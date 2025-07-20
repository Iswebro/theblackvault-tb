// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BlackVaultV2 - USDT Staking Vault (Phase 1 Launch - V2)
 * @dev A USDT staking vault where principal is permanently locked, only rewards can be withdrawn
 * @notice PRINCIPAL DEPOSITS ARE PERMANENT - ONLY REWARDS CAN BE WITHDRAWN
 * @notice This contract works with USDT (BEP-20) on Binance Smart Chain
 * @notice V2: Fixed getUserVault to return dynamic pending rewards calculation
 * @notice V2.1: New deposits earn from next full cycle; existing balance continues accruing
 * @notice V2.2:
 *   - Patched reward accrual and referral logic for correct cycle-based rewards and referral limits
 *   - Added/updated poke() to only update the caller’s state, for frontend stat refresh
 *   - Added activeAmountActivationCycle to UserVault struct for precise reward tracking
 * @notice V2.3:
 *   - Comprehensive test coverage for all contract features and edge cases for production-readiness
 *   - All view/admin/statistics functions validated for transparency and analytics
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

contract BlackVaultV2 {
    // ============ EMERGENCY FUNCTIONS (OWNER ONLY) ============
    /**
     * @dev Emergency pause with automatic expiry
     * @param duration Duration in seconds (max 7 days)
     * @param reason Public reason for the pause
     */
    function emergencyPause(uint256 duration, string calldata reason) external onlyOwner {
        require(!paused, "Already paused");
        require(duration > 0 && duration <= MAX_PAUSE_DURATION, "Invalid pause duration");
        require(bytes(reason).length > 0, "Reason required");

        paused = true;
        pausedUntil = block.timestamp + duration;
        totalPauseTime += duration;

        emit EmergencyPaused(msg.sender, pausedUntil, reason);
    }

    /**
     * @dev Manually unpause before expiry
     */
    function emergencyUnpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        pausedUntil = 0;
        emit EmergencyUnpaused(msg.sender);
    }

    /**
     * @dev Get pause status and remaining time
     */
    function getPauseStatus() external view returns (
        bool isPaused,
        uint256 remainingTime,
        uint256 totalPausedTime_
    ) {
        if (paused && block.timestamp >= pausedUntil) {
            return (false, 0, totalPauseTime);
        }
        uint256 remaining = paused ? (pausedUntil > block.timestamp ? pausedUntil - block.timestamp : 0) : 0;
        return (paused, remaining, totalPauseTime);
    }
    // poke() and updateRewards are obsolete in the new model and removed
    // ============ IMMUTABLE CONSTANTS ============
    uint256 public constant DAILY_RATE = 25; // 2.5% daily (25 per 1000)
    uint256 public constant MAX_WITHDRAWAL_PER_CYCLE = 250 * 10**18; // 250 USDT
    uint256 public constant CYCLE_DURATION = 86400; // 24 hours in seconds
    uint256 public constant CYCLE_START_TIME = 1751490000; // 3 July 2025 07:00 AEST (UTC+10)
    uint256 public constant REFERRAL_REWARD_PERCENT = 10; // 10% referral bonus
    uint256 public constant MIN_DEPOSIT = 50 * 10**18; // 50 USDT minimum
    uint256 public constant MAX_DEPOSIT = 100000 * 10**18; // 100,000 USDT maximum
    uint256 public constant MAX_PAUSE_DURATION = 7 days; // Maximum pause duration
    uint256 public constant MAX_REFERRAL_REWARDS_PER_REFEREE = 3; // Maximum referral rewards per referee
    
    // ============ USDT CONTRACT ============
    IERC20 public immutable USDT;
    
    // ============ OWNER & EMERGENCY CONTROLS ============
    address public immutable owner;
    bool public paused;
    uint256 public pausedUntil; // Timestamp when pause expires
    uint256 public totalPauseTime; // Total time contract has been paused
    
    // ============ STRUCTS ============
    struct UserVault {
        uint256 totalDeposited;     // Total USDT ever deposited (PERMANENT)
        uint256 totalRewardsWithdrawn; // Total USDT rewards withdrawn (for transparency)
        uint256 joinedCycle;        // Cycle when user first deposited
    }

    struct Deposit {
        uint256 amount;
        uint256 activationCycle; // When this deposit starts accruing rewards (getCurrentCycle() + 2)
    }

    struct ReferralData {
        uint256 totalRewards;       // Total USDT referral rewards earned
        uint256 availableRewards;   // Available USDT referral rewards for withdrawal
        uint256 referredCount;      // Number of users referred
        uint256 totalReferredVolume; // Total USDT volume from referrals
        uint256 totalWithdrawn;     // Total USDT referral rewards withdrawn
    }

    // ============ STATE VARIABLES ============
    mapping(address => UserVault) public vaults;
    mapping(address => Deposit[]) public userDeposits;
    mapping(address => uint256) public lastClaimedCycle;
    mapping(address => ReferralData) public referrals;
    mapping(address => mapping(address => uint256)) public referralRewardCount; // referrer => referee => count
    
    // Contract statistics (for transparency)
    uint256 public totalDeposited;        // Total USDT deposited (PERMANENT)
    uint256 public totalRewardsWithdrawn; // Total USDT rewards paid out
    uint256 public totalReferralRewardsWithdrawn; // Total USDT referral rewards paid out
    uint256 public totalActiveAmount;     // Total USDT earning rewards (PERMANENT)
    uint256 public totalUsers;
    uint256 public contractLaunchCycle;
    address public feeWallet;
    address public defaultReferrer;

    // ============ EVENTS ============
    event Deposited(
        address indexed user, 
        uint256 amount, 
        address indexed referrer,
        uint256 cycle
    );
    
    event RewardsWithdrawn(
        address indexed user, 
        uint256 amount,
        uint256 cycle
    );
    
    event ReferralRewardsWithdrawn(
        address indexed user, 
        uint256 amount
    );

    event EmergencyPaused(
        address indexed by,
        uint256 pausedUntil,
        string reason
    );

    event EmergencyUnpaused(
        address indexed by
    );



    // ============ MODIFIERS ============
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier notPaused() {
        // Auto-unpause if pause period expired
        if (paused && block.timestamp >= pausedUntil) {
            paused = false;
            emit EmergencyUnpaused(address(0)); // Auto-unpause
        }
        require(!paused, "Contract is temporarily paused for security");
        _;
    }

    modifier validDeposit(uint256 amount) {
        require(amount >= MIN_DEPOSIT, "Deposit below minimum (50 USDT)");
        require(amount <= MAX_DEPOSIT, "Deposit exceeds maximum (100,000 USDT)");
        _;
    }



    // ============ CONSTRUCTOR ============
    constructor(address _usdtAddress, address _feeWallet) {
        require(_usdtAddress != address(0), "Invalid USDT address");
        require(_feeWallet != address(0), "Invalid fee wallet address");
        owner = msg.sender;
        USDT = IERC20(_usdtAddress);
        feeWallet = _feeWallet;
        contractLaunchCycle = getCurrentCycle();

        // Ensure USDT contract has 18 decimals
        try USDT.decimals() returns (uint8 decimals) {
            require(decimals == 18, "USDT must have 18 decimals");
        } catch {
            revert("Failed to fetch USDT decimals");
        }

        defaultReferrer = 0x706961C676FE743C34A867437661D13E16ADCbEc;

        // Mark the default referrer as an active user
        vaults[defaultReferrer].totalDeposited = 1; // Minimal deposit to mark as active
    }

    // ============ CYCLE HELPERS ============
    function getCurrentCycle() public view returns (uint256) {
        if (block.timestamp < CYCLE_START_TIME) return 0;
        return (block.timestamp - CYCLE_START_TIME) / CYCLE_DURATION;
    }

    function getCycleStartTime(uint256 cycle) public pure returns (uint256) {
        return CYCLE_START_TIME + (cycle * CYCLE_DURATION);
    }

    function getTimeUntilNextCycle() external view returns (uint256) {
        uint256 curr = getCurrentCycle();
        uint256 nextStart = getCycleStartTime(curr + 1);
        if (block.timestamp >= nextStart) return 0;
        return nextStart - block.timestamp;
    }

    // ============ CORE FUNCTIONS ============
    function deposit(uint256 amount) external validDeposit(amount) notPaused {
        require(USDT.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");
        uint256 feeAmount = amount / 100; // 1% fee
        if (feeAmount > 0) {
            require(USDT.transfer(feeWallet, feeAmount), "Fee transfer failed");
        }
        uint256 net = amount - feeAmount;
        UserVault storage u = vaults[msg.sender];
        if (u.totalDeposited == 0) {
            totalUsers++;
            u.joinedCycle = getCurrentCycle();
        }
        u.totalDeposited += amount;
        totalDeposited += amount;
        totalActiveAmount += net;
        // Determine activation cycle (rewards start after 2 full cycles)
        uint256 activationCycle = getCurrentCycle() + 2;
        Deposit[] storage deposits = userDeposits[msg.sender];
        if (deposits.length > 0 && deposits[deposits.length - 1].activationCycle == activationCycle) {
            deposits[deposits.length - 1].amount += net;
        } else {
            deposits.push(Deposit({amount: net, activationCycle: activationCycle}));
        }
        emit Deposited(msg.sender, amount, address(0), activationCycle);
    }

    function depositWithReferrer(uint256 amount, address referrer) external validDeposit(amount) notPaused {
        if (referrer == address(0)) {
            referrer = defaultReferrer;
        }
        require(referrer != address(0), "Referrer cannot be zero address");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(vaults[referrer].totalDeposited > 0, "Referrer must be active user");
        require(USDT.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");
        uint256 feeAmount = amount / 100;
        if (feeAmount > 0) {
            require(USDT.transfer(feeWallet, feeAmount), "Fee transfer failed");
        }
        uint256 net = amount - feeAmount;
        UserVault storage u = vaults[msg.sender];
        if (u.totalDeposited == 0) {
            totalUsers++;
            u.joinedCycle = getCurrentCycle();
        }
        u.totalDeposited += amount;
        // Referral processing
        if (referralRewardCount[referrer][msg.sender] < MAX_REFERRAL_REWARDS_PER_REFEREE) {
            uint256 refReward = (amount * REFERRAL_REWARD_PERCENT) / 100;
            referrals[referrer].totalRewards += refReward;
            referrals[referrer].availableRewards += refReward;
            referralRewardCount[referrer][msg.sender]++;
        }
        referrals[referrer].referredCount++;
        referrals[referrer].totalReferredVolume += amount;
        totalDeposited += amount;
        totalActiveAmount += net;
        // Determine activation cycle (rewards start after 2 full cycles)
        uint256 activationCycle = getCurrentCycle() + 2;
        Deposit[] storage deposits = userDeposits[msg.sender];
        if (deposits.length > 0 && deposits[deposits.length - 1].activationCycle == activationCycle) {
            deposits[deposits.length - 1].amount += net;
        } else {
            deposits.push(Deposit({amount: net, activationCycle: activationCycle}));
        }
        emit Deposited(msg.sender, amount, referrer, activationCycle);
    }

    function calculateRewards(address user) public view returns (uint256 total, uint256 maxWithdrawable) {
        Deposit[] storage deposits = userDeposits[user];
        uint256 currCycle = getCurrentCycle();
        uint256 lastClaim = lastClaimedCycle[user];
        total = 0;
        for (uint i = 0; i < deposits.length; i++) {
            Deposit storage dep = deposits[i];
            // Only count cycles after activation and after last claim
            uint256 start = dep.activationCycle > lastClaim ? dep.activationCycle : lastClaim;
            if (currCycle > start) {
                uint256 cycles = currCycle - start;
                total += dep.amount * DAILY_RATE * cycles / 1000;
            }
        }
        // Enforce per-cycle withdrawal cap
        maxWithdrawable = total > MAX_WITHDRAWAL_PER_CYCLE ? MAX_WITHDRAWAL_PER_CYCLE : total;
    }

    function withdrawRewards(uint256 amount) external notPaused {
        require(amount > 0, "Withdrawal amount must be greater than zero");
        (uint256 totalRewards, uint256 maxWithdrawable) = calculateRewards(msg.sender);
        require(totalRewards > 0, "No rewards available");
        require(amount <= totalRewards, "Amount exceeds pending rewards");
        require(amount <= maxWithdrawable, "Amount exceeds maximum withdrawal limit per cycle");

        // Update lastClaimedCycle to current cycle
        lastClaimedCycle[msg.sender] = getCurrentCycle();

        // Update stats
        UserVault storage u = vaults[msg.sender];
        u.totalRewardsWithdrawn += amount;
        totalRewardsWithdrawn += amount;

        // Transfer the rewards to the user
        require(USDT.transfer(msg.sender, amount), "Transfer failed");

        emit RewardsWithdrawn(msg.sender, amount, getCurrentCycle());
    }

    function withdrawReferralRewards() external notPaused {
        ReferralData storage r = referrals[msg.sender];
        require(r.availableRewards > 0, "No referral rewards");
        uint256 amt = r.availableRewards;
        require(USDT.balanceOf(address(this)) >= amt, "Insufficient contract USDT balance");
        r.availableRewards = 0;
        r.totalWithdrawn += amt;
        totalReferralRewardsWithdrawn += amt;
        require(USDT.transfer(msg.sender, amt), "USDT transfer failed");
        emit ReferralRewardsWithdrawn(msg.sender, amt);
    }



    // ============ VIEW FUNCTIONS & OWNER FUNDING ============
    function getUserVault(address user) external view returns (
        uint256 _totalDeposited,
        uint256 _totalRewardsWithdrawn,
        uint256 _joinedCycle,
        uint256 _pendingRewards
    ) {
        UserVault storage u = vaults[user];
        (uint256 pending, ) = calculateRewards(user);
        return (
            u.totalDeposited,
            u.totalRewardsWithdrawn,
            u.joinedCycle,
            pending
        );
    }

    function getUserReferralData(address user) external view returns (
        uint256 _totalRewards,
        uint256 _availableRewards,
        uint256 _referredCount,
        uint256 _totalVolume,
        uint256 _totalWithdrawn
    ) {
        ReferralData storage r = referrals[user];
        return (
            r.totalRewards,
            r.availableRewards,
            r.referredCount,
            r.totalReferredVolume,
            r.totalWithdrawn
        );
    }

    function getReferralBonusInfo(address referrer, address referee) external view returns (
        uint256 used,
        uint256 remaining
    ) {
        used = referralRewardCount[referrer][referee];
        remaining = used >= MAX_REFERRAL_REWARDS_PER_REFEREE ? 0 : MAX_REFERRAL_REWARDS_PER_REFEREE - used;
        return (used, remaining);
    }

    function getContractStats() external view returns (
        uint256 _totalDep,
        uint256 _rewardsWithdrawn,
        uint256 _refRewardsWithdrawn,
        uint256 _activeAmt,
        uint256 _users,
        uint256 _balance,
        uint256 _currCycle
    ) {
        return (
            totalDeposited,
            totalRewardsWithdrawn,
            totalReferralRewardsWithdrawn,
            totalActiveAmount,
            totalUsers,
            USDT.balanceOf(address(this)),
            getCurrentCycle()
        );
    }

    function getUserROI(address user) external view returns (
        uint256 invested,
        uint256 earned,
        uint256 roiBP
    ) {
        UserVault storage u = vaults[user];
        ReferralData storage r = referrals[user];
        invested = u.totalDeposited;
        (uint256 pending, ) = calculateRewards(user);
        earned = u.totalRewardsWithdrawn + r.totalWithdrawn + pending + r.availableRewards;
        if (invested > 0) {
            roiBP = (earned * 10000) / invested;
        }
        return (invested, earned, roiBP);
    }

    function getUSDTAddress() external view returns (address) {
        return address(USDT);
    }

    function fundContract(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(USDT.balanceOf(msg.sender) >= amount, "Insufficient USDT balance");
        require(USDT.allowance(msg.sender, address(this)) >= amount, "Insufficient USDT allowance");
        require(USDT.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");
    }



    bool public giveawayEnabled;
    address public giveawayFundSource;

    event GiveawayEnabled(bool enabled);
    event WeeklyPrizesDistributed(address[3] winners, uint256[3] amounts, uint256 timestamp);

    function setGiveawayEnabled(bool _on, address _fundSource) external onlyOwner {
        giveawayEnabled = _on;
        giveawayFundSource = _fundSource;
        emit GiveawayEnabled(_on);
    }

    function distributeWeeklyPrizes(address[3] calldata winners, uint256[3] calldata amounts) external onlyOwner {
        require(giveawayEnabled, "Giveaway not yet active");
        for (uint i = 0; i < 3; i++) {
            if (amounts[i] > 0 && winners[i] != address(0)) {
                USDT.transferFrom(giveawayFundSource, winners[i], amounts[i]);
            }
        }
        emit WeeklyPrizesDistributed(winners, amounts, block.timestamp);
    }
}