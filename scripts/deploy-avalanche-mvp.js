const { ethers } = require("hardhat");
const fs = require("fs");
const NetworkConfig = require("./config");

/**
 * @title Avalanche LST Strategy MVP Deployment Script
 * @dev Deploys the minimal viable product to Avalanche testnet/mainnet
 */

async function main() {
  console.log("🏔️  Deploying Avalanche LST Strategy MVP...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get network info
  const network = await deployer.provider.getNetwork();
  const networkConfig = new NetworkConfig();
  const chainConfig = networkConfig.getNetworkConfig(network.chainId);
  
  console.log("Account balance:", ethers.utils.formatEther(await deployer.provider.getBalance(deployer.address)), chainConfig.nativeToken);
  console.log("Network:", chainConfig.name, "(Chain ID:", network.chainId, ")\n");

  // Deployment configuration
  const config = {
    feeRecipient: deployer.address, // Change to treasury address in production
    managementFeeBps: 200, // 2% management fee
    gasLimit: 8000000,
    gasPrice: chainConfig.gasPrice === 'auto' ? 'auto' : ethers.utils.parseUnits(chainConfig.gasPrice, 'gwei'),
    nativeToken: chainConfig.nativeToken
  };

  const deployedContracts = {};
  const deploymentLog = [];

  try {
    /**
     * Deploy ForceStablecoin (FUSD)
     */
    console.log("💰 Deploying ForceStablecoin (FUSD)...");
    const ForceStablecoin = await ethers.getContractFactory("ForceStablecoin");
    const deployOptions = {
      gasLimit: config.gasLimit
    };
    if (config.gasPrice !== "auto") {
      deployOptions.gasPrice = config.gasPrice;
    }
    
    const fusd = await ForceStablecoin.deploy("Force USD", "FUSD", deployOptions);
    await fusd.waitForDeployment();
    
    deployedContracts.fusd = await fusd.getAddress();
    deploymentLog.push({
      contract: "ForceStablecoin",
      address: deployedContracts.fusd,
      txHash: fusd.deploymentTransaction().hash
    });
    
    console.log("✅ ForceStablecoin deployed at:", deployedContracts.fusd);
    console.log("   Gas used:", (await fusd.deploymentTransaction().wait()).gasUsed.toString());

    /**
     * Deploy AvalancheLSTStrategy
     */
    console.log("\n🎯 Deploying AvalancheLSTStrategy...");
    const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
    const strategy = await AvalancheLSTStrategy.deploy(
      config.feeRecipient,
      config.managementFeeBps,
      deployOptions
    );
    await strategy.waitForDeployment();
    
    deployedContracts.strategy = await strategy.getAddress();
    deploymentLog.push({
      contract: "AvalancheLSTStrategy",
      address: deployedContracts.strategy,
      txHash: strategy.deploymentTransaction().hash
    });
    
    console.log("✅ AvalancheLSTStrategy deployed at:", deployedContracts.strategy);
    console.log("   Gas used:", (await strategy.deploymentTransaction().wait()).gasUsed.toString());

    /**
     * Set up contract relationships
     */
    console.log("\n🔗 Setting up contract relationships...");
    
    // Set FUSD address in strategy
    const setFusdOptions = { gasLimit: 500000 };
    if (config.gasPrice !== "auto") {
      setFusdOptions.gasPrice = config.gasPrice;
    }
    const setFusdTx = await strategy.setFUSDAddress(deployedContracts.fusd, setFusdOptions);
    await setFusdTx.wait();
    console.log("✅ FUSD address set in strategy");
    console.log("   Gas used:", setFusdTx.gasUsed.toString());

    // Add strategy as minter and burner for FUSD
    const addMinterTx = await fusd.addMinter(deployedContracts.strategy, setFusdOptions);
    await addMinterTx.wait();
    console.log("✅ Strategy added as FUSD minter");
    console.log("   Gas used:", addMinterTx.gasUsed.toString());

    const addBurnerTx = await fusd.addBurner(deployedContracts.strategy, setFusdOptions);
    await addBurnerTx.wait();
    console.log("✅ Strategy added as FUSD burner");
    console.log("   Gas used:", addBurnerTx.gasUsed.toString());

    /**
     * Fund strategy with native token for rewards
     */
    console.log(`\n💎 Funding strategy with ${config.nativeToken} for rewards...`);
    const fundAmount = ethers.utils.parseEther("5"); // 5 native tokens for rebalancing rewards
    const fundOptions = {
      to: deployedContracts.strategy,
      value: fundAmount,
      gasLimit: 500000
    };
    if (config.gasPrice !== "auto") {
      fundOptions.gasPrice = config.gasPrice;
    }
    const fundTx = await deployer.sendTransaction(fundOptions);
    await fundTx.wait();
    console.log(`✅ Strategy funded with ${ethers.utils.formatEther(fundAmount)} ${config.nativeToken}`);
    console.log("   Gas used:", fundTx.gasUsed.toString());

    /**
     * Verify deployment
     */
    console.log("\n🔍 Verifying deployment...");
    
    // Check FUSD configuration
    const fusdName = await fusd.name();
    const fusdSymbol = await fusd.symbol();
    console.log("✅ FUSD:", fusdName, "(", fusdSymbol, ")");

    // Check strategy configuration
    const feeRecipient = await strategy.feeRecipient();
    const managementFee = await strategy.managementFeeBps();
    const fusdAddress = await strategy.FUSD();
    console.log("✅ Strategy fee recipient:", feeRecipient);
    console.log("✅ Strategy management fee:", managementFee.toString(), "bps (", Number(managementFee) / 100, "%)");
    console.log("✅ Strategy FUSD address:", fusdAddress);

    // Check FUSD permissions
    const isMinter = await fusd.minters(deployedContracts.strategy);
    const isBurner = await fusd.burners(deployedContracts.strategy);
    console.log("✅ Strategy is FUSD minter:", isMinter);
    console.log("✅ Strategy is FUSD burner:", isBurner);

    // Check strategy balance
    const strategyBalance = await deployer.provider.getBalance(deployedContracts.strategy);
    console.log(`✅ Strategy ${config.nativeToken} balance:`, ethers.utils.formatEther(strategyBalance), config.nativeToken);

    /**
     * Deployment summary
     */
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(60));
    console.log("Network:", chainConfig.name, "(Chain ID:", network.chainId, ")");
    console.log("Deployer:", deployer.address);
    console.log("Timestamp:", new Date().toISOString());
    console.log("\nDeployed Contracts:");
    console.log("  ForceStablecoin (FUSD):", deployedContracts.fusd);
    console.log("  AvalancheLSTStrategy:", deployedContracts.strategy);
    console.log("\nConfiguration:");
    console.log("  Fee Recipient:", config.feeRecipient);
    console.log("  Management Fee:", config.managementFeeBps, "bps (", config.managementFeeBps / 100, "%)");
    console.log(`  Strategy Funded: ${ethers.utils.formatEther(fundAmount)} ${config.nativeToken}`);

    /**
     * Save deployment data
     */
    const deploymentData = {
      network: {
        name: chainConfig.name,
        chainId: network.chainId,
        nativeToken: config.nativeToken
      },
      timestamp: Date.now(),
      deployer: deployer.address,
      config: {
        feeRecipient: config.feeRecipient,
        managementFeeBps: config.managementFeeBps,
        strategyFunded: ethers.utils.formatEther(fundAmount),
        nativeToken: config.nativeToken
      },
      contracts: deployedContracts,
      deploymentLog: deploymentLog
    };

    // Save to network-specific file
    const filename = `deployments-${chainConfig.name.toLowerCase()}-${network.chainId}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentData, null, 2));
    console.log("\n📄 Deployment data saved to:", filename);

    // Also save to general deployments file
    fs.writeFileSync('deployments.json', JSON.stringify(deploymentData, null, 2));
    console.log("📄 Deployment data also saved to: deployments.json");

    console.log("\n🚀 Ready for testing!");
    console.log("Next steps:");
    console.log(`  1. Test ${config.nativeToken} deposits: strategy.depositAVAX({ value: ethers.utils.parseEther('1') })`);
    console.log("  2. Test sAVAX deposits: strategy.depositSAvax(amount, usdValue)");
    console.log("  3. Check strategy metrics: strategy.getStrategyMetrics()");
    console.log("  4. Monitor rebalancing: strategy.checkRebalanceStatus()");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
