// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockOracleManager
 * @dev Mock oracle manager for testing purposes
 */
contract MockOracleManager {
    mapping(address => uint256) public prices;
    
    constructor() {
        // Set default prices for common tokens
        prices[0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7] = 25e16; // WAVAX = $25
        prices[0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB] = 2000e18; // WETH = $2000
        prices[0x50b7545627a5162F82A992c33b87aDc75187B218] = 40000e18; // WBTC = $40000
        prices[0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664] = 1e18; // USDC.e = $1
    }
    
    function getPrice(address token) external view returns (uint256 price, uint256 timestamp) {
        return (prices[token], block.timestamp);
    }
    
    function getPrices(address[] calldata tokens) external view returns (uint256[] memory pricesArray, uint256[] memory timestamps) {
        pricesArray = new uint256[](tokens.length);
        timestamps = new uint256[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            pricesArray[i] = prices[tokens[i]];
            timestamps[i] = block.timestamp;
        }
    }
    
    function setPrice(address token, uint256 price) external {
        prices[token] = price;
    }
}
