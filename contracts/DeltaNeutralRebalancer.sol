// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IGMXRouter.sol";

/**
 * @title DeltaNeutralRebalancer
 * @dev Advanced rebalancing system for maintaining delta-neutral positions
 *      Includes liquidation protection, profit-taking, and incentivized keepers
 */
contract DeltaNeutralRebalancer is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant STRATEGY_ROLE = keccak256("STRATEGY_ROLE");

    // Core contracts
    address public immutable strategy;
    address public immutable gmxFuturesManager; // Replaces positionManager
    address public immutable oracleManager;
    address public immutable gmxRouter;
    address public immutable gmxVault;

    // Rebalancing thresholds (basis points)
    uint256 public deltaThreshold = 300; // 3% delta deviation triggers rebalance (less reactive to reduce costs)
    uint256 public liquidationBuffer = 1000; // 10% buffer from liquidation (increased for flash crash protection)
    uint256 public profitThreshold = 1000; // 10% profit triggers partial closing
    uint256 public emergencyThreshold = 1500; // 15% deviation for emergency

    // Timing parameters
    uint256 public minRebalanceInterval = 1800; // 30 minutes minimum
    uint256 public maxRebalanceInterval = 86400; // 24 hours maximum
    uint256 public lastRebalanceTime;

    // Keeper incentives
    uint256 public keeperRewardBps = 50; // 0.5% of rebalanced amount
    uint256 public maxKeeperReward = 100e18; // Max 100 tokens reward
    mapping(address => uint256) public keeperRewards;
    mapping(address => uint256) public keeperStats; // Successful rebalances

    // Position tracking
    struct PositionInfo {
        uint256 sAvaxAmount;        // Long sAVAX exposure
        uint256 shortAvaxNotional; // Short AVAX notional value
        uint256 currentDelta;      // Current delta (basis points)
        uint256 liquidationPrice;  // Price at which position gets liquidated
        uint256 unrealizedPnL;     // Current unrealized PnL
        uint256 lastUpdateTime;    // Last position update
        bool needsRebalance;       // Flag indicating rebalance needed
    }

    PositionInfo public currentPosition;

    // Events
    event RebalanceTriggered(
        address indexed keeper,
        uint256 deltaDeviation,
        uint256 rebalanceAmount,
        uint256 keeperReward,
        string reason
    );
    
    event ProfitTaken(
        uint256 profitAmount,
        uint256 newSAvaxPurchased,
        uint256 newShortOpened
    );
    
    event EmergencyRebalance(
        uint256 deltaDeviation,
        uint256 liquidationRisk,
        string action
    );
    
    event LiquidationProtection(
        uint256 currentPrice,
        uint256 liquidationPrice,
        uint256 adjustmentMade
    );
    
    event KeeperRewardPaid(address indexed keeper, uint256 reward);
    
    event ThresholdsUpdated(
        uint256 deltaThreshold,
        uint256 liquidationBuffer,
        uint256 profitThreshold
    );

    constructor(
        address _strategy,
        address _gmxFuturesManager,
        address _oracleManager,
        address _gmxRouter,
        address _gmxVault
    ) {
        require(_strategy != address(0), "Invalid strategy");
        require(_gmxFuturesManager != address(0), "Invalid GMX futures manager");
        require(_oracleManager != address(0), "Invalid oracle manager");
        require(_gmxRouter != address(0), "Invalid GMX router");
        require(_gmxVault != address(0), "Invalid GMX vault");

        strategy = _strategy;
        gmxFuturesManager = _gmxFuturesManager;
        oracleManager = _oracleManager;
        gmxRouter = _gmxRouter;
        gmxVault = _gmxVault;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        _grantRole(STRATEGY_ROLE, _strategy);
    }

    /**
     * @dev Main rebalancing function - can be called by anyone (incentivized)
     */
    function rebalance() external nonReentrant returns (uint256 reward) {
        require(_isRebalanceNeeded(), "Rebalance not needed");
        require(
            block.timestamp >= lastRebalanceTime + minRebalanceInterval,
            "Rebalance cooldown active"
        );

        // Update position info
        _updatePositionInfo();
        
        // Check for emergency conditions
        if (currentPosition.currentDelta >= emergencyThreshold) {
            return _executeEmergencyRebalance();
        }

        // Check for liquidation risk
        if (_isLiquidationRisk()) {
            return _executeLiquidationProtection();
        }

        // Check for profit-taking opportunity
        if (_shouldTakeProfit()) {
            return _executeProfitTaking();
        }

        // Execute standard rebalance
        return _executeStandardRebalance();
    }

    /**
     * @dev Emergency rebalance (admin only, bypasses cooldowns)
     */
    function emergencyRebalance() external onlyRole(EMERGENCY_ROLE) nonReentrant returns (uint256) {
        _updatePositionInfo();
        return _executeEmergencyRebalance();
    }

    /**
     * @dev Automated rebalance for periodic maintenance
     */
    function periodicRebalance() external nonReentrant returns (uint256 reward) {
        require(
            block.timestamp >= lastRebalanceTime + maxRebalanceInterval,
            "Periodic rebalance not due"
        );
        
        _updatePositionInfo();
        
        // Force rebalance if too much time has passed
        if (currentPosition.currentDelta >= deltaThreshold / 2) {
            return _executeStandardRebalance();
        }
        
        return 0;
    }

    /**
     * @dev Check if rebalance is needed
     */
    function isRebalanceNeeded() external view returns (bool needed, string memory reason) {
        if (currentPosition.currentDelta >= deltaThreshold) {
            return (true, "Delta deviation exceeded");
        }
        
        if (_isLiquidationRisk()) {
            return (true, "Liquidation risk detected");
        }
        
        if (_shouldTakeProfit()) {
            return (true, "Profit-taking opportunity");
        }
        
        if (block.timestamp >= lastRebalanceTime + maxRebalanceInterval) {
            return (true, "Periodic maintenance due");
        }
        
        return (false, "No rebalance needed");
    }

    /**
     * @dev Calculate optimal rebalance amounts
     */
    function calculateRebalanceAmounts() external view returns (
        uint256 sAvaxAdjustment,
        uint256 shortAdjustment,
        bool increaseSAvax,
        bool increaseShort
    ) {
        // Get current prices from oracle
        // uint256 avaxPrice = _getAvaxPrice(); // Unused for now
        uint256 sAvaxPrice = _getSAvaxPrice();
        
        // Calculate target positions for delta neutrality
        uint256 totalValueUsd = (currentPosition.sAvaxAmount * sAvaxPrice) / 1e18;
        uint256 targetShortNotional = totalValueUsd; // 1:1 hedge ratio
        
        // Calculate adjustments needed
        if (currentPosition.shortAvaxNotional < targetShortNotional) {
            shortAdjustment = targetShortNotional - currentPosition.shortAvaxNotional;
            increaseShort = true;
        } else if (currentPosition.shortAvaxNotional > targetShortNotional) {
            shortAdjustment = currentPosition.shortAvaxNotional - targetShortNotional;
            increaseShort = false;
        }
        
        // Consider sAVAX adjustments for profit-taking scenarios
        if (_shouldTakeProfit()) {
            uint256 profitAmount = currentPosition.unrealizedPnL;
            uint256 newSAvaxAmount = (profitAmount * 1e18) / sAvaxPrice;
            sAvaxAdjustment = newSAvaxAmount;
            increaseSAvax = true;
        }
    }

    /**
     * @dev Get detailed position health metrics
     */
    function getPositionHealth() external view returns (
        uint256 currentDelta,
        uint256 liquidationDistance,
        uint256 unrealizedPnL,
        bool isHealthy,
        string memory riskLevel
    ) {
        currentDelta = currentPosition.currentDelta;
        liquidationDistance = _calculateLiquidationDistance();
        unrealizedPnL = currentPosition.unrealizedPnL;
        
        // Determine health status
        if (liquidationDistance < liquidationBuffer) {
            isHealthy = false;
            riskLevel = "CRITICAL";
        } else if (currentDelta >= emergencyThreshold) {
            isHealthy = false;
            riskLevel = "HIGH";
        } else if (currentDelta >= deltaThreshold) {
            isHealthy = false;
            riskLevel = "MEDIUM";
        } else {
            isHealthy = true;
            riskLevel = "LOW";
        }
    }

    /**
     * @dev Update rebalancing thresholds (admin only)
     */
    function updateThresholds(
        uint256 _deltaThreshold,
        uint256 _liquidationBuffer,
        uint256 _profitThreshold,
        uint256 _emergencyThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_deltaThreshold < _emergencyThreshold, "Invalid thresholds");
        require(_liquidationBuffer > 0, "Invalid liquidation buffer");
        
        deltaThreshold = _deltaThreshold;
        liquidationBuffer = _liquidationBuffer;
        profitThreshold = _profitThreshold;
        emergencyThreshold = _emergencyThreshold;
        
        emit ThresholdsUpdated(_deltaThreshold, _liquidationBuffer, _profitThreshold);
    }

    /**
     * @dev Update keeper rewards (admin only)
     */
    function updateKeeperRewards(
        uint256 _keeperRewardBps,
        uint256 _maxKeeperReward
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_keeperRewardBps <= 500, "Reward too high"); // Max 5%
        
        keeperRewardBps = _keeperRewardBps;
        maxKeeperReward = _maxKeeperReward;
    }

    /**
     * @dev Claim keeper rewards
     */
    function claimKeeperRewards() external nonReentrant {
        uint256 reward = keeperRewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        
        keeperRewards[msg.sender] = 0;
        
        // Transfer reward (implement actual token transfer)
        emit KeeperRewardPaid(msg.sender, reward);
    }

    // Internal functions

    function _isRebalanceNeeded() internal view returns (bool) {
        return currentPosition.currentDelta >= deltaThreshold ||
               _isLiquidationRisk() ||
               _shouldTakeProfit();
    }

    function _isLiquidationRisk() internal view returns (bool) {
        uint256 liquidationDistance = _calculateLiquidationDistance();
        return liquidationDistance > 0 && liquidationDistance < liquidationBuffer;
    }

    function _shouldTakeProfit() internal view returns (bool) {
        return currentPosition.unrealizedPnL > 0 &&
               currentPosition.shortAvaxNotional > 0 &&
               (currentPosition.unrealizedPnL * 10000) / 
               (currentPosition.shortAvaxNotional) >= profitThreshold;
    }

    function _calculateLiquidationDistance() internal view returns (uint256) {
        uint256 currentPrice = _getAvaxPrice();
        if (currentPosition.liquidationPrice == 0 || currentPrice >= currentPosition.liquidationPrice) {
            return 10000; // Safe distance (100%)
        }
        return ((currentPosition.liquidationPrice - currentPrice) * 10000) / currentPrice;
    }

    function _updatePositionInfo() internal {
        // Get current position data from strategy/position manager
        (uint256 sAvaxAmount, uint256 shortNotional) = _getCurrentPositions();
        
        currentPosition.sAvaxAmount = sAvaxAmount;
        currentPosition.shortAvaxNotional = shortNotional;
        currentPosition.currentDelta = _calculateCurrentDelta();
        currentPosition.liquidationPrice = _calculateLiquidationPrice();
        currentPosition.unrealizedPnL = _calculateUnrealizedPnL();
        currentPosition.lastUpdateTime = block.timestamp;
        currentPosition.needsRebalance = _isRebalanceNeeded();
    }

    function _executeStandardRebalance() internal returns (uint256 reward) {
        (uint256 sAvaxAdj, uint256 shortAdj, bool incSAvax, bool incShort) = 
            this.calculateRebalanceAmounts();
        
        // Execute rebalancing through position manager
        // Note: sAvax and short position adjustments would be implemented here
        // For now, we'll use the variables to avoid warnings
        if (sAvaxAdj > 0 && incSAvax) {
            // _increaseSAvaxPosition(sAvaxAdj); // TODO: Implement
        } else if (sAvaxAdj > 0) {
            // _decreaseSAvaxPosition(sAvaxAdj); // TODO: Implement
        }
        
        if (shortAdj > 0) {
            if (incShort) {
                _increaseShortPosition(shortAdj);
            } else {
                _decreaseShortPosition(shortAdj);
            }
        }
        
        // Calculate and distribute keeper reward
        reward = _calculateKeeperReward(shortAdj);
        if (reward > 0) {
            keeperRewards[msg.sender] += reward;
            keeperStats[msg.sender]++;
        }
        
        lastRebalanceTime = block.timestamp;
        
        emit RebalanceTriggered(
            msg.sender,
            currentPosition.currentDelta,
            shortAdj,
            reward,
            "Standard rebalance"
        );
        
        return reward;
    }

    function _executeEmergencyRebalance() internal returns (uint256 reward) {
        // Emergency rebalancing logic - more aggressive adjustments
        uint256 deltaDeviation = currentPosition.currentDelta;
        uint256 liquidationRisk = _calculateLiquidationDistance();
        
        // Close all positions and reopen with proper sizing
        _emergencyCloseAndReopen();
        
        // Higher keeper reward for emergency actions
        reward = _calculateKeeperReward(currentPosition.shortAvaxNotional) * 2;
        if (reward > 0) {
            keeperRewards[msg.sender] += reward;
            keeperStats[msg.sender] += 2; // Double credit for emergency
        }
        
        lastRebalanceTime = block.timestamp;
        
        emit EmergencyRebalance(deltaDeviation, liquidationRisk, "Emergency rebalance executed");
        
        return reward;
    }

    function _executeLiquidationProtection() internal returns (uint256 reward) {
        uint256 currentPrice = _getAvaxPrice();
        uint256 adjustmentNeeded = _calculateLiquidationAdjustment();
        
        // Reduce position size to increase liquidation buffer
        _decreaseShortPosition(adjustmentNeeded);
        
        reward = _calculateKeeperReward(adjustmentNeeded);
        if (reward > 0) {
            keeperRewards[msg.sender] += reward;
            keeperStats[msg.sender]++;
        }
        
        lastRebalanceTime = block.timestamp;
        
        emit LiquidationProtection(currentPrice, currentPosition.liquidationPrice, adjustmentNeeded);
        
        return reward;
    }

    function _executeProfitTaking() internal returns (uint256 reward) {
        uint256 profitAmount = currentPosition.unrealizedPnL;
        
        // Close portion of winning short position
        uint256 positionToClose = (profitAmount * 1e18) / _getAvaxPrice();
        _decreaseShortPosition(positionToClose);
        
        // Use profits to buy more sAVAX
        uint256 newSAvaxAmount = _buySAvaxWithProfit(profitAmount);
        
        // Open new short to hedge the additional sAVAX
        uint256 newShortSize = (newSAvaxAmount * _getSAvaxPrice()) / _getAvaxPrice();
        _increaseShortPosition(newShortSize);
        
        reward = _calculateKeeperReward(profitAmount);
        if (reward > 0) {
            keeperRewards[msg.sender] += reward;
            keeperStats[msg.sender]++;
        }
        
        lastRebalanceTime = block.timestamp;
        
        emit ProfitTaken(profitAmount, newSAvaxAmount, newShortSize);
        
        return reward;
    }

    // Helper functions for position management
    function _increaseShortPosition(uint256 amount) internal {
        // Call GMX to increase short position
        // Implementation depends on GMX interface
    }

    function _decreaseShortPosition(uint256 amount) internal {
        // Call GMX to decrease short position
        // Implementation depends on GMX interface
    }

    function _emergencyCloseAndReopen() internal {
        // Emergency close all positions and reopen with proper sizing
        // Implementation depends on GMX interface
    }

    function _buySAvaxWithProfit(uint256 /* profitAmount */) internal pure returns (uint256) {
        // Use profit to buy more sAVAX
        // Implementation depends on DEX/AMM interface
        return 0; // Placeholder
    }

    // Price oracle functions
    function _getAvaxPrice() internal pure returns (uint256) {
        // Get AVAX price from oracle manager
        return 20e18; // Placeholder: $20
    }

    function _getSAvaxPrice() internal pure returns (uint256) {
        // Get sAVAX price from oracle manager
        return 21e18; // Placeholder: $21 (with staking yield)
    }

    function _getCurrentPositions() internal pure returns (uint256 sAvax, uint256 shortNotional) {
        // Get current positions from strategy
        return (0, 0); // Placeholder
    }

    function _calculateCurrentDelta() internal pure returns (uint256) {
        // Calculate current delta deviation in basis points
        return 0; // Placeholder
    }

    function _calculateLiquidationPrice() internal pure returns (uint256) {
        // Calculate price at which position would be liquidated
        return 0; // Placeholder
    }

    function _calculateUnrealizedPnL() internal pure returns (uint256) {
        // Calculate current unrealized PnL
        return 0; // Placeholder
    }

    function _calculateLiquidationAdjustment() internal pure returns (uint256) {
        // Calculate adjustment needed to maintain liquidation buffer
        return 0; // Placeholder
    }

    function _calculateKeeperReward(uint256 rebalanceAmount) internal view returns (uint256) {
        uint256 reward = (rebalanceAmount * keeperRewardBps) / 10000;
        return reward > maxKeeperReward ? maxKeeperReward : reward;
    }
}
