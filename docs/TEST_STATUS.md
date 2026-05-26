> [Force Finance](../README.md) · `docs/TEST_STATUS.md`

# Test Status Report

**Last Updated:** May 26, 2026

## Test Suite Overview

### Unit Tests
- **Location:** `test/unit/`
- **Status:** Mostly passing (some oracle-related tests need fixes)
- **Run:** `npx hardhat test test/unit/**/*.test.js`

### Integration Tests
- **Location:** `test/integration/`
- **Status:** Passing
- **Run:** `npm run test:integration`

### Fork Tests
- **Location:** `test/fork/`
- **Status:** Some tests skipped (require real contracts)
- **Run:** `npm run test:fork`

### E2E Tests
- **Location:** `scripts/e2e-test.js`
- **Status:** Passing
- **Run:** `npm run test:e2e`

## Recent Fixes

### PositionManager Removal
- Fixed `DeltaNeutralRebalancer.test.js` to use `gmxFuturesManager` instead of `positionManager`
- All related tests now passing

## Test Coverage

### Core Contracts
- AvalancheLSTStrategy - Basic functionality
- GMXFuturesManager - Position management
- RebalancingEngine - Rebalancing logic
- EmergencyControls - Emergency functions
- DeltaNeutralRebalancer - Advanced rebalancing
- ForceStablecoin (FUSD) - Token operations

### Features Tested
- Contract deployment
- Token configuration
- User deposits (AVAX)
- FUSD minting logic
- Yield tracking
- Rebalancing system
- GMX integration
- Emergency controls
- Withdrawals

## Known Issues

### Oracle Tests
- Some oracle tests fail due to missing real contract addresses on local network
- These tests pass on fork network with real Avalanche contracts

### Chai Syntax
- Some tests use deprecated Chai syntax (`revertedWith` instead of `rejectedWith`)
- These are non-critical and don't affect functionality

## E2E Test Results

The comprehensive E2E test script (`scripts/e2e-test.js`) successfully tests:

1. Contract deployment (all contracts)
2. Token configuration (FUSD, sAVAX, WAVAX)
3. Deposits (AVAX wrapping)
4. FUSD minting logic
5. Yield tracking system
6. Rebalancing system
7. GMX futures integration
8. Emergency controls
9. Withdrawal logic

**All E2E tests pass successfully!**

## Running Tests

See [TESTING.md](TESTING.md) for setup, structure, and the no-mocks policy.

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run fork tests (requires Avalanche RPC)
npm run test:fork

# Run E2E test suite
npm run test:e2e
```

## Next Steps

1. Fix remaining oracle test failures (non-critical)
2. Update deprecated Chai syntax
3. Add more comprehensive fork tests with real contracts
4. Add gas optimization tests
5. Add stress tests for rebalancing system
