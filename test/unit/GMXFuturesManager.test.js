/**
 * @title GMXFuturesManager Unit Tests
 * @dev Comprehensive test suite for GMX Futures Manager contract
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Setup Chai for events
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

describe("GMXFuturesManager", function () {
    this.timeout(120000); // 2 minutes timeout
  let futuresManager, oracleManager, usdcE, strategy;
  let owner, user1, user2, feeRecipient;
  let mockStrategy, mockOracleManager, mockUSDC;
  let mockGMXRouter, mockGMXVault, mockGMXPositionRouter;

  // Test constants
  const USDC_DECIMALS = 6;
  const FUTURES_COLLATERAL_RATIO = 1000; // 10%
  const MAX_LEVERAGE = 10;
  const MIN_EXECUTION_FEE = ethers.utils.parseEther("0.001");
  const MAX_POSITION_SIZE = ethers.utils.parseUnits("1000000", USDC_DECIMALS); // $1M
  const MAX_TOTAL_EXPOSURE = ethers.utils.parseUnits("5000000", USDC_DECIMALS); // $5M

  async function deployContracts() {
    [owner, user1, user2, feeRecipient] = await ethers.getSigners();

    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USDC.e", "USDC.e");
    await mockUSDC.deployed();

    const MockOracleManager = await ethers.getContractFactory("MockOracleManager");
    mockOracleManager = await MockOracleManager.deploy();
    await mockOracleManager.deployed();

    const MockStrategy = await ethers.getContractFactory("MockStrategy");
    mockStrategy = await MockStrategy.deploy();
    await mockStrategy.deployed();

    // Deploy mock GMX contracts
    const MockGMXVault = await ethers.getContractFactory("MockGMXVault");
    mockGMXVault = await MockGMXVault.deploy();
    await mockGMXVault.deployed();

    const MockGMXRouter = await ethers.getContractFactory("MockGMXRouter");
    mockGMXRouter = await MockGMXRouter.deploy(mockGMXVault.address, mockUSDC.address);
    await mockGMXRouter.deployed();

    const MockGMXPositionRouter = await ethers.getContractFactory("MockGMXPositionRouter");
    mockGMXPositionRouter = await MockGMXPositionRouter.deploy();
    await mockGMXPositionRouter.deployed();

    // Deploy MockGMXFuturesManager with injectable mock contracts
    const MockGMXFuturesManager = await ethers.getContractFactory("MockGMXFuturesManager");
    futuresManager = await MockGMXFuturesManager.deploy(
      mockOracleManager.address,
      mockUSDC.address,
      mockGMXRouter.address,
      mockGMXVault.address,
      mockGMXPositionRouter.address
    );
    await futuresManager.deployed();

    // Set strategy to owner for testing
    await futuresManager.setStrategy(owner.address);

    // Mint USDC.e to owner for testing (since owner is set as strategy)
    await mockUSDC.mint(owner.address, ethers.utils.parseUnits("1000000", USDC_DECIMALS));

    // Approve USDC.e for futures manager
    await mockUSDC.connect(owner).approve(
      futuresManager.address,
      ethers.utils.parseUnits("100000", USDC_DECIMALS)
    );

    // Fund futures manager with ETH for execution fees
    await owner.sendTransaction({
      to: futuresManager.address,
      value: ethers.utils.parseEther("1") // 1 ETH for execution fees
    });
  }

  beforeEach(async function () {
    await deployContracts();
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      expect(await futuresManager.oracleManager()).to.equal(mockOracleManager.address);
      expect(await futuresManager.usdcE()).to.equal(mockUSDC.address);
      expect(await futuresManager.gmxRouter()).to.equal(mockGMXRouter.address);
      expect(await futuresManager.gmxVault()).to.equal(mockGMXVault.address);
      expect(await futuresManager.gmxPositionRouter()).to.equal(mockGMXPositionRouter.address);
      expect((await futuresManager.maxPositionSize()).toString()).to.equal(MAX_POSITION_SIZE.toString());
      expect((await futuresManager.maxTotalExposure()).toString()).to.equal(MAX_TOTAL_EXPOSURE.toString());
    });

    it("Should set correct constants", async function () {
      expect((await futuresManager.FUTURES_COLLATERAL_RATIO()).toString()).to.equal(FUTURES_COLLATERAL_RATIO.toString());
      expect((await futuresManager.MAX_LEVERAGE()).toString()).to.equal(MAX_LEVERAGE.toString());
      expect((await futuresManager.MIN_EXECUTION_FEE()).toString()).to.equal(MIN_EXECUTION_FEE.toString());
    });

    it("Should reject zero addresses in constructor", async function () {
      const GMXFuturesManager = await ethers.getContractFactory("GMXFuturesManager");
      
      await expect(
        GMXFuturesManager.deploy(ethers.constants.AddressZero, mockUSDC.address)
      ).to.be.rejectedWith("Invalid oracle manager");

      await expect(
        GMXFuturesManager.deploy(mockOracleManager.address, ethers.constants.AddressZero)
      ).to.be.rejectedWith("Invalid USDC.e address");
    });
  });

  describe("Access Control", function () {
    it("Should allow only owner to set strategy", async function () {
      await expect(
        futuresManager.connect(user1).setStrategy(user1.address)
      ).to.be.rejectedWith("Ownable: caller is not the owner");

      await expect(
        futuresManager.setStrategy(ethers.constants.AddressZero)
      ).to.be.rejectedWith("Invalid strategy address");

      const tx = await futuresManager.setStrategy(user1.address);
      const receipt = await tx.wait();
      expect(receipt.events.length).to.be.greaterThan(0);
    });

    it("Should allow only strategy to call restricted functions", async function () {
      const token = ethers.constants.AddressZero;
      const size = ethers.utils.parseEther("1000");
      const leverage = 5;
      const collateral = ethers.utils.parseUnits("100", USDC_DECIMALS);
      const expirationTime = (await time.latest()) + 30 * 24 * 60 * 60; // 30 days

      await expect(
        futuresManager.connect(user1).openFuturesPosition(
          token, size, false, leverage, collateral, expirationTime
        )
      ).to.be.rejectedWith("Only strategy can call");

      await expect(
        futuresManager.connect(user1).depositCollateral(1000)
      ).to.be.rejectedWith("Only strategy can call");

      await expect(
        futuresManager.connect(user1).withdrawCollateral(1000)
      ).to.be.rejectedWith("Only strategy can call");
    });
  });

  describe("Futures Position Management", function () {
    const token = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"; // WAVAX
    const size = ethers.utils.parseUnits("10000", USDC_DECIMALS); // $10k position in USDC terms
    const leverage = 5;
    const collateral = ethers.utils.parseUnits("1000", USDC_DECIMALS); // $1k collateral (10% of $10k)
    let expirationTime;

    beforeEach(async function () {
      expirationTime = (await time.latest()) + 30 * 24 * 60 * 60; // 30 days
      
      // Approve USDC.e for futures manager
      await mockUSDC.connect(owner).approve(
        futuresManager.address,
        ethers.utils.parseUnits("100000", USDC_DECIMALS)
      );
    });

    it("Should open futures position successfully", async function () {
      const tx = await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );

      const receipt = await tx.wait();
      expect(receipt.events.length).to.be.greaterThan(0);
      
      // Check for FuturesPositionOpened event
      const positionOpenedEvent = receipt.events.find(e => e.event === "FuturesPositionOpened");
      expect(positionOpenedEvent).to.not.be.undefined;

      // Verify position was created
      const positionKeys = await futuresManager.getUserActiveFuturesPositions(owner.address);
      expect(positionKeys.length).to.equal(1);
      expect(await futuresManager.activeFuturesPositions(positionKeys[0])).to.be.true;
    });

    it("Should reject invalid position parameters", async function () {
      // Zero size
      await expect(
        futuresManager.connect(owner).openFuturesPosition(
          token, 0, false, leverage, collateral, expirationTime
        )
      ).to.be.rejectedWith("Invalid position size");

      // Leverage too high
      await expect(
        futuresManager.connect(owner).openFuturesPosition(
          token, size, false, MAX_LEVERAGE + 1, collateral, expirationTime
        )
      ).to.be.rejectedWith("Leverage too high");

      // Insufficient collateral
      const insufficientCollateral = ethers.utils.parseUnits("50", USDC_DECIMALS);
      await expect(
        futuresManager.connect(owner).openFuturesPosition(
          token, size, false, leverage, insufficientCollateral, expirationTime
        )
      ).to.be.rejectedWith("Insufficient collateral");

      // Invalid expiration time
      const pastExpiration = (await time.latest()) - 1;
      await expect(
        futuresManager.connect(owner).openFuturesPosition(
          token, size, false, leverage, collateral, pastExpiration
        )
      ).to.be.rejectedWith("Invalid expiration time");

      // Position size too large
      const largeSize = ethers.utils.parseEther("2000000"); // $2M
      await expect(
        futuresManager.connect(owner).openFuturesPosition(
          token, largeSize, false, leverage, collateral, expirationTime
        )
      ).to.be.rejectedWith("Position size exceeds limit");
    });

    // Note: Duplicate position keys are extremely unlikely due to timestamp inclusion in key generation

    it("Should respect total exposure limits", async function () {
      // Open first position
      await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );

      // Try to open position that exceeds total exposure
      const largeSize = ethers.utils.parseEther("6000000"); // $6M
      const largeCollateral = ethers.utils.parseUnits("600000", USDC_DECIMALS);
      
      await expect(
        futuresManager.connect(owner).openFuturesPosition(
          token, largeSize, false, leverage, largeCollateral, expirationTime
        )
      ).to.be.rejectedWith("Total exposure limit exceeded");
    });

    it("Should close futures position successfully", async function () {
      // Open position
      const tx1 = await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.events.find(e => e.event === "FuturesPositionOpened");
      const positionKey = event1.args.positionKey;

      // Close position
      const tx2 = await futuresManager.connect(owner).closeFuturesPosition(positionKey);
      
      const receipt2 = await tx2.wait();
      expect(receipt2.events.length).to.be.greaterThan(0);
      
      // Check for FuturesPositionClosed event
      const positionClosedEvent = receipt2.events.find(e => e.event === "FuturesPositionClosed");
      expect(positionClosedEvent).to.not.be.undefined;

      // Verify position is closed
      expect(await futuresManager.activeFuturesPositions(positionKey)).to.be.false;
    });

    it("Should reject closing non-existent position", async function () {
      const fakePositionKey = ethers.utils.hexZeroPad("0x1", 32);
      
      await expect(
        futuresManager.connect(owner).closeFuturesPosition(fakePositionKey)
      ).to.be.rejectedWith("Position not found");
    });

    it("Should adjust futures position size", async function () {
      // Open position
      const tx1 = await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.events.find(e => e.event === "FuturesPositionOpened");
      const positionKey = event1.args.positionKey;

      // Increase position
      const sizeDelta = ethers.utils.parseUnits("5000", USDC_DECIMALS);
      const tx2 = await futuresManager.connect(owner).adjustFuturesPosition(
        positionKey, sizeDelta, true
      );

      const receipt2 = await tx2.wait();
      expect(receipt2.events.length).to.be.greaterThan(0);

      // Decrease position
      const decreaseDelta = ethers.utils.parseUnits("2000", USDC_DECIMALS);
      const tx3 = await futuresManager.connect(owner).adjustFuturesPosition(
        positionKey, decreaseDelta, false
      );

      const receipt3 = await tx3.wait();
      expect(receipt3.events.length).to.be.greaterThan(0);
    });

    it("Should reject invalid position adjustments", async function () {
      // Open position
      const tx1 = await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.events.find(e => e.event === "FuturesPositionOpened");
      const positionKey = event1.args.positionKey;

      // Try to decrease more than current size
      const largeDecrease = size.add(1000);
      await expect(
        futuresManager.connect(owner).adjustFuturesPosition(
          positionKey, largeDecrease, false
        )
      ).to.be.rejectedWith("Size delta too large");

      // Try to adjust non-existent position
      const fakePositionKey = ethers.utils.hexZeroPad("0x1", 32);
      await expect(
        futuresManager.connect(owner).adjustFuturesPosition(
          fakePositionKey, 1000, true
        )
      ).to.be.rejectedWith("Position not found");
    });
  });

  describe("Collateral Management", function () {
    it("Should deposit collateral successfully", async function () {
      const amount = ethers.utils.parseUnits("1000", USDC_DECIMALS);
      
      const tx = await futuresManager.connect(owner).depositCollateral(amount);
      
      const receipt = await tx.wait();
      expect(receipt.events.length).to.be.greaterThan(0);

      expect((await futuresManager.getCollateralBalance()).toString()).to.equal(amount.toString());
    });

    it("Should withdraw collateral successfully", async function () {
      const amount = ethers.utils.parseUnits("1000", USDC_DECIMALS);
      
      // Deposit first
      await futuresManager.connect(owner).depositCollateral(amount);
      
      // Withdraw
      const tx = await futuresManager.connect(owner).withdrawCollateral(amount);
      
      const receipt = await tx.wait();
      expect(receipt.events.length).to.be.greaterThan(0);

      expect((await futuresManager.getCollateralBalance()).toString()).to.equal("0");
    });

    it("Should reject invalid collateral operations", async function () {
      // Try to deposit zero amount
      await expect(
        futuresManager.connect(owner).depositCollateral(0)
      ).to.be.rejectedWith("Invalid amount");

      // Try to withdraw zero amount
      await expect(
        futuresManager.connect(owner).withdrawCollateral(0)
      ).to.be.rejectedWith("Invalid amount");

      // Try to withdraw more than available
      await expect(
        futuresManager.connect(owner).withdrawCollateral(1000)
      ).to.be.rejectedWith("Insufficient collateral balance");
    });
  });

  describe("Position Queries", function () {
    it("Should return correct total futures exposure", async function () {
      expect((await futuresManager.getTotalFuturesExposure()).toString()).to.equal("0");

      // Open position
      const token = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
      const size = ethers.utils.parseUnits("10000", USDC_DECIMALS);
      const leverage = 5;
      const collateral = ethers.utils.parseUnits("1000", USDC_DECIMALS);
      const expirationTime = (await time.latest()) + 30 * 24 * 60 * 60;

      await mockUSDC.connect(owner).approve(futuresManager.address, collateral);
      await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );

      expect((await futuresManager.getTotalFuturesExposure()).toString()).to.equal(size.toString());
    });

    it("Should return correct user active positions", async function () {
      // Initially no positions
      let positions = await futuresManager.getUserActiveFuturesPositions(owner.address);
      expect(positions.length).to.equal(0);

      // Open position
      const token = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
      const size = ethers.utils.parseUnits("10000", USDC_DECIMALS);
      const leverage = 5;
      const collateral = ethers.utils.parseUnits("1000", USDC_DECIMALS);
      const expirationTime = (await time.latest()) + 30 * 24 * 60 * 60;

      await mockUSDC.connect(owner).approve(futuresManager.address, collateral);
      await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );

      // Should have one active position
      positions = await futuresManager.getUserActiveFuturesPositions(owner.address);
      expect(positions.length).to.equal(1);
      expect(await futuresManager.activeFuturesPositions(positions[0])).to.be.true;
    });

    it("Should calculate PnL correctly", async function () {
      // Open position
      const token = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
      const size = ethers.utils.parseUnits("10000", USDC_DECIMALS);
      const leverage = 5;
      const collateral = ethers.utils.parseUnits("1000", USDC_DECIMALS);
      const expirationTime = (await time.latest()) + 30 * 24 * 60 * 60;

      await mockUSDC.connect(owner).approve(futuresManager.address, collateral);
      const tx = await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "FuturesPositionOpened");
      const positionKey = event.args.positionKey;

      // Calculate PnL (should be 0 for new position)
      const pnl = await futuresManager.calculateFuturesPnL(positionKey);
      expect(pnl.toString()).to.equal("0");
    });
  });

  describe("Risk Management", function () {
    it("Should allow owner to update risk parameters", async function () {
      const newMaxSize = ethers.utils.parseUnits("2000000", USDC_DECIMALS);
      const newMaxExposure = ethers.utils.parseUnits("10000000", USDC_DECIMALS);

      const tx1 = await futuresManager.setMaxPositionSize(newMaxSize);
      const receipt1 = await tx1.wait();
      expect(receipt1.events.length).to.be.greaterThan(0);

      const tx2 = await futuresManager.setMaxTotalExposure(newMaxExposure);
      const receipt2 = await tx2.wait();
      expect(receipt2.events.length).to.be.greaterThan(0);
      
      // Verify the values were updated
      expect((await futuresManager.maxPositionSize()).toString()).to.equal(newMaxSize.toString());
      expect((await futuresManager.maxTotalExposure()).toString()).to.equal(newMaxExposure.toString());
    });

    it("Should reject non-owner from updating risk parameters", async function () {
      const newMaxSize = ethers.utils.parseUnits("2000000", USDC_DECIMALS);

      await expect(
        futuresManager.connect(user1).setMaxPositionSize(newMaxSize)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to emergency close all positions", async function () {
      // Open a position first
      const token = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
      const size = ethers.utils.parseUnits("10000", USDC_DECIMALS);
      const leverage = 5;
      const collateral = ethers.utils.parseUnits("1000", USDC_DECIMALS);
      const expirationTime = (await time.latest()) + 30 * 24 * 60 * 60;

      await mockUSDC.connect(owner).approve(futuresManager.address, collateral);
      await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );

      // Emergency close all positions
      await expect(futuresManager.emergencyCloseAllPositions()).to.not.be.rejected;
    });

    it("Should allow owner to emergency withdraw tokens", async function () {
      const amount = ethers.utils.parseUnits("1000", USDC_DECIMALS);
      
      // Deposit some collateral first
      await futuresManager.connect(owner).depositCollateral(amount);
      
      // Emergency withdraw
      await expect(futuresManager.emergencyWithdraw(mockUSDC.address, amount))
        .to.not.be.rejected;
    });

    it("Should allow owner to emergency withdraw ETH", async function () {
      // Send some ETH to contract
      await owner.sendTransaction({
        to: futuresManager.address,
        value: ethers.utils.parseEther("1")
      });

      // Emergency withdraw ETH
      await expect(futuresManager.emergencyWithdrawETH()).to.not.be.rejected;
    });

    it("Should reject non-owner from emergency functions", async function () {
      await expect(
        futuresManager.connect(user1).emergencyCloseAllPositions()
      ).to.be.rejectedWith("Ownable: caller is not the owner");

      await expect(
        futuresManager.connect(user1).emergencyWithdraw(mockUSDC.address, 1000)
      ).to.be.rejectedWith("Ownable: caller is not the owner");

      await expect(
        futuresManager.connect(user1).emergencyWithdrawETH()
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });
  });

  describe("Integration Tests", function () {
    it("Should handle multiple positions correctly", async function () {
      const token1 = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"; // WAVAX
      const token2 = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB"; // WETH
      const size = ethers.utils.parseUnits("5000", USDC_DECIMALS);
      const leverage = 5;
      const collateral = ethers.utils.parseUnits("500", USDC_DECIMALS);
      const expirationTime = (await time.latest()) + 30 * 24 * 60 * 60;

      await mockUSDC.connect(owner).approve(futuresManager.address, collateral.mul(2));

      // Open two positions
      await futuresManager.connect(owner).openFuturesPosition(
        token1, size, false, leverage, collateral, expirationTime
      );

      await futuresManager.connect(owner).openFuturesPosition(
        token2, size, true, leverage, collateral, expirationTime
      );

      // Verify total exposure
      expect((await futuresManager.getTotalFuturesExposure()).toString()).to.equal(size.mul(2).toString());

      // Verify user positions
      const positions = await futuresManager.getUserActiveFuturesPositions(owner.address);
      expect(positions.length).to.equal(2);
    });

    it("Should handle position lifecycle correctly", async function () {
      const token = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
      const size = ethers.utils.parseUnits("10000", USDC_DECIMALS);
      const leverage = 5;
      const collateral = ethers.utils.parseUnits("1000", USDC_DECIMALS);
      const expirationTime = (await time.latest()) + 30 * 24 * 60 * 60;

      await mockUSDC.connect(owner).approve(futuresManager.address, collateral);

      // Open position
      const tx1 = await futuresManager.connect(owner).openFuturesPosition(
        token, size, false, leverage, collateral, expirationTime
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.events.find(e => e.event === "FuturesPositionOpened");
      const positionKey = event1.args.positionKey;

      // Verify position is active
      expect(await futuresManager.activeFuturesPositions(positionKey)).to.be.true;

      // Adjust position
      const sizeDelta = ethers.utils.parseEther("2000");
      await futuresManager.connect(owner).adjustFuturesPosition(
        positionKey, sizeDelta, true
      );

      // Close position
      await futuresManager.connect(owner).closeFuturesPosition(positionKey);

      // Verify position is closed
      expect(await futuresManager.activeFuturesPositions(positionKey)).to.be.false;
      expect((await futuresManager.getTotalFuturesExposure()).toString()).to.equal("0");
    });
  });
});
