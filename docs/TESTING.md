> [Force Finance](../README.md) · `docs/TESTING.md` · See also [Test Status](TEST_STATUS.md)

# Avalanche LST Strategy Testing

This directory contains comprehensive tests for the Avalanche LST + GMX strategy using **real mainnet contracts** with Hardhat forking.

## NO MOCKS POLICY

All tests interact with **actual Avalanche mainnet contracts**:
- Real GMX Vault, Router, Position Router
- Real BENQI sAVAX token contract 
- Real Trader Joe DEX contracts
- Real token contracts (WAVAX, WETH.e, WBTC.e, USDC.e)

## Setup

1. **Environment Configuration**
 ```bash
 cp .env.example .env
 # Edit .env with your Infura Project ID
 ```

2. **Install Dependencies**
 ```bash
 npm install
 ```

3. **Run Tests**
 ```bash
 # Run all tests
 ./test/run-tests.sh
 
 # Or run individual test suites
 npx hardhat test test/unit/AvalancheOracleManager.test.js
 npx hardhat test test/integration/RealContractIntegration.test.js
 ```

## Test Structure

### Unit Tests (`test/unit/`)
- **AvalancheOracleManager.test.js**: Price oracle aggregation with real DEX data
- **AvalancheLSTStrategyV2.test.js**: Core strategy contract with real protocol integration

### Integration Tests (`test/integration/`)
- **RealContractIntegration.test.js**: Direct interaction with live Avalanche contracts
- **StrategyGMXIntegration.test.js**: End-to-end strategy testing with real GMX

### Fixtures (`test/fixtures/`)
- **AvalancheAddresses.js**: Real mainnet contract addresses (verified)
- **TestHelpers.js**: Utilities for mainnet forking and whale impersonation

## Real Contract Addresses

All addresses are verified from official sources:

### GMX Protocol
- **Vault**: `0x9ab2De34A33fB459b538c43f251eB825645e8595`
- **Router**: `0x5F719c2F1095F7B9fc68a68e35B51194f4b6abe8`
- **Position Router**: `0xffF6D276Bc37c61A23f06410Dce4A400f66420f8`

### Tokens
- **WAVAX**: `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7`
- **WETH.e**: `0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB`
- **USDC.e**: `0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664`
- **sAVAX**: `0x2b2C81e08f1Af8835aB89C2ffC7e21d6dFfC7e2C`

## Testing Features

### Real Data Integration
- Live GMX pool liquidity
- Real token balances via whale impersonation
- Actual DEX prices from Trader Joe V2
- Real sAVAX exchange rates
- Current market conditions

### Position Testing
- GMX position creation with real parameters
- Leverage calculation based on actual pool utilization
- Real execution fees and slippage
- Actual liquidation thresholds

### Risk Management
- Emergency controls with live positions
- Real-time rebalancing triggers
- Actual yield claiming mechanics
- Live price deviation detection

## Gas Analysis

Tests include comprehensive gas usage analysis:
- Position creation costs
- Rebalancing efficiency
- Yield claiming optimization
- Emergency execution costs

## Test Scenarios

### Market Conditions
1. **Bull Market**: Strong upward price movement
2. **Bear Market**: Strong downward price movement 
3. **High Volatility**: Large price swings
4. **Stable Market**: Minimal price movement

### Protocol States
1. **High GMX Utilization**: Limited liquidity
2. **Low GMX Utilization**: Abundant liquidity
3. **Yield Accumulation**: sAVAX rewards available
4. **Emergency Situations**: Rapid deleveraging needed

## Troubleshooting

### Common Issues

1. **RPC Rate Limiting**
 ```
 Error: Too many requests
 ```
 Solution: Use your own Infura/Alchemy endpoint

2. **Insufficient Whale Balance**
 ```
 Error: Transfer amount exceeds balance
 ```
 Solution: Check whale addresses are current, try different whales

3. **GMX Pool Liquidity**
 ```
 Error: InsufficientLiquidity
 ```
 Solution: This is expected behavior - tests validate liquidity checks

### Performance Tips

- Use `--parallel` for faster test execution
- Set `REPORT_GAS=false` to skip gas reporting
- Use specific test files for faster iteration

## Continuous Integration

Tests are designed for CI/CD with:
- Deterministic mainnet forking
- Proper cleanup after each test
- Comprehensive error handling
- Detailed logging for debugging

## Security Notes

- Tests use mainnet forking - no real funds at risk
- Whale impersonation is sandboxed to test environment
- All transactions are simulated, not broadcast to mainnet
- Private keys in tests are for local testing only
