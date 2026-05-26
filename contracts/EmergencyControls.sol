// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title EmergencyControls
 * @dev Handles emergency situations and provides safety controls
 */
contract EmergencyControls is ReentrancyGuard, Ownable, Pausable {
    
    // Rebalancing engine
    address public rebalancingEngine;
    
    // GMX Futures Manager (replaces PositionManager)
    address public gmxFuturesManager;
    
    // Emergency operators (can trigger emergency actions)
    mapping(address => bool) public emergencyOperators;
    
    // Guardians (can pause the system)
    mapping(address => bool) public guardians;
    
    // Emergency state
    bool public emergencyMode = false;
    uint256 public emergencyTriggerTime;
    string public emergencyReason;
    
    // Emergency thresholds
    uint256 public maxDrawdown = 2000; // 20% max drawdown
    uint256 public maxVolatility = 5000; // 50% max volatility
    uint256 public emergencyCooldown = 3600; // 1 hour cooldown
    
    // Events
    event EmergencyOperatorAdded(address indexed operator);
    event EmergencyOperatorRemoved(address indexed operator);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event EmergencyModeActivated(string reason, uint256 timestamp);
    event EmergencyModeDeactivated(uint256 timestamp);
    event EmergencyActionExecuted(string action, uint256 timestamp);
    event ParametersUpdated(uint256 maxDrawdown, uint256 maxVolatility, uint256 cooldown);
    
    struct EmergencyStatus {
        bool active;
        uint256 triggerTime;
        string reason;
        uint256 cooldownRemaining;
    }
    
    constructor() {
        // Add deployer as emergency operator and guardian
        emergencyOperators[msg.sender] = true;
        guardians[msg.sender] = true;
    }
    
    modifier onlyEmergencyOperator() {
        require(emergencyOperators[msg.sender] || msg.sender == owner(), "Not emergency operator");
        _;
    }
    
    modifier onlyGuardian() {
        require(guardians[msg.sender] || msg.sender == owner(), "Not guardian");
        _;
    }
    
    /**
     * @dev Set the rebalancing engine address
     */
    function setRebalancingEngine(address _rebalancingEngine) external onlyOwner {
        require(_rebalancingEngine != address(0), "Invalid rebalancing engine");
        rebalancingEngine = _rebalancingEngine;
    }
    
    /**
     * @dev Set the GMX Futures Manager address
     */
    function setGMXFuturesManager(address _gmxFuturesManager) external onlyOwner {
        require(_gmxFuturesManager != address(0), "Invalid GMX futures manager");
        gmxFuturesManager = _gmxFuturesManager;
    }
    
    /**
     * @dev Add emergency operator
     */
    function addEmergencyOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator");
        emergencyOperators[operator] = true;
        emit EmergencyOperatorAdded(operator);
    }
    
    /**
     * @dev Remove emergency operator
     */
    function removeEmergencyOperator(address operator) external onlyOwner {
        require(operator != owner(), "Cannot remove owner");
        emergencyOperators[operator] = false;
        emit EmergencyOperatorRemoved(operator);
    }
    
    /**
     * @dev Add guardian
     */
    function addGuardian(address guardian) external onlyOwner {
        require(guardian != address(0), "Invalid guardian");
        guardians[guardian] = true;
        emit GuardianAdded(guardian);
    }
    
    /**
     * @dev Remove guardian
     */
    function removeGuardian(address guardian) external onlyOwner {
        require(guardian != owner(), "Cannot remove owner");
        guardians[guardian] = false;
        emit GuardianRemoved(guardian);
    }
    
    /**
     * @dev Update emergency parameters
     */
    function updateParameters(
        uint256 _maxDrawdown,
        uint256 _maxVolatility,
        uint256 _cooldown
    ) external onlyOwner {
        require(_maxDrawdown <= 5000, "Max drawdown too high"); // Max 50%
        require(_maxVolatility <= 10000, "Max volatility too high"); // Max 100%
        require(_cooldown <= 86400, "Cooldown too long"); // Max 24 hours
        
        maxDrawdown = _maxDrawdown;
        maxVolatility = _maxVolatility;
        emergencyCooldown = _cooldown;
        
        emit ParametersUpdated(_maxDrawdown, _maxVolatility, _cooldown);
    }
    
    /**
     * @dev Activate emergency mode
     */
    function activateEmergencyMode(string calldata reason) external onlyEmergencyOperator {
        require(!emergencyMode, "Emergency mode already active");
        require(bytes(reason).length > 0, "Reason required");
        
        emergencyMode = true;
        emergencyTriggerTime = block.timestamp;
        emergencyReason = reason;
        
        // Pause the system
        _pause();
        
        emit EmergencyModeActivated(reason, block.timestamp);
    }
    
    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyOwner {
        require(emergencyMode, "Emergency mode not active");
        require(block.timestamp >= emergencyTriggerTime + emergencyCooldown, "Cooldown active");
        
        emergencyMode = false;
        emergencyTriggerTime = 0;
        emergencyReason = "";
        
        // Unpause the system
        _unpause();
        
        emit EmergencyModeDeactivated(block.timestamp);
    }
    
    /**
     * @dev Emergency pause (guardians can pause without activating emergency mode)
     */
    function emergencyPause() external onlyGuardian {
        _pause();
        emit EmergencyActionExecuted("PAUSE", block.timestamp);
    }
    
    /**
     * @dev Emergency unpause (only owner)
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
        emit EmergencyActionExecuted("UNPAUSE", block.timestamp);
    }
    
    /**
     * @dev Emergency deleverage (reduce all positions to minimum)
     */
    function emergencyDeleverage() external onlyEmergencyOperator nonReentrant {
        require(emergencyMode, "Emergency mode not active");
        require(gmxFuturesManager != address(0), "GMX Futures Manager not set");
        
        // Call GMXFuturesManager.emergencyCloseAllPositions()
        // Implementation: GMXFuturesManager handles emergency position closure
        
        emit EmergencyActionExecuted("DELEVERAGE", block.timestamp);
    }
    
    /**
     * @dev Emergency rebalancing (force rebalance regardless of thresholds)
     */
    function emergencyRebalancing() external onlyEmergencyOperator nonReentrant {
        require(emergencyMode, "Emergency mode not active");
        require(rebalancingEngine != address(0), "Rebalancing engine not set");
        
        // Call rebalancing engine's emergency rebalancing
        // This would be implemented in the rebalancing engine
        
        emit EmergencyActionExecuted("REBALANCING", block.timestamp);
    }
    
    /**
     * @dev Check if emergency conditions are met
     */
    function checkEmergencyConditions() external view returns (bool, string memory) {
        // Check drawdown
        uint256 currentDrawdown = _calculateDrawdown();
        if (currentDrawdown > maxDrawdown) {
            return (true, "Drawdown threshold exceeded");
        }
        
        // Check volatility
        uint256 currentVolatility = _calculateVolatility();
        if (currentVolatility > maxVolatility) {
            return (true, "Volatility threshold exceeded");
        }
        
        return (false, "");
    }
    
    /**
     * @dev Get emergency status
     */
    function getEmergencyStatus() external view returns (EmergencyStatus memory) {
        uint256 cooldownRemaining = 0;
        if (emergencyMode && block.timestamp < emergencyTriggerTime + emergencyCooldown) {
            cooldownRemaining = emergencyTriggerTime + emergencyCooldown - block.timestamp;
        }
        
        return EmergencyStatus({
            active: emergencyMode,
            triggerTime: emergencyTriggerTime,
            reason: emergencyReason,
            cooldownRemaining: cooldownRemaining
        });
    }
    
    /**
     * @dev Check if address is emergency operator
     */
    function isEmergencyOperator(address account) external view returns (bool) {
        return emergencyOperators[account] || account == owner();
    }
    
    /**
     * @dev Check if address is guardian
     */
    function isGuardian(address account) external view returns (bool) {
        return guardians[account] || account == owner();
    }
    
    // Internal functions
    
    function _calculateDrawdown() internal pure returns (uint256) {
        // TODO: Implement drawdown calculation
        // This would compare current portfolio value to peak value
        return 0;
    }
    
    function _calculateVolatility() internal pure returns (uint256) {
        // TODO: Implement volatility calculation
        // This would calculate portfolio volatility
        return 0;
    }
    
    /**
     * @dev Emergency function to withdraw all funds
     */
    function emergencyWithdraw(address token, address recipient) external onlyOwner {
        // This would withdraw all funds from the strategy
        // Implementation depends on the strategy contract
    }
}
