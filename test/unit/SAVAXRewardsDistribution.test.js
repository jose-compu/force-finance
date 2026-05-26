const { expect } = require("chai");
const { ethers } = require("hardhat");
const { oracleAlignedDeposit } = require("../helpers/oracleAmounts");

describe("sAVAX Rewards Distribution to FUSD Holders", function () {
    let strategy, mockSAVAX, mockFUSD, mockWAVAX;
    let owner, user1, user2, user3;

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy mock contracts
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const MockWAVAX = await ethers.getContractFactory("MockWAVAX");
        const MockSAVAX = await ethers.getContractFactory("MockSAVAX");
        const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
        
        mockFUSD = await MockERC20.deploy("Force USD", "FUSD");
        mockSAVAX = await MockSAVAX.deploy();
        mockWAVAX = await MockWAVAX.deploy();
        
        // Deploy strategy
        const USDC_E_ADDRESS = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"; // Real USDC.e address
        strategy = await AvalancheLSTStrategy.deploy(
            owner.address, // feeRecipient
            200, // managementFeeBps (2%)
            USDC_E_ADDRESS // usdcE address
        );

        // Set token addresses
        await strategy.setFUSDAddress(mockFUSD.address);
        await strategy.setSAVAXAddress(mockSAVAX.address);
        await strategy.setWAVAXAddress(mockWAVAX.address);

        // Grant necessary roles to strategy contract
        await mockFUSD.grantRole(await mockFUSD.MINTER_ROLE(), strategy.address);
        await mockFUSD.grantRole(await mockFUSD.BURNER_ROLE(), strategy.address);

        // Fund strategy with tokens
        await mockSAVAX.mint(strategy.address, ethers.utils.parseEther("10000"));
        await mockSAVAX.mint(user1.address, ethers.utils.parseEther("1000"));
        await mockSAVAX.mint(user2.address, ethers.utils.parseEther("1000"));
        await mockSAVAX.mint(user3.address, ethers.utils.parseEther("1000"));
        await mockSAVAX.grantRole(await mockSAVAX.YIELD_ROLE(), owner.address);
    });

    describe("Complete sAVAX Rewards Distribution Flow", function () {
        it("Should distribute sAVAX yield to FUSD holders based on exchange rate changes", async function () {
            // Step 1: Users deposit sAVAX and mint FUSD
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
            
            await mockSAVAX.connect(user2).approve(strategy.address, depositAmount);
            await strategy.connect(user2).depositSAvax(depositAmount, usdValue);
            
            // Verify FUSD was minted
            expect((await mockFUSD.balanceOf(user1.address)).gt(0)).to.be.true;
            expect((await mockFUSD.balanceOf(user2.address)).gt(0)).to.be.true;
            
            // Step 2: Enable sAVAX yield tracking
            await strategy.connect(owner).enableSAvaxYieldTracking();
            expect(await strategy.sAvaxYieldTrackingEnabled()).to.be.true;
            
            // Step 3: Simulate sAVAX yield (5% increase in exchange rate)
            const initialRate = await mockSAVAX.getExchangeRate();
            const portfolioSize = await strategy.getStrategyMetrics();
            
            // Simulate 5% yield
            await mockSAVAX.connect(owner).simulateYield(500); // 500 bps = 5%
            
            const newRate = await mockSAVAX.getExchangeRate();
            expect(newRate.gt(initialRate)).to.be.true;
            
            // Step 4: Checkpoint the yield (this distributes to FUSD holders)
            const tx = await strategy.connect(owner).checkpointSAvaxYield();
            const receipt = await tx.wait();
            
            // Verify the yield checkpoint event
            const checkpointEvent = receipt.events?.find(e => e.event === "SAvaxYieldCheckpoint");
            expect(checkpointEvent).to.not.be.undefined;
            
            // Step 5: Verify yield was distributed to FUSD holders
            const yieldMetrics = await strategy.getYieldMetrics();
            expect(yieldMetrics.totalYieldDistributedAmount.gt(0)).to.be.true;
            
            // Step 6: Users can now claim their sAVAX rewards
            const user1ClaimableBefore = await strategy.getClaimableYield(user1.address);
            const user2ClaimableBefore = await strategy.getClaimableYield(user2.address);
            
            expect(user1ClaimableBefore.gt(0)).to.be.true;
            expect(user2ClaimableBefore.gt(0)).to.be.true;
            
            // Step 7: Users claim their sAVAX rewards
            const user1InitialSAVAX = await mockSAVAX.balanceOf(user1.address);
            const user2InitialSAVAX = await mockSAVAX.balanceOf(user2.address);
            
            await strategy.connect(user1).claimYield(user1.address);
            await strategy.connect(user2).claimYield(user2.address);
            
            const user1FinalSAVAX = await mockSAVAX.balanceOf(user1.address);
            const user2FinalSAVAX = await mockSAVAX.balanceOf(user2.address);
            
            // Verify users received sAVAX rewards
            expect(user1FinalSAVAX.gt(user1InitialSAVAX)).to.be.true;
            expect(user2FinalSAVAX.gt(user2InitialSAVAX)).to.be.true;
            
            // Step 8: Verify claimable yield is reset after claiming
            const user1ClaimableAfter = await strategy.getClaimableYield(user1.address);
            const user2ClaimableAfter = await strategy.getClaimableYield(user2.address);
            
            expect(user1ClaimableAfter.toString()).to.equal("0");
            expect(user2ClaimableAfter.toString()).to.equal("0");
        });

        it("Should distribute yield proportionally based on FUSD holdings", async function () {
            // Setup: User1 deposits more than User2
            const user1Deposit = ethers.utils.parseEther("150");
            const user2Deposit = ethers.utils.parseEther("50");
            const user1UsdValue = user1Deposit.mul(22);
            const user2UsdValue = user2Deposit.mul(22);
            
            await mockSAVAX.connect(user1).approve(strategy.address, user1Deposit);
            await strategy.connect(user1).depositSAvax(user1Deposit, user1UsdValue);
            
            await mockSAVAX.connect(user2).approve(strategy.address, user2Deposit);
            await strategy.connect(user2).depositSAvax(user2Deposit, user2UsdValue);
            
            // Enable yield tracking
            await strategy.connect(owner).enableSAvaxYieldTracking();
            
            // Simulate yield
            await mockSAVAX.connect(owner).simulateYield(1000); // 10% yield
            
            // Checkpoint yield
            await strategy.connect(owner).checkpointSAvaxYield();
            
            // Check claimable yields
            const user1Claimable = await strategy.getClaimableYield(user1.address);
            const user2Claimable = await strategy.getClaimableYield(user2.address);
            
            // User1 should have more claimable yield (3x more FUSD)
            expect(user1Claimable.gt(user2Claimable)).to.be.true;
            
            // The ratio should be approximately 3:1 (150:50)
            const ratio = user1Claimable.mul(1000).div(user2Claimable);
            expect(ratio.toNumber()).to.be.closeTo(3000, 100); // Allow some tolerance
        });

        it("Should handle multiple yield checkpoints over time", async function () {
            // Setup deposits
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
            
            await strategy.connect(owner).enableSAvaxYieldTracking();
            
            // First yield checkpoint (5% yield)
            await mockSAVAX.connect(owner).simulateYield(500);
            await strategy.connect(owner).checkpointSAvaxYield();
            
            const firstClaimable = await strategy.getClaimableYield(user1.address);
            expect(firstClaimable.gt(0)).to.be.true;
            
            // Second yield checkpoint (3% more yield)
            await mockSAVAX.connect(owner).simulateYield(300);
            await strategy.connect(owner).checkpointSAvaxYield();
            
            const secondClaimable = await strategy.getClaimableYield(user1.address);
            expect(secondClaimable.gt(firstClaimable)).to.be.true;
            
            // Third yield checkpoint (2% more yield)
            await mockSAVAX.connect(owner).simulateYield(200);
            await strategy.connect(owner).checkpointSAvaxYield();
            
            const thirdClaimable = await strategy.getClaimableYield(user1.address);
            expect(thirdClaimable.gt(secondClaimable)).to.be.true;
            
            // User claims all accumulated yield
            const initialBalance = await mockSAVAX.balanceOf(user1.address);
            await strategy.connect(user1).claimYield(user1.address);
            const finalBalance = await mockSAVAX.balanceOf(user1.address);
            
            expect(finalBalance.gt(initialBalance)).to.be.true;
            expect((await strategy.getClaimableYield(user1.address)).toString()).to.equal("0");
        });

        it("Should handle users joining after yield has been distributed", async function () {
            // User1 deposits first
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
            
            await strategy.connect(owner).enableSAvaxYieldTracking();
            
            // Generate some yield
            await mockSAVAX.connect(owner).simulateYield(500);
            await strategy.connect(owner).checkpointSAvaxYield();
            
            // User2 deposits after yield has been generated
            await mockSAVAX.connect(user2).approve(strategy.address, depositAmount);
            await strategy.connect(user2).depositSAvax(depositAmount, usdValue);
            
            // User1 should have claimable yield from the first distribution
            // User2 should also have some yield since they joined during the current yield period
            const user1Claimable = await strategy.getClaimableYield(user1.address);
            const user2Claimable = await strategy.getClaimableYield(user2.address);
            
            expect(user1Claimable.gt(0)).to.be.true;
            expect(user2Claimable.gt(0)).to.be.true;
            
            // Generate more yield
            await mockSAVAX.connect(owner).simulateYield(300);
            await strategy.connect(owner).checkpointSAvaxYield();
            
            // Now both users should have claimable yield from the second distribution
            const user1ClaimableAfter = await strategy.getClaimableYield(user1.address);
            const user2ClaimableAfter = await strategy.getClaimableYield(user2.address);
            
            expect(user1ClaimableAfter.gt(user1Claimable)).to.be.true;
            expect(user2ClaimableAfter.gt(0)).to.be.true;
        });

        it("Should handle external yield distribution", async function () {
            // Setup deposits
            const { amount: depositAmount, usd: usdValue } = oracleAlignedDeposit(100);
            
            await mockSAVAX.connect(user1).approve(strategy.address, depositAmount);
            await strategy.connect(user1).depositSAvax(depositAmount, usdValue);
            
            await mockSAVAX.connect(user2).approve(strategy.address, depositAmount);
            await strategy.connect(user2).depositSAvax(depositAmount, usdValue);
            
            // Distribute external yield (e.g., from other sources)
            const externalYield = ethers.utils.parseEther("50");
            await strategy.connect(owner).distributeExternalYield(externalYield);
            
            // Both users should have claimable yield
            const user1Claimable = await strategy.getClaimableYield(user1.address);
            const user2Claimable = await strategy.getClaimableYield(user2.address);
            
            expect(user1Claimable.gt(0)).to.be.true;
            expect(user2Claimable.gt(0)).to.be.true;
            
            // Users should have equal claimable amounts (equal FUSD holdings)
            expect(user1Claimable.toString()).to.equal(user2Claimable.toString());
        });
    });

    describe("Yield Distribution Mechanics", function () {
        it("Should calculate yield index correctly", async function () {
            // Setup
            await mockSAVAX.connect(user1).approve(strategy.address, ethers.utils.parseEther("100"));
            const { amount, usd } = oracleAlignedDeposit(100);
            await strategy.connect(user1).depositSAvax(amount, usd);
            
            // Initial yield index should be 1e18
            const initialYieldMetrics = await strategy.getYieldMetrics();
            expect(initialYieldMetrics.currentYieldIndex.toString()).to.equal(ethers.utils.parseEther("1").toString());
            
            // Distribute yield
            await strategy.connect(owner).distributeExternalYield(ethers.utils.parseEther("100"));
            
            // Yield index should increase
            const updatedYieldMetrics = await strategy.getYieldMetrics();
            expect(updatedYieldMetrics.currentYieldIndex.gt(initialYieldMetrics.currentYieldIndex)).to.be.true;
        });

        it("Should handle zero FUSD supply gracefully", async function () {
            // Deploy a fresh strategy and fresh FUSD with no supply
            const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const freshFUSD = await MockERC20.deploy("Force USD", "FUSD");
            const USDC_E_ADDRESS = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"; // Real USDC.e address
            const freshStrategy = await AvalancheLSTStrategy.deploy(
                owner.address, // feeRecipient
                200, // managementFeeBps (2%)
                USDC_E_ADDRESS // usdcE address
            );
            
            // Set FUSD address but don't mint any FUSD
            await freshStrategy.setFUSDAddress(freshFUSD.address);
            
            // Try to distribute yield with no FUSD supply
            await freshStrategy.connect(owner).distributeExternalYield(ethers.utils.parseEther("100"));
            
            // Should not revert, but no yield should be distributed
            const yieldMetrics = await freshStrategy.getYieldMetrics();
            expect(yieldMetrics.totalYieldDistributedAmount.toString()).to.equal("0");
        });

        it("Should update user yield tracking correctly", async function () {
            // Setup
            await mockSAVAX.connect(user1).approve(strategy.address, ethers.utils.parseEther("100"));
            const { amount, usd } = oracleAlignedDeposit(100);
            await strategy.connect(user1).depositSAvax(amount, usd);
            
            // Distribute yield
            await strategy.connect(owner).distributeExternalYield(ethers.utils.parseEther("100"));
            
            // User should have claimable yield
            const claimableYield = await strategy.getClaimableYield(user1.address);
            expect(claimableYield.gt(0)).to.be.true;
            
            // After claiming, yield should be reset
            await strategy.connect(user1).claimYield(user1.address);
            expect((await strategy.getClaimableYield(user1.address)).toString()).to.equal("0");
        });
    });
});
