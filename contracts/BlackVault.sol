// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BlackVault {
    address public owner;
    bool public paused;

    uint256 public constant DAILY_RATE = 22; // 2.2% (22 per 1000)
    uint256 public constant MAX_WITHDRAWAL = 250 ether;
    uint256 public constant CYCLE_DURATION = 86400; // 24 hours
    uint256 public constant CYCLE_START_TIME = 1718619600; // 7am Brisbane time 17 June 2024 (Unix timestamp)
    uint256 public constant REFERRAL_REWARD_PERCENT = 10; // 10%

    struct Deposit {
        uint256 amount;
        uint256 lastCycle;
        uint256 rewards;
    }

    struct Referral {
        uint256 rewards;
        uint256 referredCount;
    }

    mapping(address => Deposit) public vault;
    mapping(address => uint256) public totalWithdrawn;
    mapping(address => Referral) public referrals;

    event Deposited(address indexed user, uint256 amount, address indexed referrer);
    event Withdrawn(address indexed user, uint256 amount);
    event ReferralWithdrawn(address indexed user, uint256 amount);
    event Paused(bool state);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Vault is paused");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function deposit(address referrer) external payable notPaused {
        require(msg.value > 0, "Zero deposit");

        Deposit storage dep = vault[msg.sender];
        dep.amount += msg.value;

        dep.lastCycle = (block.timestamp - CYCLE_START_TIME) / CYCLE_DURATION;

        if (
            referrer != address(0) &&
            referrer != msg.sender &&
            vault[referrer].amount > 0
        ) {
            uint256 reward = (msg.value * REFERRAL_REWARD_PERCENT) / 100;
            referrals[referrer].rewards += reward;
            referrals[referrer].referredCount += 1;
        }

        emit Deposited(msg.sender, msg.value, referrer);
    }

    function withdraw() external notPaused {
        _updateRewards(msg.sender);
        uint256 reward = vault[msg.sender].rewards;
        require(reward > 0, "No rewards");

        uint256 withdrawAmount = reward > MAX_WITHDRAWAL ? MAX_WITHDRAWAL : reward;
        vault[msg.sender].rewards -= withdrawAmount;
        totalWithdrawn[msg.sender] += withdrawAmount;
        payable(msg.sender).transfer(withdrawAmount);

        emit Withdrawn(msg.sender, withdrawAmount);
    }

    function withdrawReferralEarnings() external notPaused {
        uint256 amount = referrals[msg.sender].rewards;
        require(amount > 0, "No referral rewards");

        referrals[msg.sender].rewards = 0;
        payable(msg.sender).transfer(amount);

        emit ReferralWithdrawn(msg.sender, amount);
    }

    function referralRewards(address user) external view returns (uint256) {
        return referrals[user].rewards;
    }

    function referredUsers(address user) external view returns (uint256) {
        return referrals[user].referredCount;
    }

    function _updateRewards(address user) internal {
        Deposit storage dep = vault[user];
        if (dep.amount == 0) return;

        uint256 currentCycle = dep.lastCycle + 2; // Simulate 2 cycles passed for local test only

        if (dep.lastCycle == 0) {
            dep.lastCycle = currentCycle;
            return;
        }

        if (currentCycle > dep.lastCycle) {
            uint256 cycles = currentCycle - dep.lastCycle;
            uint256 newRewards = (dep.amount * DAILY_RATE / 1000) * cycles;
            dep.rewards += newRewards;
            dep.lastCycle = currentCycle;
        }
    }

    function togglePause() external onlyOwner {
        paused = !paused;
        emit Paused(paused);
    }

    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
