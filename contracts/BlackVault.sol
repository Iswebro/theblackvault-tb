// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BlackVaultV2 - USDT Staking Vault (Phase 1 Launch - V2)
 * @dev A USDT staking vault where principal is permanently locked, only rewards can be withdrawn
 * @notice PRINCIPAL DEPOSITS ARE PERMANENT - ONLY REWARDS CAN BE WITHDRAWN
 * @notice This contract works with USDT (BEP-20) on Binance Smart Chain
 * @notice V2: Fixed getUserVault to return dynamic pending rewards calculation
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
    // ============ IMMUTABLE CONSTANTS ============
    uint256 public constant DAILY_RATE = 25; // 2.5% daily (25 per 1000)
    uint256 public constant MAX_WITHDRAWAL_PER_CYCLE = 250 * 10**18; // 250 USDT (18 decimals)
    uint256 public constant CYCLE_DURATION = 86400; // 24 hours in seconds
    uint256 public constant CYCLE_START_TIME = 1751478000; // 3 July 2025 07:00 AEST
    uint256 public constant REFERRAL_REWARD_PERCENT = 10; // 10% referral bonus
    uint256 public constant MIN_DEPOSIT = 50 * 10**18; // 50 USDT minimum
    uint256 public constant MAX_DEPOSIT = 100000 * 10**18; // 100,000 USDT maximum
    uint256 public constant MAX_PAUSE_DURATION = 7 days; // Maximum pause duration
    uint256 public constant MAX_REFERRAL_REWARDS_PER_REFEREE = 3; // Maximum referral rewards per referee
    
    // ============ USDT CONTRACT ============
    IERC20 public immutable USDT;
    
    // BSC Mainnet USDT: 0x55d398326f99059fF775485246999027B3197955
    // BSC Testnet USDT: 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd (or deploy your own)
    
    // ============ OWNER & EMERGENCY CONTROLS ============
    address public immutable owner;
    bool public paused;
    uint256 public pausedUntil; // Timestamp when pause expires
    uint256 public totalPauseTime; // Total time contract has been paused
    
    // ============ STRUCTS ============
    struct UserVault {
        uint256 totalDeposited;     // Total USDT ever deposited (PERMANENT)
        uint256 activeAmount;       // Currently active USDT earning rewards (PERMANENT)
        uint256 lastAccrualCycle;   // Last cycle when rewards were calculated
        uint256 pendingRewards;     // Accumulated USDT rewards ready for withdrawal
        uint256 totalRewardsWithdrawn; // Total USDT rewards withdrawn (for transparency)
        uint256 joinedCycle;        // Cycle when user first deposited
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

    /// @dev Emitted when the owner tops up a user's pendingRewards in an emergency
    event EmergencyRewarded(address indexed user, uint256 amount);

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

    modifier updateRewards() {
        _updateUserRewards(msg.sender);
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
        
        // Verify USDT contract
        require(USDT.decimals() == 18, "USDT must have 18 decimals");
    }

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
        
        uint256 remaining = paused ? pausedUntil - block.timestamp : 0;
        return (paused, remaining, totalPauseTime);
    }

    /**
     * @dev Update fee wallet address (owner only)
     * @param _newFeeWallet New fee wallet address
     */
    function setFeeWallet(address _newFeeWallet) external onlyOwner {
        require(_newFeeWallet != address(0), "Invalid fee wallet address");
        feeWallet = _newFeeWallet;
    }

    // ============ CORE FUNCTIONS ============
    
    /**
     * @dev Deposit USDT into the vault (PERMANENT DEPOSIT)
     * @notice ⚠️ DEPOSITS ARE PERMANENT - PRINCIPAL CANNOT BE WITHDRAWN
     * @notice User must approve USDT spending before calling this function
     * @param amount Amount of USDT to deposit (in wei, 18 decimals)
     */
    function deposit(uint256 amount) external validDeposit(amount) notPaused updateRewards {
        require(USDT.balanceOf(msg.sender) >= amount, "Insufficient USDT balance");
        require(USDT.allowance(msg.sender, address(this)) >= amount, "Insufficient USDT allowance");

        UserVault storage user = vaults[msg.sender];
        
        // First time depositor
        if (user.totalDeposited == 0) {
            totalUsers++;
            user.joinedCycle = getCurrentCycle();
        }

        uint256 currentCycle = getCurrentCycle();
        
        // Deposits made after cycle start earn from next cycle
        uint256 effectiveCycle = currentCycle;
        if (block.timestamp > getCycleStartTime(currentCycle)) {
            effectiveCycle = currentCycle + 1;
        }

        // Transfer USDT from user to contract
        require(USDT.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");

        // Collect 1% deposit fee to fee wallet
        uint256 feeAmount = amount / 100; // 1% fee
        if (feeAmount > 0) {
            require(USDT.transfer(feeWallet, feeAmount), "Fee transfer failed");
        }

        uint256 netAmount = amount - feeAmount; // Calculate net amount after fee

        user.totalDeposited += amount; // totalDeposited should still be the gross amount
        user.activeAmount += netAmount; // activeAmount should be the net amount
        user.lastAccrualCycle = effectiveCycle;

        totalDeposited += amount; // totalDeposited (contract-wide) should still be gross
        totalActiveAmount += netAmount; // totalActiveAmount (contract-wide) should be net

        emit Deposited(msg.sender, amount, address(0), effectiveCycle);
    }

    /**
     * @dev Deposit USDT with referrer (PERMANENT DEPOSIT)
     * @notice ⚠️ DEPOSITS ARE PERMANENT - PRINCIPAL CANNOT BE WITHDRAWN
     * @param amount Amount of USDT to deposit (in wei, 18 decimals)
     * @param referrer Address of the referrer
     */
    function depositWithReferrer(uint256 amount, address referrer) 
        external 
        validDeposit(amount) 
        notPaused 
        updateRewards 
    {
        require(referrer != msg.sender, "Cannot refer yourself");
        require(referrer != address(0), "Invalid referrer");
        require(vaults[referrer].totalDeposited > 0, "Referrer must be active user");
        require(USDT.balanceOf(msg.sender) >= amount, "Insufficient USDT balance");
        require(USDT.allowance(msg.sender, address(this)) >= amount, "Insufficient USDT allowance");

        UserVault storage user = vaults[msg.sender];
        
        // First time depositor
        if (user.totalDeposited == 0) {
            totalUsers++;
            user.joinedCycle = getCurrentCycle();
        }

        uint256 currentCycle = getCurrentCycle();
        
        // Deposits made after cycle start earn from next cycle
        uint256 effectiveCycle = currentCycle;
        if (block.timestamp > getCycleStartTime(currentCycle)) {
            effectiveCycle = currentCycle + 1;
        }

        // Transfer USDT from user to contract
        require(USDT.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");

        // Collect 1% deposit fee to fee wallet
        uint256 feeAmount = amount / 100; // 1% fee
        if (feeAmount > 0) {
            require(USDT.transfer(feeWallet, feeAmount), "Fee transfer failed");
        }

        uint256 netAmount = amount - feeAmount; // Calculate net amount after fee

        user.totalDeposited += amount; // totalDeposited should still be the gross amount
        user.activeAmount += netAmount; // activeAmount should be the net amount
        user.lastAccrualCycle = effectiveCycle;

        // Process referral reward (only for referee's first 3 deposits to this referrer)
        if (referralRewardCount[referrer][msg.sender] < MAX_REFERRAL_REWARDS_PER_REFEREE) {
            uint256 referralReward = (amount * REFERRAL_REWARD_PERCENT) / 100;
            ReferralData storage refDataForReward = referrals[referrer];
            refDataForReward.totalRewards += referralReward;
            refDataForReward.availableRewards += referralReward;
            referralRewardCount[referrer][msg.sender] += 1;
        }
        
        // Always update referral stats regardless of reward eligibility
        ReferralData storage refDataForStats = referrals[referrer];
        refDataForStats.referredCount++;
        refDataForStats.totalReferredVolume += amount;

        totalDeposited += amount; // totalDeposited (contract-wide) should still be gross
        totalActiveAmount += netAmount; // totalActiveAmount (contract-wide) should be net

        emit Deposited(msg.sender, amount, referrer, effectiveCycle);
    }

    /**
     * @dev Withdraw accumulated USDT rewards ONLY
     * @notice Only rewards can be withdrawn, never principal
     */
    function withdrawRewards() external notPaused updateRewards {
        UserVault storage user = vaults[msg.sender];
        require(user.pendingRewards > 0, "No rewards available");

        uint256 withdrawAmount = user.pendingRewards;
        if (withdrawAmount > MAX_WITHDRAWAL_PER_CYCLE) {
            withdrawAmount = MAX_WITHDRAWAL_PER_CYCLE;
        }

        require(USDT.balanceOf(address(this)) >= withdrawAmount, "Insufficient contract USDT balance");

        user.pendingRewards -= withdrawAmount;
        user.totalRewardsWithdrawn += withdrawAmount;
        totalRewardsWithdrawn += withdrawAmount;

        require(USDT.transfer(msg.sender, withdrawAmount), "USDT transfer failed");

        emit RewardsWithdrawn(msg.sender, withdrawAmount, getCurrentCycle());
    }

    /**
     * @dev Withdraw USDT referral earnings
     */
    function withdrawReferralRewards() external notPaused {
        ReferralData storage refData = referrals[msg.sender];
        require(refData.availableRewards > 0, "No referral rewards");

        uint256 amount = refData.availableRewards;
        require(USDT.balanceOf(address(this)) >= amount, "Insufficient contract USDT balance");

        refData.availableRewards = 0;
        refData.totalWithdrawn += amount;
        totalReferralRewardsWithdrawn += amount;

        require(USDT.transfer(msg.sender, amount), "USDT transfer failed");

        emit ReferralRewardsWithdrawn(msg.sender, amount);
    }

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get current cycle number
     */
    function getCurrentCycle() public view returns (uint256) {
        if (block.timestamp < CYCLE_START_TIME) {
            return 0;
        }
        return (block.timestamp - CYCLE_START_TIME) / CYCLE_DURATION;
    }

    /**
     * @dev Get cycle start time for a specific cycle
     */
    function getCycleStartTime(uint256 cycle) public pure returns (uint256) {
        return CYCLE_START_TIME + (cycle * CYCLE_DURATION);
    }

    /**
     * @dev Get time until next cycle
     */
    function getTimeUntilNextCycle() external view returns (uint256) {
        uint256 currentCycle = getCurrentCycle();
        uint256 nextCycleStart = getCycleStartTime(currentCycle + 1);
        if (block.timestamp >= nextCycleStart) {
            return 0;
        }
        return nextCycleStart - block.timestamp;
    }

    /**
     * @dev Get user's vault information
     * @notice V2: Returns dynamic pending rewards calculation
     * @notice Frontend should use this function, not raw vaults[user] mapping
     */
    function getUserVault(address user) external view returns (
        uint256 userTotalDeposited,
        uint256 activeAmount,
        uint256 pendingRewards,
        uint256 userTotalRewardsWithdrawn,
        uint256 lastAccrualCycle,
        uint256 joinedCycle
    ) {
        UserVault storage vault = vaults[user];
        
        // V2: Compute dynamic pending = stored + missed cycles
        uint256 owed = vault.pendingRewards;
        uint256 currentCycle = getCurrentCycle();
        if (currentCycle > vault.lastAccrualCycle) {
            uint256 cyclesPassed = currentCycle - vault.lastAccrualCycle;
            owed += (vault.activeAmount * DAILY_RATE * cyclesPassed) / 1000;
        }
        
        return (
            vault.totalDeposited,
            vault.activeAmount,
            owed, // Dynamic pending rewards
            vault.totalRewardsWithdrawn,
            vault.lastAccrualCycle,
            vault.joinedCycle
        );
    }

    /**
     * @dev Get user's referral information
     */
    function getUserReferralData(address user) external view returns (
        uint256 totalRewards,
        uint256 availableRewards,
        uint256 referredCount,
        uint256 totalReferredVolume,
        uint256 totalWithdrawn
    ) {
        ReferralData storage refData = referrals[user];
        return (
            refData.totalRewards,
            refData.availableRewards,
            refData.referredCount,
            refData.totalReferredVolume,
            refData.totalWithdrawn
        );
    }

    /**
     * @dev Get referral bonus count for a specific referrer-referee pair
     * @param referrer The referrer address
     * @param referee The referee address
     * @return bonusesUsed Number of bonuses already used (0-3)
     * @return bonusesRemaining Number of bonuses remaining (3-0)
     */
    function getReferralBonusInfo(address referrer, address referee) external view returns (
        uint256 bonusesUsed,
        uint256 bonusesRemaining
    ) {
        bonusesUsed = referralRewardCount[referrer][referee];
        bonusesRemaining = bonusesUsed >= MAX_REFERRAL_REWARDS_PER_REFEREE ? 0 : MAX_REFERRAL_REWARDS_PER_REFEREE - bonusesUsed;
        return (bonusesUsed, bonusesRemaining);
    }

    /**
     * @dev Get contract statistics
     */
    function getContractStats() external view returns (
        uint256 _totalDeposited,
        uint256 _totalRewardsWithdrawn,
        uint256 _totalReferralRewardsWithdrawn,
        uint256 _totalActiveAmount,
        uint256 _totalUsers,
        uint256 _contractBalance,
        uint256 _currentCycle
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

    /**
     * @dev Calculate user's lifetime ROI
     * @notice V2: Includes dynamic pending rewards in calculation
     * @notice Frontend should use this function for accurate ROI display
     */
    function getUserROI(address user) external view returns (
        uint256 totalInvested,
        uint256 totalEarned,
        uint256 roiPercentage
    ) {
        UserVault storage vault = vaults[user];
        ReferralData storage refData = referrals[user];
        
        // Renamed local variables to avoid shadowing state variables
        uint256 userVaultTotalDeposited = vault.totalDeposited;
        uint256 userVaultTotalRewardsWithdrawn = vault.totalRewardsWithdrawn;

        totalInvested = userVaultTotalDeposited;
        
        // Include dynamic pending rewards
        uint256 dynamicPending = vault.pendingRewards;
        uint256 cc = getCurrentCycle();
        if (cc > vault.lastAccrualCycle) {
            dynamicPending += (vault.activeAmount * DAILY_RATE * (cc - vault.lastAccrualCycle)) / 1000;
        }
        totalEarned = userVaultTotalRewardsWithdrawn + refData.totalWithdrawn + dynamicPending + refData.availableRewards;
        
        if (totalInvested > 0) {
            roiPercentage = (totalEarned * 10000) / totalInvested; // ROI in basis points (100 = 1%)
        }
        
        return (totalInvested, totalEarned, roiPercentage);
    }

    /**
     * @dev Get USDT contract address
     */
    function getUSDTAddress() external view returns (address) {
        return address(USDT);
    }

    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @dev Update user's pending rewards based on cycles passed
     */
    function _updateUserRewards(address userAddress) internal {
        UserVault storage user = vaults[userAddress];
        
        if (user.activeAmount == 0) {
            return;
        }

        uint256 currentCycle = getCurrentCycle();
        
        if (currentCycle > user.lastAccrualCycle) {
            uint256 cyclesPassed = currentCycle - user.lastAccrualCycle;
            uint256 newRewards = (user.activeAmount * DAILY_RATE * cyclesPassed) / 1000;
            
            user.pendingRewards += newRewards;
            user.lastAccrualCycle = currentCycle;
        }
    }

    // ============ OWNER FUNDING FUNCTIONS ============
    
    /**
     * @dev Owner can fund the contract with USDT for rewards
     * @notice This is how the contract gets USDT to pay rewards
     */
    function fundContract(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(USDT.balanceOf(msg.sender) >= amount, "Insufficient USDT balance");
        require(USDT.allowance(msg.sender, address(this)) >= amount, "Insufficient USDT allowance");
        
        require(USDT.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");
    }

    /**
     * @dev Emergency micro-reward to top up a user's pendingRewards
     *      without changing their activeAmount. Owner only.
     * @notice This function is reentrancy-safe as it only modifies storage and emits events
     * @notice No external calls are made, making reentrancy protection unnecessary
     */
    function emergencyReward(address user, uint256 amount) external onlyOwner notPaused {
        require(amount > 0, "Amount must be > 0");
        UserVault storage v = vaults[user];
        v.pendingRewards += amount;
        emit EmergencyRewarded(user, amount);
    }

    // ============ WEEKLY GIVEAWAY (disabled by default) ============
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
