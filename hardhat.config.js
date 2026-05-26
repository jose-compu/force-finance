require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

// Chain ID configuration with environment variable support
const CHAIN_IDS = {
  AVALANCHE: parseInt(process.env.AVALANCHE_CHAIN_ID) || 43114,
  HARDHAT: parseInt(process.env.HARDHAT_CHAIN_ID) || 31337,
  LOCALHOST: parseInt(process.env.LOCALHOST_CHAIN_ID) || 31337,
  // Add more chains as needed
  FUJI: parseInt(process.env.FUJI_CHAIN_ID) || 43113,
  ETHEREUM: parseInt(process.env.ETHEREUM_CHAIN_ID) || 1,
  GOERLI: parseInt(process.env.GOERLI_CHAIN_ID) || 5,
  SEPOLIA: parseInt(process.env.SEPOLIA_CHAIN_ID) || 11155111,
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      metadata: {
        bytecodeHash: "none",
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.AVALANCHE_RPC_URL || (process.env.INFURA_API_KEY ? `https://avalanche-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}` : "https://api.avax.network/ext/bc/C/rpc"),
        blockNumber: 38000000, // Recent Avalanche block (Dec 2024)
        enabled: process.env.FORK_AVALANCHE === "true",
      },
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000", // 10,000 AVAX equivalent
        mnemonic: "test test test test test test test test test test test junk",
      },
      chainId: CHAIN_IDS.HARDHAT,
      gas: "auto",
      gasPrice: "auto",
      allowUnlimitedContractSize: true,
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      chainId: CHAIN_IDS.AVALANCHE,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66)
        ? [process.env.PRIVATE_KEY]
        : [],
    },
    fuji: {
      url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: CHAIN_IDS.FUJI,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66)
        ? [process.env.PRIVATE_KEY]
        : [],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: CHAIN_IDS.LOCALHOST,
    },
    // Add more networks as needed
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/your-api-key",
      chainId: CHAIN_IDS.ETHEREUM,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66)
        ? [process.env.PRIVATE_KEY]
        : [],
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || "https://eth-goerli.alchemyapi.io/v2/your-api-key",
      chainId: CHAIN_IDS.GOERLI,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66)
        ? [process.env.PRIVATE_KEY]
        : [],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.alchemyapi.io/v2/your-api-key",
      chainId: CHAIN_IDS.SEPOLIA,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66)
        ? [process.env.PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 60000,
    retries: 0,
  },
};

// Export chain IDs for use in scripts
module.exports.CHAIN_IDS = CHAIN_IDS;

