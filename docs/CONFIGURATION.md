> [Force Finance](../README.md) · `docs/CONFIGURATION.md`

# Force Finance Configuration Guide

## Flexible Chain ID Configuration

The Force Finance project now supports flexible chain ID configuration through environment variables. This allows you to easily deploy to different networks and customize chain IDs as needed.

## Environment Variables

### Chain IDs
Set these environment variables to override default chain IDs:

```bash
# Avalanche Networks
AVALANCHE_CHAIN_ID=43114 # Avalanche Mainnet (default)
FUJI_CHAIN_ID=43113 # Avalanche Fuji Testnet (default)

# Ethereum Networks 
ETHEREUM_CHAIN_ID=1 # Ethereum Mainnet (default)
GOERLI_CHAIN_ID=5 # Goerli Testnet (default)
SEPOLIA_CHAIN_ID=11155111 # Sepolia Testnet (default)

# Local Networks
HARDHAT_CHAIN_ID=31337 # Hardhat Network (default)
LOCALHOST_CHAIN_ID=31337 # Localhost Network (default)
```

### RPC URLs
Configure RPC endpoints for different networks:

```bash
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
GOERLI_RPC_URL=https://eth-goerli.alchemyapi.io/v2/your-api-key
SEPOLIA_RPC_URL=https://eth-sepolia.alchemyapi.io/v2/your-api-key
```

### Authentication
```bash
PRIVATE_KEY=your-private-key-here
```

## Usage Examples

### View Current Configuration
```bash
npx hardhat run scripts/show-config.js
```

### Deploy to Different Networks

**Avalanche Mainnet:**
```bash
npx hardhat run scripts/deploy-avalanche-mvp.js --network avalanche
```

**Avalanche Fuji Testnet:**
```bash
npx hardhat run scripts/deploy-avalanche-mvp.js --network fuji
```

**Local Hardhat Network:**
```bash
npx hardhat run scripts/deploy-test.js --network hardhat
```

**Localhost:**
```bash
npx hardhat run scripts/deploy-test.js --network localhost
```

## Configuration Utility

The project includes a `NetworkConfig` utility class that provides:

- **Flexible chain ID management** - Get chain IDs by network name
- **Network-specific settings** - Gas prices, block times, native tokens
- **Deployment configuration** - Optimized settings for each network
- **Validation** - Ensure chain IDs are valid

### Using NetworkConfig in Scripts

```javascript
const NetworkConfig = require("./scripts/config");

const networkConfig = new NetworkConfig();

// Get chain ID for a network
const chainId = networkConfig.getChainId('avalanche');

// Get network configuration
const config = networkConfig.getNetworkConfig(chainId);

// Get deployment settings
const deployConfig = networkConfig.getDeploymentConfig(chainId);
```

## Default Chain IDs

| Network | Default Chain ID | Environment Variable |
|---------|------------------|---------------------|
| Avalanche Mainnet | 43114 | `AVALANCHE_CHAIN_ID` |
| Avalanche Fuji | 43113 | `FUJI_CHAIN_ID` |
| Ethereum Mainnet | 1 | `ETHEREUM_CHAIN_ID` |
| Goerli Testnet | 5 | `GOERLI_CHAIN_ID` |
| Sepolia Testnet | 11155111 | `SEPOLIA_CHAIN_ID` |
| Hardhat Network | 31337 | `HARDHAT_CHAIN_ID` |
| Localhost | 31337 | `LOCALHOST_CHAIN_ID` |

## Benefits

1. **Flexibility** - Easily switch between networks without code changes
2. **Environment-specific** - Different settings for development, staging, production
3. **Extensible** - Add new networks by updating the configuration
4. **Consistent** - All scripts use the same configuration system
5. **Maintainable** - Centralized configuration management

## Troubleshooting

### Chain ID Mismatch
If you encounter chain ID mismatch errors:

1. Check your environment variables are set correctly
2. Verify the network configuration in `hardhat.config.js`
3. Use `npx hardhat run scripts/show-config.js` to view current settings

### Network Not Found
If a network is not recognized:

1. Add the network to `hardhat.config.js`
2. Update the `NetworkConfig` class in `scripts/config.js`
3. Set the appropriate environment variables

### Gas Price Issues
If you encounter gas price problems:

1. Check the network-specific gas price settings
2. Verify RPC URL is accessible
3. Consider using 'auto' gas price for local networks
