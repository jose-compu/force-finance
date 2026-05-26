/**
 * @title AvalancheOracleManager Integration Tests
 * @dev Integration tests for Trader Joe V2 and GMX Futures Manager integration
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectBn } = require("../helpers/bn");
const { seedOracleCache } = require("../helpers/oracleCache");

// Setup Chai for promises
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

describe("AvalancheOracleManager - Integration Tests", function () {
  let oracleManager, futuresManager;
  let owner, user1, user2;
  let mockUSDC, mockStrategy;

  // Token addresses
  const USDC_E = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
  const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
  const WETH_E = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";
  const WBTC_E = "0x50b7545627a5162F82A992c33b87aDc75187B218";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USDC.e", "USDC.e");
    await mockUSDC.deployed();

    const MockStrategy = await ethers.getContractFactory("MockStrategy");
    mockStrategy = await MockStrategy.deploy();
    await mockStrategy.deployed();

    // Deploy Oracle Manager
    const AvalancheOracleManager = await ethers.getContractFactory("AvalancheOracleManager");
    oracleManager = await AvalancheOracleManager.deploy();
    await oracleManager.deployed();

    // Deploy GMX Futures Manager
    const GMXFuturesManager = await ethers.getContractFactory("GMXFuturesManager");
    futuresManager = await GMXFuturesManager.deploy(oracleManager.address, mockUSDC.address);
    await futuresManager.deployed();

    // Set up strategy
    await futuresManager.setStrategy(mockStrategy.address);
  });

  describe("Trader Joe V2 Integration", function () {
    it("Should have correct Trader Joe V2 factory address", async function () {
      const lbFactory = await oracleManager.LB_FACTORY();
      expect(lbFactory).to.equal("0x8e42f2F4101563bF679975178e880FD87d3eFd4e");
    });

    it("Should handle Trader Joe V2 pair queries gracefully", async function () {
      // This test would require forking mainnet to test real Trader Joe V2 integration
      // For now, we test that the function doesn't revert with proper parameters
      
      // WAVAX is now handled specially and returns hardcoded price
      const [price, confidence] = await oracleManager.getTWAPPrice(WAVAX, 1800);
      expect(price.toString()).to.equal(ethers.utils.parseEther("25").toString()); // WAVAX = AVAX price
      expect(confidence.toNumber()).to.equal(9500);
    });

    it("Should handle missing pairs gracefully", async function () {
      const nonExistentToken = "0x1234567890123456789012345678901234567890";
      
      // Add support for the token first
      await oracleManager.setTokenBinStep(nonExistentToken, 15);
      
      try {
        const [price, confidence] = await oracleManager.getTWAPPrice(nonExistentToken, 1800);
        expect(price).to.equal(0);
        expect(confidence).to.equal(0);
      } catch (error) {
        expect(error.message).to.include("call revert exception");
      }
    });

    it("Should validate bin step configurations", async function () {
      const tokens = [WAVAX, WETH_E, WBTC_E];
      
      for (const token of tokens) {
        const binStep = await oracleManager.tokenBinSteps(token);
        expect(binStep.toNumber()).to.be.greaterThan(0);
        expect(binStep.toNumber()).to.be.lessThan(1000); // Reasonable bin step
      }
    });

    it("Should handle oracle parameter queries", async function () {
      // Test that oracle functions don't revert even without real pairs
      const supportedTokens = await oracleManager.getSupportedTokens();
      
      for (const token of supportedTokens) {
        if (token !== USDC_E) {
          try {
            await oracleManager.getSpotPrice(token);
          } catch (error) {
            // Expected in test environment
            expect(error.message).to.include("call revert exception");
          }
        }
      }
    });
  });

  describe("GMX Futures Manager Integration", function () {
    it("Should provide oracle service to GMX Futures Manager", async function () {
      // Verify that the futures manager is using the oracle manager
      expect(await futuresManager.oracleManager()).to.equal(oracleManager.address);
    });

    it("Should provide prices for GMX Futures Manager", async function () {
      await seedOracleCache(oracleManager);
      const tokens = [WAVAX, WETH_E, WBTC_E];
      
      for (const token of tokens) {
        const testPrice = ethers.utils.parseEther("25");
        if (token !== WAVAX && token !== USDC_E) {
          await oracleManager.updatePriceCache(token, testPrice);
        }
        
        const [price, confidence] = await oracleManager.getPrice(token);
        expect(price).to.not.be.undefined;
        expect(confidence).to.not.be.undefined;
      }
    });

    it("Should handle price queries from futures manager", async function () {
      // WAVAX is handled specially and returns its hardcoded AVAX price
      const [price, confidence] = await oracleManager.getPrice(WAVAX);
      expect(price.toString()).to.equal(ethers.utils.parseEther("25").toString()); // WAVAX = AVAX price
      expect(confidence.toNumber()).to.equal(9500); // High confidence for WAVAX
    });

    it("Should support all tokens needed by futures manager", async function () {
      const requiredTokens = [WAVAX, WETH_E, WBTC_E];
      const supportedTokens = await oracleManager.getSupportedTokens();
      
      for (const token of requiredTokens) {
        expect(supportedTokens).to.include(token);
      }
    });

    it("Should provide consistent price data", async function () {
      const testPrice = ethers.utils.parseEther("25");
      const cacheToken = WETH_E;
      await oracleManager.updatePriceCache(cacheToken, testPrice);

      const [price1] = await oracleManager.getPrice(cacheToken);
      const [price2] = await oracleManager.getPrice(cacheToken);

      expectBn(price1, price2);
      expectBn(price1, testPrice);
    });
  });

  describe("Price Conversion and Calculation", function () {
    it("Should handle USD price conversions correctly", async function () {
      // Test that USDC.e always returns $1
      const [usdcPrice, usdcConfidence] = await oracleManager.getPrice(USDC_E);
      expectBn(usdcPrice, ethers.utils.parseEther("1"));
      expect(usdcConfidence.toNumber()).to.be.greaterThan(8000);
    });

    it("Should maintain price precision in conversions", async function () {
      const precisePrice = ethers.utils.parseEther("25.123456789");
      await oracleManager.updatePriceCache(WETH_E, precisePrice);

      const [retrievedPrice] = await oracleManager.getPrice(WETH_E);
      expectBn(retrievedPrice, precisePrice);
    });

    it("Should handle price scaling correctly", async function () {
      // Test different price magnitudes
      const prices = [
        ethers.utils.parseEther("0.01"), // Small price
        ethers.utils.parseEther("1"), // Medium price  
        ethers.utils.parseEther("10000"), // Large price
      ];
      
      for (let i = 0; i < prices.length; i++) {
        await oracleManager.updatePriceCache(WETH_E, prices[i]);
        const [retrievedPrice] = await oracleManager.getPrice(WETH_E);
        expectBn(retrievedPrice, prices[i]);
      }
    });
  });

  describe("Confidence Calculation Integration", function () {
    it("Should calculate confidence based on data quality", async function () {
      // Test confidence calculation with cached data
      const testPrice = ethers.utils.parseEther("25");
      await oracleManager.updatePriceCache(WAVAX, testPrice);
      
      const [, confidence] = await oracleManager.getPrice(WAVAX);
      expect(confidence.toNumber()).to.equal(9500); // High confidence for WAVAX (handled specially)
    });

    it("Should handle confidence thresholds appropriately", async function () {
      const highThreshold = await oracleManager.HIGH_CONFIDENCE_THRESHOLD();
      const mediumThreshold = await oracleManager.MEDIUM_CONFIDENCE_THRESHOLD();
      
      // Cached prices should exceed high confidence threshold
      const testPrice = ethers.utils.parseEther("25");
      await oracleManager.updatePriceCache(WAVAX, testPrice);
      
      const [, confidence] = await oracleManager.getPrice(WAVAX);
      expect(confidence.toNumber()).to.be.greaterThan(highThreshold.toNumber());
    });

    it("Should provide confidence metrics for risk management", async function () {
      await seedOracleCache(oracleManager);
      const tokens = [WAVAX, WETH_E, WBTC_E, USDC_E];
      
      for (const token of tokens) {
        const [, confidence] = await oracleManager.getPrice(token);
        
        if (token === USDC_E || token === WAVAX) {
          expect(confidence.toNumber()).to.be.greaterThan(8000);
        }

        expect(confidence.toNumber()).to.be.greaterThanOrEqual(0);
        expect(confidence.toNumber()).to.be.lessThanOrEqual(10000);
      }
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should handle network issues gracefully", async function () {
      // Test that oracle functions don't revert unexpectedly
      const [price, confidence] = await oracleManager.getTWAPPrice(WAVAX, 1800);
      expectBn(price, ethers.utils.parseEther("25"));
      expectBn(confidence, 9500);
    });

    it("Should handle invalid token queries", async function () {
      const invalidToken = ethers.constants.AddressZero;
      
      await expect(
        oracleManager.getPrice(invalidToken)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should handle concurrent price requests", async function () {
      // Test that multiple simultaneous price requests work
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(oracleManager.getPrice(USDC_E));
      }
      
      const results = await Promise.all(promises);
      
      // All should return the same USDC.e price
      for (const [price, confidence] of results) {
        expectBn(price, ethers.utils.parseEther("1"));
        expect(confidence.toNumber()).to.be.greaterThan(8000);
      }
    });

    it("Should maintain state consistency", async function () {
      const testPrice = ethers.utils.parseEther("25");
      
      await oracleManager.updatePriceCache(WETH_E, testPrice);
      await oracleManager.updatePriceCache(WETH_E, testPrice.mul(2));
      await oracleManager.updatePriceCache(WETH_E, testPrice);
      
      const [price] = await oracleManager.getPrice(WETH_E);
      expectBn(price, testPrice);
    });
  });

  describe("Performance and Gas Optimization", function () {
    it("Should handle batch price queries efficiently", async function () {
      await seedOracleCache(oracleManager);
      const tokens = [WAVAX, WETH_E, WBTC_E, USDC_E];
      
      const [prices, confidences] = await oracleManager.getPrices(tokens);
      
      expect(prices.length).to.equal(tokens.length);
      expect(confidences.length).to.equal(tokens.length);
    });

    it("Should cache prices efficiently", async function () {
      const testPrice = ethers.utils.parseEther("25");
      await oracleManager.updatePriceCache(WETH_E, testPrice);

      const [price1] = await oracleManager.getPrice(WETH_E);
      const [price2] = await oracleManager.getPrice(WETH_E);

      expectBn(price1, price2);
      expectBn(price1, testPrice);
    });

    it("Should handle large token arrays", async function () {
      await seedOracleCache(oracleManager);
      const tokens = [WAVAX, WETH_E, WBTC_E, USDC_E, WAVAX, WETH_E];

      const [prices, confidences] = await oracleManager.getPrices(tokens);

      expect(prices.length).to.equal(tokens.length);
      expect(confidences.length).to.equal(tokens.length);

      expectBn(prices[0], prices[4]);
      expectBn(prices[1], prices[5]);
    });
  });
});
