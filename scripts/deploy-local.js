const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * @title Local Testnet Deployment Script
 * @dev Deploys Avalanche LST Strategy contracts to local Hardhat network
 */

async function waitForNode() {
  console.log("⏳ Waiting for Hardhat node to be ready...");
  let attempts = 0;
  const maxAttempts = 60;
  
  while (attempts < maxAttempts) {
    try {
      const provider = ethers.provider;
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ Hardhat node is ready! Chain ID: ${network.chainId}, Block: ${blockNumber}`);
      return;
    } catch (error) {
      attempts++;
      if (attempts % 5 === 0) {
        console.log(`Attempt ${attempts}/${maxAttempts}: Node not ready yet, waiting...`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error("Hardhat node failed to start within 2 minutes");
}

async function main() {
  console.log("🚀 Deploying Force Finance to local Hardhat network...\n");
  
  // Wait for node to be ready
  await waitForNode();
  
  const [deployer, user1, user2] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  const deployedContracts = {};
  const TEST_CONFIG = {
    USDC_E: "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664", // USDC.e on Avalanche (will use mock for local)
    WAVAX: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX on Avalanche (will use mock for local)
    SAVAX: "0x2B2C81E08f1aF8835aB89c2Ffc7e21D6DfFC7E2C", // sAVAX on Avalanche (will use mock for local)
  };

  /**
   * Deploy Mock Tokens for Local Testing
   */
  console.log("📦 Deploying Mock Tokens...");
  
  // Deploy MockSAVAX
  const MockSAVAX = await ethers.getContractFactory("MockSAVAX");
  const mockSAVAX = await MockSAVAX.deploy();
  await mockSAVAX.waitForDeployment();
  deployedContracts.mockSAVAX = await mockSAVAX.getAddress();
  console.log("✅ MockSAVAX deployed at:", deployedContracts.mockSAVAX);
  
  // Deploy MockWAVAX
  const MockWAVAX = await ethers.getContractFactory("MockWAVAX");
  const mockWAVAX = await MockWAVAX.deploy();
  await mockWAVAX.waitForDeployment();
  deployedContracts.mockWAVAX = await mockWAVAX.getAddress();
  console.log("✅ MockWAVAX deployed at:", deployedContracts.mockWAVAX);
  
  // Deploy MockUSDC
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy("USD Coin", "USDC.e", 6);
  await mockUSDC.waitForDeployment();
  deployedContracts.mockUSDC = await mockUSDC.getAddress();
  console.log("✅ MockUSDC deployed at:", deployedContracts.mockUSDC);

  /**
   * Deploy Oracle Manager
   */
  console.log("\n📊 Deploying AvalancheOracleManager...");
  const OracleManager = await ethers.getContractFactory("AvalancheOracleManager");
  const oracleManager = await OracleManager.deploy();
  await oracleManager.waitForDeployment();
  deployedContracts.oracleManager = await oracleManager.getAddress();
  console.log("✅ Oracle Manager deployed at:", deployedContracts.oracleManager);

  /**
   * Deploy GMX Futures Manager
   */
  console.log("\n🎯 Deploying GMXFuturesManager...");
  const GMXFuturesManager = await ethers.getContractFactory("GMXFuturesManager");
  const gmxFuturesManager = await GMXFuturesManager.deploy(
    deployedContracts.oracleManager,
    deployedContracts.mockUSDC
  );
  await gmxFuturesManager.waitForDeployment();
  deployedContracts.gmxFuturesManager = await gmxFuturesManager.getAddress();
  console.log("✅ GMX Futures Manager deployed at:", deployedContracts.gmxFuturesManager);

  /**
   * Deploy ForceStablecoin (FUSD)
   */
  console.log("\n💰 Deploying ForceStablecoin (FUSD)...");
  const ForceStablecoin = await ethers.getContractFactory("ForceStablecoin");
  const fusd = await ForceStablecoin.deploy("Force USD", "FUSD");
  await fusd.waitForDeployment();
  deployedContracts.fusd = await fusd.getAddress();
  console.log("✅ FUSD deployed at:", deployedContracts.fusd);

  /**
   * Deploy Main Strategy
   */
  console.log("\n🎯 Deploying AvalancheLSTStrategy...");
  const Strategy = await ethers.getContractFactory("AvalancheLSTStrategy");
  const strategy = await Strategy.deploy(
    deployer.address, // fee recipient
    200, // 2% management fee
    deployedContracts.mockUSDC
  );
  await strategy.waitForDeployment();
  deployedContracts.strategy = await strategy.getAddress();
  console.log("✅ Strategy deployed at:", deployedContracts.strategy);

  /**
   * Deploy Rebalancing Engine
   */
  console.log("\n⚖️  Deploying RebalancingEngine...");
  const RebalancingEngine = await ethers.getContractFactory("RebalancingEngine");
  const rebalancingEngine = await RebalancingEngine.deploy(
    deployedContracts.oracleManager
  );
  await rebalancingEngine.waitForDeployment();
  deployedContracts.rebalancingEngine = await rebalancingEngine.getAddress();
  console.log("✅ Rebalancing Engine deployed at:", deployedContracts.rebalancingEngine);

  /**
   * Deploy Emergency Controls
   */
  console.log("\n🚨 Deploying EmergencyControls...");
  const EmergencyControls = await ethers.getContractFactory("EmergencyControls");
  const emergencyControls = await EmergencyControls.deploy();
  await emergencyControls.waitForDeployment();
  deployedContracts.emergencyControls = await emergencyControls.getAddress();
  console.log("✅ Emergency Controls deployed at:", deployedContracts.emergencyControls);

  /**
   * Configure Contracts
   */
  console.log("\n⚙️  Configuring contracts...");
  
  // Set FUSD address in strategy
  await strategy.setFUSDAddress(deployedContracts.fusd);
  console.log("   ✅ FUSD configured");
  
  // Set sAVAX address (using mock)
  await strategy.setSAVAXAddress(deployedContracts.mockSAVAX);
  console.log("   ✅ sAVAX configured");
  
  // Set WAVAX address (using mock)
  await strategy.setWAVAXAddress(deployedContracts.mockWAVAX);
  console.log("   ✅ WAVAX configured");
  
  // Set GMX Futures Manager
  await strategy.setFuturesManager(deployedContracts.gmxFuturesManager);
  console.log("   ✅ GMX Futures Manager configured");
  
  // Set Oracle Manager
  await strategy.setOracleManager(deployedContracts.oracleManager);
  console.log("   ✅ Oracle Manager configured");
  
  // Set strategy in FUSD
  await fusd.setStrategy(deployedContracts.strategy);
  console.log("   ✅ Strategy set in FUSD");
  
  // Grant MINTER_ROLE and BURNER_ROLE to strategy in FUSD
  const MINTER_ROLE = await fusd.MINTER_ROLE();
  const BURNER_ROLE = await fusd.BURNER_ROLE();
  await fusd.grantRole(MINTER_ROLE, deployedContracts.strategy);
  await fusd.grantRole(BURNER_ROLE, deployedContracts.strategy);
  console.log("   ✅ Strategy roles granted in FUSD");
  
  // Configure Rebalancing Engine
  await rebalancingEngine.setStrategy(deployedContracts.strategy);
  await rebalancingEngine.setGMXFuturesManager(deployedContracts.gmxFuturesManager);
  console.log("   ✅ Rebalancing Engine configured");
  
  // Configure Emergency Controls
  await emergencyControls.setRebalancingEngine(deployedContracts.rebalancingEngine);
  await emergencyControls.setGMXFuturesManager(deployedContracts.gmxFuturesManager);
  console.log("   ✅ Emergency Controls configured");
  
  // Grant MINTER_ROLE to deployer in MockSAVAX for testing
  const mockSAVAX_MINTER = await mockSAVAX.MINTER_ROLE();
  await mockSAVAX.grantRole(mockSAVAX_MINTER, deployer.address);
  console.log("   ✅ Deployer can mint MockSAVAX for testing");

  /**
   * Save Deployment Data
   */
  const network = await ethers.provider.getNetwork();
  const deploymentData = {
    network: "localhost",
    chainId: Number(network.chainId),
    timestamp: Date.now(),
    deployer: deployer.address,
    testUsers: [user1.address, user2.address],
    contracts: {
      strategy: deployedContracts.strategy,
      fusd: deployedContracts.fusd,
      oracleManager: deployedContracts.oracleManager,
      gmxFuturesManager: deployedContracts.gmxFuturesManager,
      rebalancingEngine: deployedContracts.rebalancingEngine,
      emergencyControls: deployedContracts.emergencyControls,
      mockSAVAX: deployedContracts.mockSAVAX,
      mockWAVAX: deployedContracts.mockWAVAX,
      mockUSDC: deployedContracts.mockUSDC,
    },
    rpcUrl: "http://127.0.0.1:8545"
  };
  
  fs.writeFileSync('./deployments-local.json', JSON.stringify(deploymentData, null, 2));
  fs.writeFileSync('./frontend/src/deployments.json', JSON.stringify(deploymentData, null, 2));

  console.log("\n🎉 === LOCAL DEPLOYMENT COMPLETE ===");
  console.log("📄 Contract addresses saved to deployments-local.json");
  console.log("📄 Frontend config saved to frontend/src/deployments.json");
  console.log("\n📋 Quick Reference:");
  console.log("Strategy:", deployedContracts.strategy);
  console.log("FUSD:", deployedContracts.fusd);
  console.log("Oracle Manager:", deployedContracts.oracleManager);
  console.log("GMX Futures Manager:", deployedContracts.gmxFuturesManager);
  console.log("Rebalancing Engine:", deployedContracts.rebalancingEngine);
  console.log("Emergency Controls:", deployedContracts.emergencyControls);
  console.log("MockSAVAX:", deployedContracts.mockSAVAX);
  console.log("MockWAVAX:", deployedContracts.mockWAVAX);
  console.log("MockUSDC:", deployedContracts.mockUSDC);
  
  console.log("\n🔗 Network Info:");
  console.log("RPC URL: http://127.0.0.1:8545");
  console.log("Chain ID:", Number(network.chainId));
  console.log("Deployer Address:", deployer.address);
  console.log("Test User 1:", user1.address);
  console.log("Test User 2:", user2.address);
  
  console.log("\n🚀 Ready to start the frontend!");
  console.log("Run: cd frontend && npm start");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
