const { expect } = require("chai");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const { ethers } = require("hardhat");

describe("AvalancheLSTStrategy", function () {
  let owner, user1, user2;
  let strategy, mockFUSD, mockSAVAX;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockFUSD = await MockERC20.deploy("Force USD", "FUSD");
    mockSAVAX = await MockERC20.deploy("Staked AVAX", "sAVAX");
    
    await mockFUSD.deployed();
    await mockSAVAX.deployed();

    // Deploy AvalancheLSTStrategy
    const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
    const USDC_E_ADDRESS = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"; // Real USDC.e address
    strategy = await AvalancheLSTStrategy.deploy(owner.address, 200, USDC_E_ADDRESS); // 2% management fee
    await strategy.deployed();
  });

  describe("Deployment", function () {
    it("Should set the correct initial parameters", async function () {
      expect(await strategy.feeRecipient()).to.equal(owner.address);
      expect((await strategy.managementFeeBps()).toString()).to.equal("200");
      expect((await strategy.collateralizationRatio()).toString()).to.equal("150");
      expect((await strategy.liquidationThreshold()).toString()).to.equal("120");
    });

    it("Should set correct rebalancing parameters", async function () {
      expect((await strategy.rebalanceDeviationThreshold()).toString()).to.equal("80");
      expect((await strategy.emergencyRebalanceThreshold()).toString()).to.equal("1500");
      expect((await strategy.rebalanceRewardAmount()).toString()).to.equal(ethers.utils.parseEther("0.1").toString());
      expect((await strategy.rebalanceCooldown()).toString()).to.equal("3600");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update fee recipient", async function () {
      await strategy.setFeeRecipient(user1.address);
      expect(await strategy.feeRecipient()).to.equal(user1.address);
    });

    it("Should allow owner to update management fee", async function () {
      await strategy.setManagementFee(300);
      expect((await strategy.managementFeeBps()).toString()).to.equal("300");
    });

    it("Should reject non-owner from updating parameters", async function () {
      await expect(
        strategy.connect(user1).setFeeRecipient(user2.address)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });
  });

  describe("Strategy Metrics", function () {
    it("Should return correct initial metrics", async function () {
      const metrics = await strategy.getStrategyMetrics();
      expect(metrics.totalLSTAmount.toString()).to.equal("0");
      expect(metrics.shortNotionalUsd.toString()).to.equal("0");
      expect(metrics.isActive).to.equal(false);
      expect(metrics.totalInUsd.toString()).to.equal("0");
      expect(metrics.totalOutUsd.toString()).to.equal("0");
    });
  });

  describe("Rebalancing System", function () {
    it("Should return correct rebalancing status", async function () {
      const status = await strategy.checkRebalanceStatus();
      expect(status.targetRatio.toString()).to.equal("8000"); // 80%
      expect(status.currentRatio.toString()).to.equal("8000");
      expect(status.deviation.toString()).to.equal("0");
      expect(status.needsRebalance).to.equal(false);
    });
  });

  describe("Yield Distribution", function () {
    it("Should return correct yield metrics", async function () {
      const metrics = await strategy.getYieldMetrics();
      expect(metrics.currentYieldIndex.toString()).to.equal(ethers.utils.parseEther("1").toString());
      expect(metrics.totalYieldDistributedAmount.toString()).to.equal("0");
    });
  });
});

// Helper function for testing events with dynamic values
const anyValue = () => true;
