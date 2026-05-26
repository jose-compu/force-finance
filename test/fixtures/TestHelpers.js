/**
 * @title TestHelpers
 * @dev Utilities for testing with Avalanche mainnet forking
 */

const { ethers } = require("hardhat");
const { time, impersonateAccount, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const addresses = require("./AvalancheAddresses");

class TestHelpers {
  
  /**
   * @dev Impersonate a whale account and get tokens
   */
  static async impersonateWhale(whaleAddress, tokenAddress, recipientAddress, amount) {
    // Impersonate the whale account
    await impersonateAccount(whaleAddress);
    
    // Give the whale some ETH for gas
    await setBalance(whaleAddress, ethers.utils.parseEther("100"));
    
    // Get the whale signer
    const whaleSigner = await ethers.getSigner(whaleAddress);
    
    // Get token contract
    const token = await ethers.getContractAt("IERC20", tokenAddress, whaleSigner);
    
    // Transfer tokens to recipient
    await token.transfer(recipientAddress, amount);
    
    return whaleSigner;
  }

  /**
   * @dev Setup test tokens for an account
   */
  static async setupTestTokens(userAddress, amounts = {}) {
    const tokens = {};
    
    // Default amounts if not specified
    const defaultAmounts = {
      WAVAX: ethers.utils.parseEther("1000"),
      WETH_E: ethers.utils.parseEther("10"), 
      WBTC_E: ethers.utils.parseUnits("1", 8), // 1 BTC
      USDC_E: ethers.utils.parseUnits("50000", 6), // 50k USDC
      SAVAX: ethers.utils.parseEther("500") // 500 sAVAX
    };

    const tokenAmounts = { ...defaultAmounts, ...amounts };

    // Get tokens from whales
    for (const [tokenSymbol, amount] of Object.entries(tokenAmounts)) {
      const tokenAddress = addresses[tokenSymbol];
      const whaleAddress = addresses.WHALES[tokenSymbol];
      
      if (tokenAddress && whaleAddress) {
        await this.impersonateWhale(whaleAddress, tokenAddress, userAddress, amount);
        tokens[tokenSymbol] = await ethers.getContractAt("IERC20", tokenAddress);
      }
    }

    return tokens;
  }

  /**
   * @dev Get current GMX pool utilization
   */
  static async getGMXPoolUtilization(tokenAddress) {
    const gmxVault = await ethers.getContractAt("IGMXVault", addresses.GMX_VAULT);
    
    const poolAmount = await gmxVault.poolAmounts(tokenAddress);
    const reservedAmount = await gmxVault.reservedAmounts(tokenAddress);
    
    if (poolAmount === 0n) return 0;
    
    const utilization = (reservedAmount * 10000n) / poolAmount;
    return Number(utilization);
  }

  /**
   * @dev Get real DEX prices for comparison
   */
  static async getTraderJoeV2Price(token0, token1, binStep = 15) {
    const lbFactory = await ethers.getContractAt("ILBFactory", addresses.LB_FACTORY);
    
    const pairAddress = await lbFactory.getLBPairInformation(token0, token1, binStep);
    
    if (pairAddress === ethers.constants.AddressZero) {
      throw new Error(`No LB pair found for ${token0}/${token1} with bin step ${binStep}`);
    }
    
    const lbPair = await ethers.getContractAt("ILBPair", pairAddress);
    const activeId = await lbPair.getActiveId();
    const price = await lbPair.getPriceFromId(activeId);
    
    return price;
  }

  /**
   * @dev Get Uniswap V3 TWAP price
   */
  static async getUniswapV3TWAP(token0, token1, fee = 3000, period = 1800) {
    const uniFactory = await ethers.getContractAt("IUniswapV3Factory", addresses.UNISWAP_V3_FACTORY);
    
    const poolAddress = await uniFactory.getPool(token0, token1, fee);
    
    if (poolAddress === ethers.constants.AddressZero) {
      throw new Error(`No Uniswap V3 pool found for ${token0}/${token1} with fee ${fee}`);
    }
    
    const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
    
    const secondsAgos = [period, 0];
    const [tickCumulatives] = await pool.observe(secondsAgos);
    
    const tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
    const tick = Number(tickCumulativesDelta) / period;
    
    // Convert tick to price (simplified)
    const price = Math.pow(1.0001, tick);
    return ethers.utils.parseUnits(price.toString(), 18);
  }

  /**
   * @dev Simulate market volatility by advancing time and changing block
   */
  static async simulateVolatility(hours = 24) {
    const hoursInSeconds = hours * 3600;
    await time.increase(hoursInSeconds);
    
    // Mine some blocks to simulate passage of time
    for (let i = 0; i < hours; i++) {
      await time.increase(3600); // 1 hour
    }
  }

  /**
   * @dev Check if address has sufficient balance
   */
  static async checkBalance(tokenAddress, userAddress, requiredAmount) {
    const token = await ethers.getContractAt("IERC20", tokenAddress);
    const balance = await token.balanceOf(userAddress);
    return balance >= requiredAmount;
  }

  /**
   * @dev Get sAVAX exchange rate
   */
  static async getSAVAXExchangeRate() {
    const sAvax = await ethers.getContractAt("ISAVAXToken", addresses.SAVAX);
    const rate = await sAvax.getExchangeRate();
    return rate;
  }

  /**
   * @dev Calculate expected IL for a given price change
   */
  static calculateImpermanentLoss(initialPrice, currentPrice) {
    const priceRatio = currentPrice / initialPrice;
    const sqrtRatio = Math.sqrt(priceRatio);
    const ilFactor = (2 * sqrtRatio) / (1 + priceRatio);
    return ilFactor - 1; // Negative value indicates loss
  }

  /**
   * @dev Setup GMX position for testing
   */
  static async setupGMXPosition(userSigner, indexToken, collateralAmount, sizeDelta, isLong = false) {
    const gmxRouter = await ethers.getContractAt("IGMXRouter", addresses.GMX_ROUTER, userSigner);
    const usdc = await ethers.getContractAt("IERC20", addresses.USDC_E, userSigner);
    
    // Approve USDC for GMX
    await usdc.approve(addresses.GMX_ROUTER, collateralAmount);
    
    const path = [addresses.USDC_E];
    const executionFee = ethers.utils.parseEther("0.01");
    
    // Create position
    await gmxRouter.createIncreasePosition(
      path,
      indexToken,
      collateralAmount,
      0, // minOut
      sizeDelta,
      isLong,
      ethers.utils.parseUnits("999999", 30), // acceptablePrice (very high for testing)
      executionFee,
      ethers.constants.HashZero, // referralCode
      ethers.constants.AddressZero, // callbackTarget
      { value: executionFee }
    );
  }

  /**
   * @dev Fast forward to specific block number
   */
  static async fastForwardToBlock(blockNumber) {
    const currentBlock = await ethers.provider.getBlockNumber();
    if (blockNumber > currentBlock) {
      const blocksToMine = blockNumber - currentBlock;
      for (let i = 0; i < blocksToMine; i++) {
        await time.increase(3); // ~3 seconds per block on Avalanche
      }
    }
  }

  /**
   * @dev Get real protocol metrics for comparison
   */
  static async getProtocolMetrics() {
    const gmxVault = await ethers.getContractAt("IGMXVault", addresses.GMX_VAULT);
    
    const metrics = {};
    
    // Get pool data for major tokens
    for (const [symbol, address] of Object.entries({
      WAVAX: addresses.WAVAX,
      WETH_E: addresses.WETH_E,
      WBTC_E: addresses.WBTC_E
    })) {
      const poolAmount = await gmxVault.poolAmounts(address);
      const reservedAmount = await gmxVault.reservedAmounts(address);
      const utilization = poolAmount.gt(0) ? reservedAmount.mul(10000).div(poolAmount) : 0;
      
      metrics[symbol] = {
        poolAmount: ethers.utils.formatEther(poolAmount),
        reservedAmount: ethers.utils.formatEther(reservedAmount),
        utilization: utilization.toNumber ? utilization.toNumber() : Number(utilization), // basis points
        available: ethers.utils.formatEther(poolAmount.sub(reservedAmount))
      };
    }
    
    return metrics;
  }

  /**
   * @dev Verify contract deployment and initialization
   */
  static async verifyContractDeployment(contractAddress, expectedFunctions = []) {
    const code = await ethers.provider.getCode(contractAddress);
    
    if (code === "0x") {
      throw new Error(`No contract deployed at ${contractAddress}`);
    }
    
    // Check if contract has expected functions
    if (expectedFunctions.length > 0) {
      const contract = await ethers.getContractAt("AvalancheLSTStrategyV2", contractAddress);
      
      for (const functionName of expectedFunctions) {
        if (typeof contract[functionName] !== "function") {
          throw new Error(`Contract missing expected function: ${functionName}`);
        }
      }
    }
    
    return true;
  }

  /**
   * @dev Generate test scenarios with different market conditions
   */
  static generateTestScenarios() {
    return [
      {
        name: "Bull Market",
        description: "Strong upward price movement",
        priceChanges: { AVAX: 1.5, ETH: 1.3, BTC: 1.2 },
        expectedIL: "negative", // Positions should lose due to IL
        leverageAdjustment: "increase"
      },
      {
        name: "Bear Market", 
        description: "Strong downward price movement",
        priceChanges: { AVAX: 0.7, ETH: 0.8, BTC: 0.75 },
        expectedIL: "negative",
        leverageAdjustment: "decrease"
      },
      {
        name: "High Volatility",
        description: "Large price swings up and down",
        priceChanges: { AVAX: 1.2, ETH: 0.9, BTC: 1.1 },
        expectedIL: "high_negative",
        leverageAdjustment: "dynamic"
      },
      {
        name: "Stable Market",
        description: "Minimal price movement",
        priceChanges: { AVAX: 1.01, ETH: 0.99, BTC: 1.005 },
        expectedIL: "minimal",
        leverageAdjustment: "maintain"
      }
    ];
  }
}

module.exports = TestHelpers;
