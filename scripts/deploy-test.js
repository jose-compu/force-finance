const { ethers } = require("hardhat");
const NetworkConfig = require("./config");

async function main() {
  console.log("🧪 Testing deployment on local network...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get network info
  const network = await deployer.provider.getNetwork();
  const networkConfig = new NetworkConfig();
  const chainConfig = networkConfig.getNetworkConfig(network.chainId);
  
  console.log("Account balance:", ethers.utils.formatEther(await deployer.provider.getBalance(deployer.address)), chainConfig.nativeToken);
  console.log("Network:", chainConfig.name, "(Chain ID:", network.chainId, ")\n");

  try {
    // Deploy ForceStablecoin
    console.log("💰 Deploying ForceStablecoin...");
    const ForceStablecoin = await ethers.getContractFactory("ForceStablecoin");
    const fusd = await ForceStablecoin.deploy("Force USD", "FUSD");
    await fusd.deployed();
    console.log("✅ ForceStablecoin deployed at:", fusd.address);

    // Deploy AvalancheLSTStrategy
    console.log("\n🎯 Deploying AvalancheLSTStrategy...");
    const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
    const strategy = await AvalancheLSTStrategy.deploy(deployer.address, 200); // 2% fee
    await strategy.deployed();
    console.log("✅ AvalancheLSTStrategy deployed at:", strategy.address);

    // Set up relationships
    console.log("\n🔗 Setting up relationships...");
    
    await strategy.setFUSDAddress(fusd.address);
    console.log("✅ FUSD address set in strategy");

    await fusd.addMinter(strategy.address);
    console.log("✅ Strategy added as FUSD minter");

    await fusd.addBurner(strategy.address);
    console.log("✅ Strategy added as FUSD burner");

    // Fund strategy
    console.log(`\n💎 Funding strategy with ${chainConfig.nativeToken}...`);
    const fundAmount = ethers.utils.parseEther("5");
    await deployer.sendTransaction({
      to: strategy.address,
      value: fundAmount
    });
    console.log(`✅ Strategy funded with ${ethers.utils.formatEther(fundAmount)} ${chainConfig.nativeToken}`);

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    console.log("✅ FUSD name:", await fusd.name());
    console.log("✅ FUSD symbol:", await fusd.symbol());
    console.log("✅ Strategy fee recipient:", await strategy.feeRecipient());
    console.log("✅ Strategy management fee:", (await strategy.managementFeeBps()).toString(), "bps");
    console.log("✅ Strategy FUSD address:", await strategy.FUSD());
    console.log(`✅ Strategy balance: ${ethers.utils.formatEther(await ethers.provider.getBalance(strategy.address))} ${chainConfig.nativeToken}`);

    console.log("\n🎉 Test deployment successful!");
    console.log("Contracts ready for testing on local network.");

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
