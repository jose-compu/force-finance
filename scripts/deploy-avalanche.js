const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * @title Avalanche LST Strategy Deployment Script
 * @dev Deploys complete strategy system to Avalanche mainnet
 */

async function main() {
  console.log("🏔️  Deploying Avalanche LST Strategy...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "AVAX\n");

  // Deployment configuration
  const config = {
    feeRecipient: deployer.address, // Change to treasury address in production
    emergencyOperators: [deployer.address],
    guardians: [deployer.address],
    gasLimit: 8000000,
    gasPrice: ethers.parseUnits("25", "gwei") // 25 gwei for Avalanche
  };

  const deployedContracts = {};
  const deploymentLog = [];

  /**
   * Deploy Oracle Manager
   */
  console.log("📊 Deploying Oracle Manager...");
  const OracleManager = await ethers.getContractFactory("AvalancheOracleManager");
  const oracleManager = await OracleManager.deploy({
    gasLimit: config.gasLimit,
    gasPrice: config.gasPrice
  });
  await oracleManager.waitForDeployment();
  
  deployedContracts.oracleManager = await oracleManager.getAddress();
  deploymentLog.push({
    contract: "AvalancheOracleManager",
    address: deployedContracts.oracleManager,
    txHash: oracleManager.deploymentTransaction().hash
  });
  
  console.log("✅ Oracle Manager deployed at:", deployedContracts.oracleManager);
  console.log("   Gas used:", (await oracleManager.deploymentTransaction().wait()).gasUsed.toString());

  /**
   * Deploy GMX Futures Manager (replaces PositionManager)
   */
  console.log("\n🎯 Deploying GMX Futures Manager...");
  const USDC_E = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"; // USDC.e on Avalanche
  const GMXFuturesManager = await ethers.getContractFactory("GMXFuturesManager");
  const gmxFuturesManager = await GMXFuturesManager.deploy(
    deployedContracts.oracleManager,
    USDC_E,
    {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    }
  );
  await gmxFuturesManager.waitForDeployment();
  
  deployedContracts.gmxFuturesManager = await gmxFuturesManager.getAddress();
  deploymentLog.push({
    contract: "GMXFuturesManager",
    address: deployedContracts.gmxFuturesManager,
    txHash: gmxFuturesManager.deploymentTransaction().hash
  });
  
  console.log("✅ GMX Futures Manager deployed at:", deployedContracts.gmxFuturesManager);

  /**
   * Deploy Leverage Optimizer
   */
  console.log("\n⚖️  Deploying Leverage Optimizer...");
  const LeverageOptimizer = await ethers.getContractFactory("LeverageOptimizer");
  const leverageOptimizer = await LeverageOptimizer.deploy(
    deployedContracts.oracleManager,
    {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    }
  );
  await leverageOptimizer.waitForDeployment();
  
  deployedContracts.leverageOptimizer = await leverageOptimizer.getAddress();
  deploymentLog.push({
    contract: "LeverageOptimizer",
    address: deployedContracts.leverageOptimizer,
    txHash: leverageOptimizer.deploymentTransaction().hash
  });
  
  console.log("✅ Leverage Optimizer deployed at:", deployedContracts.leverageOptimizer);

  /**
   * Deploy Rebalancing Engine
   */
  console.log("\n🔄 Deploying Rebalancing Engine...");
  const RebalancingEngine = await ethers.getContractFactory("RebalancingEngine");
  const rebalancingEngine = await RebalancingEngine.deploy(
    deployedContracts.oracleManager,
    "0x0000000000000000000000000000000000000000", // Will be updated after strategy deployment
    {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    }
  );
  await rebalancingEngine.waitForDeployment();
  
  deployedContracts.rebalancingEngine = await rebalancingEngine.getAddress();
  deploymentLog.push({
    contract: "RebalancingEngine",
    address: deployedContracts.rebalancingEngine,
    txHash: rebalancingEngine.deploymentTransaction().hash
  });
  
  console.log("✅ Rebalancing Engine deployed at:", deployedContracts.rebalancingEngine);

  /**
   * Deploy Emergency Controls
   */
  console.log("\n🚨 Deploying Emergency Controls...");
  const EmergencyControls = await ethers.getContractFactory("EmergencyControls");
  const emergencyControls = await EmergencyControls.deploy({
    gasLimit: config.gasLimit,
    gasPrice: config.gasPrice
  });
  await emergencyControls.waitForDeployment();
  
  deployedContracts.emergencyControls = await emergencyControls.getAddress();
  deploymentLog.push({
    contract: "EmergencyControls",
    address: deployedContracts.emergencyControls,
    txHash: emergencyControls.deploymentTransaction().hash
  });
  
  console.log("✅ Emergency Controls deployed at:", deployedContracts.emergencyControls);

  /**
   * Deploy Main Strategy Contract
   */
  console.log("\n🎯 Deploying Main Strategy Contract...");
  const Strategy = await ethers.getContractFactory("AvalancheLSTStrategy");
  const strategy = await Strategy.deploy(
    deployedContracts.oracleManager,
    config.feeRecipient,
    {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    }
  );
  await strategy.waitForDeployment();
  
  deployedContracts.strategy = await strategy.getAddress();
  deploymentLog.push({
    contract: "AvalancheLSTStrategy",
    address: deployedContracts.strategy,
    txHash: strategy.deploymentTransaction().hash
  });
  
  console.log("✅ Main Strategy deployed at:", deployedContracts.strategy);

  /**
   * Post-deployment Configuration
   */
  console.log("\n⚙️  Configuring contracts...");

  // Update strategy contract addresses in other contracts
  console.log("   - Updating Rebalancing Engine strategy address...");
  try {
    const setStrategyTx = await rebalancingEngine.setStrategy(deployedContracts.strategy);
    await setStrategyTx.wait();
    console.log("     ✅ Strategy set in Rebalancing Engine");
  } catch (error) {
    console.log("     ❌ Failed to set strategy in Rebalancing Engine:", error.message);
  }

  console.log("   - Updating Rebalancing Engine GMX Futures Manager...");
  try {
    const setGMXManagerTx = await rebalancingEngine.setGMXFuturesManager(deployedContracts.gmxFuturesManager);
    await setGMXManagerTx.wait();
    console.log("     ✅ GMX Futures Manager set in Rebalancing Engine");
  } catch (error) {
    console.log("     ❌ Failed to set GMX Futures Manager in Rebalancing Engine:", error.message);
  }

  console.log("   - Updating Emergency Controls addresses...");
  try {
    const setRebalancingEngineTx = await emergencyControls.setRebalancingEngine(deployedContracts.rebalancingEngine);
    await setRebalancingEngineTx.wait();
    console.log("     ✅ Rebalancing Engine set in Emergency Controls");
    
    const setGMXManagerEmergencyTx = await emergencyControls.setGMXFuturesManager(deployedContracts.gmxFuturesManager);
    await setGMXManagerEmergencyTx.wait();
    console.log("     ✅ GMX Futures Manager set in Emergency Controls");
  } catch (error) {
    console.log("     ❌ Failed to set addresses in Emergency Controls:", error.message);
  }

  console.log("   - Setting strategy in GMX Futures Manager...");
  try {
    const setStrategyGMXTx = await gmxFuturesManager.setStrategy(deployedContracts.strategy);
    await setStrategyGMXTx.wait();
    console.log("     ✅ Strategy set in GMX Futures Manager");
  } catch (error) {
    console.log("     ❌ Failed to set strategy in GMX Futures Manager:", error.message);
  }

  // Set up emergency operators and guardians
  console.log("   - Setting up emergency operators...");
  for (const operator of config.emergencyOperators) {
    try {
      const tx = await emergencyControls.addEmergencyOperator(operator);
      await tx.wait();
      console.log(`     ✅ Added emergency operator: ${operator}`);
    } catch (error) {
      console.log(`     ❌ Failed to add emergency operator ${operator}:`, error.message);
    }
  }

  console.log("   - Setting up guardians...");
  for (const guardian of config.guardians) {
    try {
      const tx = await emergencyControls.addGuardian(guardian);
      await tx.wait();
      console.log(`     ✅ Added guardian: ${guardian}`);
    } catch (error) {
      console.log(`     ❌ Failed to add guardian ${guardian}:`, error.message);
    }
  }

  /**
   * Verification and Testing
   */
  console.log("\n🔍 Verifying deployment...");

  // Test oracle manager
  try {
    const avaxPrice = await oracleManager.getPrice("0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7");
    console.log("   ✅ Oracle Manager working - AVAX price:", ethers.formatUnits(avaxPrice[0], 18));
  } catch (error) {
    console.log("   ❌ Oracle Manager test failed:", error.message);
  }

  // Test strategy contract
  try {
    const strategyMetrics = await strategy.getStrategyMetrics();
    console.log("   ✅ Strategy Contract working - Total LST Value:", ethers.formatUnits(strategyMetrics[0], 18));
  } catch (error) {
    console.log("   ❌ Strategy Contract test failed:", error.message);
  }

  // Test emergency controls
  try {
    const emergencyStatus = await emergencyControls.getEmergencyStatus();
    console.log("   ✅ Emergency Controls working - Current Level:", emergencyStatus[0]);
  } catch (error) {
    console.log("   ❌ Emergency Controls test failed:", error.message);
  }

  /**
   * Save Deployment Information
   */
  console.log("\n💾 Saving deployment information...");

  const deploymentInfo = {
    network: "avalanche",
    chainId: 43114,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: deployedContracts,
    deploymentLog: deploymentLog,
    config: config
  };

  // Save to JSON file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `avalanche-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("   ✅ Deployment info saved to:", deploymentFile);

  // Save current deployment as latest
  const latestFile = path.join(deploymentsDir, "avalanche-latest.json");
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("   ✅ Latest deployment info saved to:", latestFile);

  // Generate environment file for frontend
  const envContent = `
# Avalanche LST Strategy Contract Addresses
REACT_APP_NETWORK=avalanche
REACT_APP_CHAIN_ID=43114
REACT_APP_ORACLE_MANAGER=${deployedContracts.oracleManager}
REACT_APP_GMX_FUTURES_MANAGER=${deployedContracts.gmxFuturesManager}
REACT_APP_LEVERAGE_OPTIMIZER=${deployedContracts.leverageOptimizer}
REACT_APP_REBALANCING_ENGINE=${deployedContracts.rebalancingEngine}
REACT_APP_EMERGENCY_CONTROLS=${deployedContracts.emergencyControls}
REACT_APP_STRATEGY_CONTRACT=${deployedContracts.strategy}
REACT_APP_DEPLOYER=${deployer.address}
REACT_APP_DEPLOYED_AT=${deploymentInfo.deployedAt}
`;

  const envFile = path.join(__dirname, "..", "frontend", ".env.production");
  fs.writeFileSync(envFile, envContent.trim());
  console.log("   ✅ Frontend environment file saved to:", envFile);

  /**
   * Deployment Summary
   */
  console.log("\n🎉 Deployment Complete!\n");
  console.log("📋 Contract Addresses:");
  console.log("   Oracle Manager:      ", deployedContracts.oracleManager);
  console.log("   GMX Futures Manager: ", deployedContracts.gmxFuturesManager);
  console.log("   Leverage Optimizer:  ", deployedContracts.leverageOptimizer);
  console.log("   Rebalancing Engine:  ", deployedContracts.rebalancingEngine);
  console.log("   Emergency Controls:  ", deployedContracts.emergencyControls);
  console.log("   Strategy Contract:   ", deployedContracts.strategy);

  console.log("\n🔗 Verification Commands:");
  deploymentLog.forEach(log => {
    console.log(`   npx hardhat verify --network avalanche ${log.address}`);
  });

  console.log("\n💡 Next Steps:");
  console.log("   1. Verify contracts on Snowtrace");
  console.log("   2. Set up monitoring and alerting");
  console.log("   3. Configure frontend with contract addresses");
  console.log("   4. Run comprehensive tests on mainnet fork");
  console.log("   5. Perform security audit");
  
  console.log("\n⚠️  Important Notes:");
  console.log("   - Update fee recipient to treasury address");
  console.log("   - Add additional emergency operators and guardians");
  console.log("   - Set up automated monitoring");
  console.log("   - Configure rebalancing thresholds based on market conditions");

  return deployedContracts;
}

// Error handling
main()
  .then((contracts) => {
    console.log("\n✅ Deployment script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

module.exports = { main };
