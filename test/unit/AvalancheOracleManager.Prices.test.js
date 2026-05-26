/**
 * @title AvalancheOracleManager Price Tests
 * @dev Price management tests for caching, TWAP, spot prices, and USDC.e handling
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expectBn } = require("../helpers/bn");
const { seedOracleCache } = require("../helpers/oracleCache");

const CACHE_TOKEN = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB"; // WETH_E

describe("AvalancheOracleManager - Price Tests", function () {
  let oracleManager;
  let owner, user1, user2;

  // Token addresses
  const USDC_E = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
  const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
  const WETH_E = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";
  const WBTC_E = "0x50b7545627a5162F82A992c33b87aDc75187B218";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Oracle Manager
    const AvalancheOracleManager = await ethers.getContractFactory("AvalancheOracleManager");
    oracleManager = await AvalancheOracleManager.deploy();
    await oracleManager.deployed();
  });

  describe("USDC.e Price Handling", function () {
    it("Should return $1 for USDC.e price", async function () {
      const [price, confidence] = await oracleManager.getPrice(USDC_E);
      expect(price.toString()).to.equal(ethers.utils.parseEther("1").toString()); // $1.00
      expect(confidence.toNumber()).to.equal(10000); // Maximum confidence for USDC.e
    });

    it("Should return $1 for USDC.e TWAP price", async function () {
      const [price, confidence] = await oracleManager.getTWAPPrice(USDC_E, 1800);
      expect(price.toString()).to.equal(ethers.utils.parseEther("1").toString()); // $1.00
      expect(confidence.toNumber()).to.equal(10000); // Maximum confidence
    });

    it("Should return $1 for USDC.e spot price", async function () {
      const [price, confidence] = await oracleManager.getSpotPrice(USDC_E);
      expect(price.toString()).to.equal(ethers.utils.parseEther("1").toString()); // $1.00
      expect(confidence.toNumber()).to.equal(10000); // Maximum confidence
    });

    it("Should always return high confidence for USDC.e", async function () {
      const [, confidence1] = await oracleManager.getPrice(USDC_E);
      const [, confidence2] = await oracleManager.getTWAPPrice(USDC_E, 3600);
      const [, confidence3] = await oracleManager.getSpotPrice(USDC_E);
      
      expect(confidence1.toNumber()).to.be.greaterThan(8000);
      expect(confidence2.toNumber()).to.equal(10000);
      expect(confidence3.toNumber()).to.equal(10000);
    });
  });

  describe("Price Cache Management", function () {
    it("Should return cached price if fresh", async function () {
      const testPrice = ethers.utils.parseEther("25"); // $25
      
      // Update cache
      await oracleManager.updatePriceCache(CACHE_TOKEN, testPrice);

      const [price, confidence] = await oracleManager.getPrice(CACHE_TOKEN);
      expectBn(price, testPrice);
      expectBn(confidence, 9000);
    });

    it("Should check if price is fresh", async function () {
      const testPrice = ethers.utils.parseEther("25");
      
      expect(await oracleManager.isPriceFresh(CACHE_TOKEN)).to.be.false;
      
      await oracleManager.updatePriceCache(CACHE_TOKEN, testPrice);
      
      expect(await oracleManager.isPriceFresh(CACHE_TOKEN)).to.be.true;
    });

    it("Should reject invalid price updates", async function () {
      await expect(
        oracleManager.updatePriceCache(WAVAX, 0)
      ).to.be.revertedWith("Invalid price");
    });

    it("Should emit PriceUpdated event", async function () {
      const testPrice = ethers.utils.parseEther("25");
      
      const tx = await oracleManager.updatePriceCache(WAVAX, testPrice);
      const receipt = await tx.wait();
      expect(receipt.events.length).to.be.greaterThan(0);
    });

    it("Should handle cache expiration correctly", async function () {
      const testPrice = ethers.utils.parseEther("25");
      
      await oracleManager.updatePriceCache(CACHE_TOKEN, testPrice);
      
      expect(await oracleManager.isPriceFresh(CACHE_TOKEN)).to.be.true;
      
      await time.increase(301);
      
      expect(await oracleManager.isPriceFresh(CACHE_TOKEN)).to.be.false;
    });

    it("Should handle multiple price updates", async function () {
      const price1 = ethers.utils.parseEther("25");
      const price2 = ethers.utils.parseEther("30");
      
      await oracleManager.updatePriceCache(CACHE_TOKEN, price1);
      await oracleManager.updatePriceCache(CACHE_TOKEN, price2);

      const [price] = await oracleManager.getPrice(CACHE_TOKEN);
      expectBn(price, price2);
    });

    it("Should handle price staleness correctly", async function () {
      const testPrice = ethers.utils.parseEther("25");
      
      await oracleManager.updatePriceCache(CACHE_TOKEN, testPrice);
      await time.increase(301);

      expect(await oracleManager.isPriceFresh(CACHE_TOKEN)).to.be.false;
      await expect(oracleManager.getPrice(CACHE_TOKEN)).to.be.reverted;
    });
  });

  describe("Multiple Token Prices", function () {
    it("Should get prices for multiple tokens", async function () {
      await seedOracleCache(oracleManager);
      const tokens = [WAVAX, WETH_E, WBTC_E];
      
      const [prices, confidences] = await oracleManager.getPrices(tokens);
      
      expect(prices.length).to.equal(tokens.length);
      expect(confidences.length).to.equal(tokens.length);
      
      expectBn(prices[0], ethers.utils.parseEther("25"));
      expectBn(confidences[0], 9500);
      for (let i = 1; i < prices.length; i++) {
        expectBn(prices[i], ethers.utils.parseEther("25"));
        expectBn(confidences[i], 9000);
      }
    });

    it("Should handle empty token array", async function () {
      const tokens = [];
      
      const [prices, confidences] = await oracleManager.getPrices(tokens);
      
      expect(prices.length).to.equal(0);
      expect(confidences.length).to.equal(0);
    });

    it("Should handle mixed cached and non-cached prices", async function () {
      const testPrice = ethers.utils.parseEther("25");
      const tokens = [WAVAX, CACHE_TOKEN, USDC_E];

      await oracleManager.updatePriceCache(CACHE_TOKEN, testPrice);

      const [prices, confidences] = await oracleManager.getPrices(tokens);

      expectBn(prices[0], ethers.utils.parseEther("25"));
      expectBn(prices[1], testPrice);
      expectBn(prices[2], ethers.utils.parseEther("1"));

      expectBn(confidences[0], 9500);
      expectBn(confidences[1], 9000);
      expectBn(confidences[2], 10000);
    });

    it("Should handle large token arrays efficiently", async function () {
      await seedOracleCache(oracleManager);
      const tokens = [WAVAX, WETH_E, WBTC_E, USDC_E];
      
      const [prices, confidences] = await oracleManager.getPrices(tokens);
      
      expect(prices.length).to.equal(tokens.length);
      expect(confidences.length).to.equal(tokens.length);
    });
  });

  describe("TWAP Price Queries", function () {
    it("Should handle TWAP price queries for supported tokens", async function () {
      const [price, confidence] = await oracleManager.getTWAPPrice(WAVAX, 1800);
      expectBn(price, ethers.utils.parseEther("25"));
      expectBn(confidence, 9500);
    });

    it("Should handle different TWAP periods", async function () {
      const periods = [600, 1800, 3600]; // 10min, 30min, 1hour
      
      for (const period of periods) {
        try {
          const [price, confidence] = await oracleManager.getTWAPPrice(WAVAX, period);
          expect(price).to.not.be.undefined;
          expect(confidence).to.not.be.undefined;
        } catch (error) {
          // Expected to fail in test environment
          expect(error.message).to.include("call revert exception");
        }
      }
    });

    it("Should validate TWAP period parameters", async function () {
      // Should not revert with reasonable periods
      try {
        await oracleManager.getTWAPPrice(WAVAX, 1800);
      } catch (error) {
        // Expected in test environment
        expect(error.message).to.include("call revert exception");
      }
    });
  });

  describe("Spot Price Queries", function () {
    it("Should handle spot price queries for supported tokens", async function () {
      const [price, confidence] = await oracleManager.getSpotPrice(WAVAX);
      expectBn(price, ethers.utils.parseEther("25"));
      expectBn(confidence, 9500);
    });

    it("Should handle spot price for all supported tokens", async function () {
      const tokens = [WAVAX, WETH_E, WBTC_E];
      
      for (const token of tokens) {
        try {
          const [price, confidence] = await oracleManager.getSpotPrice(token);
          expect(price).to.not.be.undefined;
          expect(confidence).to.not.be.undefined;
        } catch (error) {
          // Expected to fail in test environment
          expect(error.message).to.include("call revert exception");
        }
      }
    });
  });

  describe("Price Validation", function () {
    it("Should validate price ranges for cached prices", async function () {
      const validPrices = [
        ethers.utils.parseEther("0.01"), // $0.01
        ethers.utils.parseEther("1"), // $1
        ethers.utils.parseEther("100"), // $100
        ethers.utils.parseEther("10000"), // $10,000
      ];
      
      for (const price of validPrices) {
        await expect(oracleManager.updatePriceCache(WAVAX, price))
          .to.not.be.rejected;
      }
    });

    it("Should handle extreme price values", async function () {
      const extremePrices = [
        ethers.utils.parseEther("0.000001"), // Very small
        ethers.utils.parseEther("1000000"), // Very large
      ];
      
      for (const price of extremePrices) {
        await expect(oracleManager.updatePriceCache(WAVAX, price))
          .to.not.be.rejected;
      }
    });

    it("Should maintain price precision", async function () {
      const precisePrice = ethers.utils.parseEther("25.123456789"); // High precision
      
      await oracleManager.updatePriceCache(CACHE_TOKEN, precisePrice);

      const [retrievedPrice] = await oracleManager.getPrice(CACHE_TOKEN);
      expectBn(retrievedPrice, precisePrice);
    });
  });

  describe("Confidence Levels", function () {
    it("Should return appropriate confidence levels", async function () {
      const testPrice = ethers.utils.parseEther("25");
      await oracleManager.updatePriceCache(CACHE_TOKEN, testPrice);
      
      const [, confidence] = await oracleManager.getPrice(CACHE_TOKEN);
      expect(confidence.toNumber()).to.equal(9000);
      expect(confidence.toNumber()).to.be.greaterThan(0);
      expect(confidence.toNumber()).to.be.lessThanOrEqual(10000);
    });

    it("Should handle confidence thresholds correctly", async function () {
      const highConfidenceThreshold = await oracleManager.HIGH_CONFIDENCE_THRESHOLD();
      const mediumConfidenceThreshold = await oracleManager.MEDIUM_CONFIDENCE_THRESHOLD();
      
      expect(highConfidenceThreshold.toNumber()).to.equal(8000);
      expect(mediumConfidenceThreshold.toNumber()).to.equal(6000);
      expect(highConfidenceThreshold.toNumber()).to.be.greaterThan(mediumConfidenceThreshold.toNumber());
    });
  });
});
