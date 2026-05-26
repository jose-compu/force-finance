// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IGMXRouter.sol";

/**
 * @title LeverageOptimizer
 * @dev Optimizes leverage based on market conditions and risk parameters
 */
contract LeverageOptimizer is ReentrancyGuard, Ownable {
    
    // Oracle manager for price feeds
    address public immutable oracleManager;
    
    // Strategy contract
    address public strategy;
    
    // Risk parameters
    uint256 public maxLeverage = 30; // 30x max leverage
    uint256 public minLeverage = 1;  // 1x min leverage
    uint256 public volatilityThreshold = 500; // 5% volatility threshold
    uint256 public correlationThreshold = 7000; // 70% correlation threshold
    
    // Market state tracking
    mapping(address => MarketState) public marketStates;
    
    // Events
    event LeverageOptimized(address indexed token, uint256 oldLeverage, uint256 newLeverage);
    event RiskParametersUpdated(uint256 maxLeverage, uint256 minLeverage, uint256 volatilityThreshold);
    event StrategySet(address indexed strategy);
    
    struct MarketState {
        uint256 volatility;      // Current volatility (basis points)
        uint256 correlation;     // Correlation with AVAX (basis points)
        uint256 liquidity;       // Market liquidity score
        uint256 lastUpdate;      // Last update timestamp
        uint256 recommendedLeverage; // Recommended leverage
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
     * @dev Update risk parameters
     */
    function updateRiskParameters(
        uint256 _maxLeverage,
        uint256 _minLeverage,
        uint256 _volatilityThreshold
    ) external onlyOwner {
        require(_maxLeverage > _minLeverage, "Invalid leverage range");
        require(_maxLeverage <= 50, "Max leverage too high");
        require(_volatilityThreshold <= 2000, "Volatility threshold too high");
        
        maxLeverage = _maxLeverage;
        minLeverage = _minLeverage;
        volatilityThreshold = _volatilityThreshold;
        
        emit RiskParametersUpdated(_maxLeverage, _minLeverage, _volatilityThreshold);
    }
    
    /**
     * @dev Calculate optimal leverage for a token
     */
    function calculateOptimalLeverage(address token) external view returns (uint256) {
        MarketState memory state = marketStates[token];
        
        // If no market state, return default leverage
        if (state.lastUpdate == 0) {
            return 10; // Default 10x leverage
        }
        
        // Base leverage calculation
        uint256 baseLeverage = _calculateBaseLeverage(state);
        
        // Apply volatility adjustment
        uint256 volatilityAdjusted = _applyVolatilityAdjustment(baseLeverage, state.volatility);
        
        // Apply correlation adjustment
        uint256 correlationAdjusted = _applyCorrelationAdjustment(volatilityAdjusted, state.correlation);
        
        // Apply liquidity adjustment
        uint256 finalLeverage = _applyLiquidityAdjustment(correlationAdjusted, state.liquidity);
        
        // Ensure within bounds
        if (finalLeverage > maxLeverage) finalLeverage = maxLeverage;
        if (finalLeverage < minLeverage) finalLeverage = minLeverage;
        
        return finalLeverage;
    }
    
    /**
     * @dev Update market state for a token
     */
    function updateMarketState(
        address token,
        uint256 volatility,
        uint256 correlation,
        uint256 liquidity
    ) external onlyStrategy {
        require(token != address(0), "Invalid token");
        require(volatility <= 10000, "Invalid volatility");
        require(correlation <= 10000, "Invalid correlation");
        require(liquidity <= 10000, "Invalid liquidity");
        
        marketStates[token] = MarketState({
            volatility: volatility,
            correlation: correlation,
            liquidity: liquidity,
            lastUpdate: block.timestamp,
            recommendedLeverage: 0 // Will be calculated on demand
        });
    }
    
    /**
     * @dev Get market state for a token
     */
    function getMarketState(address token) external view returns (MarketState memory) {
        return marketStates[token];
    }
    
    /**
     * @dev Check if leverage should be adjusted
     */
    function shouldAdjustLeverage(address token, uint256 currentLeverage) external view returns (bool, uint256) {
        uint256 optimalLeverage = this.calculateOptimalLeverage(token);
        uint256 deviation = currentLeverage > optimalLeverage ? 
            currentLeverage - optimalLeverage : 
            optimalLeverage - currentLeverage;
        
        // Adjust if deviation is more than 20%
        bool shouldAdjust = deviation > (optimalLeverage * 20 / 100);
        
        return (shouldAdjust, optimalLeverage);
    }
    
    /**
     * @dev Get risk score for a token
     */
    function getRiskScore(address token) external view returns (uint256) {
        MarketState memory state = marketStates[token];
        if (state.lastUpdate == 0) return 5000; // Medium risk if no data
        
        // Calculate risk score based on volatility and correlation
        uint256 volatilityRisk = state.volatility * 40 / 100; // 40% weight
        uint256 correlationRisk = (10000 - state.correlation) * 30 / 100; // 30% weight (inverse correlation)
        uint256 liquidityRisk = (10000 - state.liquidity) * 30 / 100; // 30% weight (inverse liquidity)
        
        return volatilityRisk + correlationRisk + liquidityRisk;
    }
    
    // Internal functions
    
    function _calculateBaseLeverage(MarketState memory state) internal pure returns (uint256) {
        // Base leverage calculation based on market conditions
        // Higher volatility = lower leverage
        uint256 volatilityFactor = 10000 - state.volatility;
        uint256 baseLeverage = 15 + (volatilityFactor * 15 / 10000); // 15-30x range
        
        return baseLeverage;
    }
    
    function _applyVolatilityAdjustment(uint256 baseLeverage, uint256 volatility) internal view returns (uint256) {
        if (volatility > volatilityThreshold) {
            // Reduce leverage for high volatility
            uint256 reduction = (volatility - volatilityThreshold) * baseLeverage / 10000;
            return baseLeverage > reduction ? baseLeverage - reduction : minLeverage;
        }
        return baseLeverage;
    }
    
    function _applyCorrelationAdjustment(uint256 leverage, uint256 correlation) internal view returns (uint256) {
        if (correlation > correlationThreshold) {
            // High correlation with AVAX means higher risk, reduce leverage
            uint256 reduction = (correlation - correlationThreshold) * leverage / 10000;
            return leverage > reduction ? leverage - reduction : minLeverage;
        }
        return leverage;
    }
    
    function _applyLiquidityAdjustment(uint256 leverage, uint256 liquidity) internal view returns (uint256) {
        if (liquidity < 5000) {
            // Low liquidity means higher risk, reduce leverage
            uint256 reduction = (5000 - liquidity) * leverage / 10000;
            return leverage > reduction ? leverage - reduction : minLeverage;
        }
        return leverage;
    }
    
    /**
     * @dev Emergency function to set all leverages to minimum
     */
    function emergencyReduceLeverage() external onlyOwner {
        // This would iterate through all tokens and set leverage to minimum
        // Implementation depends on how tokens are tracked
    }
}
