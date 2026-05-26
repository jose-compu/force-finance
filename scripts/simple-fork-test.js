const hre = require("hardhat");

async function main() {
  console.log("🏔️  Simple Avalanche Fork Test\n");
  
  // Get basic network info without using problematic APIs
  console.log("Testing Avalanche fork connection...");
  
  // Get accounts
  const accounts = await hre.ethers.getSigners();
  const deployer = accounts[0];
  console.log("Deployer Address:", deployer.address);
  
  // Get balance using the older ethers API
  const balance = await deployer.getBalance();
  console.log("Deployer Balance:", hre.ethers.utils.formatEther(balance), "AVAX");
  
  // Test real Avalanche contract addresses
  console.log("\n🔍 Testing Real Avalanche Protocol Access:");
  
  const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
  const GMX_VAULT = "0x9ab2De34A33fB459b538c43f251eB825645e8595";
  const USDC_E = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
  
  // Check if contracts exist
  const wavaxCode = await hre.ethers.provider.getCode(WAVAX);
  const gmxCode = await hre.ethers.provider.getCode(GMX_VAULT);
  const usdcCode = await hre.ethers.provider.getCode(USDC_E);
  
  console.log("WAVAX Contract:", WAVAX, wavaxCode !== "0x" ? "✅ EXISTS" : "❌ NOT FOUND");
  console.log("GMX Vault:", GMX_VAULT, gmxCode !== "0x" ? "✅ EXISTS" : "❌ NOT FOUND");
  console.log("USDC.e Contract:", USDC_E, usdcCode !== "0x" ? "✅ EXISTS" : "❌ NOT FOUND");
  
  // Deploy our test contract
  console.log("\n📦 Deploying Test Contract...");
  
  const ContractFactory = await hre.ethers.getContractFactory("ForkTestStrategy");
  const strategy = await ContractFactory.deploy();
  await strategy.deployed();
  
  console.log("✅ ForkTestStrategy deployed at:", strategy.address);
  
  // Test contract functionality
  console.log("\n🧪 Testing Contract Functions...");
  
  try {
    const protocolInfo = await strategy.getProtocolInfo();
    console.log("Contract WAVAX Balance:", hre.ethers.utils.formatEther(protocolInfo.wavaxBalance), "WAVAX");
    console.log("Contract USDC.e Balance:", hre.ethers.utils.formatUnits(protocolInfo.usdcBalance, 6), "USDC.e");
    console.log("GMX AVAX Pool Amount:", hre.ethers.utils.formatEther(protocolInfo.gmxPoolAmount), "AVAX");
    
    if (protocolInfo.gmxPoolAmount.gt(0)) {
      console.log("✅ Successfully reading real GMX vault data on fork!");
    }
  } catch (error) {
    console.log("❌ Error testing contract:", error.message);
  }
  
  // Test token contract interaction
  console.log("\n💰 Testing Token Contract Interactions...");
  
  try {
    const wavaxContract = await hre.ethers.getContractAt("IERC20", WAVAX);
    const name = await wavaxContract.name();
    const symbol = await wavaxContract.symbol();
    const decimals = await wavaxContract.decimals();
    console.log(`✅ WAVAX: ${name} (${symbol}) - ${decimals} decimals`);
  } catch (error) {
    console.log("❌ WAVAX interaction failed:", error.message);
  }
  
  try {
    const usdcContract = await hre.ethers.getContractAt("IERC20", USDC_E);
    const name = await usdcContract.name();
    const symbol = await usdcContract.symbol();
    const decimals = await usdcContract.decimals();
    console.log(`✅ USDC.e: ${name} (${symbol}) - ${decimals} decimals`);
  } catch (error) {
    console.log("❌ USDC.e interaction failed:", error.message);
  }
  
  // Test GMX Vault directly
  console.log("\n🎯 Testing GMX Vault Direct Access...");
  
  try {
    const gmxVault = await hre.ethers.getContractAt([
      "function poolAmounts(address) view returns (uint256)",
      "function getMaxPrice(address) view returns (uint256)"
    ], GMX_VAULT);
    
    const avaxPoolAmount = await gmxVault.poolAmounts(WAVAX);
    const avaxPrice = await gmxVault.getMaxPrice(WAVAX);
    
    console.log(`✅ GMX Vault: ${hre.ethers.utils.formatEther(avaxPoolAmount)} AVAX in pool`);
    console.log(`✅ GMX Vault: $${hre.ethers.utils.formatUnits(avaxPrice, 30)} AVAX price`);
    
    if (avaxPoolAmount.gt(0)) {
      console.log("🎉 SUCCESS: Real GMX vault data accessible on fork!");
    }
  } catch (error) {
    console.log("❌ GMX Vault direct interaction failed:", error.message);
  }
  
  // Save deployment info
  const deploymentInfo = {
    network: "avalanche-fork",
    strategy: strategy.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    forkWorking: wavaxCode !== "0x" && gmxCode !== "0x" && usdcCode !== "0x",
    contracts: {
      wavax: WAVAX,
      gmxVault: GMX_VAULT,
      usdcE: USDC_E
    }
  };
  
  const fs = require("fs");
  fs.writeFileSync("fork-test-results.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Results saved to: fork-test-results.json");
  
  console.log("\n🎉 Fork Test Complete!");
  console.log("📋 Summary:");
  console.log(`   • Avalanche Fork: ${deploymentInfo.forkWorking ? "✅ Working" : "❌ Failed"}`);
  console.log(`   • Contract Deployed: ✅ ${strategy.address}`);
  console.log(`   • Real Protocols Accessible: ${deploymentInfo.forkWorking ? "✅ Yes" : "❌ No"}`);
  
  if (deploymentInfo.forkWorking) {
    console.log("\n🚀 SUCCESS: Avalanche fork is working with real protocol data!");
    console.log("   You can now test your strategy with actual GMX, BENQI, and token contracts.");
  }
  
  return strategy.address;
}

main()
  .then((address) => {
    console.log(`\n✅ Success! Strategy deployed at: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fork test failed:", error);
    process.exit(1);
  });
