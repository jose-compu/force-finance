// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title MockSAVAX - Mock implementation of sAVAX token
 * @dev Implements the real ISAVAXToken interface for testing
 *      Includes staking rewards and exchange rate functionality
 */
contract MockSAVAX is ERC20, AccessControl {
    using Math for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant YIELD_ROLE = keccak256("YIELD_ROLE");
    bytes32 public constant REWARDS_ROLE = keccak256("REWARDS_ROLE");

    // Exchange rate tracking (1e18 scale)
    uint256 public exchangeRate = 1e18; // Initial rate: 1 sAVAX = 1 AVAX
    uint256 public lastUpdateTime;

    // Staking rewards tracking
    mapping(address => uint256) public userRewards;
    mapping(address => uint256) public lastRewardCheckpoint;
    uint256 public totalRewardsDistributed;
    uint256 public rewardRate = 1e16; // 1% per block (for testing)

    // Withdrawal requests
    struct WithdrawalRequest {
        uint256 amount;
        uint256 timestamp;
        bool claimed;
    }
    mapping(address => WithdrawalRequest[]) public withdrawalRequests;

    // Events
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);
    event RewardsDistributed(address indexed user, uint256 amount);
    event WithdrawalRequested(address indexed user, uint256 amount, uint256 shares);
    event WithdrawalClaimed(address indexed user, uint256 amount);

    constructor() ERC20("Staked AVAX", "sAVAX") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(YIELD_ROLE, msg.sender);
        _grantRole(REWARDS_ROLE, msg.sender);
        lastUpdateTime = block.timestamp;
    }

    // ===== Basic ERC20 Functions =====
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    // ===== ISAVAXToken Interface Implementation =====

    /**
     * @dev Get the amount of AVAX that corresponds to `_sharesAmount` token shares.
     */
    function getPooledAvaxByShares(uint256 _sharesAmount) external view returns (uint256) {
        return (_sharesAmount * exchangeRate) / 1e18;
    }

    /**
     * @dev Get the amount of shares that corresponds to `_avaxAmount` protocol-controlled AVAX.
     */
    function getSharesByPooledAvax(uint256 _avaxAmount) external view returns (uint256) {
        return (_avaxAmount * 1e18) / exchangeRate;
    }

    /**
     * @dev Get total amount of AVAX controlled by the protocol
     */
    function getTotalPooledAvax() external view returns (uint256) {
        return (totalSupply() * exchangeRate) / 1e18;
    }

    /**
     * @dev Get total amount of shares issued
     */
    function getTotalShares() external view returns (uint256) {
        return totalSupply();
    }

    /**
     * @dev Submit AVAX for staking and receive sAVAX shares
     */
    function submit() external payable returns (uint256 shares) {
        require(msg.value > 0, "Must submit AVAX");
        
        shares = (msg.value * 1e18) / exchangeRate;
        _mint(msg.sender, shares);
        
        // Update rewards checkpoint
        _updateRewards(msg.sender);
        
        return shares;
    }

    /**
     * @dev Request withdrawal of AVAX by burning sAVAX shares
     */
    function requestWithdrawal(uint256 _amount) external returns (uint256 shares) {
        require(_amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= _amount, "Insufficient sAVAX balance");
        
        shares = _amount;
        _burn(msg.sender, shares);
        
        // Create withdrawal request
        uint256 avaxAmount = (shares * exchangeRate) / 1e18;
        withdrawalRequests[msg.sender].push(WithdrawalRequest({
            amount: avaxAmount,
            timestamp: block.timestamp,
            claimed: false
        }));
        
        emit WithdrawalRequested(msg.sender, avaxAmount, shares);
        return shares;
    }

    /**
     * @dev Claim pending withdrawals
     */
    function claimWithdrawal(address _recipient) external {
        require(_recipient != address(0), "Invalid recipient");
        
        WithdrawalRequest[] storage requests = withdrawalRequests[msg.sender];
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < requests.length; i++) {
            if (!requests[i].claimed) {
                totalAmount += requests[i].amount;
                requests[i].claimed = true;
            }
        }
        
        require(totalAmount > 0, "No pending withdrawals");
        
        // In a real implementation, this would transfer AVAX
        // For mock, we just emit the event
        emit WithdrawalClaimed(_recipient, totalAmount);
    }

    /**
     * @dev Get exchange rate: sAVAX to AVAX
     */
    function getExchangeRate() external view returns (uint256 rate) {
        return exchangeRate;
    }

    // ===== Rewards System =====

    /**
     * @dev Update rewards for a user
     */
    function _updateRewards(address user) internal {
        if (balanceOf(user) > 0) {
            uint256 blocksSinceLastCheckpoint = block.number - lastRewardCheckpoint[user];
            uint256 newRewards = (balanceOf(user) * rewardRate * blocksSinceLastCheckpoint) / 1e18;
            
            if (newRewards > 0) {
                userRewards[user] += newRewards;
                totalRewardsDistributed += newRewards;
                emit RewardsDistributed(user, newRewards);
            }
        }
        
        lastRewardCheckpoint[user] = block.number;
    }

    /**
     * @dev Get claimable rewards for a user
     */
    function getClaimableRewards(address user) external view returns (uint256) {
        uint256 currentRewards = userRewards[user];
        
        if (balanceOf(user) > 0) {
            uint256 blocksSinceLastCheckpoint = block.number - lastRewardCheckpoint[user];
            uint256 newRewards = (balanceOf(user) * rewardRate * blocksSinceLastCheckpoint) / 1e18;
            currentRewards += newRewards;
        }
        
        return currentRewards;
    }

    /**
     * @dev Claim rewards for a user
     */
    function claimRewards(address user) external onlyRole(REWARDS_ROLE) returns (uint256) {
        _updateRewards(user);
        uint256 claimableAmount = userRewards[user];
        
        if (claimableAmount > 0) {
            userRewards[user] = 0;
            // In a real implementation, this would mint reward tokens
            // For mock, we just return the amount
        }
        
        return claimableAmount;
    }

    // ===== Testing Functions =====

    /**
     * @dev Simulate yield by increasing exchange rate
     */
    function simulateYield(uint256 yieldBps) external onlyRole(YIELD_ROLE) {
        uint256 oldRate = exchangeRate;
        uint256 yieldMultiplier = 1e18 + (yieldBps * 1e14); // Convert bps to multiplier
        exchangeRate = (exchangeRate * yieldMultiplier) / 1e18;
        lastUpdateTime = block.timestamp;
        
        emit ExchangeRateUpdated(oldRate, exchangeRate);
    }

    /**
     * @dev Simulate yield and return the growth amount for a given portfolio size
     * This is useful for testing the strategy's yield distribution
     */
    function simulateYieldForPortfolio(uint256 yieldBps, uint256 portfolioSize) external onlyRole(YIELD_ROLE) returns (uint256 growthAmount) {
        uint256 oldRate = exchangeRate;
        uint256 yieldMultiplier = 1e18 + (yieldBps * 1e14);
        exchangeRate = (exchangeRate * yieldMultiplier) / 1e18;
        lastUpdateTime = block.timestamp;
        
        // Calculate the growth amount that would be distributed to FUSD holders
        growthAmount = (portfolioSize * (exchangeRate - oldRate)) / 1e18;
        
        emit ExchangeRateUpdated(oldRate, exchangeRate);
        return growthAmount;
    }

    /**
     * @dev Set exchange rate directly (for testing)
     */
    function setExchangeRate(uint256 newRate) external onlyRole(YIELD_ROLE) {
        uint256 oldRate = exchangeRate;
        exchangeRate = newRate;
        lastUpdateTime = block.timestamp;
        
        emit ExchangeRateUpdated(oldRate, exchangeRate);
    }

    /**
     * @dev Set reward rate (for testing)
     */
    function setRewardRate(uint256 newRate) external onlyRole(REWARDS_ROLE) {
        rewardRate = newRate;
    }

    /**
     * @dev Get current yield rate (for testing)
     */
    function getCurrentYieldRate() external view returns (uint256) {
        return exchangeRate;
    }

    /**
     * @dev Get user's pending withdrawal requests
     */
    function getWithdrawalRequests(address user) external view returns (WithdrawalRequest[] memory) {
        return withdrawalRequests[user];
    }

    /**
     * @dev Get total pending withdrawals for a user
     */
    function getTotalPendingWithdrawals(address user) external view returns (uint256) {
        WithdrawalRequest[] storage requests = withdrawalRequests[user];
        uint256 total = 0;
        
        for (uint256 i = 0; i < requests.length; i++) {
            if (!requests[i].claimed) {
                total += requests[i].amount;
            }
        }
        
        return total;
    }
}
