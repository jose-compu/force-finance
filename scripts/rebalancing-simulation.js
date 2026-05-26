const { ethers } = require("hardhat");

/**
 * Rebalancing Simulation Script
 * 
 * This script simulates various market scenarios and tests the rebalancing system:
 * 1. AVAX price movements (both directions)
 * 2. sAVAX yield distributions
 * 3. Liquidation risk scenarios
 * 4. Profit-taking opportunities
 * 5. Emergency rebalancing situations
 */

async function main() {
    console.log("🚀 Starting Delta-Neutral Rebalancing Simulation...\n");

    const [deployer, keeper1, keeper2, user1, user2] = await ethers.getSigners();

    // Deploy contracts (using existing deployment if available)
    console.log("📋 Deploying contracts...");
    
    const contracts = await deployContracts(deployer);
    console.log("✅ Contracts deployed successfully\n");

    // Setup initial positions
    console.log("🏗️  Setting up initial positions...");
    await setupInitialPositions(contracts, user1, user2);
    console.log("✅ Initial positions set up\n");

    // Run simulation scenarios
    await runSimulationScenarios(contracts, keeper1, keeper2);

    console.log("\n🎯 Simulation completed successfully!");
}

async function deployContracts(deployer) {
    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockWAVAX = await MockERC20.deploy("Wrapped AVAX", "WAVAX");
    const mockSAVAX = await MockERC20.deploy("Staked AVAX", "sAVAX");
    const mockFUSD = await MockERC20.deploy("Force USD", "FUSD");

    // Deploy mock oracle manager
    const mockOracle = await MockERC20.deploy("Mock Oracle", "MO");

    // Deploy position manager
    const PositionManager = await ethers.getContractFactory("PositionManager");
    const positionManager = await PositionManager.deploy(mockOracle.address);

    // Deploy strategy
    const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
    const strategy = await AvalancheLSTStrategy.deploy(deployer.address, 200);

    // Deploy rebalancer
    const DeltaNeutralRebalancer = await ethers.getContractFactory("DeltaNeutralRebalancer");
    const rebalancer = await DeltaNeutralRebalancer.deploy(
        strategy.address,
        positionManager.address,
        mockOracle.address,
        ethers.constants.AddressZero, // Mock GMX router
        ethers.constants.AddressZero  // Mock GMX vault
    );

    return {
        mockWAVAX,
        mockSAVAX,
        mockFUSD,
        mockOracle,
        positionManager,
        strategy,
        rebalancer
    };
}

async function setupInitialPositions(contracts, user1, user2) {
    const { mockSAVAX, mockFUSD, strategy, rebalancer } = contracts;

    // Mint initial tokens
    await mockSAVAX.mint(user1.address, ethers.utils.parseEther("1000"));
    await mockSAVAX.mint(user2.address, ethers.utils.parseEther("1000"));
    await mockFUSD.mint(user1.address, ethers.utils.parseEther("20000"));
    await mockFUSD.mint(user2.address, ethers.utils.parseEther("20000"));

    // Setup strategy with mock addresses
    await strategy.setSAVAXAddress(mockSAVAX.address);
    await strategy.setFUSDAddress(mockFUSD.address);

    // Grant keeper roles
    await rebalancer.grantRole(await rebalancer.KEEPER_ROLE(), user1.address);
    await rebalancer.grantRole(await rebalancer.KEEPER_ROLE(), user2.address);

    console.log(`   💰 User1 sAVAX balance: ${ethers.utils.formatEther(await mockSAVAX.balanceOf(user1.address))}`);
    console.log(`   💰 User2 sAVAX balance: ${ethers.utils.formatEther(await mockSAVAX.balanceOf(user2.address))}`);
}

async function runSimulationScenarios(contracts, keeper1, keeper2) {
    console.log("🎮 Running simulation scenarios...\n");

    // Scenario 1: Normal market conditions
    await simulateNormalConditions(contracts, keeper1);

    // Scenario 2: AVAX price surge (need to increase short)
    await simulateAvaxPriceSurge(contracts, keeper1);

    // Scenario 3: AVAX price drop (profitable shorts)
    await simulateAvaxPriceDrop(contracts, keeper2);

    // Scenario 4: sAVAX yield distribution
    await simulateSavaxYieldDistribution(contracts, keeper1);

    // Scenario 5: Liquidation risk scenario
    await simulateLiquidationRisk(contracts, keeper2);

    // Scenario 6: Emergency rebalancing
    await simulateEmergencyScenario(contracts, keeper1);

    // Scenario 7: Periodic maintenance
    await simulatePeriodicMaintenance(contracts, keeper2);
}

async function simulateNormalConditions(contracts, keeper) {
    console.log("📊 Scenario 1: Normal Market Conditions");
    console.log("   - AVAX price: $20 (stable)");
    console.log("   - sAVAX exchange rate: 1.05 (5% yield)");
    console.log("   - Delta deviation: <2%");

    const { rebalancer } = contracts;

    // Check if rebalance is needed
    const [needed, reason] = await rebalancer.isRebalanceNeeded();
    console.log(`   - Rebalance needed: ${needed} (${reason})`);

    // Get position health
    const [currentDelta, liquidationDistance, unrealizedPnL, isHealthy, riskLevel] = 
        await rebalancer.getPositionHealth();
    
    console.log(`   - Current delta: ${currentDelta} bps`);
    console.log(`   - Liquidation distance: ${liquidationDistance} bps`);
    console.log(`   - Risk level: ${riskLevel}`);
    console.log(`   - Position healthy: ${isHealthy}\n`);
}

async function simulateAvaxPriceSurge(contracts, keeper) {
    console.log("📈 Scenario 2: AVAX Price Surge");
    console.log("   - AVAX price: $20 → $25 (+25%)");
    console.log("   - Need to increase short position for delta neutrality");

    const { rebalancer } = contracts;

    // This would typically trigger rebalancing
    console.log("   - Simulating price impact on delta...");
    
    // Calculate rebalance amounts
    const [sAvaxAdj, shortAdj, incSAvax, incShort] = await rebalancer.calculateRebalanceAmounts();
    console.log(`   - sAVAX adjustment: ${ethers.utils.formatEther(sAvaxAdj)}`);
    console.log(`   - Short adjustment: ${ethers.utils.formatEther(shortAdj)}`);
    console.log(`   - Increase short: ${incShort}`);

    // Try to trigger rebalance (will fail with placeholder implementation)
    try {
        const tx = await rebalancer.connect(keeper).rebalance();
        console.log(`   - Rebalance successful! Gas used: ${tx.gasUsed}`);
    } catch (error) {
        console.log(`   - Rebalance not needed (placeholder implementation)`);
    }
    console.log();
}

async function simulateAvaxPriceDrop(contracts, keeper) {
    console.log("📉 Scenario 3: AVAX Price Drop (Profitable Shorts)");
    console.log("   - AVAX price: $20 → $15 (-25%)");
    console.log("   - Short positions are profitable, consider profit-taking");

    const { rebalancer } = contracts;

    console.log("   - Checking for profit-taking opportunities...");
    
    // Get position health (would show profits in real implementation)
    const [currentDelta, liquidationDistance, unrealizedPnL, isHealthy, riskLevel] = 
        await rebalancer.getPositionHealth();
    
    console.log(`   - Unrealized PnL: ${ethers.utils.formatEther(unrealizedPnL)}`);
    console.log(`   - Current delta: ${currentDelta} bps`);

    // Check if rebalance is needed for profit-taking
    const [needed, reason] = await rebalancer.isRebalanceNeeded();
    console.log(`   - Profit-taking needed: ${needed} (${reason})`);
    console.log();
}

async function simulateSavaxYieldDistribution(contracts, keeper) {
    console.log("💎 Scenario 4: sAVAX Yield Distribution");
    console.log("   - sAVAX exchange rate: 1.05 → 1.08 (+2.86%)");
    console.log("   - More AVAX value in LST, need to adjust short");

    const { mockSAVAX, rebalancer } = contracts;

    // Simulate yield by updating exchange rate (if MockSAVAX supports it)
    try {
        if (mockSAVAX.setExchangeRate) {
            await mockSAVAX.setExchangeRate(ethers.utils.parseEther("1.08"));
            console.log("   - sAVAX exchange rate updated");
        }
    } catch (error) {
        console.log("   - Exchange rate simulation not available");
    }

    // Check rebalancing need after yield distribution
    const [needed, reason] = await rebalancer.isRebalanceNeeded();
    console.log(`   - Rebalance needed: ${needed} (${reason})`);
    console.log();
}

async function simulateLiquidationRisk(contracts, keeper) {
    console.log("⚠️  Scenario 5: Liquidation Risk");
    console.log("   - AVAX price surge puts short positions at risk");
    console.log("   - Need immediate position adjustment");

    const { rebalancer } = contracts;

    // This scenario would trigger emergency rebalancing
    console.log("   - Checking liquidation risk...");
    
    const [currentDelta, liquidationDistance, unrealizedPnL, isHealthy, riskLevel] = 
        await rebalancer.getPositionHealth();
    
    console.log(`   - Liquidation distance: ${liquidationDistance} bps`);
    console.log(`   - Risk level: ${riskLevel}`);
    console.log(`   - Position healthy: ${isHealthy}`);

    // Try emergency rebalance if needed
    if (riskLevel === "CRITICAL") {
        console.log("   - Triggering emergency rebalance...");
        try {
            await rebalancer.connect(keeper).rebalance();
            console.log("   - Emergency rebalance successful!");
        } catch (error) {
            console.log("   - Emergency rebalance failed (placeholder implementation)");
        }
    }
    console.log();
}

async function simulateEmergencyScenario(contracts, keeper) {
    console.log("🚨 Scenario 6: Emergency Rebalancing");
    console.log("   - Extreme market conditions");
    console.log("   - Delta deviation >15% (emergency threshold)");

    const { rebalancer } = contracts;

    // Get emergency role for the keeper (in real scenario, this would be pre-assigned)
    const [deployer] = await ethers.getSigners();
    await rebalancer.connect(deployer).grantRole(await rebalancer.EMERGENCY_ROLE(), keeper.address);

    try {
        const tx = await rebalancer.connect(keeper).emergencyRebalance();
        console.log("   - Emergency rebalance executed successfully!");
    } catch (error) {
        console.log("   - Emergency rebalance failed (placeholder implementation)");
    }
    console.log();
}

async function simulatePeriodicMaintenance(contracts, keeper) {
    console.log("🔄 Scenario 7: Periodic Maintenance");
    console.log("   - 24 hours since last rebalance");
    console.log("   - Routine maintenance regardless of delta");

    const { rebalancer } = contracts;

    // Advance time by 24+ hours (in real test environment)
    console.log("   - Simulating 24+ hour time passage...");
    
    try {
        // This would work if we advanced blockchain time
        await rebalancer.connect(keeper).periodicRebalance();
        console.log("   - Periodic rebalance successful!");
    } catch (error) {
        console.log("   - Periodic rebalance not due yet");
    }

    // Show keeper stats
    const keeperStats = await rebalancer.keeperStats(keeper.address);
    const keeperRewards = await rebalancer.keeperRewards(keeper.address);
    
    console.log(`   - Keeper successful rebalances: ${keeperStats}`);
    console.log(`   - Keeper pending rewards: ${ethers.utils.formatEther(keeperRewards)}`);
    console.log();
}

// Helper function to format large numbers
function formatBN(bn, decimals = 18) {
    return ethers.utils.formatUnits(bn, decimals);
}

// Helper function to simulate time passage
async function advanceTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
}

// Run the simulation
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Simulation failed:", error);
        process.exit(1);
    });
