const { CHAIN_IDS } = require("../hardhat.config");

/**
 * Network configuration utility
 * Provides flexible chain ID and network-specific settings
 */
class NetworkConfig {
  constructor() {
    this.chainIds = CHAIN_IDS;
  }

  /**
   * Get chain ID for a specific network
   * @param {string} networkName - Network name (e.g., 'avalanche', 'hardhat', 'fuji')
   * @returns {number} Chain ID
   */
  getChainId(networkName) {
    const networkMap = {
      'avalanche': this.chainIds.AVALANCHE,
      'hardhat': this.chainIds.HARDHAT,
      'localhost': this.chainIds.LOCALHOST,
      'fuji': this.chainIds.FUJI,
      'ethereum': this.chainIds.ETHEREUM,
      'goerli': this.chainIds.GOERLI,
      'sepolia': this.chainIds.SEPOLIA,
    };
    
    return networkMap[networkName.toLowerCase()] || this.chainIds.HARDHAT;
  }

  /**
   * Get network-specific configuration
   * @param {number} chainId - Chain ID
   * @returns {object} Network configuration
   */
  getNetworkConfig(chainId) {
    const configs = {
      [this.chainIds.AVALANCHE]: {
        name: 'Avalanche',
        nativeToken: 'AVAX',
        gasPrice: '25', // gwei
        blockTime: 2, // seconds
        explorer: 'https://snowtrace.io',
        rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
      },
      [this.chainIds.FUJI]: {
        name: 'Avalanche Fuji Testnet',
        nativeToken: 'AVAX',
        gasPrice: '25', // gwei
        blockTime: 2, // seconds
        explorer: 'https://testnet.snowtrace.io',
        rpcUrl: process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
      },
      [this.chainIds.HARDHAT]: {
        name: 'Hardhat Network',
        nativeToken: 'ETH',
        gasPrice: 'auto',
        blockTime: 1, // seconds
        explorer: null,
        rpcUrl: 'http://127.0.0.1:8545',
      },
      [this.chainIds.LOCALHOST]: {
        name: 'Localhost',
        nativeToken: 'ETH',
        gasPrice: 'auto',
        blockTime: 1, // seconds
        explorer: null,
        rpcUrl: 'http://127.0.0.1:8545',
      },
      [this.chainIds.ETHEREUM]: {
        name: 'Ethereum Mainnet',
        nativeToken: 'ETH',
        gasPrice: 'auto',
        blockTime: 12, // seconds
        explorer: 'https://etherscan.io',
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/your-api-key',
      },
      [this.chainIds.GOERLI]: {
        name: 'Goerli Testnet',
        nativeToken: 'ETH',
        gasPrice: 'auto',
        blockTime: 12, // seconds
        explorer: 'https://goerli.etherscan.io',
        rpcUrl: process.env.GOERLI_RPC_URL || 'https://eth-goerli.alchemyapi.io/v2/your-api-key',
      },
      [this.chainIds.SEPOLIA]: {
        name: 'Sepolia Testnet',
        nativeToken: 'ETH',
        gasPrice: 'auto',
        blockTime: 12, // seconds
        explorer: 'https://sepolia.etherscan.io',
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.alchemyapi.io/v2/your-api-key',
      },
    };

    return configs[chainId] || configs[this.chainIds.HARDHAT];
  }

  /**
   * Get deployment configuration for a specific chain
   * @param {number} chainId - Chain ID
   * @returns {object} Deployment configuration
   */
  getDeploymentConfig(chainId) {
    const networkConfig = this.getNetworkConfig(chainId);
    
    return {
      gasLimit: 8000000,
      gasPrice: networkConfig.gasPrice === 'auto' ? 'auto' : 
                ethers.utils.parseUnits(networkConfig.gasPrice, 'gwei'),
      nativeToken: networkConfig.nativeToken,
      blockTime: networkConfig.blockTime,
      explorer: networkConfig.explorer,
    };
  }

  /**
   * Validate chain ID
   * @param {number} chainId - Chain ID to validate
   * @returns {boolean} True if valid
   */
  isValidChainId(chainId) {
    return Object.values(this.chainIds).includes(chainId);
  }

  /**
   * Get all supported chain IDs
   * @returns {object} Object with network names as keys and chain IDs as values
   */
  getAllChainIds() {
    return {
      avalanche: this.chainIds.AVALANCHE,
      fuji: this.chainIds.FUJI,
      hardhat: this.chainIds.HARDHAT,
      localhost: this.chainIds.LOCALHOST,
      ethereum: this.chainIds.ETHEREUM,
      goerli: this.chainIds.GOERLI,
      sepolia: this.chainIds.SEPOLIA,
    };
  }

  /**
   * Print current configuration
   */
  printConfig() {
    console.log('🔧 Network Configuration:');
    console.log('='.repeat(50));
    
    Object.entries(this.getAllChainIds()).forEach(([network, chainId]) => {
      const config = this.getNetworkConfig(chainId);
      console.log(`${network.padEnd(12)} | Chain ID: ${chainId.toString().padStart(6)} | ${config.name}`);
    });
    
    console.log('='.repeat(50));
    console.log('💡 Set environment variables to override defaults:');
    console.log('   AVALANCHE_CHAIN_ID, HARDHAT_CHAIN_ID, FUJI_CHAIN_ID, etc.');
  }
}

module.exports = NetworkConfig;
