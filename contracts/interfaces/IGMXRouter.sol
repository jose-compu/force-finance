// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGMXRouter
 * @dev Complete interface for GMX Router contract (V1) on Avalanche
 * Official contract: 0x5F719c2F1095F7B9fc68a68e35B51194f4b6abe8
 */
interface IGMXRouter {
    // Core state variables
    function gov() external view returns (address);
    function vault() external view returns (address);
    function usdg() external view returns (address);
    function whitelistedTokenCount() external view returns (uint256);
    function maxLeverage() external view returns (uint256);
    
    // Swapping functions
    function swap(
        address[] calldata _path,
        uint256 _amountIn,
        uint256 _minOut,
        address _receiver
    ) external;
    
    function swapETHToTokens(
        address[] calldata _path,
        uint256 _minOut,
        address _receiver
    ) external payable;
    
    function swapTokensToETH(
        address[] calldata _path,
        uint256 _amountIn,
        uint256 _minOut,
        address payable _receiver
    ) external;
    
    // Direct pool interactions
    function directPoolDeposit(address _token, uint256 _amount) external;
    
    // Liquidity management
    function addLiquidity(
        address _token,
        uint256 _amount,
        uint256 _minUsdg,
        uint256 _minGlp
    ) external returns (uint256);
    
    function addLiquidityETH(
        uint256 _minUsdg,
        uint256 _minGlp
    ) external payable returns (uint256);
    
    function removeLiquidity(
        address _tokenOut,
        uint256 _glpAmount,
        uint256 _minOut,
        address _receiver
    ) external returns (uint256);
    
    function removeLiquidityETH(
        uint256 _glpAmount,
        uint256 _minOut,
        address payable _receiver
    ) external returns (uint256);
    
    // Plugin management
    function approvePlugin(address _plugin) external;
    function denyPlugin(address _plugin) external;
    
    // Position size functions
    function increasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _price
    ) external;
    
    function increasePositionETH(
        address[] memory _path,
        address _indexToken,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _price
    ) external payable;
    
    function decreasePosition(
        address _collateralToken,
        address _indexToken,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        bool _isLong,
        address _receiver,
        uint256 _price
    ) external;
    
    function decreasePositionETH(
        address _collateralToken,
        address _indexToken,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        bool _isLong,
        address payable _receiver,
        uint256 _price
    ) external;
    
    // Position liquidation
    function liquidatePosition(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong,
        address _feeReceiver
    ) external;
}

/**
 * @title IGMXPositionRouter
 * @dev Interface for GMX Position Router for perpetual positions
 */
interface IGMXPositionRouter {
    function createIncreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _acceptablePrice,
        uint256 _executionFee,
        bytes32 _referralCode,
        address _callbackTarget
    ) external payable returns (bytes32);

    function createDecreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        bool _isLong,
        address _receiver,
        uint256 _acceptablePrice,
        uint256 _minOut,
        uint256 _executionFee,
        bool _withdrawETH,
        address _callbackTarget
    ) external payable returns (bytes32);

    function executeIncreasePosition(bytes32 _key, address payable _executionFeeReceiver) external returns (bool);
    function executeDecreasePosition(bytes32 _key, address payable _executionFeeReceiver) external returns (bool);
    
    function cancelIncreasePosition(bytes32 _key, address payable _executionFeeReceiver) external returns (bool);
    function cancelDecreasePosition(bytes32 _key, address payable _executionFeeReceiver) external returns (bool);

    function getRequestKey(address _account, uint256 _index) external pure returns (bytes32);
    function getIncreasePositionRequestPath(bytes32 _key) external view returns (address[] memory);
    function getDecreasePositionRequestPath(bytes32 _key) external view returns (address[] memory);
    
    function minExecutionFee() external view returns (uint256);
}

/**
 * @title IGMXVault
 * @dev Interface for GMX Vault contract
 */
interface IGMXVault {
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
    );

    function getPositionDelta(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong
    ) external view returns (bool hasProfit, uint256 delta);

    function poolAmounts(address _token) external view returns (uint256);
    function reservedAmounts(address _token) external view returns (uint256);
    function guaranteedUsd(address _token) external view returns (uint256);
    
    function getMaxPrice(address _token) external view returns (uint256);
    function getMinPrice(address _token) external view returns (uint256);
    
    function tokenDecimals(address _token) external view returns (uint256);
    function tokenWeights(address _token) external view returns (uint256);
    
    function usdgAmounts(address _token) external view returns (uint256);
    function getTargetUsdgAmount(address _token) external view returns (uint256);
    
    function isLiquidator(address _account) external view returns (bool);
    function liquidationFeeUsd() external view returns (uint256);
    
    function marginFeeBasisPoints() external view returns (uint256);
    function maxLeverage() external view returns (uint256);
}
