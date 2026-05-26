const NetworkConfig = require("./config");

async function main() {
  const networkConfig = new NetworkConfig();
  
  console.log("🔧 Force Finance Network Configuration");
  console.log("=".repeat(60));
  
  // Show current configuration
  networkConfig.printConfig();
  
  console.log("\n📋 Environment Variables:");
  console.log("   Set these in your .env file to override defaults:");
  console.log("   AVALANCHE_CHAIN_ID=43114");
  console.log("   HARDHAT_CHAIN_ID=31337");
  console.log("   FUJI_CHAIN_ID=43113");
  console.log("   ETHEREUM_CHAIN_ID=1");
  console.log("   GOERLI_CHAIN_ID=5");
  console.log("   SEPOLIA_CHAIN_ID=11155111");
  
  console.log("\n🌐 RPC URLs:");
  console.log("   AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc");
  console.log("   FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc");
  console.log("   ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key");
  console.log("   GOERLI_RPC_URL=https://eth-goerli.alchemyapi.io/v2/your-api-key");
  console.log("   SEPOLIA_RPC_URL=https://eth-sepolia.alchemyapi.io/v2/your-api-key");
  
  console.log("\n🔑 Authentication:");
  console.log("   PRIVATE_KEY=your-private-key-here");
  
  console.log("\n💡 Usage Examples:");
  console.log("   # Deploy to Avalanche mainnet");
  console.log("   npx hardhat run scripts/deploy-avalanche-mvp.js --network avalanche");
  console.log("");
  console.log("   # Deploy to Fuji testnet");
  console.log("   npx hardhat run scripts/deploy-avalanche-mvp.js --network fuji");
  console.log("");
  console.log("   # Deploy to local hardhat network");
  console.log("   npx hardhat run scripts/deploy-test.js --network hardhat");
  console.log("");
  console.log("   # Deploy to localhost");
  console.log("   npx hardhat run scripts/deploy-test.js --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
