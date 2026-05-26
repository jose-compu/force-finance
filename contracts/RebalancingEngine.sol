// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IGMXRouter.sol";

/**
 * @title RebalancingEngine
 * @dev Handles portfolio rebalancing based on deviation thresholds
 */
contract RebalancingEngine is ReentrancyGuard, Ownable {
    
    // Oracle manager for price feeds
    address public immutable oracleManager;
    
    // Strategy contract
    address public strategy;
    
    // GMX Futures Manager (replaces PositionManager)
    address public gmxFuturesManager;
    
    // Rebalancing parameters
    uint256 public deviationThreshold = 500; // 5% deviation threshold
    uint256 public emergencyThreshold = 1000; // 10% emergency threshold
    uint256 public rebalanceCooldown = 3600; // 1 hour cooldown
    uint256 public lastRebalanceTime;
    
    // Target allocations
    mapping(address => uint256) public targetAllocations; // Basis points (10000 = 100%)
    mapping(address => uint256) public currentAllocations;
    
    // Rebalancing state
    bool public rebalancingActive = true;
    uint256 public totalAllocation = 10000; // 100%
    
    // Events
    event RebalancingTriggered(uint256 deviation, uint256 timestamp);
    event RebalancingExecuted(address indexed token, uint256 oldAllocation, uint256 newAllocation);
    event EmergencyRebalancing(uint256 deviation, string reason);
    event ParametersUpdated(uint256 deviationThreshold, uint256 emergencyThreshold, uint256 cooldown);
    event StrategySet(address indexed strategy);
    event GMXFuturesManagerSet(address indexed gmxFuturesManager);
    
    struct RebalancingAction {
        address token;
        uint256 currentAmount;
        uint256 targetAmount;
        uint256 action; // 0 = no action, 1 = increase, 2 = decrease
        uint256 amount;
    }
    
    constructor(address _oracleManager) {
        require(_oracleManager != address(0), "Invalid oracle manager");
        oracleManager = _oracleManager;
    }
    
    modifier onlyStrategy() {
        require(msg.sender == strategy, "Only strategy can call");
        _;
    }
    
    /**
     * @dev Set the strategy contract address
     */
    function setStrategy(address _strategy) external onlyOwner {
        require(_strategy != address(0), "Invalid strategy address");
        strategy = _strategy;
        emit StrategySet(_strategy);
    }
    
    /**
     * @dev Set the GMX Futures Manager address
     */
    function setGMXFuturesManager(address _gmxFuturesManager) external onlyOwner {
        require(_gmxFuturesManager != address(0), "Invalid GMX futures manager");
        gmxFuturesManager = _gmxFuturesManager;
        emit GMXFuturesManagerSet(_gmxFuturesManager);
    }
    
    /**
     * @dev Update rebalancing parameters
     */
    function updateParameters(
        uint256 _deviationThreshold,
        uint256 _emergencyThreshold,
        uint256 _cooldown
    ) external onlyOwner {
        require(_deviationThreshold < _emergencyThreshold, "Invalid thresholds");
        require(_cooldown <= 86400, "Cooldown too long"); // Max 24 hours
        
        deviationThreshold = _deviationThreshold;
        emergencyThreshold = _emergencyThreshold;
        rebalanceCooldown = _cooldown;
        
        emit ParametersUpdated(_deviationThreshold, _emergencyThreshold, _cooldown);
    }
    
    /**
     * @dev Set target allocation for a token
     */
    function setTargetAllocation(address token, uint256 allocation) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(allocation <= 10000, "Allocation too high");
        
        uint256 oldAllocation = targetAllocations[token];
        targetAllocations[token] = allocation;
        
        // Update total allocation
        totalAllocation = totalAllocation - oldAllocation + allocation;
        require(totalAllocation <= 10000, "Total allocation exceeds 100%");
    }
    
    /**
     * @dev Update current allocation for a token
     */
    function updateCurrentAllocation(address token, uint256 allocation) external onlyStrategy {
        require(token != address(0), "Invalid token");
        require(allocation <= 10000, "Allocation too high");
        
        currentAllocations[token] = allocation;
    }
    
    /**
     * @dev Check if rebalancing is needed
     */
    function checkRebalancingNeeded() external view returns (bool, uint256, RebalancingAction[] memory) {
        if (!rebalancingActive) return (false, 0, new RebalancingAction[](0));
        
        uint256 maxDeviation = 0;
        RebalancingAction[] memory actions = new RebalancingAction[](10); // Max 10 tokens
        uint256 actionCount = 0;
        
        // Check each token's deviation
        // This is a simplified implementation
        // In production, you'd iterate through actual tokens
        // for (uint256 i = 0; i < actualTokenCount; i++) { ... }
        
        // Resize actions array to actual count
        RebalancingAction[] memory finalActions = new RebalancingAction[](actionCount);
        for (uint256 i = 0; i < actionCount; i++) {
            finalActions[i] = actions[i];
        }
        
        bool needsRebalancing = maxDeviation >= deviationThreshold;
        return (needsRebalancing, maxDeviation, finalActions);
    }
    
    /**
     * @dev Execute rebalancing
     */
    function executeRebalancing() external onlyStrategy nonReentrant returns (bool) {
        require(rebalancingActive, "Rebalancing disabled");
        require(block.timestamp >= lastRebalanceTime + rebalanceCooldown, "Cooldown active");
        
        (bool needsRebalancing, uint256 deviation, RebalancingAction[] memory actions) = this.checkRebalancingNeeded();
        
        if (!needsRebalancing) {
            return false;
        }
        
        // Check for emergency threshold
        if (deviation >= emergencyThreshold) {
            emit EmergencyRebalancing(deviation, "Deviation above emergency threshold");
        }
        
        // Execute rebalancing actions
        for (uint256 i = 0; i < actions.length; i++) {
            RebalancingAction memory action = actions[i];
            if (action.action == 0) continue;
            
            if (action.action == 1) {
                // Increase position
                _increasePosition(action.token, action.amount);
            } else if (action.action == 2) {
                // Decrease position
                _decreasePosition(action.token, action.amount);
            }
            
            emit RebalancingExecuted(action.token, action.currentAmount, action.targetAmount);
        }
        
        lastRebalanceTime = block.timestamp;
        emit RebalancingTriggered(deviation, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Emergency rebalancing (bypasses cooldown)
     */
    function emergencyRebalancing() external onlyOwner nonReentrant returns (bool) {
        require(rebalancingActive, "Rebalancing disabled");
        
        (bool needsRebalancing, uint256 deviation, RebalancingAction[] memory actions) = this.checkRebalancingNeeded();
        
        if (!needsRebalancing) {
            return false;
        }
        
        emit EmergencyRebalancing(deviation, "Manual emergency rebalancing");
        
        // Execute rebalancing actions
        for (uint256 i = 0; i < actions.length; i++) {
            RebalancingAction memory action = actions[i];
            if (action.action == 0) continue;
            
            if (action.action == 1) {
                _increasePosition(action.token, action.amount);
            } else if (action.action == 2) {
                _decreasePosition(action.token, action.amount);
            }
            
            emit RebalancingExecuted(action.token, action.currentAmount, action.targetAmount);
        }
        
        lastRebalanceTime = block.timestamp;
        return true;
    }
    
    /**
     * @dev Toggle rebalancing on/off
     */
    function toggleRebalancing() external onlyOwner {
        rebalancingActive = !rebalancingActive;
    }
    
    /**
     * @dev Get rebalancing status
     */
    function getRebalancingStatus() external view returns (
        bool active,
        uint256 lastRebalance,
        uint256 cooldownRemaining,
        uint256 totalDeviation
    ) {
        active = rebalancingActive;
        lastRebalance = lastRebalanceTime;
        cooldownRemaining = block.timestamp >= lastRebalanceTime + rebalanceCooldown ? 
            0 : lastRebalanceTime + rebalanceCooldown - block.timestamp;
        
        // Calculate total deviation
        totalDeviation = _calculateTotalDeviation();
    }
    
    // Internal functions
    
    function _increasePosition(address token, uint256 amount) internal {
        // Use GMXFuturesManager to adjust position
        // Implementation: Call GMXFuturesManager.adjustFuturesPosition() through strategy
        // Note: Requires positionKey tracking - should be managed by strategy contract
    }
    
    function _decreasePosition(address token, uint256 amount) internal {
        // Use GMXFuturesManager to adjust position
        // Implementation: Call GMXFuturesManager.adjustFuturesPosition() through strategy
        // Note: Requires positionKey tracking - should be managed by strategy contract
    }
    
    function _calculateTotalDeviation() internal pure returns (uint256) {
        uint256 totalDeviation = 0;
        
        // Calculate total deviation across all tokens
        // This is a simplified implementation
        // In production, you'd iterate through actual tokens
        
        return totalDeviation;
    }
    
    /**
     * @dev Emergency function to reset all allocations
     */
    function emergencyResetAllocations() external onlyOwner {
        // Reset all current allocations to target allocations
        // This would iterate through all tokens and reset them
    }
}
