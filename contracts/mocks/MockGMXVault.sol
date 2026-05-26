// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockGMXVault
 * @dev Mock implementation of GMX Vault for testing
 */
contract MockGMXVault {
    struct Position {
        uint256 size;
        uint256 collateral;
        uint256 averagePrice;
        uint256 entryFundingRate;
        uint256 reserveAmount;
        uint256 realisedPnl;
        bool hasRealisedProfit;
        uint256 lastIncreasedTime;
    }
    
    mapping(bytes32 => Position) public positions;
    mapping(address => uint256) public poolAmounts;
    mapping(address => uint256) public reservedAmounts;
    mapping(address => uint256) public guaranteedUsd;
    mapping(address => uint256) public tokenDecimals;
    mapping(address => uint256) public tokenWeights;
    mapping(address => uint256) public usdgAmounts;
    mapping(address => bool) public isLiquidator;
    
    uint256 public liquidationFeeUsd = 5 * 1e30; // $5
    uint256 public marginFeeBasisPoints = 10; // 0.1%
    uint256 public maxLeverage = 50;
    
    function getPosition(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong
    ) external view returns (
        uint256 size,
        uint256 collateral,
        uint256 averagePrice,
        uint256 entryFundingRate,
        uint256 reserveAmount,
        uint256 realisedPnl,
        bool hasRealisedProfit,
        uint256 lastIncreasedTime
    ) {
        bytes32 key = getPositionKey(_account, _collateralToken, _indexToken, _isLong);
        Position memory position = positions[key];
        
        return (
            position.size,
            position.collateral,
            position.averagePrice,
            position.entryFundingRate,
            position.reserveAmount,
            position.realisedPnl,
            position.hasRealisedProfit,
            position.lastIncreasedTime
        );
    }
    
    function getPositionDelta(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong
    ) external view returns (bool hasProfit, uint256 delta) {
        bytes32 key = getPositionKey(_account, _collateralToken, _indexToken, _isLong);
        Position memory position = positions[key];
        
        if (position.size == 0) {
            return (false, 0);
        }
        
        // Mock delta calculation - assume 5% profit for testing
        uint256 mockDelta = position.size * 5 / 100;
        return (true, mockDelta);
    }
    
    function getPositionKey(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_account, _collateralToken, _indexToken, _isLong));
    }
    
    function setPosition(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong,
        uint256 _size,
        uint256 _collateral,
        uint256 _averagePrice
    ) external {
        bytes32 key = getPositionKey(_account, _collateralToken, _indexToken, _isLong);
        positions[key] = Position({
            size: _size,
            collateral: _collateral,
            averagePrice: _averagePrice,
            entryFundingRate: 0,
            reserveAmount: 0,
            realisedPnl: 0,
            hasRealisedProfit: false,
            lastIncreasedTime: block.timestamp
        });
    }
    
    function getMaxPrice(address /* _token */) external pure returns (uint256) {
        // Mock price - $22 for AVAX
        return 22 * 1e30;
    }
    
    function getMinPrice(address /* _token */) external pure returns (uint256) {
        // Mock price - $22 for AVAX
        return 22 * 1e30;
    }
    
    function getTargetUsdgAmount(address _token) external view returns (uint256) {
        return usdgAmounts[_token];
    }
    
    // Admin functions for testing
    function setPoolAmount(address _token, uint256 _amount) external {
        poolAmounts[_token] = _amount;
    }
    
    function setReservedAmount(address _token, uint256 _amount) external {
        reservedAmounts[_token] = _amount;
    }
    
    function setGuaranteedUsd(address _token, uint256 _amount) external {
        guaranteedUsd[_token] = _amount;
    }
    
    function setTokenDecimals(address _token, uint256 _decimals) external {
        tokenDecimals[_token] = _decimals;
    }
    
    function setTokenWeight(address _token, uint256 _weight) external {
        tokenWeights[_token] = _weight;
    }
    
    function setUsdgAmount(address _token, uint256 _amount) external {
        usdgAmounts[_token] = _amount;
    }
    
    function setLiquidator(address _liquidator, bool _isActive) external {
        isLiquidator[_liquidator] = _isActive;
    }
}
