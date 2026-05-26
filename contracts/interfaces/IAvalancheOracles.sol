// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IAvalancheOracles
 * @dev Interfaces for Avalanche DEX price oracles
 */

// Trader Joe V2 Oracle Interface
interface ITraderJoeOracle {
    function getPrice(address token) external view returns (uint256 price);
    function getPriceFromQty(uint256 amountA, uint256 amountB) external view returns (uint256 price);
    function getLpTokenPrice(address lpToken) external view returns (uint256 price);
    function getLpTokenReserves(address lpToken) external view returns (uint256 reserveA, uint256 reserveB);
}

// BENQI Oracle Interface
interface IBENQIOracle {
    function getUnderlyingPrice(address cToken) external view returns (uint256);
    function getPrice(address asset) external view returns (uint256);
    function getAssetPrice(address asset) external view returns (uint256);
}

// Uniswap V3 Oracle Interface
interface IUniswapV3Oracle {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
    
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
    
    function liquidity() external view returns (uint128);
    
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    
    function ticks(int24 tick)
        external
        view
        returns (
            uint128 liquidityGross,
            int128 liquidityNet,
            uint256 feeGrowthOutside0X128,
            uint256 feeGrowthOutside1X128,
            int56 tickCumulativeOutside,
            uint160 secondsPerLiquidityOutsideX128,
            uint32 secondsOutside,
            bool initialized
        );
}

// Chainlink Price Feed Interface
interface IChainlinkPriceFeed {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
}

// Pyth Oracle Interface
interface IPythOracle {
    function getPrice(bytes32 priceId) external view returns (uint256 price, uint256 confidence, uint256 expo, uint256 publishTime);
    function getPriceUnsafe(bytes32 priceId) external view returns (uint256 price, uint256 confidence, uint256 expo, uint256 publishTime);
    function getPriceNoOlderThan(bytes32 priceId, uint256 age) external view returns (uint256 price, uint256 confidence, uint256 expo, uint256 publishTime);
    function getEmaPrice(bytes32 priceId) external view returns (uint256 price, uint256 confidence, uint256 expo, uint256 publishTime);
    function getEmaPriceUnsafe(bytes32 priceId) external view returns (uint256 price, uint256 confidence, uint256 expo, uint256 publishTime);
    function getEmaPriceNoOlderThan(bytes32 priceId, uint256 age) external view returns (uint256 price, uint256 confidence, uint256 expo, uint256 publishTime);
}

// Generic Oracle Interface
interface IOracle {
    function getPrice(address token) external view returns (uint256 price, uint256 confidence);
    function getPriceUSD(address token) external view returns (uint256 price);
    function getPriceETH(address token) external view returns (uint256 price);
    function getPriceAVAX(address token) external view returns (uint256 price);
    
    function isPriceValid(address token) external view returns (bool);
    function getLastUpdateTime(address token) external view returns (uint256);
    function getPriceAge(address token) external view returns (uint256);
}

// Price Aggregator Interface
interface IPriceAggregator {
    function getAggregatedPrice(address token) external view returns (uint256 price, uint256 confidence);
    function getWeightedPrice(address token) external view returns (uint256 price);
    function getMedianPrice(address token) external view returns (uint256 price);
    
    function addOracle(address oracle) external;
    function removeOracle(address oracle) external;
    function setOracleWeight(address oracle, uint256 weight) external;
    
    function getOracleCount() external view returns (uint256);
    function getOracle(uint256 index) external view returns (address);
    function getOracleWeight(address oracle) external view returns (uint256);
}
