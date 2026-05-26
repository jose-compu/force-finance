> [Force Finance](../README.md) · `docs/FINANCIAL_FAILURE_SCENARIOS.md`

# Financial Failure Scenarios & Failsafes

This document outlines the critical financial failure scenarios that could lead to protocol bankruptcy, along with the failsafes and tests implemented to protect against them.

## Overview

The Force Finance protocol implements comprehensive safeguards against various financial failure scenarios. All critical scenarios have been tested with both unit tests and end-to-end tests.

## Critical Failure Scenarios

### 1. Protocol Insolvency
**Risk**: FUSD supply exceeds total collateral value, making the protocol unable to honor all redemptions.

**Failsafes**:
- **150% Collateralization Ratio**: FUSD is minted at 150% collateralization, providing a 50% buffer
- **Insolvency Detection**: `_isProtocolInsolvent()` function checks if FUSD supply > collateral value (with 5% buffer)
- **Operation Blocking**: Deposits and withdrawals are blocked when protocol is insolvent
- **Health Monitoring**: `getProtocolHealth()` provides real-time solvency metrics

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 1
- E2E test: `scripts/e2e-failure-scenarios.js` - Scenario 1

### 2. Liquidation Risk
**Risk**: GMX short positions getting too close to liquidation price, risking total loss of collateral.

**Failsafes**:
- **Liquidation Buffer**: 5% buffer from liquidation price (configurable)
- **Automatic Detection**: `_isLiquidationRisk()` monitors position health
- **Liquidation Protection**: `_executeLiquidationProtection()` reduces position size when risk detected
- **Emergency Rebalancing**: Bypasses cooldowns when liquidation risk is high

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 2
- E2E test: `scripts/e2e-failure-scenarios.js` - Scenario 2

### 3. Oracle Manipulation & Price Feed Failures
**Risk**: Malicious actors manipulating price feeds or oracle failures causing incorrect rebalancing.

**Failsafes**:
- **Fallback Prices**: Default prices ($22) when oracle manager is not set
- **Multiple Oracle Support**: Architecture supports multiple oracle sources (BENQI, Trader Joe, GMX)
- **Oracle Deviation Detection**: `_checkOracleDeviation()` triggers rebalancing when oracles diverge
- **Graceful Degradation**: Protocol continues operating with fallback prices if oracle fails

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 3
- E2E test: `scripts/e2e-failure-scenarios.js` - Scenario 5

### 4. Extreme Volatility
**Risk**: Rapid price movements causing delta imbalance and potential losses.

**Failsafes**:
- **Rebalancing Thresholds**: 5% deviation triggers rebalancing, 10% triggers emergency
- **Soft Rebalancing**: 1.5% threshold with gas price checks
- **Emergency Rebalancing**: Bypasses cooldowns for extreme deviations
- **Gas Price Protection**: Skips non-emergency rebalancing when gas is too high

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 4
- E2E test: `scripts/e2e-failure-scenarios.js` - Scenario 4

### 5. sAVAX Depegging
**Risk**: sAVAX exchange rate dropping significantly, reducing collateral value.

**Failsafes**:
- **Yield Tracking**: Monitors sAVAX exchange rate changes
- **Negative Yield Handling**: Checkpoint gracefully handles negative yield (no distribution)
- **Exchange Rate Triggers**: 10 bps change triggers rebalancing
- **Health Monitoring**: Protocol health check includes current sAVAX price

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 5
- E2E test: `scripts/e2e-failure-scenarios.js` - Scenario 6

### 6. Mass Withdrawals (Bank Run)
**Risk**: Simultaneous large withdrawals depleting collateral reserves.

**Failsafes**:
- **Collateral Limits**: Withdrawals blocked when insufficient sAVAX in portfolio
- **User Position Tracking**: Each user's position tracked separately
- **Proportional Withdrawals**: Users can only withdraw their proportional share
- **Solvency Checks**: Protocol health monitored during withdrawals

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 6
- E2E test: `scripts/e2e-failure-scenarios.js` - Scenario 3

### 7. Gas Price Spikes
**Risk**: Rebalancing becoming too expensive to execute, leaving positions unbalanced.

**Failsafes**:
- **Gas Price Threshold**: `maxGasPrice` parameter (default 200 gwei)
- **Emergency Bypass**: Emergency rebalancing bypasses gas checks
- **Soft Rebalancing Skip**: Non-emergency rebalancing skipped when gas too high
- **Keeper Incentives**: Higher rewards for emergency actions

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 7

### 8. Yield Distribution Failures
**Risk**: Errors in yield calculation or distribution breaking the protocol.

**Failsafes**:
- **Zero Supply Handling**: Yield distribution gracefully handles zero FUSD supply
- **Compound-Style Distribution**: Industry-standard yield distribution mechanism
- **Error Isolation**: Yield errors don't break core protocol functions
- **Checkpoint Safety**: Negative yield handled without distribution

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 8

### 9. Emergency Mode Edge Cases
**Risk**: Emergency controls not functioning properly or being bypassed.

**Failsafes**:
- **Pausable Contract**: OpenZeppelin Pausable for emergency stops
- **Guardian System**: Multiple guardians can pause the system
- **Emergency Operators**: Dedicated operators for emergency actions
- **Cooldown Period**: 1-hour cooldown before emergency mode can be deactivated
- **Emergency Actions**: Deleverage, rebalancing, and withdrawal functions

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 9
- E2E test: `scripts/e2e-failure-scenarios.js` - Scenario 8

### 10. Reentrancy Attacks
**Risk**: Malicious contracts re-entering functions to drain funds.

**Failsafes**:
- **ReentrancyGuard**: OpenZeppelin ReentrancyGuard on all critical functions
- **Checks-Effects-Interactions**: State updates before external calls
- **SafeERC20**: SafeERC20 library for token transfers

**Tests**:
- Unit test: `test/unit/FinancialFailureScenarios.test.js` - Scenario 10
- E2E test: `scripts/e2e-failure-scenarios.js` - Scenario 7

## Enhanced Failsafes Added

### Insolvency Detection
```solidity
function _isProtocolInsolvent() internal view returns (bool)
```
- Checks if FUSD supply exceeds collateral value (with 5% buffer)
- Blocks deposits and withdrawals when insolvent
- Uses current oracle prices for accurate assessment

### Protocol Health Monitoring
```solidity
function getProtocolHealth() external view returns (
 uint256 totalFUSDSupply,
 uint256 totalCollateralValue,
 uint256 healthRatio,
 bool isSolvent
)
```
- Real-time solvency metrics
- Health ratio in basis points
- Public visibility for monitoring

### Solvency Checks
- All deposits check `_isProtocolInsolvent()` before execution
- All withdrawals check `_isProtocolInsolvent()` before execution
- Emergency mode can be triggered when insolvency detected

## Test Coverage

### Unit Tests
- **File**: `test/unit/FinancialFailureScenarios.test.js`
- **Coverage**: 10 critical scenarios, 20+ test cases
- **Status**: All tests passing

### E2E Tests
- **File**: `scripts/e2e-failure-scenarios.js`
- **Coverage**: 8 critical scenarios with full contract interactions
- **Status**: All tests passing

## Running Tests

### Unit Tests
```bash
npm test -- test/unit/FinancialFailureScenarios.test.js
```

### E2E Tests
```bash
npx hardhat run scripts/e2e-failure-scenarios.js --network hardhat
```

### Specific Scenario
```bash
npm test -- test/unit/FinancialFailureScenarios.test.js --grep "Scenario 1"
```

## Recommendations

1. **Oracle Integration**: Implement multi-oracle price aggregation for better price accuracy
2. **Liquidation Monitoring**: Add real-time liquidation distance monitoring from GMX
3. **Circuit Breakers**: Add automatic circuit breakers for extreme market conditions
4. **Insurance Fund**: Consider implementing an insurance fund for extreme scenarios
5. **Time-Weighted Prices**: Use TWAP (Time-Weighted Average Price) for better price stability

## Conclusion

The protocol now has comprehensive safeguards against all identified financial failure scenarios. All critical paths are tested and protected with multiple layers of failsafes. The enhanced insolvency detection and health monitoring provide real-time visibility into protocol health.
