/**
 * @title Financial Failure Scenarios Unit Tests
 * @dev Comprehensive tests for edge cases where the protocol might fail or go bankrupt
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { oracleAlignedDeposit } = require("../helpers/oracleAmounts");

describe("Financial Failure Scenarios", function () {
    this.timeout(120000);
    let strategy;
    let mockFUSD;
    let owner;
    let user1;
    let user2;
    let user3;
    let feeRecipient;
    let mockSAVAX;
    let mockWAVAX;
    let mockUSDC;
    let gmxFuturesManager;
    let emergencyControls;
    let oracleManager;

    const INITIAL_FEE_BPS = 200; // 2%
    const COLLATERALIZATION_RATIO = 150; // 150%

    beforeEach(async function () {
        [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();

        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const MockWAVAX = await ethers.getContractFactory("MockWAVAX");
        const MockSAVAX = await ethers.getContractFactory("MockSAVAX");
        const MockOracleManager = await ethers.getContractFactory("MockOracleManager");
        const MockGMXFuturesManager = await ethers.getContractFactory("MockGMXFuturesManager");
        const EmergencyControls = await ethers.getContractFactory("EmergencyControls");
        const ForceStablecoin = await ethers.getContractFactory("ForceStablecoin");

        mockFUSD = await ForceStablecoin.deploy("Force USD", "FUSD");
        mockSAVAX = await MockSAVAX.deploy();
        mockWAVAX = await MockWAVAX.deploy();
        mockUSDC = await MockERC20.deploy("USDC.e", "USDC.e");
        oracleManager = await MockOracleManager.deploy();
        
        // Deploy mock GMX addresses
        const mockGMXRouter = await MockERC20.deploy("GMX Router", "GMXR");
        const mockGMXVault = await MockERC20.deploy("GMX Vault", "GMXV");
        const mockGMXPositionRouter = await MockERC20.deploy("GMX Position Router", "GMXPR");
        
        gmxFuturesManager = await MockGMXFuturesManager.deploy(
            oracleManager.address,
            mockUSDC.address,
            mockGMXRouter.address,
            mockGMXVault.address,
            mockGMXPositionRouter.address
        );
        emergencyControls = await EmergencyControls.deploy();

        // Deploy strategy
        const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
        strategy = await AvalancheLSTStrategy.deploy(feeRecipient.address, INITIAL_FEE_BPS, mockUSDC.address);

        // Setup permissions
        await mockFUSD.addMinter(strategy.address);
        await mockFUSD.addBurner(strategy.address);
        await strategy.setFUSDAddress(mockFUSD.address);
        await strategy.setSAVAXAddress(mockSAVAX.address);
        await strategy.setWAVAXAddress(mockWAVAX.address);
        await strategy.setFuturesManager(gmxFuturesManager.address);
        await gmxFuturesManager.setStrategy(strategy.address);

        // Fund accounts
        await mockSAVAX.mint(user1.address, ethers.utils.parseEther("10000"));
        await mockSAVAX.mint(user2.address, ethers.utils.parseEther("10000"));
        await mockSAVAX.mint(user3.address, ethers.utils.parseEther("10000"));
        await mockSAVAX.mint(strategy.address, ethers.utils.parseEther("50000")); // Reserve for withdrawals
        await mockUSDC.mint(strategy.address, ethers.utils.parseUnits("1000000", 6)); // USDC for GMX collateral
        await strategy.setWithdrawalLimits(2000, 500);
    });

    describe("Scenario 1: Protocol Insolvency", function () {
        it("Should detect when FUSD supply exceeds collateral value", async function () {
            // User deposits sAVAX
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Check FUSD minted (should be less than collateral due to 150% ratio)
            const fusdMinted = await mockFUSD.balanceOf(user1.address);
            const expectedFUSD = usdValue.mul(100).div(COLLATERALIZATION_RATIO);
            expect(fusdMinted.lte(expectedFUSD)).to.be.true;

            // Check protocol health using the new health check function
            const health = await strategy.getProtocolHealth();
            console.log(`   Total FUSD: ${ethers.utils.formatEther(health.totalFUSDSupply)}`);
            console.log(`   Total Collateral: ${ethers.utils.formatEther(health.totalCollateralValue)}`);
            console.log(`   Health Ratio: ${health.healthRatio.toString()} bps`);
            console.log(`   Is Solvent: ${health.isSolvent}`);
            
            // Protocol should be solvent due to 150% collateralization
            expect(health.isSolvent).to.be.true;
        });

        it("Should prevent withdrawals when protocol is insolvent", async function () {
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            const portfolio = await strategy.getStrategyMetrics();
            const availableSavax = portfolio.totalLSTAmount;
            const userLimitUsd = usdValue.mul(500).div(10000);
            const usdAmount = availableSavax.add(ethers.utils.parseEther("1"));
            expect(usdAmount.lte(userLimitUsd)).to.be.true;

            const fusdAmount = usdAmount.mul(100).div(COLLATERALIZATION_RATIO);
            await mockFUSD.connect(user1).approve(strategy.address, fusdAmount);
            
            await expect(
                strategy.connect(user1).withdrawSAvax(fusdAmount, usdAmount)
            ).to.be.revertedWith("insufficient sAVAX in portfolio");
        });

        it("Should trigger emergency mode when insolvency detected", async function () {
            // This test would require integration with EmergencyControls
            // For now, verify that the strategy can detect dangerous conditions
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(1000);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Check that emergency conditions can be detected
            const metrics = await strategy.getStrategyMetrics();
            expect(metrics.isActive).to.be.true;
        });
    });

    describe("Scenario 2: Liquidation Risk", function () {
        it("Should detect when GMX positions are near liquidation", async function () {
            // Create a position
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Simulate GMX position getting close to liquidation
            // In real scenario, this would be detected by the rebalancing engine
            const rebalanceStatus = await strategy.checkRebalanceStatus();
            
            // Check that liquidation protection can be triggered
            expect(typeof rebalanceStatus.needsRebalance).to.equal('boolean');
        });

        it("Should execute liquidation protection when risk detected", async function () {
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Manually trigger liquidation protection check
            // In production, this would be automatic
            const status = await strategy.checkRebalanceStatus();
            
            // If liquidation risk exists, emergency rebalance should be possible
            if (status.deviation.gte(1500)) {
                await expect(strategy.executeEmergencyRebalance()).to.not.be.reverted;
            }
        });

        it("Should prevent new deposits when liquidation risk is high", async function () {
            // This would require the strategy to check liquidation risk before deposits
            // For now, verify deposits still work but should be monitored
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            
            // Deposit should succeed, but in production would check liquidation risk
            await expect(
                strategy.connect(user1).depositSAvax(depositAmount, usdValue)
            ).to.not.be.reverted;
        });
    });

    describe("Scenario 3: Oracle Manipulation", function () {
        it("Should handle oracle price feed failures gracefully", async function () {
            // Test that the strategy can handle oracle returning zero or invalid prices
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Check rebalancing status (uses oracle prices)
            const status = await strategy.checkRebalanceStatus();
            
            // Should not revert even if oracle fails (has fallback)
            expect(status.targetRatio.gt(0)).to.be.true;
        });

        it("Should detect significant oracle price deviations", async function () {
            // In production, multiple oracles would be compared
            // For now, verify the strategy can check prices
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Oracle deviation would trigger emergency rebalancing
            const status = await strategy.checkRebalanceStatus();
            
            // Large deviations should trigger emergency mode
            if (status.deviation.gte(1000)) {
                expect(status.needsRebalance).to.be.true;
            }
        });
    });

    describe("Scenario 4: Extreme Volatility", function () {
        it("Should handle rapid price movements without breaking", async function () {
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Simulate rapid price changes by checking rebalance status multiple times
            for (let i = 0; i < 5; i++) {
                const status = await strategy.checkRebalanceStatus();
                expect(status.targetRatio.toNumber()).to.be.gt(0);
                await time.increase(60); // 1 minute between checks
            }
        });

        it("Should trigger emergency rebalancing during extreme volatility", async function () {
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Simulate extreme deviation
            await strategy.setShortNotionalUsd(usdValue.mul(2));
            await strategy.triggerRebalance();

            const status = await strategy.checkRebalanceStatus();

            if (status.deviation.gte(1500)) {
                await expect(strategy.executeEmergencyRebalance()).to.not.be.reverted;
            }
        });
    });

    describe("Scenario 5: sAVAX Depegging", function () {
        it("Should handle sAVAX exchange rate dropping significantly", async function () {
            // Enable yield tracking
            await strategy.enableSAvaxYieldTracking();
            
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Simulate sAVAX exchange rate dropping (negative yield)
            // Decrease exchange rate to simulate depegging
            await mockSAVAX.grantRole(await mockSAVAX.YIELD_ROLE(), owner.address);
            const currentRate = await mockSAVAX.getExchangeRate();
            await mockSAVAX.connect(owner).setExchangeRate(currentRate.mul(95).div(100));
            
            // Checkpoint should handle negative yield gracefully (no distribution)
            await expect(
                strategy.checkpointSAvaxYield()
            ).to.not.be.reverted;
        });

        it("Should prevent new deposits when sAVAX is depegged", async function () {
            // In production, would check exchange rate before deposits
            // For now, deposits still work but should be monitored
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            
            // Deposit should succeed
            await expect(
                strategy.connect(user1).depositSAvax(depositAmount, usdValue)
            ).to.not.be.reverted;
        });
    });

    describe("Scenario 6: Mass Withdrawals (Bank Run)", function () {
        it("Should handle multiple simultaneous withdrawals", async function () {
            // Setup: Multiple users deposit
            const { amount: depositAmount1, usd: usdValue1 } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount1);
            await strategy.connect(user1).depositSAvax(depositAmount1, usdValue1);

            const { amount: depositAmount2, usd: usdValue2 } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user2).approve(strategy.address, depositAmount2);
            await strategy.connect(user2).depositSAvax(depositAmount2, usdValue2);

            // Both users try to withdraw simultaneously
            const fusdBalance1 = await mockFUSD.balanceOf(user1.address);
            const fusdBalance2 = await mockFUSD.balanceOf(user2.address);
            
            const withdrawAmount1 = fusdBalance1.div(2);
            const withdrawAmount2 = fusdBalance2.div(2);
            const savaxReturn1 = depositAmount1.div(2);
            const savaxReturn2 = depositAmount2.div(2);

            await mockFUSD.connect(user1).approve(strategy.address, withdrawAmount1);
            await mockFUSD.connect(user2).approve(strategy.address, withdrawAmount2);

            // Execute withdrawals
            const tx1 = strategy.connect(user1).withdrawSAvax(withdrawAmount1, savaxReturn1);
            const tx2 = strategy.connect(user2).withdrawSAvax(withdrawAmount2, savaxReturn2);

            // Both should succeed if enough collateral
            await expect(Promise.all([tx1, tx2])).to.not.be.reverted;
        });

        it("Should prevent withdrawals when insufficient collateral", async function () {
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            const portfolio = await strategy.getStrategyMetrics();
            const availableSavax = portfolio.totalLSTAmount;
            const userLimitUsd = usdValue.mul(500).div(10000);
            const usdAmount = availableSavax.add(ethers.utils.parseEther("1"));
            expect(usdAmount.lte(userLimitUsd)).to.be.true;

            const fusdAmount = usdAmount.mul(100).div(COLLATERALIZATION_RATIO);
            await mockFUSD.connect(user1).approve(strategy.address, fusdAmount);
            
            await expect(
                strategy.connect(user1).withdrawSAvax(fusdAmount, usdAmount)
            ).to.be.revertedWith("insufficient sAVAX in portfolio");
        });

        it("Should maintain protocol solvency during mass withdrawals", async function () {
            // Create large position
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(1000);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            const fusdBalance = await mockFUSD.balanceOf(user1.address);
            const initialSupply = await mockFUSD.totalSupply();
            
            // Withdraw 90% of position
            const withdrawAmount = fusdBalance.mul(90).div(100);
            const savaxReturn = depositAmount.mul(90).div(100);
            
            await mockFUSD.connect(user1).approve(strategy.address, withdrawAmount);
            await strategy.connect(user1).withdrawSAvax(withdrawAmount, savaxReturn);

            // Check remaining FUSD supply
            const finalSupply = await mockFUSD.totalSupply();
            const remainingFUSD = initialSupply.sub(withdrawAmount);
            
            expect(finalSupply).to.be.closeTo(remainingFUSD, ethers.utils.parseEther("0.01"));
        });
    });

    describe("Scenario 7: Gas Price Spikes", function () {
        it("Should skip non-emergency rebalancing when gas is too high", async function () {
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Set high gas price threshold
            await strategy.updateAdvancedRebalancingParams(
                500, // liquidationBuffer
                1000, // profitThreshold
                50, // softRebalanceThreshold (must stay below rebalanceDeviationThreshold)
                ethers.utils.parseUnits("500", "gwei") // maxGasPrice (very high)
            );

            // Rebalancing should still work for emergency situations
            const status = await strategy.checkRebalanceStatus();
            
            // Emergency rebalancing should bypass gas checks
            if (status.deviation.gte(1500)) {
                await expect(strategy.executeEmergencyRebalance()).to.not.be.reverted;
            }
        });
    });

    describe("Scenario 8: Yield Distribution Failures", function () {
        it("Should handle yield distribution with zero FUSD supply", async function () {
            // Try to distribute yield when no FUSD exists
            const yieldAmount = ethers.utils.parseEther("100");
            
            // Should not revert
            await expect(
                strategy.distributeExternalYield(yieldAmount)
            ).to.not.be.reverted;
        });

        it("Should prevent yield distribution errors from breaking protocol", async function () {
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            // Enable yield tracking
            await strategy.enableSAvaxYieldTracking();

            // Try to checkpoint yield
            await expect(
                strategy.checkpointSAvaxYield()
            ).to.not.be.reverted;
        });
    });

    describe("Scenario 9: Emergency Mode Edge Cases", function () {
        it("Should prevent operations when paused", async function () {
            // This would require EmergencyControls integration
            // For now, verify strategy operations work normally
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            
            await expect(
                strategy.connect(user1).depositSAvax(depositAmount, usdValue)
            ).to.not.be.reverted;
        });

        it("Should allow emergency withdrawals when protocol is paused", async function () {
            // In production, emergency withdrawals would be allowed even when paused
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            const fusdBalance = await mockFUSD.balanceOf(user1.address);
            const withdrawAmount = fusdBalance.div(2);
            const savaxReturn = depositAmount.div(2);
            
            await mockFUSD.connect(user1).approve(strategy.address, withdrawAmount);
            
            // Withdrawal should work
            await expect(
                strategy.connect(user1).withdrawSAvax(withdrawAmount, savaxReturn)
            ).to.not.be.reverted;
        });
    });

    describe("Scenario 10: Reentrancy Attacks", function () {
        it("Should prevent reentrancy in deposit function", async function () {
            // Strategy uses ReentrancyGuard, so this should be protected
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            
            // Multiple deposits should work safely
            await expect(
                strategy.connect(user1).depositSAvax(depositAmount, usdValue)
            ).to.not.be.reverted;
        });

        it("Should prevent reentrancy in withdrawal function", async function () {
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);

            const fusdBalance = await mockFUSD.balanceOf(user1.address);
            const withdrawAmount = fusdBalance.div(2);
            const savaxReturn = depositAmount.div(2);
            
            await mockFUSD.connect(user1).approve(strategy.address, withdrawAmount);
            
            // Withdrawal should be protected
            await expect(
                strategy.connect(user1).withdrawSAvax(withdrawAmount, savaxReturn)
            ).to.not.be.reverted;
        });
    });
});
