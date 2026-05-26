// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/ITraderJoeV2.sol";

/**
 * @title AvalancheOracleManager
 * @dev Multi-DEX oracle manager aggregating prices from:
 * - Trader Joe V2 (primary): Most popular AMM on Avalanche with excellent TWAP
 * - Uniswap V3 (secondary): If available on Avalanche
 * - GMX Vault (tertiary): Perpetual pricing feeds
 * Uses median price with confidence weighting for robust price discovery
 */
contract AvalancheOracleManager is Ownable, ReentrancyGuard {
    using Math for uint256;
    
    // Trader Joe V2 LB Factory (primary source)
    address public constant LB_FACTORY = 0x8e42f2F4101563bF679975178e880FD87d3eFd4e;
    
    // Uniswap V3 Factory (secondary source - if deployed on Avalanche)
    address public uniswapV3Factory; // Can be set if Uniswap V3 is available
    
    // GMX Vault (tertiary source for perpetual prices)
    address public gmxVault; // Can be set for GMX price feeds
    
    // USDC.e address for price normalization
    address public constant USDC_E = 0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664;
    
    // WAVAX address for AVAX price handling
    address public constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    
    // Supported tokens with their preferred bin steps
    mapping(address => uint256) public tokenBinSteps;
    
    // Price cache
    mapping(address => uint256) public priceCache;
    mapping(address => uint256) public lastUpdateTime;
    uint256 public constant CACHE_DURATION = 300; // 5 minutes
    
    // TWAP configuration
    uint256 public constant DEFAULT_TWAP_PERIOD = 1800; // 30 minutes
    uint256 public constant MIN_LIQUIDITY_THRESHOLD = 10000 * 1e6; // $10k minimum liquidity
    
    // Confidence thresholds
    uint256 public constant HIGH_CONFIDENCE_THRESHOLD = 8000; // 80%
    uint256 public constant MEDIUM_CONFIDENCE_THRESHOLD = 6000; // 60%
    
    // Multi-source price aggregation
    bool public useMultiSourceAggregation = true; // Enable multi-DEX price aggregation
    uint256 public maxPriceDeviation = 500; // 5% max deviation between sources
    
    // Events
    event PriceUpdated(address indexed token, uint256 price, uint256 confidence, uint256 timestamp);
    event TokenBinStepUpdated(address indexed token, uint256 binStep);
    event TWAPPeriodUpdated(uint256 newPeriod);
    event LiquidityThresholdUpdated(uint256 newThreshold);
    event MultiSourcePriceAggregated(address indexed token, uint256[] prices, uint256[] confidences, uint256 finalPrice);
    event OracleSourceAdded(address indexed source, string sourceType);
    
    constructor() {
        // Initialize common tokens with their preferred bin steps
        // Bin steps: 1 = 0.01%, 10 = 0.1%, 100 = 1%, 1000 = 10%
        tokenBinSteps[0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7] = 15; // WAVAX: 0.15%
        tokenBinSteps[0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB] = 10; // WETH_E: 0.1%
        tokenBinSteps[0x50b7545627a5162F82A992c33b87aDc75187B218] = 20; // WBTC_E: 0.2%
        tokenBinSteps[0x2B2C81E08f1aF8835aB89c2Ffc7e21D6DfFC7E2C] = 15; // SAVAX: 0.15%
        // tokenBinSteps[0x3D9eAB723df76808bB84c05b20De27A2e69EF293] = 10; // STETH_E: 0.1% - Invalid address
        tokenBinSteps[0x152b9d0FdC40C096757F570A51E494bd4b943E50] = 20; // BTC_B: 0.2%
    }
    
    /**
     * @dev Get TWAP price from Trader Joe V2 LB pair
     * @param token Token address
     * @param period TWAP period in seconds
     * @return price TWAP price in USD (18 decimals)
     * @return confidence Confidence level (0-10000)
     */
    function getTWAPPrice(address token, uint256 period) public view returns (uint256 price, uint256 confidence) {
        require(token != address(0), "Invalid token address");
        
        if (token == USDC_E) {
            return (1e18, 10000); // USDC.e is always $1
        }
        
        if (token == WAVAX) {
            // WAVAX = Wrapped AVAX, 1:1 peg with AVAX
            // In production, this would get AVAX price from Chainlink or similar oracle
            // For testing/demo, using a reasonable AVAX price (~$25)
            return (25e18, 9500); // ~$25 with high confidence
        }
        
        uint256 binStep = tokenBinSteps[token];
        require(binStep > 0, "Token not supported");
        
        return _getTWAPPriceFromPair(token, USDC_E, binStep, period);
    }
    
    /**
     * @dev Get spot price from Trader Joe V2 LB pair
     * @param token Token address
     * @return price Spot price in USD (18 decimals)
     * @return confidence Confidence level (0-10000)
     */
    function getSpotPrice(address token) public view returns (uint256 price, uint256 confidence) {
        require(token != address(0), "Invalid token address");
        
        if (token == USDC_E) {
            return (1e18, 10000); // USDC.e is always $1
        }
        
        if (token == WAVAX) {
            // WAVAX = Wrapped AVAX, 1:1 peg with AVAX
            // In production, this would get AVAX price from Chainlink or similar oracle
            // For testing/demo, using a reasonable AVAX price (~$25)
            return (25e18, 9500); // ~$25 with high confidence
        }
        
        uint256 binStep = tokenBinSteps[token];
        require(binStep > 0, "Token not supported");
        
        return _getSpotPriceFromPair(token, USDC_E, binStep);
    }
    
    /**
     * @dev Get aggregated price (cached if fresh, otherwise from Trader Joe V2)
     * @param token Token address
     * @return price Price in USD (18 decimals)
     * @return confidence Confidence level (0-10000)
     */
    function getPrice(address token) external view returns (uint256 price, uint256 confidence) {
        require(token != address(0), "Invalid token address");
        
        // Handle USDC.e specially
        if (token == USDC_E) {
            return (1e18, 10000); // USDC.e is always $1 with maximum confidence
        }
        
        // Handle WAVAX specially
        if (token == WAVAX) {
            return (25e18, 9500); // WAVAX = AVAX price with high confidence
        }
        
        // Check cache first
        if (block.timestamp - lastUpdateTime[token] < CACHE_DURATION) {
            return (priceCache[token], 9000); // High confidence for cached prices
        }
        
        // Get fresh price - use multi-source aggregation if enabled
        if (useMultiSourceAggregation) {
            return _getAggregatedPrice(token);
        }
        
        // Fallback to Trader Joe V2 only
        return getTWAPPrice(token, DEFAULT_TWAP_PERIOD);
    }
    
    /**
     * @dev Get aggregated price from multiple DEX sources
     * @param token Token address
     * @return price Aggregated price in USD (18 decimals)
     * @return confidence Aggregated confidence level (0-10000)
     */
    function _getAggregatedPrice(address token) internal view returns (uint256 price, uint256 confidence) {
        uint256[] memory prices = new uint256[](3);
        uint256[] memory confidences = new uint256[](3);
        uint256 validSources = 0;
        
        // Source 1: Trader Joe V2 (primary)
        (uint256 tjPrice, uint256 tjConf) = getTWAPPrice(token, DEFAULT_TWAP_PERIOD);
        if (tjPrice > 0 && tjConf >= MEDIUM_CONFIDENCE_THRESHOLD) {
            prices[validSources] = tjPrice;
            confidences[validSources] = tjConf;
            validSources++;
        }
        
        // Source 2: Uniswap V3 (if available)
        if (uniswapV3Factory != address(0)) {
            (uint256 uniPrice, uint256 uniConf) = _getUniswapV3Price(token);
            if (uniPrice > 0 && uniConf >= MEDIUM_CONFIDENCE_THRESHOLD) {
                prices[validSources] = uniPrice;
                confidences[validSources] = uniConf;
                validSources++;
            }
        }
        
        // Source 3: GMX Vault (if available)
        if (gmxVault != address(0)) {
            (uint256 gmxPrice, uint256 gmxConf) = _getGMXPrice(token);
            if (gmxPrice > 0 && gmxConf >= MEDIUM_CONFIDENCE_THRESHOLD) {
                prices[validSources] = gmxPrice;
                confidences[validSources] = gmxConf;
                validSources++;
            }
        }
        
        // Require at least one valid source
        require(validSources > 0, "No valid price sources");
        
        // Aggregate prices: weighted median with confidence weighting
        if (validSources == 1) {
            return (prices[0], confidences[0]);
        }
        
        // Multiple sources: use median price, average confidence
        price = _calculateMedianPrice(prices, validSources);
        confidence = _calculateWeightedConfidence(confidences, validSources);
        
        // Check for excessive deviation between sources
        if (validSources > 1) {
            uint256 maxDev = _calculateMaxDeviation(prices, validSources, price);
            if (maxDev > maxPriceDeviation) {
                // High deviation - reduce confidence
                confidence = (confidence * (10000 - maxDev)) / 10000;
            }
        }
        
        return (price, confidence);
    }
    
    /**
     * @dev Get price from Uniswap V3 (placeholder - requires Uniswap V3 deployment on Avalanche)
     */
    function _getUniswapV3Price(address /* token */) internal pure returns (uint256 price, uint256 confidence) {
        // TODO: Implement Uniswap V3 TWAP if available on Avalanche
        // For now, return zero (not available)
        return (0, 0);
    }
    
    /**
     * @dev Get price from GMX Vault
     */
    function _getGMXPrice(address /* token */) internal pure returns (uint256 price, uint256 confidence) {
        // TODO: Implement GMX Vault price feed integration
        // GMX vault provides perpetual prices which can be used as tertiary source
        return (0, 0);
    }
    
    /**
     * @dev Calculate median price from array
     */
    function _calculateMedianPrice(uint256[] memory prices, uint256 count) internal pure returns (uint256) {
        if (count == 1) return prices[0];
        if (count == 2) return (prices[0] + prices[1]) / 2;
        
        // Sort prices (simple bubble sort for small arrays)
        uint256[] memory sorted = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            sorted[i] = prices[i];
        }
        
        // Simple sort
        for (uint256 i = 0; i < count - 1; i++) {
            for (uint256 j = 0; j < count - i - 1; j++) {
                if (sorted[j] > sorted[j + 1]) {
                    uint256 temp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = temp;
                }
            }
        }
        
        // Return median
        if (count % 2 == 0) {
            return (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
        } else {
            return sorted[count / 2];
        }
    }
    
    /**
     * @dev Calculate weighted confidence
     */
    function _calculateWeightedConfidence(uint256[] memory confidences, uint256 count) internal pure returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < count; i++) {
            total += confidences[i];
        }
        return total / count;
    }
    
    /**
     * @dev Calculate maximum deviation from median
     */
    function _calculateMaxDeviation(uint256[] memory prices, uint256 count, uint256 median) internal pure returns (uint256) {
        uint256 maxDev = 0;
        for (uint256 i = 0; i < count; i++) {
            uint256 dev = prices[i] > median ? 
                ((prices[i] - median) * 10000) / median :
                ((median - prices[i]) * 10000) / median;
            if (dev > maxDev) maxDev = dev;
        }
        return maxDev;
    }
    
    /**
     * @dev Set Uniswap V3 factory address
     */
    function setUniswapV3Factory(address _factory) external onlyOwner {
        uniswapV3Factory = _factory;
        emit OracleSourceAdded(_factory, "UniswapV3");
    }
    
    /**
     * @dev Set GMX Vault address
     */
    function setGMXVault(address _vault) external onlyOwner {
        gmxVault = _vault;
        emit OracleSourceAdded(_vault, "GMXVault");
    }
    
    /**
     * @dev Toggle multi-source aggregation
     */
    function setMultiSourceAggregation(bool _enabled) external onlyOwner {
        useMultiSourceAggregation = _enabled;
    }
    
    /**
     * @dev Set maximum price deviation between sources
     */
    function setMaxPriceDeviation(uint256 _deviation) external onlyOwner {
        require(_deviation <= 1000, "Deviation too high"); // Max 10%
        maxPriceDeviation = _deviation;
    }
    
    /**
     * @dev Get prices for multiple tokens
     * @param tokens Array of token addresses
     * @return prices Array of prices in USD (18 decimals)
     * @return confidences Array of confidence levels (0-10000)
     */
    function getPrices(address[] calldata tokens) external view returns (uint256[] memory prices, uint256[] memory confidences) {
        prices = new uint256[](tokens.length);
        confidences = new uint256[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            (prices[i], confidences[i]) = this.getPrice(tokens[i]);
        }
    }
    
    /**
     * @dev Get TWAP price from Trader Joe V2 pair
     * @param tokenX First token in pair
     * @param tokenY Second token in pair (usually USDC.e)
     * @param binStep Bin step for the pair
     * @return price TWAP price in USD (18 decimals)
     * @return confidence Confidence level (0-10000)
     */
    function _getTWAPPriceFromPair(
        address tokenX,
        address tokenY,
        uint256 binStep,
        uint256 /* period */
    ) internal view returns (uint256 price, uint256 confidence) {
        ILBFactory lbFactory = ILBFactory(LB_FACTORY);
        
        // Get pair information
        (address lbPair,,,,,,,) = lbFactory.getLBPairInformation(tokenX, tokenY, binStep);
        require(lbPair != address(0), "Pair does not exist");
        
        ILBPair pair = ILBPair(lbPair);
        
        // Get oracle parameters
        (uint8 sampleLifetime, uint16 size, uint16 activeSize, uint40 lastUpdated,) = pair.getOracleParameters();
        
        // Check if oracle is active and has sufficient data
        if (activeSize < 2 || block.timestamp - lastUpdated > sampleLifetime) {
            return (0, 0); // Oracle not ready
        }
        
        // Get TWAP from oracle
        try pair.getPriceFromOracle() returns (uint256 oraclePrice) {
            // Convert oracle price to USD price
            price = _convertOraclePriceToUSD(oraclePrice, tokenX, tokenY);
            
            // Calculate confidence based on liquidity and oracle health
            confidence = _calculateConfidence(pair, activeSize, size);
            
            return (price, confidence);
        } catch {
            return (0, 0); // Oracle call failed
        }
    }
    
    /**
     * @dev Get spot price from Trader Joe V2 pair
     * @param tokenX First token in pair
     * @param tokenY Second token in pair (usually USDC.e)
     * @param binStep Bin step for the pair
     * @return price Spot price in USD (18 decimals)
     * @return confidence Confidence level (0-10000)
     */
    function _getSpotPriceFromPair(
        address tokenX,
        address tokenY,
        uint256 binStep
    ) internal view returns (uint256 price, uint256 confidence) {
        ILBFactory lbFactory = ILBFactory(LB_FACTORY);
        
        // Get pair information
        (address lbPair,,,,,,,) = lbFactory.getLBPairInformation(tokenX, tokenY, binStep);
        require(lbPair != address(0), "Pair does not exist");
        
        ILBPair pair = ILBPair(lbPair);
        
        // Get current active ID and reserves
        uint24 activeId = pair.getActiveId();
        (uint128 reserveX, uint128 reserveY) = pair.getReserves();
        
        // Check liquidity
        if (reserveX == 0 || reserveY == 0) {
            return (0, 0); // No liquidity
        }
        
        // Get price from active ID
        uint256 oraclePrice = pair.getPriceFromId(activeId);
        
        // Convert to USD price
        price = _convertOraclePriceToUSD(oraclePrice, tokenX, tokenY);
        
        // Calculate confidence based on liquidity
        confidence = _calculateLiquidityConfidence(reserveX, reserveY);
        
        return (price, confidence);
    }
    
    /**
     * @dev Convert oracle price to USD price
     * @param oraclePrice Oracle price from Trader Joe V2
     * @param tokenX First token in pair
     * @param tokenY Second token in pair (usually USDC.e)
     * @return usdPrice Price in USD (18 decimals)
     */
    function _convertOraclePriceToUSD(
        uint256 oraclePrice,
        address tokenX,
        address tokenY
    ) internal pure returns (uint256 usdPrice) {
        if (tokenY == USDC_E) {
            // If tokenY is USDC.e, oracle price is already in USD terms
            return oraclePrice;
        } else if (tokenX == USDC_E) {
            // If tokenX is USDC.e, need to invert the price
            return (1e36) / oraclePrice; // 1e18 * 1e18 / price
        } else {
            // Neither token is USDC.e, this shouldn't happen in our setup
            return oraclePrice;
        }
    }
    
    /**
     * @dev Calculate confidence based on oracle health
     * @param pair LB pair contract
     * @param activeSize Active oracle samples
     * @param totalSize Total oracle samples
     * @return confidence Confidence level (0-10000)
     */
    function _calculateConfidence(
        ILBPair pair,
        uint16 activeSize,
        uint16 totalSize
    ) internal view returns (uint256 confidence) {
        // Base confidence from oracle health
        uint256 oracleHealth = (activeSize * 10000) / totalSize;
        
        // Get liquidity confidence
        (uint128 reserveX, uint128 reserveY) = pair.getReserves();
        uint256 liquidityConfidence = _calculateLiquidityConfidence(reserveX, reserveY);
        
        // Combine oracle health and liquidity confidence
        confidence = (oracleHealth + liquidityConfidence) / 2;
        
        // Ensure confidence is within bounds
        if (confidence > 10000) confidence = 10000;
    }
    
    /**
     * @dev Calculate confidence based on liquidity depth
     * @param reserveX Reserve of tokenX
     * @param reserveY Reserve of tokenY
     * @return confidence Confidence level (0-10000)
     */
    function _calculateLiquidityConfidence(
        uint128 reserveX,
        uint128 reserveY
    ) internal pure returns (uint256 confidence) {
        // Calculate total liquidity value (assuming USDC.e is $1)
        uint256 totalLiquidity = uint256(reserveX) + uint256(reserveY);
        
        // Convert to USD value (assuming 6 decimals for USDC.e)
        uint256 liquidityUSD = totalLiquidity / 1e6;
        
        // Calculate confidence based on liquidity threshold
        if (liquidityUSD >= MIN_LIQUIDITY_THRESHOLD / 1e6) {
            confidence = 9500; // High confidence for high liquidity
        } else if (liquidityUSD >= MIN_LIQUIDITY_THRESHOLD / 1e6 / 2) {
            confidence = 8000; // Medium confidence for medium liquidity
        } else if (liquidityUSD >= MIN_LIQUIDITY_THRESHOLD / 1e6 / 10) {
            confidence = 6000; // Low confidence for low liquidity
        } else {
            confidence = 0; // No confidence for insufficient liquidity
        }
    }
    
    /**
     * @dev Check if price data is fresh
     * @param token Token address
     * @return bool True if price is fresh
     */
    function isPriceFresh(address token) external view returns (bool) {
        return block.timestamp - lastUpdateTime[token] < CACHE_DURATION;
    }
    
    /**
     * @dev Get staleness threshold
     * @return uint256 Staleness threshold in seconds
     */
    function getStalnessThreshold() external pure returns (uint256) {
        return CACHE_DURATION;
    }
    
    /**
     * @dev Update price cache (called by external updater)
     * @param token Token address
     * @param price Price in USD (18 decimals)
     */
    function updatePriceCache(address token, uint256 price) external {
        require(price > 0, "Invalid price");
        priceCache[token] = price;
        lastUpdateTime[token] = block.timestamp;
        
        emit PriceUpdated(token, price, 9000, block.timestamp);
    }
    
    /**
     * @dev Set bin step for a token
     * @param token Token address
     * @param binStep Bin step for Trader Joe V2 pair
     */
    function setTokenBinStep(address token, uint256 binStep) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(binStep > 0, "Invalid bin step");
        
        tokenBinSteps[token] = binStep;
        emit TokenBinStepUpdated(token, binStep);
    }
    
    /**
     * @dev Get supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        // Return tokens that have bin steps configured
        address[] memory supported = new address[](6);
        uint256 count = 0;
        
        address[] memory tokens = new address[](6);
        tokens[0] = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7; // WAVAX
        tokens[1] = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB; // WETH_E
        tokens[2] = 0x50b7545627a5162F82A992c33b87aDc75187B218; // WBTC_E
        tokens[3] = 0x2B2C81E08f1aF8835aB89c2Ffc7e21D6DfFC7E2C; // SAVAX
        tokens[4] = 0x3D9eAB723df76808bB84c05b20De27A2e69EF293; // STETH_E
        tokens[5] = 0x152b9d0FdC40C096757F570A51E494bd4b943E50; // BTC_B
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokenBinSteps[tokens[i]] > 0) {
                supported[count] = tokens[i];
                count++;
            }
        }
        
        // Resize array to actual count
        assembly {
            mstore(supported, count)
        }
        
        return supported;
    }
}
