<div align="center">

```
······································································································
:    dMMMMMP .aMMMb  dMMMMb  .aMMMb  dMMMMMP      dMMMMMP dMP dMMMMb  .aMMMb  dMMMMb  .aMMMb  dMMMMMP:
:   dMP     dMP"dMP dMP.dMP dMP"VMP dMP          dMP     amr dMP dMP dMP"dMP dMP dMP dMP"VMP dMP     :
:  dMMMP   dMP dMP dMMMMK" dMP     dMMMP        dMMMP   dMP dMP dMP dMMMMMP dMP dMP dMP     dMMMP    :
: dMP     dMP.aMP dMP"AMF dMP.aMP dMP     amr  dMP     dMP dMP dMP dMP dMP dMP dMP dMP.aMP dMP       :
:dMP      VMMMP" dMP dMP  VMMMP" dMMMMMP dMP  dMP     dMP dMP dMP dMP dMP dMP dMP  VMMMP" dMMMMMP    :
······································································································
```

**FUSD** · Avalanche C-Chain · Delta-Neutral Stablecoin

[![CI](https://github.com/jose-compu/force-finance/actions/workflows/ci.yml/badge.svg)](https://github.com/jose-compu/force-finance/actions/workflows/ci.yml)
[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-0052FF?labelColor=1a1a2e)](LICENSE.md)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-FFF100?logo=ethereum&logoColor=black)](https://hardhat.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Avalanche](https://img.shields.io/badge/Chain-Avalanche-E84142?logo=avalanche&logoColor=white)](https://www.avax.network/)
[![Tests](https://img.shields.io/badge/Unit%20Tests-256%20passing-brightgreen)](#testing--ci)
[![Contract Size](https://img.shields.io/badge/Strategy-21.4%20KB%20%2F%2024%20KB-blue)](#overview)
[![Hybrid](https://img.shields.io/badge/Hedge-30%25%20IL%20%2F%2070%25%20Synthetic-purple)](STRATEGY_REVISION.md)

</div>

On-chain stablecoin (FUSD) on Avalanche C-Chain: LST collateral, GMX perpetual shorts, hybrid delta-neutral hedging, and compound-style yield to holders.

**Contents:** [Overview](#overview) · [Architecture](#architecture) · [Contracts](#contracts) · [Setup](#setup) · [Testing & CI](#testing--ci) · [Docs](#documentation) · [License](#license)

## Overview

FUSD targets peg stability via a **30% IL / 70% synthetic** short split ([STRATEGY_REVISION.md](STRATEGY_REVISION.md)): sAVAX (and planned LSTs) as collateral, GMX shorts for delta neutrality, **0.8%** rebalance threshold, **150%** collateralization, volatility circuit breaker, and emergency 100% synthetic mode.

| Item | Value |
|------|-------|
| License | [BUSL-1.1](LICENSE.md) |
| Repo | [github.com/jose-compu/force-finance](https://github.com/jose-compu/force-finance) |
| Node | 20 (recommended) |
| Unit tests | 256 passing (~16s, no fork) |
| Strategy deploy size | ~21.4 KB (mainnet limit 24 KB, `viaIR`) |
| CI | GitHub Actions on every push/PR |

## Architecture

- **Collateral:** sAVAX primary; stETH.e / BTC.b planned
- **Hedge:** GMX perpetual shorts + tracked IL/synthetic notional split
- **Oracles:** `AvalancheOracleManager` — USDC.e, WAVAX, Trader Joe cache, multi-source aggregation
- **Rebalancing:** Public execution with cooldown; emergency path at higher deviation
- **Yield:** sAVAX exchange-rate tracking, FUSD yield index, external yield distribution
- **Frontend:** React dashboard — deposits, FUSD mint/burn, metrics, rebalancer UI

## Contracts

| Contract | Role |
|----------|------|
| `AvalancheLSTStrategy.sol` | Core strategy — deposits, FUSD, hybrid shorts, rebalancing, yield |
| `AvalancheOracleManager.sol` | Price feeds and cache |
| `GMXFuturesManager.sol` | GMX futures / synthetic leg (partial integration) |
| `DeltaNeutralRebalancer.sol` | Keeper-driven rebalancing coordinator |
| `RebalancingEngine.sol` | Advanced rebalance logic |
| `EmergencyControls.sol` | Pause and emergency flows |
| `LeverageOptimizer.sol` | Pool-based leverage hints |
| `ForceStablecoin.sol` | FUSD ERC20 |
| `MockSAVAX.sol` / `MockWAVAX.sol` | Test doubles |

Phase 2/3 (Uniswap V3 IL leg, full GMX wiring) — see [STRATEGY_REVISION.md](STRATEGY_REVISION.md#implementation-status-may-2026).

## Setup

**Prerequisites:** Node 20, Git, MetaMask (optional, for UI)

```bash
git clone https://github.com/jose-compu/force-finance.git
cd force-finance
npm run setup
cp .env.example .env   # edit locally; never commit .env
```

**Local stack (node + deploy + UI):**
```bash
npm run start:local    # or: npm run node / deploy-local / frontend in separate terminals
```

**MetaMask — Hardhat local:** RPC `http://127.0.0.1:8545`, chain ID `31337`, symbol `ETH`. Import a key from the Hardhat node output.

**Env (`.env`):** `AVALANCHE_RPC_URL`, `PRIVATE_KEY` (deploy only), `SNOWTRACE_API_KEY` (optional). Fork tests: `FORK_AVALANCHE=true`. Details: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Testing & CI

```bash
npm run ci              # compile + unit tests (same as CI)
npm test                # unit tests only
npm run test:fork       # Avalanche fork suite (needs RPC)
npm run test:integration
npm run test:e2e
```

**CI** (`.github/workflows/ci.yml`): `npm ci` → compile → unit tests → `AvalancheLSTStrategy` size check. Fork/integration tests are local/optional.

**Simulations** (Python, optional): `cd simulations && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && python run_simulation.py --quick`

## Documentation

Full docs in [`docs/`](docs/):

| Doc | Topic |
|-----|-------|
| [SPECS.md](docs/SPECS.md) | Technical specs |
| [AVALANCHE_STRATEGY_SPECS.md](docs/AVALANCHE_STRATEGY_SPECS.md) | LST + GMX strategy |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Networks and env |
| [TESTING.md](docs/TESTING.md) | Test layout |
| [DEPLOYMENT_STATUS.md](docs/DEPLOYMENT_STATUS.md) | Deploy readiness |
| [SECURITY_ANALYSIS.md](docs/SECURITY_ANALYSIS.md) | Security review |
| [STRATEGY_REVISION.md](STRATEGY_REVISION.md) | Hybrid strategy rationale and status |

**Security:** ReentrancyGuard, Ownable, Solidity 0.8.20, multi-oracle staleness checks, withdrawal limits, insolvency guards. Report issues via GitHub; do not open public tickets for undisclosed vulnerabilities.

**Contributing:** Fork → branch → PR. CI must pass.

**Publishing notes:** `.env` and build artifacts are gitignored; use `deployments-static.json` / `deploy-local` for local UI addresses.

## License

[Business Source License 1.1](LICENSE.md) (BUSL-1.1). Non-production and limited production use per the Additional Use Grant; other production use requires a commercial license from Force Finance. Converts to MIT on the Change Date (26 May 2030 or four years after first public release, whichever is earlier).

**Disclaimer:** DeFi software, no warranty. Do your own research; only risk what you can afford to lose.
