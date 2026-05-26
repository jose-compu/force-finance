# Development Setup Guide

## Quick Start

1. **Install all dependencies:**
   ```bash
   npm run setup
   ```

2. **Start the full development environment:**
   ```bash
   npm run dev
   ```
   This will:
   - Start Hardhat local network
   - Deploy all contracts
   - Start the React frontend

## Manual Setup

### Terminal 1: Start Hardhat Network
```bash
npm run node
```

### Terminal 2: Deploy Contracts
```bash
npm run deploy-local
```

### Terminal 3: Start Frontend
```bash
npm run frontend
```

## Access Points

- **Frontend**: http://localhost:3000
- **Hardhat Network**: http://127.0.0.1:8545
- **Chain ID**: 31337

## Test Accounts

The Hardhat network provides 20 test accounts with 10,000 ETH each:
- Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (deployer)
- Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (test user 1)
- Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (test user 2)

## Contract Addresses

After deployment, contract addresses are saved to (both gitignored):

- `deployments-local.json` (backend reference)
- `frontend/src/deployments.json` (frontend use)

Fresh clones ship with `frontend/src/deployments.example.json`. Run `npm run create-placeholder` or `npm run deploy-local` before using the UI.

## Security Features Implemented

- **Reentrancy Protection**: All external functions use `nonReentrant`
- **Access Control**: Owner-only functions with proper validation
- **Input Validation**: All parameters validated before use
- **Overflow Protection**: Using Solidity 0.8+ built-in checks
- **Emergency Pause**: Owner can pause critical functions
- **Rate Limiting**: Cooldown periods for sensitive operations
- **Oracle Security**: Price validation and bounds checking

## Testing

Run contract tests:
```bash
npm test
```

Run frontend tests:
```bash
cd frontend && npm test
```
