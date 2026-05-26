/**
 * @title AvalancheOracleManager Basic Tests
 * @dev Basic functionality tests for deployment, configuration, and admin functions
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Setup Chai for promises
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

describe("AvalancheOracleManager - Basic Tests", function () {
  let oracleManager;
  let owner, user1, user2;

  // Token addresses
  const USDC_E = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
  const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
  const WETH_E = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";
  const WBTC_E = "0x50b7545627a5162F82A992c33b87aDc75187B218";
  const SAVAX = "0x2B2C81E08f1aF8835aB89c2Ffc7e21D6DfFC7E2C";
  // const STETH_E = "0x3d9eAB723df76808bB84c05b20de27A2e69EF293"; // Invalid address - commented out
  const BTC_B = "0x152b9d0FdC40C096757F570A51E494bd4b943E50";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Oracle Manager
    const AvalancheOracleManager = await ethers.getContractFactory("AvalancheOracleManager");
    oracleManager = await AvalancheOracleManager.deploy();
    await oracleManager.deployed();
  });

  describe("Deployment", function () {
    it("Should deploy with correct constants", async function () {
      expect(await oracleManager.LB_FACTORY()).to.equal("0x8e42f2F4101563bF679975178e880FD87d3eFd4e");
      expect(await oracleManager.USDC_E()).to.equal(USDC_E);
      expect((await oracleManager.CACHE_DURATION()).toNumber()).to.equal(300); // 5 minutes
      expect((await oracleManager.DEFAULT_TWAP_PERIOD()).toNumber()).to.equal(1800); // 30 minutes
      expect((await oracleManager.MIN_LIQUIDITY_THRESHOLD()).toString()).to.equal(ethers.utils.parseUnits("10000", 6).toString());
    });

    it("Should initialize supported tokens with bin steps", async function () {
      expect((await oracleManager.tokenBinSteps(WAVAX)).toNumber()).to.equal(15); // 0.15%
      expect((await oracleManager.tokenBinSteps(WETH_E)).toNumber()).to.equal(10); // 0.1%
      expect((await oracleManager.tokenBinSteps(WBTC_E)).toNumber()).to.equal(20); // 0.2%
      expect((await oracleManager.tokenBinSteps(SAVAX)).toNumber()).to.equal(15); // 0.15%
      expect((await oracleManager.tokenBinSteps(USDC_E)).toNumber()).to.equal(0); // USDC.e handled specially
      expect((await oracleManager.tokenBinSteps(BTC_B)).toNumber()).to.equal(20); // 0.2%
    });

    it("Should set owner correctly", async function () {
      expect(await oracleManager.owner()).to.equal(owner.address);
    });

    it("Should have correct confidence thresholds", async function () {
      expect((await oracleManager.HIGH_CONFIDENCE_THRESHOLD()).toNumber()).to.equal(8000); // 80%
      expect((await oracleManager.MEDIUM_CONFIDENCE_THRESHOLD()).toNumber()).to.equal(6000); // 60%
    });
  });

  describe("Token Support", function () {
    it("Should reject unsupported tokens", async function () {
      const unsupportedToken = "0x1234567890123456789012345678901234567890";
      
      await expect(
        oracleManager.getTWAPPrice(unsupportedToken, 1800)
      ).to.be.rejectedWith("Token not supported");

      await expect(
        oracleManager.getSpotPrice(unsupportedToken)
      ).to.be.rejectedWith("Token not supported");
    });

    it("Should reject zero address", async function () {
      await expect(
        oracleManager.getTWAPPrice(ethers.constants.AddressZero, 1800)
      ).to.be.rejectedWith("Invalid token address");

      await expect(
        oracleManager.getSpotPrice(ethers.constants.AddressZero)
      ).to.be.rejectedWith("Invalid token address");
    });

    it("Should return supported tokens list", async function () {
      const supportedTokens = await oracleManager.getSupportedTokens();
      expect(supportedTokens.length).to.be.greaterThan(0);
      expect(supportedTokens).to.include(WAVAX);
      expect(supportedTokens).to.include(WETH_E);
      expect(supportedTokens).to.include(WBTC_E);
    });

    it("Should handle supported tokens array correctly", async function () {
      const supportedTokens = await oracleManager.getSupportedTokens();
      
      // All returned tokens should have bin steps configured
      for (const token of supportedTokens) {
        const binStep = await oracleManager.tokenBinSteps(token);
        expect(binStep.toNumber()).to.be.greaterThan(0);
      }
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set token bin step", async function () {
      const newBinStep = 25;
      
      const tx = await oracleManager.setTokenBinStep(WAVAX, newBinStep);
      const receipt = await tx.wait();
      expect(receipt.events.length).to.be.greaterThan(0);
      
      expect((await oracleManager.tokenBinSteps(WAVAX)).toNumber()).to.equal(newBinStep);
    });

    it("Should reject non-owner from setting bin step", async function () {
      await expect(
        oracleManager.connect(user1).setTokenBinStep(WAVAX, 25)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Should reject invalid bin step", async function () {
      await expect(
        oracleManager.setTokenBinStep(WAVAX, 0)
      ).to.be.rejectedWith("Invalid bin step");
    });

    it("Should reject zero address for bin step", async function () {
      await expect(
        oracleManager.setTokenBinStep(ethers.constants.AddressZero, 25)
      ).to.be.rejectedWith("Invalid token address");
    });

    it("Should allow adding new token support", async function () {
      const newToken = "0x1234567890123456789012345678901234567890";
      const binStep = 15;
      
      // Initially not supported
      expect((await oracleManager.tokenBinSteps(newToken)).toNumber()).to.equal(0);
      
      // Add support
      await oracleManager.setTokenBinStep(newToken, binStep);
      
      // Should now be supported
      expect((await oracleManager.tokenBinSteps(newToken)).toNumber()).to.equal(binStep);
    });
  });

  describe("Utility Functions", function () {
    it("Should return correct staleness threshold", async function () {
      expect((await oracleManager.getStalnessThreshold()).toNumber()).to.equal(300); // 5 minutes
    });

    it("Should check price freshness correctly", async function () {
      // Initially not fresh
      expect(await oracleManager.isPriceFresh(WAVAX)).to.be.false;
    });

    it("Should handle ownership transfer", async function () {
      // Transfer ownership to user1
      await oracleManager.transferOwnership(user1.address);
      
      // Old owner should not be able to set bin steps
      await expect(
        oracleManager.setTokenBinStep(WAVAX, 25)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
      
      // New owner should be able to set bin steps
      await expect(oracleManager.connect(user1).setTokenBinStep(WAVAX, 25))
        .to.not.be.rejected;
    });
  });

  describe("Constants Validation", function () {
    it("Should have reasonable bin step values", async function () {
      const tokens = [WAVAX, WETH_E, WBTC_E, SAVAX, BTC_B]; // Exclude USDC_E as it's handled specially
      
      for (const token of tokens) {
        const binStep = await oracleManager.tokenBinSteps(token);
        expect(binStep.toNumber()).to.be.greaterThan(0);
        expect(binStep.toNumber()).to.be.lessThan(1000); // Should be reasonable
      }
      
      // USDC_E should have bin step 0 as it's handled specially
      const usdcBinStep = await oracleManager.tokenBinSteps(USDC_E);
      expect(usdcBinStep.toNumber()).to.equal(0);
    });

    it("Should have correct Trader Joe V2 factory address", async function () {
      const lbFactory = await oracleManager.LB_FACTORY();
      expect(lbFactory).to.equal("0x8e42f2F4101563bF679975178e880FD87d3eFd4e");
      expect(lbFactory).to.not.equal(ethers.constants.AddressZero);
    });

    it("Should have correct USDC.e address", async function () {
      const usdcE = await oracleManager.USDC_E();
      expect(usdcE).to.equal(USDC_E);
      expect(usdcE).to.not.equal(ethers.constants.AddressZero);
    });
  });
});
