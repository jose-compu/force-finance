// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITraderJoeV2
 * @dev Comprehensive interfaces for Trader Joe V2 LB (Liquidity Bin) pairs
 * Trader Joe V2 is the most popular AMM on Avalanche with excellent TWAP capabilities
 */

/**
 * @title ILBFactory
 * @dev Trader Joe V2 LB Factory interface
 */
interface ILBFactory {
    function getLBPairInformation(address tokenX, address tokenY, uint256 binStep)
        external
        view
        returns (
            address lbPair,
            uint256 baseFactor,
            uint256 filterPeriod,
            uint256 decayPeriod,
            uint256 reductionFactor,
            uint256 variableFeeControl,
            uint256 protocolShare,
            uint256 maxVolatilityAccumulated
        );

    function getAllLBPairs(address tokenX, address tokenY)
        external
        view
        returns (address[] memory LBPairs);

    function getLBPairAtIndex(address tokenX, address tokenY, uint256 index)
        external
        view
        returns (address lbPair);

    function getNumberOfLBPairs(address tokenX, address tokenY)
        external
        view
        returns (uint256);

    function getLBPair(address tokenX, address tokenY, uint256 binStep)
        external
        view
        returns (address lbPair);

    function isLBPair(address lbPair) external view returns (bool);
}

/**
 * @title ILBPair
 * @dev Trader Joe V2 LB Pair interface for price and liquidity data
 */
interface ILBPair {
    function getActiveId() external view returns (uint24);
    
    function getBin(uint24 id) external view returns (
        uint128 binReserveX,
        uint128 binReserveY,
        uint256 oracleSampleLifetime,
        uint256 oracleSize,
        uint256 oracleActiveSize,
        uint256 oracleLastTimestamp,
        uint256 oracleId,
        uint256 feeXPerToken,
        uint256 feeYPerToken
    );

    function getPriceFromId(uint24 id) external pure returns (uint256);
    
    function getIdFromPrice(uint256 price) external pure returns (uint24);
    
    function getSwapIn(uint256 amountOut, bool swapForY)
        external
        view
        returns (uint256 amountIn, uint256 amountOutLeft, uint256 fee);
    
    function getSwapOut(uint256 amountIn, bool swapForY)
        external
        view
        returns (uint256 amountInLeft, uint256 amountOut, uint256 fee);

    function getReserves() external view returns (uint128 reserveX, uint128 reserveY);
    
    function getGlobalFees() external view returns (uint128 feesXTotal, uint128 feesYTotal, uint128 feesXProtocol, uint128 feesYProtocol);
    
    function getOracleParameters() external view returns (
        uint8 sampleLifetime,
        uint16 size,
        uint16 activeSize,
        uint40 lastUpdated,
        uint16 firstLifetime
    );

    function getOracleSampleFrom(uint256 timeDelta) external view returns (
        uint256 cumulativeId,
        uint256 cumulativeAccumulator,
        uint256 cumulativeBinCrossed
    );

    function getOracleSampleAt(uint40 timestamp) external view returns (
        uint256 cumulativeId,
        uint256 cumulativeAccumulator,
        uint256 cumulativeBinCrossed
    );

    function getPriceFromOracle() external view returns (uint256);

    function tokenX() external view returns (address);
    function tokenY() external view returns (address);
    function binStep() external view returns (uint16);
    function factory() external view returns (address);
}

/**
 * @title ILBRouter
 * @dev Trader Joe V2 LB Router interface for swaps
 */
interface ILBRouter {
    function getAmountsOut(uint256 amountIn, address[] calldata path, uint256[] calldata binSteps)
        external
        view
        returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, address[] calldata path, uint256[] calldata binSteps)
        external
        view
        returns (uint256[] memory amounts);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        uint256[] calldata binSteps,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        uint256[] calldata binSteps,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * @title ITraderJoeV2Oracle
 * @dev Oracle interface specifically for Trader Joe V2 price feeds
 */
interface ITraderJoeV2Oracle {
    /**
     * @dev Get TWAP price from Trader Joe V2 LB pair
     * @param tokenX First token in pair
     * @param tokenY Second token in pair (usually USDC.e)
     * @param binStep Bin step for the pair
     * @param period TWAP period in seconds
     * @return price TWAP price in USD (18 decimals)
     * @return confidence Confidence level (0-10000)
     */
    function getTWAPPrice(
        address tokenX,
        address tokenY,
        uint256 binStep,
        uint256 period
    ) external view returns (uint256 price, uint256 confidence);

    /**
     * @dev Get spot price from Trader Joe V2 LB pair
     * @param tokenX First token in pair
     * @param tokenY Second token in pair (usually USDC.e)
     * @param binStep Bin step for the pair
     * @return price Spot price in USD (18 decimals)
     * @return confidence Confidence level (0-10000)
     */
    function getSpotPrice(
        address tokenX,
        address tokenY,
        uint256 binStep
    ) external view returns (uint256 price, uint256 confidence);

    /**
     * @dev Get liquidity depth for a pair
     * @param tokenX First token in pair
     * @param tokenY Second token in pair
     * @param binStep Bin step for the pair
     * @return liquidityX Liquidity in tokenX
     * @return liquidityY Liquidity in tokenY
     * @return totalLiquidity Total liquidity value in USD
     */
    function getLiquidityDepth(
        address tokenX,
        address tokenY,
        uint256 binStep
    ) external view returns (uint256 liquidityX, uint256 liquidityY, uint256 totalLiquidity);

    /**
     * @dev Check if a pair exists and has sufficient liquidity
     * @param tokenX First token in pair
     * @param tokenY Second token in pair
     * @param binStep Bin step for the pair
     * @param minLiquidity Minimum liquidity threshold
     * @return exists Whether pair exists
     * @return hasLiquidity Whether pair has sufficient liquidity
     */
    function isPairValid(
        address tokenX,
        address tokenY,
        uint256 binStep,
        uint256 minLiquidity
    ) external view returns (bool exists, bool hasLiquidity);
}
