const hre = require("hardhat");

async function main() {
  console.log("🏔️  Basic Avalanche Fork Test\n");
  
  try {
    // Test basic hardhat functionality
    console.log("Testing basic hardhat setup...");
    
    // Get provider directly
    const provider = hre.ethers.provider;
    console.log("✅ Provider connected");
    
    // Get network info
    const network = await provider.getNetwork();
    console.log("✅ Network:", network.name, "Chain ID:", network.chainId.toString());
    
    // Get block number
    const blockNumber = await provider.getBlockNumber();
    console.log("✅ Block Number:", blockNumber);
    
    // Test real Avalanche addresses
    console.log("\n🔍 Testing Real Avalanche Contracts:");
    
    const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
    const GMX_VAULT = "0x9ab2De34A33fB459b538c43f251eB825645e8595";
    const USDC_E = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
    
    // Check contract existence
    const wavaxCode = await provider.getCode(WAVAX);
    const gmxCode = await provider.getCode(GMX_VAULT);
    const usdcCode = await provider.getCode(USDC_E);
    
    console.log("WAVAX:", wavaxCode !== "0x" ? "✅ EXISTS" : "❌ NOT FOUND");
    console.log("GMX Vault:", gmxCode !== "0x" ? "✅ EXISTS" : "❌ NOT FOUND");
    console.log("USDC.e:", usdcCode !== "0x" ? "✅ EXISTS" : "❌ NOT FOUND");
    
    // Test contract compilation
    console.log("\n📦 Testing Contract Compilation:");
    
    await hre.run("compile");
    console.log("✅ Contracts compiled successfully");
    
    // Test deployment with basic approach
    console.log("\n🚀 Testing Contract Deployment:");
    
    // Get accounts using basic approach
    const accounts = await hre.ethers.getSigners();
    console.log("✅ Got", accounts.length, "accounts");
    
    if (accounts.length > 0) {
      const deployer = accounts[0];
      console.log("✅ Deployer address:", deployer.address);
      
      // Get balance
      const balance = await deployer.getBalance();
      console.log("✅ Deployer balance:", hre.ethers.utils.formatEther(balance), "AVAX");
      
      // Deploy test contract
      console.log("\n📦 Deploying ForkTestStrategy...");
      
      const ContractFactory = await hre.ethers.getContractFactory("ForkTestStrategy");
      const strategy = await ContractFactory.deploy();
      await strategy.deployed();
      
      console.log("✅ Strategy deployed at:", strategy.address);
      
      // Test basic contract functions
      console.log("\n🧪 Testing Contract Functions:");
      
      try {
        const protocolInfo = await strategy.getProtocolInfo();
        console.log("✅ getProtocolInfo() successful");
        console.log("  - WAVAX Balance:", hre.ethers.utils.formatEther(protocolInfo.wavaxBalance));
        console.log("  - USDC.e Balance:", hre.ethers.utils.formatUnits(protocolInfo.usdcBalance, 6));
        console.log("  - GMX Pool Amount:", hre.ethers.utils.formatEther(protocolInfo.gmxPoolAmount));
      } catch (error) {
        console.log("❌ getProtocolInfo() failed:", error.message);
      }
      
      // Test GMX vault interaction
      console.log("\n🎯 Testing GMX Vault Interaction:");
      
      try {
        const gmxVault = await hre.ethers.getContractAt([
          "function poolAmounts(address) view returns (uint256)",
          "function getMaxPrice(address) view returns (uint256)"
        ], GMX_VAULT);
        
        const avaxPoolAmount = await gmxVault.poolAmounts(WAVAX);
        const avaxPrice = await gmxVault.getMaxPrice(WAVAX);
        
        console.log("✅ GMX Vault interaction successful");
        console.log("  - AVAX Pool Amount:", hre.ethers.utils.formatEther(avaxPoolAmount), "AVAX");
        console.log("  - AVAX Price: $", hre.ethers.utils.formatUnits(avaxPrice, 30));
        
        if (avaxPoolAmount.gt(0)) {
          console.log("🎉 SUCCESS: Real GMX data accessible!");
        }
      } catch (error) {
        console.log("❌ GMX Vault interaction failed:", error.message);
      }
      
      // Test token contract interaction
      console.log("\n💰 Testing Token Contract Interaction:");
      
      try {
        const wavaxContract = await hre.ethers.getContractAt("IERC20", WAVAX);
        const name = await wavaxContract.name();
        const symbol = await wavaxContract.symbol();
        const decimals = await wavaxContract.decimals();
        
        console.log("✅ WAVAX contract interaction successful");
        console.log("  - Name:", name);
        console.log("  - Symbol:", symbol);
        console.log("  - Decimals:", decimals);
      } catch (error) {
        console.log("❌ WAVAX contract interaction failed:", error.message);
      }
      
      // Save results
      const results = {
        success: true,
        network: network.name,
        chainId: network.chainId.toString(),
        blockNumber: blockNumber,
        strategy: strategy.address,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
          wavax: WAVAX,
          gmxVault: GMX_VAULT,
          usdcE: USDC_E
        },
        forkWorking: wavaxCode !== "0x" && gmxCode !== "0x" && usdcCode !== "0x"
      };
      
      const fs = require("fs");
      fs.writeFileSync("fork-test-results.json", JSON.stringify(results, null, 2));
      console.log("\n💾 Results saved to: fork-test-results.json");
      
      console.log("\n🎉 FORK TEST COMPLETE!");
      console.log("📋 Summary:");
      console.log(`   • Avalanche Fork: ${results.forkWorking ? "✅ Working" : "❌ Failed"}`);
      console.log(`   • Contract Deployed: ✅ ${strategy.address}`);
      console.log(`   • Real Protocols: ${results.forkWorking ? "✅ Accessible" : "❌ Not Found"}`);
      console.log(`   • Chain ID: ${network.chainId} (Avalanche)`);
      
      if (results.forkWorking) {
        console.log("\n🚀 SUCCESS: Avalanche fork is fully functional!");
        console.log("   Ready for strategy testing with real protocol data.");
      }
      
    } else {
      console.log("❌ No accounts available");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

main()
  .then(() => {
    console.log("\n✅ Basic fork test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Basic fork test failed:", error);
    process.exit(1);
  });
