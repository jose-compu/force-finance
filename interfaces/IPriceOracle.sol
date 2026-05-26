// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPriceOracle
 * @dev Interface for price oracle functionality
 */
interface IPriceOracle {
    
    /**
     * @dev Get the latest price for an asset
     * @param asset Address of the asset
     * @return price Latest price in USD (18 decimals)
     * @return timestamp Timestamp of the price update
     */
    function getPrice(address asset) external view returns (uint256 price, uint256 timestamp);
    
    /**
     * @dev Get the latest prices for multiple assets
     * @param assets Array of asset addresses
     * @return prices Array of latest prices in USD (18 decimals)
     * @return timestamps Array of timestamps for price updates
     */
    function getPrices(address[] calldata assets) 
        external 
        view 
        returns (uint256[] memory prices, uint256[] memory timestamps);
    
    /**
     * @dev Check if price data is fresh (within acceptable staleness threshold)
     * @param asset Address of the asset
     * @return bool True if price is fresh
     */
    function isPriceFresh(address asset) external view returns (bool);
    
    /**
     * @dev Get the staleness threshold for price data
     * @return uint256 Staleness threshold in seconds
     */
    function getStalnessThreshold() external view returns (uint256);
}
