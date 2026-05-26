> [Force Finance](../README.md) · `docs/UI_IMPROVEMENTS.md`

# UI Consistency Improvements

## Summary

Improved web UI consistency and set up local testnet deployment for development.

## Changes Made

### 1. Shared UI Components

**Created `MetricCard.js`**:
- Consistent metric card component used across all pages
- Supports loading states, trends, icons, and hover effects
- Cyberpunk theme styling

**Created `Button.js`**:
- Consistent button component with variants (primary, secondary, danger, success)
- Loading states and disabled states
- Size options (sm, md, lg)

### 2. Updated Components

**Dashboard.js**:
- Now uses shared `MetricCard` component
- Consistent styling with other components
- Improved loading states

**ContractContext.js**:
- Updated to read from `deployments.json` (local or Avalanche)
- Supports both local testnet and mainnet deployments
- Better error handling and logging

### 3. Local Testnet Deployment

**Created `deploy-local.js`**:
- Deploys all Avalanche LST Strategy contracts to localhost
- Includes MockSAVAX, MockWAVAX, MockUSDC for testing
- Automatically configures all contract relationships
- Saves deployment addresses to `deployments-local.json` and `frontend/src/deployments.json`

**Created `start-local-testnet.sh`**:
- One-command script to start Hardhat node, deploy contracts, and start frontend
- Handles all setup automatically

**Updated `package.json`**:
- Added `start:local` script for easy local testnet startup

## Usage

### Start Local Testnet

```bash
# Option 1: Use the script
npm run start:local

# Option 2: Manual steps
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npm run deploy-local

# Terminal 3: Start frontend
npm run frontend
```

### Connect to Local Testnet

1. Start Hardhat node: `npx hardhat node`
2. Deploy contracts: `npm run deploy-local`
3. Start frontend: `cd frontend && npm start`
4. In MetaMask:
 - Add network: http://127.0.0.1:8545
 - Chain ID: 31337 (Hardhat default)
 - Import one of the test accounts from Hardhat output

## Contract Addresses

After deployment, addresses are saved to:
- `deployments-local.json` (root)
- `frontend/src/deployments.json` (frontend)

The frontend automatically reads from `deployments.json` and connects to the correct contracts.

## UI Consistency

All components now use:
- Consistent color scheme (cyberpunk theme)
- Shared MetricCard component
- Shared Button component
- Consistent spacing and borders
- Loading states
- Error handling

## Next Steps

1. Update remaining components (Vault, Yield, Rebalancer) to use shared components
2. Add more comprehensive error messages
3. Add transaction status notifications
4. Improve mobile responsiveness
