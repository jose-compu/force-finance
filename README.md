# Force Finance - Avalanche LST + GMX Delta-Neutral Stablecoin

A fully on-chain stablecoin architecture on Avalanche C-Chain, backed by Liquid Staking Tokens (LSTs) and GMX perpetuals using delta-neutral strategies.

## Documentation

Project docs live in [`docs/`](docs/):

| Document | Topic |
|----------|-------|
| [SPECS.md](docs/SPECS.md) | Technical specifications |
| [AVALANCHE_STRATEGY_SPECS.md](docs/AVALANCHE_STRATEGY_SPECS.md) | Avalanche LST + GMX strategy |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Environment and network configuration |
| [DEPLOYMENT_STATUS.md](docs/DEPLOYMENT_STATUS.md) | Deployment readiness and blockers |
| [TESTING.md](docs/TESTING.md) | Test setup and structure |
| [TEST_STATUS.md](docs/TEST_STATUS.md) | Current test suite status |
| [SECURITY_ANALYSIS.md](docs/SECURITY_ANALYSIS.md) | Security review |
| [SAFETY_IMPROVEMENTS.md](docs/SAFETY_IMPROVEMENTS.md) | Safety enhancements |
| [SAFETY_IMPLEMENTATION_SUMMARY.md](docs/SAFETY_IMPLEMENTATION_SUMMARY.md) | Safety implementation summary |
| [RISK_PARAMETER_UPDATES.md](docs/RISK_PARAMETER_UPDATES.md) | Risk parameter changes |
| [SLIPPAGE_ANALYSIS.md](docs/SLIPPAGE_ANALYSIS.md) | Slippage analysis |
| [FINANCIAL_FAILURE_SCENARIOS.md](docs/FINANCIAL_FAILURE_SCENARIOS.md) | Failure scenario modeling |
| [QUANTITATIVE_REVIEW.md](docs/QUANTITATIVE_REVIEW.md) | Quantitative finance review |
| [TODO_STATUS.md](docs/TODO_STATUS.md) | Project TODO tracking |
| [UI_IMPROVEMENTS.md](docs/UI_IMPROVEMENTS.md) | UI improvement notes |
| [UI_IMPROVEMENTS_SUMMARY.md](docs/UI_IMPROVEMENTS_SUMMARY.md) | UI review summary |

## Architecture Overview

The Force Finance stablecoin (FUSD) maintains its peg through a delta-neutral strategy on Avalanche that combines:
- **Liquid Staking Tokens (LSTs)**: sAVAX, stETH.e, BTC.b as primary collateral
- **GMX Perpetual Shorts**: Synthetic short exposure via GMX perpetuals
- **Automated Rebalancing**: Incentivized community-driven rebalancing
- **On-chain Oracles**: BENQI, Trader Joe, and GMX price feeds
- **Yield Distribution**: Compound-style yield to FUSD holders

## Key Features

### Avalanche-Native Architecture
- **LST Integration**: Direct sAVAX, stETH.e, BTC.b support
- **GMX Perpetuals**: Leveraged short positions for delta neutrality
- **Multi-Oracle System**: BENQI, Trader Joe, GMX price aggregation
- **CREATE2 Deployment**: Deterministic contract addresses
- **Mainnet Fork Testing**: Real Avalanche data for development

### Economic Model
- **150% Collateralization Ratio**: Over-collateralized for stability
- **120% Liquidation Threshold**: Automated position management
- **0.8% Rebalancing Threshold**: Maintains delta neutrality
- **Hybrid Strategy**: 30% IL exposure, 70% synthetic shorts
- **Tiered Incentive Structure**: Rewards based on deviation severity

### Yield Generation
- **FUSD Staking**: Earn yield from LST staking rewards
- **Automated Yield Claiming**: Integrated LST reward collection
- **Compound-Style Distribution**: Industry standard yield indexing
- **Real-time Yield Tracking**: sAVAX exchange rate monitoring

## Smart Contracts

### Core Contracts
- **AvalancheLSTStrategy.sol**: Core strategy managing LST deposits and GMX shorts
- **AvalancheOracleManager.sol**: Multi-source price oracle aggregation
- **LeverageOptimizer.sol**: Dynamic leverage calculation based on GMX pools
- **RebalancingEngine.sol**: Advanced delta-neutral rebalancing with risk controls
- **EmergencyControls.sol**: Emergency pause and deleveraging mechanisms
- **PositionManager.sol**: GMX position lifecycle management

### Yield & Distribution Contracts
- **FUSD Stablecoin**: ERC20 stablecoin with minting/burning mechanics
- **Yield Distribution**: Compound-style yield indexing system
- **LST Yield Tracking**: Automated sAVAX exchange rate monitoring
- **Reward Collection**: Integrated LST reward claiming

### Supporting Contracts
- **CREATE2Factory.sol**: Deterministic contract deployment
- **MockERC20.sol**: Testing utilities for development
- **Interfaces**: Clean interfaces for GMX, BENQI, and LST interactions

## Frontend Application

### Features
- **Dashboard**: Real-time protocol metrics and portfolio overview
- **Vault Operations**: Deposit/withdraw LSTs, mint/burn FUSD
- **GMX Integration**: Monitor and manage perpetual positions
- **Rebalancer Tool**: Monitor delta and trigger rebalancing for rewards
- **Yield Analytics**: Track LST yields and FUSD distribution
- **Portfolio Analytics**: Charts and visualizations for position tracking

### Technology Stack
- React 18 with modern hooks
- Ethers.js v5 for blockchain interaction
- Tailwind CSS for responsive styling
- Recharts for data visualization
- Context-based state management

## Delta-Neutral Strategy

The system maintains price stability through:

1. **LST Collateral**: Users deposit sAVAX, stETH.e, BTC.b as collateral
2. **GMX Short Positions**: Create equivalent short exposure via GMX perpetuals
3. **Hybrid Approach**: 30% impermanent loss, 70% synthetic shorts
4. **Delta Monitoring**: Continuous tracking of portfolio delta
5. **Automated Rebalancing**: Triggered when deviation exceeds 0.8%
6. **Community Incentives**: Rewards for maintaining system balance
7. **Yield Generation**: LST staking rewards distributed to FUSD holders

### Rebalancing Mechanism
- **Base Threshold**: 0.8% deviation from target (delta = 0)
- **Emergency Threshold**: 10% deviation triggers emergency rebalancing
- **Reward Structure**: 0.1 AVAX base reward + deviation bonus
- **Cooldown Period**: 1 hour minimum between rebalances
- **Public Execution**: Anyone can trigger rebalancing for rewards

### Yield Distribution System
- **LST Rewards**: Automated sAVAX staking reward collection
- **Compound Indexing**: Global yield index with user tracking
- **Real-time Updates**: Continuous yield accrual to FUSD holders
- **Claim Mechanism**: Industry standard yield claiming interface

## Installation & Setup

### Prerequisites
- Node.js v20 (recommended)
- MetaMask or compatible Web3 wallet
- Git
- Optional: Infura or other Avalanche RPC for mainnet forking

### Backend Setup
```bash
git clone https://github.com/YOUR_ORG/force-finance.git
cd force-finance

npm run setup

cp .env.example .env
# Edit .env with your RPC URL and keys. Never commit .env.

npx hardhat test
```

For local development with the frontend:
```bash
npm run node              # terminal 1
npm run deploy-local      # terminal 2
npm run frontend          # terminal 3
```

Or use the all-in-one helper:
```bash
npm run start:local
```

### Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Configuration

### Environment Variables
Create `.env` file in project root:
```bash
# Avalanche RPC URLs
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
INFURA_AVALANCHE_RPC_URL=https://avalanche-mainnet.infura.io/v3/YOUR_KEY

# Deployment
PRIVATE_KEY=your_deployer_private_key

# API Keys
SNOWTRACE_API_KEY=your_snowtrace_api_key
```

### Network Configuration
- **Avalanche Mainnet**: Production deployment with real assets
- **Avalanche Testnet**: Testnet deployment for development
- **Local Fork**: Avalanche mainnet fork for testing

## Usage Guide

### For Users (FUSD Holders)
1. **Deposit LSTs**: Add sAVAX, stETH.e, or BTC.b to the strategy
2. **Mint FUSD**: Create stablecoins against your LST collateral
3. **Earn Yield**: Automatically earn LST staking rewards
4. **Monitor Health**: Keep collateral ratio above 150%
5. **Claim Rewards**: Claim accumulated yield in sAVAX

### For Rebalancers (Yield Farmers)
1. **Monitor Dashboard**: Watch for rebalancing opportunities
2. **Check Deviation**: Look for >0.8% delta deviation
3. **Trigger Rebalance**: Execute rebalancing for AVAX rewards
4. **Emergency Rebalancing**: Higher rewards for >10% deviations
5. **Track Performance**: Monitor earnings and success rate

### For Developers
1. **Contract Integration**: Use provided interfaces and ABIs
2. **Frontend Customization**: Extend React components
3. **Oracle Integration**: Leverage multi-source price feeds
4. **Strategy Extension**: Build on delta-neutral framework

## Security Features

### Smart Contract Security
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Ownable**: Role-based permissions and ownership
- **Input Validation**: Comprehensive parameter checking
- **Safe Math**: Built-in overflow protection via Solidity 0.8.20

### Oracle Security
- **Multi-Source Aggregation**: BENQI, Trader Joe, GMX price feeds
- **Staleness Checks**: Ensure fresh price data
- **Deviation Limits**: Bounds checking for price movements
- **Fallback Mechanisms**: Multiple oracle redundancy

### Economic Security
- **Over-collateralization**: 150% minimum ratio
- **Liquidation Mechanism**: Automated position closure
- **Emergency Controls**: Circuit breakers for extreme events
- **Incentive Alignment**: Rewards for system maintenance

## API Reference

### Core Contract Methods

#### AvalancheLSTStrategy
```solidity
// Deposit sAVAX and mint FUSD
function depositSAvax(uint256 amount, uint256 usdAmount)

// Deposit AVAX (wraps to WAVAX)
function depositAVAX() external payable

// Withdraw sAVAX by burning FUSD
function withdrawSAvax(uint256 fusdAmount, uint256 usdAmount)

// Enable sAVAX yield tracking
function enableSAvaxYieldTracking()

// Checkpoint sAVAX yield
function checkpointSAvaxYield() returns (uint256)

// Trigger rebalancing
function triggerRebalance()

// Execute rebalancing (public)
function executeRebalance() returns (bool, uint256)

// Emergency rebalancing
function executeEmergencyRebalance() returns (bool, uint256)
```

#### Yield Distribution
```solidity
// Claim accrued yield
function claimYield(address user) returns (uint256)

// Get claimable yield
function getClaimableYield(address user) returns (uint256)

// Distribute external yield
function distributeExternalYield(uint256 amount)
```

#### Oracle Integration
```solidity
// Get asset price from multiple sources
function getPrice(address asset) returns (uint256 price, uint256 confidence)

// Get GMX pool utilization
function getPoolUtilization(address token) returns (uint256)

// Get optimal leverage
function getOptimalLeverage(address token) returns (uint256)
```

## Local Development

### Prerequisites
- Node.js 16+ and npm
- Hardhat
- MetaMask (for frontend testing)

### Quick Start

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Compile contracts
npm run compile

# Start local testnet (one command)
npm run start:local
```

This will:
1. Start Hardhat node on http://127.0.0.1:8545
2. Deploy all contracts to localhost
3. Start the frontend on http://localhost:3000

### Manual Setup

```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npm run deploy-local

# Terminal 3: Start frontend
cd frontend && npm start
```

### Connect MetaMask to Local Testnet

1. Open MetaMask
2. Add Network:
 - Network Name: `Hardhat Local`
 - RPC URL: `http://127.0.0.1:8545`
 - Chain ID: `31337`
 - Currency Symbol: `ETH`
3. Import test account from Hardhat node output (private keys are displayed)

### Testing

```bash
# Run all unit tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```

## Development Roadmap

### Phase 1: Core Implementation 
- Smart contract development
- Delta-neutral strategy implementation
- Multi-oracle price aggregation
- Basic frontend interface
- Testing framework

### Phase 2: LST Integration 
- sAVAX, stETH.e, BTC.b support
- Automated yield tracking
- Compound-style yield distribution
- GMX perpetual integration
- Rebalancing incentives

### Phase 3: Enhanced Features 
- Advanced liquidation mechanisms
- Cross-LST strategies
- Governance token integration
- Advanced analytics dashboard
- Professional trading tools

### Phase 4: Ecosystem Expansion 
- Cross-chain deployment
- Institutional integrations
- Advanced derivative strategies
- Community governance
- Mobile applications

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Repository Notes

Before publishing or deploying:

- Copy `.env.example` to `.env` and keep secrets out of git (`.env` is ignored).
- Rotate any API keys or private keys that were ever stored locally in `.env`.
- Run `npm run deploy-local` to generate `frontend/src/deployments.json` for local UI testing.
- Committed templates: `deployments-static.json`, `deployments-avalanche.json`, `frontend/src/deployments.example.json`.
- Generated files (`artifacts/`, `cache/`, `deployments-local.json`) are gitignored.

## License

This project is licensed under the [Business Source License 1.1](LICENSE.md) (BUSL-1.1), similar to [Aave v3 Core](https://github.com/aave/aave-v3-core/blob/master/LICENSE.md).

- Non-production use is permitted under the license terms.
- Limited production use is defined in the Additional Use Grant section of [LICENSE.md](LICENSE.md).
- Other production use requires a commercial license from Force Finance.
- On the Change Date (26 May 2030, or four years after first public release, whichever is earlier), the code converts to MIT.

## Disclaimer

This software is provided "as is" without warranties. Users should:
- Understand the risks of DeFi protocols
- Only invest what they can afford to lose
- Conduct their own research and due diligence
- Consider seeking professional financial advice

## Support

- **Documentation**: See [`docs/`](docs/) and the [Testing Guide](docs/TESTING.md)
- **Community**: Discord and Telegram channels
- **Issues**: GitHub issue tracker for bug reports
- **Security**: Responsible disclosure for security issues

---

**Built by the Force Finance team on Avalanche**
