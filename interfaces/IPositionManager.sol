// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPositionManager
 * @dev Interface for managing perpetual positions for delta-neutral strategy
 */
interface IPositionManager {
    
    struct Position {
        address asset;      // Underlying asset (ETH/BTC)
        uint256 size;       // Position size
        bool isShort;       // True for short positions
        uint256 entryPrice; // Entry price
        uint256 timestamp;  // Position creation timestamp
    }
    
    /**
     * @dev Open a new position
     * @param asset Address of the underlying asset
     * @param size Position size
     * @param isShort True for short position, false for long
     * @return positionId Unique identifier for the position
     */
    function openPosition(
        address asset,
        uint256 size,
        bool isShort
    ) external returns (uint256 positionId);
    
    /**
     * @dev Close an existing position
     * @param positionId Unique identifier for the position
     */
    function closePosition(uint256 positionId) external;
    
    /**
     * @dev Get position details
     * @param positionId Unique identifier for the position
     * @return position Position struct with details
     */
    function getPosition(uint256 positionId) external view returns (Position memory position);
    
    /**
     * @dev Get all positions for an account
     * @param account Address of the account
     * @return positionIds Array of position identifiers
     */
    function getAccountPositions(address account) external view returns (uint256[] memory positionIds);
    
    /**
     * @dev Calculate the current PnL for a position
     * @param positionId Unique identifier for the position
     * @return pnl Current profit/loss (can be negative)
     */
    function getPositionPnL(uint256 positionId) external view returns (int256 pnl);
    
    /**
     * @dev Get the total exposure for an asset
     * @param asset Address of the underlying asset
     * @return netExposure Net exposure (positive for long, negative for short)
     */
    function getNetExposure(address asset) external view returns (int256 netExposure);
}
