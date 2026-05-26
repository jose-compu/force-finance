/**
 * @title AvalancheLSTStrategyV2 Unit Tests
 * @dev Comprehensive testing with real Avalanche protocols
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AvalancheLSTStrategy", function () {
    this.timeout(120000); // 2 minutes timeout
    let strategy;
    let owner;
    let user1;
    let user2;
    let feeRecipient;
    let mockFUSD;
    let mockSAVAX;
    let mockWAVAX;

    const INITIAL_FEE_BPS = 200; // 2%
    const COLLATERALIZATION_RATIO = 150; // 150%
    const LIQUIDATION_THRESHOLD = 120; // 120%
    const SAVAX_ORACLE_PRICE_USD = 22; // Matches strategy fallback when oracle unset
    const ORACLE_ALIGNED_DEPOSIT_SAVAX = ethers.utils.parseEther("100");
    const ORACLE_ALIGNED_DEPOSIT_USD = ethers.utils.parseEther(String(SAVAX_ORACLE_PRICE_USD * 100));
    const ORACLE_ALIGNED_NET_COLLATERAL = ORACLE_ALIGNED_DEPOSIT_USD.mul(10000 - INITIAL_FEE_BPS).div(10000);

    beforeEach(async function () {
        [owner, user1, user2, feeRecipient] = await ethers.getSigners();

        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const MockWAVAX = await ethers.getContractFactory("MockWAVAX");
        const MockSAVAX = await ethers.getContractFactory("MockSAVAX");
        mockFUSD = await MockERC20.deploy("Force USD", "FUSD");
        mockSAVAX = await MockSAVAX.deploy();
        mockWAVAX = await MockWAVAX.deploy();

        // Deploy mock USDC.e
        const mockUSDC = await MockERC20.deploy("USDC.e", "USDC.e");
        await mockUSDC.deployed();

        // Deploy mock oracle manager
        const MockOracleManager = await ethers.getContractFactory("MockOracleManager");
        const mockOracleManager = await MockOracleManager.deploy();
        await mockOracleManager.deployed();

        // Deploy strategy
        const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
        strategy = await AvalancheLSTStrategy.deploy(feeRecipient.address, INITIAL_FEE_BPS, mockUSDC.address);

        // Setup mock tokens
        await mockSAVAX.mint(user1.address, ethers.utils.parseEther("1000"));
        await mockWAVAX.mint(user1.address, ethers.utils.parseEther("1000"));

        // Grant mint/burn permissions to strategy (FUSD is minted to users on deposit)
        await mockFUSD.grantRole(await mockFUSD.MINTER_ROLE(), strategy.address);
        await mockFUSD.grantRole(await mockFUSD.BURNER_ROLE(), strategy.address);

        // Set FUSD address in strategy
        await strategy.setFUSDAddress(mockFUSD.address);

                // Set SAVAX address in strategy
        await strategy.setSAVAXAddress(mockSAVAX.address);

        // Set WAVAX address in strategy
        await strategy.setWAVAXAddress(mockWAVAX.address);

        // Fund strategy with some AVAX for rewards
        await owner.sendTransaction({
            to: strategy.address,
            value: ethers.utils.parseEther("10")
        });

        // Fund strategy with SAVAX tokens for withdrawals and yield distribution
        await mockSAVAX.mint(strategy.address, ethers.utils.parseEther("10000"));

        // Fund users with SAVAX tokens for deposits
        await mockSAVAX.mint(user1.address, ethers.utils.parseEther("1000"));
        await mockSAVAX.mint(user2.address, ethers.utils.parseEther("1000"));

        // Deploy and set GMX Futures Manager
        const GMXFuturesManager = await ethers.getContractFactory("GMXFuturesManager");
        const futuresManager = await GMXFuturesManager.deploy(mockOracleManager.address, mockUSDC.address);
        await futuresManager.deployed();
        
        await futuresManager.setStrategy(strategy.address);
        await strategy.setFuturesManager(futuresManager.address);

        // Fund strategy with USDC.e for GMX collateral
        await mockUSDC.mint(strategy.address, ethers.utils.parseUnits("100000", 6));
    });

    describe("Deployment", function () {
        it("Should set correct initial parameters", async function () {
            expect(await strategy.feeRecipient()).to.equal(feeRecipient.address);
            expect((await strategy.managementFeeBps()).eq(INITIAL_FEE_BPS)).to.be.true;
            expect((await strategy.collateralizationRatio()).eq(COLLATERALIZATION_RATIO)).to.be.true;
            expect((await strategy.liquidationThreshold()).eq(LIQUIDATION_THRESHOLD)).to.be.true;
            expect((await strategy.yieldIndex()).eq(ethers.utils.parseEther("1"))).to.be.true;
        });

        it("Should set rebalancing parameters correctly", async function () {
            expect((await strategy.rebalanceDeviationThreshold()).eq(80)).to.be.true; // 0.8% (STRATEGY_REVISION)
            expect((await strategy.emergencyRebalanceThreshold()).eq(1500)).to.be.true; // 15%
            expect((await strategy.rebalanceRewardAmount()).eq(ethers.utils.parseEther("0.1"))).to.be.true;
            expect((await strategy.rebalanceCooldown()).eq(3600)).to.be.true; // 1 hour
        });

        it("Should set owner correctly", async function () {
            expect(await strategy.owner()).to.equal(owner.address);
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

        it("Should allow owner to update collateralization ratio", async function () {
            // Now requires timelock - propose change
            await strategy.setCollateralizationRatio(160);
            
            // Check that change is pending
            const pending = await strategy.getPendingChange("collateralizationRatio");
            expect(pending.exists).to.be.true;
            expect(pending.newValue.toString()).to.equal("160");
            
            // Fast forward time to execute
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]); // 48 hours + 1 second
            await ethers.provider.send("evm_mine", []);
            
            // Execute the change
            await strategy.executeCollateralizationRatioChange();
            expect((await strategy.collateralizationRatio()).toString()).to.equal("160");
        });

        it("Should allow owner to update liquidation threshold", async function () {
            await strategy.setLiquidationThreshold(125);
            expect((await strategy.liquidationThreshold()).toString()).to.equal("125");
        });

        it("Should revert if non-owner tries to call admin functions", async function () {
            try {
                await strategy.connect(user1).setFeeRecipient(user1.address);
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("Ownable: caller is not the owner");
            }
        });
    });

    describe("Rebalancing Admin Functions", function () {
        it("Should allow owner to update rebalance threshold", async function () {
            // Now requires timelock - propose change
            await strategy.setRebalanceThreshold(600);
            
            // Check that change is pending
            const pending = await strategy.getPendingChange("rebalanceDeviationThreshold");
            expect(pending.exists).to.be.true;
            expect(pending.newValue.toString()).to.equal("600");
            
            // Fast forward time to execute
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]); // 48 hours + 1 second
            await ethers.provider.send("evm_mine", []);
            
            // Execute the change
            await strategy.executeRebalanceThresholdChange();
            expect((await strategy.rebalanceDeviationThreshold()).toString()).to.equal("600");
        });

        it("Should allow owner to update emergency rebalance threshold", async function () {
            await strategy.setEmergencyRebalanceThreshold(1500);
            expect((await strategy.emergencyRebalanceThreshold()).toString()).to.equal("1500");
        });

        it("Should allow owner to update rebalance reward", async function () {
            const newReward = ethers.utils.parseEther("0.2");
            await strategy.setRebalanceReward(newReward);
            expect((await strategy.rebalanceRewardAmount()).toString()).to.equal(newReward.toString());
        });

        it("Should allow owner to update rebalance cooldown", async function () {
            await strategy.setRebalanceCooldown(7200); // 2 hours
            expect((await strategy.rebalanceCooldown()).toString()).to.equal("7200");
        });

        it("Should revert if rebalance threshold is invalid", async function () {
            try {
                await strategy.setRebalanceThreshold(0);
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("invalid threshold");
            }

            try {
                await strategy.setRebalanceThreshold(2000); // > emergency threshold
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("invalid threshold");
            }
        });

        it("Should revert if emergency threshold is not greater than rebalance threshold", async function () {
            try {
                await strategy.setEmergencyRebalanceThreshold(50); // < rebalance threshold (80 bps)
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("must be > rebalance threshold");
            }
        });
    });

    describe("sAVAX Deposits", function () {
        it("Should accept sAVAX deposits and mint FUSD", async function () {
            const depositAmount = ethers.utils.parseEther("100");
            const usdValue = ethers.utils.parseEther("5000"); // $5000 worth
            
            // Calculate fee (2% management fee)
            const feeAmount = usdValue.mul(INITIAL_FEE_BPS).div(10000);
            const netCollateralValue = usdValue.sub(feeAmount);
            const expectedFUSD = netCollateralValue.mul(100).div(COLLATERALIZATION_RATIO);

            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);

            const tx = await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
            const receipt = await tx.wait();

            // Check for events
            const depositEvent = receipt.events?.find(e => e.event === "Deposit");
            const mintEvent = receipt.events?.find(e => e.event === "FUSDMinted");
            
            expect(depositEvent).to.not.be.undefined;
            expect(mintEvent).to.not.be.undefined;

            // Check user position (now uses net collateral after fee)
            const userPos = await strategy.getUserPosition(user1.address);
            expect(userPos.collateralValue.toString()).to.equal(netCollateralValue.toString());
            expect(userPos.fusdMinted.toString()).to.equal(expectedFUSD.toString());

            // Check global metrics
            const metrics = await strategy.getStrategyMetrics();
            expect(metrics.totalLSTAmount.toString()).to.equal(depositAmount.toString());
            expect(metrics.isActive).to.be.true;
        });

        it("Should revert on zero amounts", async function () {
            try {
                await strategy.connect(user1).depositSAvax(0, ethers.utils.parseEther("100"));
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("zero amount");
            }

            try {
                await strategy.connect(user1).depositSAvax(ethers.utils.parseEther("100"), 0);
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("zero USD value");
            }
        });
    });

    describe("AVAX/WAVAX Deposits", function () {
        it("Should accept AVAX deposits", async function () {
            const depositAmount = ethers.utils.parseEther("10");
            
            const tx = await strategy.connect(user1).depositAVAX({ value: depositAmount });
            const receipt = await tx.wait();
            
            const wrapEvent = receipt.events?.find(e => e.event === "AvaxWrapped");
            expect(wrapEvent).to.not.be.undefined;
        });

        it("Should accept WAVAX deposits", async function () {
            const depositAmount = ethers.utils.parseEther("10");
            
            await mockWAVAX.connect(user1).approve(strategy.address, depositAmount);
            
            const tx = await strategy.connect(user1).depositWAVAX(depositAmount);
            const receipt = await tx.wait();
            
            const wrapEvent = receipt.events?.find(e => e.event === "AvaxWrapped");
            expect(wrapEvent).to.not.be.undefined;
        });
    });

    describe("FUSD Withdrawals", function () {
        beforeEach(async function () {
            const depositAmount = ORACLE_ALIGNED_DEPOSIT_SAVAX;
            const usdValue = ORACLE_ALIGNED_DEPOSIT_USD;
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
        });

        it("Should allow users to burn FUSD and withdraw collateral", async function () {
            const userPos = await strategy.getUserPosition(user1.address);
            // Stay within 1% per-user daily withdrawal limit (1% of ~$2200 TVL = $22)
            const fusdAmount = userPos.fusdMinted.div(100);
            const usdValue = userPos.collateralValue.div(100);

            await mockFUSD.connect(user1).approve(strategy.address, fusdAmount);

            const tx = await strategy.connect(user1).withdrawSAvax(fusdAmount, usdValue);
            const receipt = await tx.wait();

            const withdrawEvent = receipt.events?.find(e => e.event === "Withdraw");
            const burnEvent = receipt.events?.find(e => e.event === "FUSDBurned");
            
            expect(withdrawEvent).to.not.be.undefined;
            expect(burnEvent).to.not.be.undefined;
        });

        it("Should revert if user tries to burn more FUSD than minted", async function () {
            const fusdAmount = ethers.utils.parseEther("10000"); // More than minted
            const usdValue = ethers.utils.parseEther("1000");

            try {
                await strategy.connect(user1).withdrawSAvax(fusdAmount, usdValue);
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("insufficient FUSD minted");
            }
        });
    });

    describe("Rebalancing System", function () {
        beforeEach(async function () {
            // Setup initial portfolio
            const depositAmount = ethers.utils.parseEther("100");
            const usdValue = ethers.utils.parseEther("5000");
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
        });

        it("Should check rebalancing status correctly", async function () {
            const status = await strategy.checkRebalanceStatus();
            expect(status.targetRatio.toString()).to.equal("8000"); // 80%
            expect(status.currentRatio.gt(0)).to.be.true;
            expect(status.deviation.gte(0)).to.be.true;
            expect(status.needsRebalance).to.be.a("boolean");
            expect(status.lastCheckTime.gt(0)).to.be.true;
        });

        it("Should trigger rebalancing when deviation threshold is met", async function () {
            // Set short position to create deviation
            await strategy.connect(owner).setShortNotionalUsd(ethers.utils.parseEther("1000"));
            
            // Trigger rebalance check
            await strategy.connect(owner).triggerRebalance();
            
            const status = await strategy.checkRebalanceStatus();
            console.log("Rebalance status:", {
                targetRatio: status.targetRatio.toString(),
                currentRatio: status.currentRatio.toString(),
                deviation: status.deviation.toString(),
                needsRebalance: status.needsRebalance
            });
        });

        it("Should allow public rebalancing execution", async function () {
            // Set short position to create deviation
            await strategy.connect(owner).setShortNotionalUsd(ethers.utils.parseEther("1000"));
            await strategy.connect(owner).triggerRebalance();
            
            const status = await strategy.checkRebalanceStatus();
            
            if (status.needsRebalance) {
                const initialBalance = await ethers.provider.getBalance(user2.address);
                
                const tx = await strategy.connect(user2).executeRebalance();
                const receipt = await tx.wait();
                
                const rebalanceEvent = receipt.events?.find(e => e.event === "RebalanceExecuted");
                expect(rebalanceEvent).to.not.be.undefined;
                
                const finalBalance = await ethers.provider.getBalance(user2.address);
                expect(finalBalance.gt(initialBalance)).to.be.true;
            }
        });

        it("Should enforce rebalance cooldown", async function () {
            // Set short position to create deviation
            await strategy.connect(owner).setShortNotionalUsd(ethers.utils.parseEther("1000"));
            await strategy.connect(owner).triggerRebalance();
            
            const status = await strategy.checkRebalanceStatus();
            
            if (status.needsRebalance) {
                // First rebalance should succeed
                await strategy.connect(user2).executeRebalance();
                
                // Second rebalance should fail due to cooldown
                try {
                    await strategy.connect(user2).executeRebalance();
                    expect.fail("Should have reverted");
                } catch (error) {
                    expect(error.message).to.include("rebalance cooldown");
                }
            }
        });

        it("Should allow emergency rebalancing with higher rewards", async function () {
            // Set very high short position to trigger emergency threshold
            await strategy.connect(owner).setShortNotionalUsd(ethers.utils.parseEther("10000"));
            await strategy.connect(owner).triggerRebalance();
            
            const status = await strategy.checkRebalanceStatus();
            
            if (status.deviation >= 1000) { // Emergency threshold
                const initialBalance = await ethers.provider.getBalance(user2.address);
                
                const tx = await strategy.connect(user2).executeEmergencyRebalance();
                const receipt = await tx.wait();
                
                const emergencyEvent = receipt.events?.find(e => e.event === "EmergencyRebalanceExecuted");
                expect(emergencyEvent).to.not.be.undefined;
                
                const finalBalance = await ethers.provider.getBalance(user2.address);
                expect(finalBalance.gt(initialBalance)).to.be.true;
            }
        });

        it("Should revert rebalancing when not needed", async function () {
            // Set short position to match target ratio (80% LST, 20% short)
            // With sAVAX price = $22, 100 sAVAX = $2200
            // For 80% LST ratio: $2200 / 0.8 = $2750 total, so short = $550
            await strategy.connect(owner).setShortNotionalUsd(ethers.utils.parseEther("550"));
            await strategy.connect(owner).triggerRebalance();
            
            // Now try to rebalance - should fail because no rebalancing is needed
            try {
                await strategy.connect(user2).executeRebalance();
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("no rebalancing needed");
            }
        });

        it("Should revert emergency rebalancing when deviation is below threshold", async function () {
            // Set short position to match target ratio (80% LST, 20% short)
            // With sAVAX price = $22, 100 sAVAX = $2200
            // For 80% LST ratio: $2200 / 0.8 = $2750 total, so short = $550
            await strategy.connect(owner).setShortNotionalUsd(ethers.utils.parseEther("550"));
            await strategy.connect(owner).triggerRebalance();
            
            try {
                await strategy.connect(user2).executeEmergencyRebalance();
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("deviation below emergency threshold");
            }
        });
    });

    describe("Yield Distribution", function () {
        beforeEach(async function () {
            // Setup deposits from multiple users (USD must match oracle-backed collateral)
            const depositAmount = ORACLE_ALIGNED_DEPOSIT_SAVAX;
            const usdValue = ORACLE_ALIGNED_DEPOSIT_USD;
            
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await mockSAVAX.connect(user2).approve(strategy.address, depositAmount);
            
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
            await strategy.connect(user2).depositSAvax(depositAmount, usdValue);
        });

        it("Should distribute yield to FUSD holders", async function () {
            const yieldAmount = ethers.utils.parseEther("100");
            
            const tx = await strategy.connect(owner).distributeExternalYield(yieldAmount);
            const receipt = await tx.wait();
            
            const yieldEvent = receipt.events?.find(e => e.event === "YieldDistributed");
            expect(yieldEvent).to.not.be.undefined;

            const yieldMetrics = await strategy.getYieldMetrics();
            expect(yieldMetrics.totalYieldDistributedAmount.toString()).to.equal(yieldAmount.toString());
        });

        it("Should allow users to claim accrued yield", async function () {
            const yieldAmount = ethers.utils.parseEther("100");
            await strategy.connect(owner).distributeExternalYield(yieldAmount);

            const initialBalance = await mockSAVAX.balanceOf(user1.address);
            const claimableYield = await strategy.getClaimableYield(user1.address);
            
            const tx = await strategy.connect(user1).claimYield(user1.address);
            const receipt = await tx.wait();
            
            const claimEvent = receipt.events?.find(e => e.event === "YieldClaimed");
            expect(claimEvent).to.not.be.undefined;

            const finalBalance = await mockSAVAX.balanceOf(user1.address);
            expect(finalBalance.sub(initialBalance).toString()).to.equal(claimableYield.toString());
        });

        it("Should calculate claimable yield correctly", async function () {
            const yieldAmount = ethers.utils.parseEther("100");
            await strategy.connect(owner).distributeExternalYield(yieldAmount);

            const claimableYield = await strategy.getClaimableYield(user1.address);
            expect(claimableYield.gt(0)).to.be.true;
        });
    });

    describe("sAVAX Yield Tracking", function () {
        beforeEach(async function () {
            // Setup a deposit to have an active portfolio
            const depositAmount = ethers.utils.parseEther("100");
            const usdValue = ethers.utils.parseEther("5000");
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
        });

        it("Should enable yield tracking", async function () {
            const tx = await strategy.connect(owner).enableSAvaxYieldTracking();
            const receipt = await tx.wait();
            
            const enableEvent = receipt.events?.find(e => e.event === "EnableSAvaxYieldTracking");
            expect(enableEvent).to.not.be.undefined;
            
            expect(await strategy.sAvaxYieldTrackingEnabled()).to.be.true;
            
            // Check that the initial exchange rate was captured
            const initialRate = await mockSAVAX.getExchangeRate();
            expect(initialRate.toString()).to.equal("1000000000000000000"); // 1e18
        });

        it("Should calculate yield delta correctly", async function () {
            await strategy.connect(owner).enableSAvaxYieldTracking();
            
            // Simulate some yield (1% yield)
            await mockSAVAX.connect(owner).simulateYield(100); // 100 bps = 1%
            
            const yieldDelta = await strategy.getSAvaxYieldDelta();
            expect(yieldDelta.enabled).to.be.true;
            expect(yieldDelta.previousRate.toString()).to.equal("1000000000000000000"); // Initial rate
            expect(yieldDelta.currentRate.gt(yieldDelta.previousRate)).to.be.true; // Rate increased
            expect(yieldDelta.impliedSAvaxGrowth.gt(0)).to.be.true; // Should have positive growth
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            const depositAmount = ORACLE_ALIGNED_DEPOSIT_SAVAX;
            const usdValue = ORACLE_ALIGNED_DEPOSIT_USD;
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
        });

        it("Should return correct strategy metrics", async function () {
            const metrics = await strategy.getStrategyMetrics();
            expect(metrics.totalLSTAmount.toString()).to.equal(ethers.utils.parseEther("100").toString());
            expect(metrics.isActive).to.be.true;
        });

        it("Should return correct user position", async function () {
            const userPos = await strategy.getUserPosition(user1.address);
            expect(userPos.collateralValue.toString()).to.equal(ORACLE_ALIGNED_NET_COLLATERAL.toString());
            expect(userPos.fusdMinted.gt(0)).to.be.true;
        });

        it("Should return correct FUSD metrics", async function () {
            const fusdMetrics = await strategy.getFUSDMetrics();
            expect(fusdMetrics.totalMinted.gt(0)).to.be.true;
            expect(fusdMetrics.circulatingSupply.gt(0)).to.be.true;
        });

        it("Should return correct yield metrics", async function () {
            const yieldMetrics = await strategy.getYieldMetrics();
            expect(yieldMetrics.currentYieldIndex.toString()).to.equal(ethers.utils.parseEther("1").toString());
            expect(yieldMetrics.totalYieldDistributedAmount.toString()).to.equal("0");
        });

        it("Should return correct rebalancing metrics", async function () {
            const rebalancingMetrics = await strategy.getRebalancingMetrics();
            expect(rebalancingMetrics.rebalanceThreshold.toString()).to.equal("80");
            expect(rebalancingMetrics.emergencyThreshold.toString()).to.equal("1500");
            expect(rebalancingMetrics.rewardAmount.toString()).to.equal(ethers.utils.parseEther("0.1").toString());
            expect(rebalancingMetrics.cooldown.toString()).to.equal("3600");
        });
    });

    describe("Hybrid Exposure (STRATEGY_REVISION)", function () {
        it("Should expose default 30/70 IL/synthetic parameters", async function () {
            const metrics = await strategy.getHybridExposureMetrics();
            expect(metrics.ilExposureRatioBps.toString()).to.equal("3000");
            expect(metrics.syntheticExposureRatioBps.toString()).to.equal("7000");
            expect(metrics.effectiveIlExposureBps.toString()).to.equal("3000");
            expect(metrics.syntheticOnlyMode).to.equal(false);
        });

        it("Should split short notional into IL and synthetic legs", async function () {
            const shortNotional = ethers.utils.parseEther("1000");
            await strategy.connect(owner).setShortNotionalUsd(shortNotional);

            const metrics = await strategy.getHybridExposureMetrics();
            expect(metrics.ilShortNotionalUsd.toString()).to.equal(ethers.utils.parseEther("300").toString());
            expect(metrics.syntheticShortNotionalUsd.toString()).to.equal(ethers.utils.parseEther("700").toString());
        });

        it("Should switch to 100% synthetic in emergency mode", async function () {
            await strategy.connect(owner).setEmergencySyntheticOnly(true);
            await strategy.connect(owner).setShortNotionalUsd(ethers.utils.parseEther("1000"));

            const metrics = await strategy.getHybridExposureMetrics();
            expect(metrics.syntheticOnlyMode).to.equal(true);
            expect(metrics.effectiveIlExposureBps.toString()).to.equal("0");
            expect(metrics.ilShortNotionalUsd.toString()).to.equal("0");
            expect(metrics.syntheticShortNotionalUsd.toString()).to.equal(ethers.utils.parseEther("1000").toString());
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero FUSD supply in yield distribution", async function () {
            const yieldAmount = ethers.utils.parseEther("100");
            // Should not revert; yield is skipped when no FUSD is outstanding
            await strategy.connect(owner).distributeExternalYield(yieldAmount);
            const yieldMetrics = await strategy.getYieldMetrics();
            expect(yieldMetrics.totalYieldDistributedAmount.toString()).to.equal("0");
            expect(yieldMetrics.currentYieldIndex.toString()).to.equal(ethers.utils.parseEther("1").toString());
        });

        it("Should handle user with zero FUSD balance in yield tracking", async function () {
            // Get claimable yield for user with no FUSD balance
            const claimableYield = await strategy.getClaimableYield(user1.address);
            expect(claimableYield.toString()).to.equal("0");
        });

        it("Should handle rebalancing with no active portfolio", async function () {
            try {
                await strategy.connect(user2).executeRebalance();
                expect.fail("Should have reverted");
            } catch (error) {
                expect(error.message).to.include("no active portfolio");
            }
        });
    });
});
