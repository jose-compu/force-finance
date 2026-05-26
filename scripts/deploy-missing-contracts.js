const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * @title Missing Contracts Deployment Script
 * @dev Deploys all missing contracts and initializes them
 */

async function main() {
  console.log("🔧 Deploying Missing Contracts...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.provider.getBalance(deployer.address)), "AVAX\n");

  const deployedContracts = {};
  const deploymentLog = [];

  // Deployment configuration
  const config = {
    gasLimit: 8000000
  };

  /**
   * Deploy Oracle Manager (if not already deployed)
   */
  console.log("📊 Deploying Oracle Manager...");
  const OracleManager = await ethers.getContractFactory("AvalancheOracleManager");
  const oracleManager = await OracleManager.deploy({
    gasLimit: config.gasLimit
  });
  await oracleManager.deployed();
  
  deployedContracts.oracleManager = oracleManager.address;
  deploymentLog.push({
    contract: "AvalancheOracleManager",
    address: deployedContracts.oracleManager,
    txHash: oracleManager.deployTransaction.hash
  });
  
  console.log("✅ Oracle Manager deployed at:", deployedContracts.oracleManager);

  /**
   * Deploy Position Manager
   */
  console.log("\n🎯 Deploying Position Manager...");
  const PositionManager = await ethers.getContractFactory("PositionManager");
  const positionManager = await PositionManager.deploy(
    deployedContracts.oracleManager,
    {
      gasLimit: config.gasLimit
    }
  );
  await positionManager.deployed();
  
  deployedContracts.positionManager = positionManager.address;
  deploymentLog.push({
    contract: "PositionManager",
    address: deployedContracts.positionManager,
    txHash: positionManager.deployTransaction.hash
  });
  
  console.log("✅ Position Manager deployed at:", deployedContracts.positionManager);

  /**
   * Deploy Leverage Optimizer
   */
  console.log("\n⚖️  Deploying Leverage Optimizer...");
  const LeverageOptimizer = await ethers.getContractFactory("LeverageOptimizer");
  const leverageOptimizer = await LeverageOptimizer.deploy(
    deployedContracts.oracleManager,
    {
      gasLimit: config.gasLimit
    }
  );
  await leverageOptimizer.deployed();
  
  deployedContracts.leverageOptimizer = leverageOptimizer.address;
  deploymentLog.push({
    contract: "LeverageOptimizer",
    address: deployedContracts.leverageOptimizer,
    txHash: leverageOptimizer.deployTransaction.hash
  });
  
  console.log("✅ Leverage Optimizer deployed at:", deployedContracts.leverageOptimizer);

  /**
   * Deploy Rebalancing Engine
   */
  console.log("\n🔄 Deploying Rebalancing Engine...");
  const RebalancingEngine = await ethers.getContractFactory("RebalancingEngine");
  const rebalancingEngine = await RebalancingEngine.deploy(
    deployedContracts.oracleManager,
    {
      gasLimit: config.gasLimit
    }
  );
  await rebalancingEngine.deployed();
  
  deployedContracts.rebalancingEngine = rebalancingEngine.address;
  deploymentLog.push({
    contract: "RebalancingEngine",
    address: deployedContracts.rebalancingEngine,
    txHash: rebalancingEngine.deployTransaction.hash
  });
  
  console.log("✅ Rebalancing Engine deployed at:", deployedContracts.rebalancingEngine);

  /**
   * Deploy Emergency Controls
   */
  console.log("\n🚨 Deploying Emergency Controls...");
  const EmergencyControls = await ethers.getContractFactory("EmergencyControls");
  const emergencyControls = await EmergencyControls.deploy({
    gasLimit: config.gasLimit
  });
  await emergencyControls.deployed();
  
  deployedContracts.emergencyControls = emergencyControls.address;
  deploymentLog.push({
    contract: "EmergencyControls",
    address: deployedContracts.emergencyControls,
    txHash: emergencyControls.deployTransaction.hash
  });
  
  console.log("✅ Emergency Controls deployed at:", deployedContracts.emergencyControls);

  /**
   * Deploy ForceStablecoin (FUSD)
   */
  console.log("\n💰 Deploying ForceStablecoin (FUSD)...");
  const ForceStablecoin = await ethers.getContractFactory("ForceStablecoin");
  const forceStablecoin = await ForceStablecoin.deploy("Force USD", "FUSD", {
    gasLimit: config.gasLimit
  });
  await forceStablecoin.deployed();
  
  deployedContracts.forceStablecoin = forceStablecoin.address;
  deploymentLog.push({
    contract: "ForceStablecoin",
    address: deployedContracts.forceStablecoin,
    txHash: forceStablecoin.deployTransaction.hash
  });
  
  console.log("✅ ForceStablecoin deployed at:", deployedContracts.forceStablecoin);

  /**
   * Deploy Main Strategy Contract
   */
  console.log("\n🎯 Deploying Main Strategy Contract...");
  const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
  const strategy = await AvalancheLSTStrategy.deploy(
    deployer.address, // Fee recipient
    200, // 2% management fee
    {
      gasLimit: config.gasLimit
    }
  );
  await strategy.deployed();
  
  deployedContracts.strategy = strategy.address;
  deploymentLog.push({
    contract: "AvalancheLSTStrategy",
    address: deployedContracts.strategy,
    txHash: strategy.deployTransaction.hash
  });
  
  console.log("✅ Main Strategy deployed at:", deployedContracts.strategy);

  /**
   * Initialize Contracts
   */
  console.log("\n🔧 Initializing Contracts...");

  // Set strategy in Position Manager
  console.log("Setting strategy in Position Manager...");
  const setStrategyTx = await positionManager.setStrategy(deployedContracts.strategy);
  await setStrategyTx.wait();
  console.log("✅ Strategy set in Position Manager");

  // Set strategy in Leverage Optimizer
  console.log("Setting strategy in Leverage Optimizer...");
  const setStrategyLeverageTx = await leverageOptimizer.setStrategy(deployedContracts.strategy);
  await setStrategyLeverageTx.wait();
  console.log("✅ Strategy set in Leverage Optimizer");

  // Set strategy in Rebalancing Engine
  console.log("Setting strategy in Rebalancing Engine...");
  const setStrategyRebalanceTx = await rebalancingEngine.setStrategy(deployedContracts.strategy);
  await setStrategyRebalanceTx.wait();
  console.log("✅ Strategy set in Rebalancing Engine");

  // Set position manager in Rebalancing Engine
  console.log("Setting position manager in Rebalancing Engine...");
  const setPositionManagerTx = await rebalancingEngine.setPositionManager(deployedContracts.positionManager);
  await setPositionManagerTx.wait();
  console.log("✅ Position Manager set in Rebalancing Engine");

  // Set rebalancing engine in Emergency Controls
  console.log("Setting rebalancing engine in Emergency Controls...");
  const setRebalancingEngineTx = await emergencyControls.setRebalancingEngine(deployedContracts.rebalancingEngine);
  await setRebalancingEngineTx.wait();
  console.log("✅ Rebalancing Engine set in Emergency Controls");

  // Set position manager in Emergency Controls
  console.log("Setting position manager in Emergency Controls...");
  const setPositionManagerEmergencyTx = await emergencyControls.setPositionManager(deployedContracts.positionManager);
  await setPositionManagerEmergencyTx.wait();
  console.log("✅ Position Manager set in Emergency Controls");

  // Set FUSD address in Strategy
  console.log("Setting FUSD address in Strategy...");
  const setFUSDTx = await strategy.setFUSDAddress(deployedContracts.forceStablecoin);
  await setFUSDTx.wait();
  console.log("✅ FUSD address set in Strategy");

  // Add strategy as minter and burner in FUSD
  console.log("Adding strategy as minter and burner in FUSD...");
  const addMinterTx = await forceStablecoin.addMinter(deployedContracts.strategy);
  await addMinterTx.wait();
  const addBurnerTx = await forceStablecoin.addBurner(deployedContracts.strategy);
  await addBurnerTx.wait();
  console.log("✅ Strategy added as minter and burner in FUSD");

  /**
   * Save Deployment Information
   */
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedContracts,
    deploymentLog: deploymentLog
  };

  // Save to file
  const deploymentPath = path.join(__dirname, "../deployments-missing.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  /**
   * Print Summary
   */
  console.log("\n🎉 Deployment Complete!");
  console.log("=".repeat(50));
  console.log("📋 Deployed Contracts:");
  console.log(`   Oracle Manager:      ${deployedContracts.oracleManager}`);
  console.log(`   Position Manager:    ${deployedContracts.positionManager}`);
  console.log(`   Leverage Optimizer:  ${deployedContracts.leverageOptimizer}`);
  console.log(`   Rebalancing Engine:  ${deployedContracts.rebalancingEngine}`);
  console.log(`   Emergency Controls:  ${deployedContracts.emergencyControls}`);
  console.log(`   ForceStablecoin:     ${deployedContracts.forceStablecoin}`);
  console.log(`   Strategy Contract:   ${deployedContracts.strategy}`);
  console.log("\n📁 Deployment info saved to: deployments-missing.json");

  return deployedContracts;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
