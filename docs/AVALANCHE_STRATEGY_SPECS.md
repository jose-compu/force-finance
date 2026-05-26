> [Force Finance](../README.md) · `docs/AVALANCHE_STRATEGY_SPECS.md`

# FORCE FINANCE AVALANCHE LST + GMX STRATEGY

## Avalanche-Native Delta-Neutral Stablecoin

An Avalanche-only strategy that pairs yield-bearing LST long exposure (sAVAX primary) with GMX perpetual shorts to target near-zero delta, high capital efficiency, and automated compounding.

## 1) Architecture Overview

- **Long (Yield)**
 - sAVAX (BENQI) — primary LST exposure
 - Optional: stETH.e (Lido), BTC.b (AAVE lending)
- **Short (Hedge)**
 - GMX perpetuals: AVAX, ETH, BTC
- **Collateral / Settlement**: USDC.e
- **Chain**: Avalanche C-Chain only (no cross-chain)

## 2) Target Allocations (initial)

- sAVAX: 100% (Phase 1)
- Optional Phase 2+ diversification:
 - stETH.e: up to 35%
 - BTC.b (lent on AAVE): up to 25%

Rationale: start simple with sAVAX + AVAX perp hedges, expand after production maturity.

## 3) Leverage Policy (GMX Utilization Bands)

Per-asset leverage is bounded by GMX pool utilization bands. Use lower of: per-asset cap and band-derived leverage.

- **AVAX**
 - Util ≤ 55% → 10x
 - 55–75% → 7x
 - >75% → 5x
 - Max cap: 10x
- **BTC**
 - Util ≤ 55% → 6x
 - 55–75% → 4x
 - >75% → 3x
 - Max cap: 6x
- **ETH**
 - Util ≤ 55% → 4x
 - 55–75% → 3x
 - >75% → 2x
 - Max cap: 4x

Safety:
- Do not increase size if utilization > 90%.
- Maintain minimum available-liquidity buffer ≥ 10% of `poolAmounts`.

## 4) Delta Neutrality and Rebalancing

- **Delta Target**: 0
- **Hard Rebalance Trigger**: |LST_value − Short_value| / Total_notional > 2%
- **Soft Trigger**: >1.5% if gas price is low and liquidity ≥ buffer
- **Additional Triggers**:
 - GMX utilization crosses leverage band boundary
 - sAVAX exchange-rate step change > 10 bps since last checkpoint
 - Price deviation between internal oracle and GMX price > 10%

### Rebalance Procedure
1. Claim and checkpoint LST yields
2. Determine delta deviation and optimal hedge changes
3. Validate GMX liquidity and utilization bands
4. Adjust GMX short sizes and/or LST exposure accordingly
5. Update checkpoints (exchange rates, bands, metrics)

## 5) Yield Policy

- **sAVAX/stETH.e**: auto-compound (rebasing). Track yield via exchange-rate delta.
- **AAVE BTC.b**: claim incentives weekly (configurable). 
- **Reinvest Split**: 70% to LST exposure, 30% to increase GMX short collateral.

## 6) Oracles and Pricing

Priority stack and validation:
- Primary: GMX Vault price (30-decimals) normalized to 18
- Cross-check: Trader Joe V2 TWAP / Uniswap V3 TWAP (≥10 min window)
- Fallback: BENQI oracle (where applicable)
- Reject price if deviation between primary and cross-check > 10%

## 7) Risk Controls

- Maintenance margin buffer per position ≥ 2% of notional
- Circuit breakers:
 - GMX utilization > 92%: deleverage 20% of affected leg
 - Oracle deviation > 15% sustained 5 minutes: pause increases only
 - Gas spike > 200 gwei: skip non-emergency rebalancing
- Emergency: owner can pause/invoke partial deleverage; operator cannot change parameters.

## 8) Deterministic Deployment (CREATE2)

- Use fixed `salt` per environment for deterministic addresses
- Precompute addresses and record (`salt`, `saltHash`) in deployments manifest
- Keep constructor minimal (fee recipient, static params). Set dynamic params via initializer methods.

## 9) Contracts (Phase 1 Minimal)

- `AvalancheLSTStrategy.sol`
 - State: fee recipient, sAVAX balances, short notional (informational), accounting
 - Functions: deposit/withdraw sAVAX, set short notional (owner), view metrics
 - No external protocol calls in MVP (compilation-first). Integrations added incrementally.

- Future add-ons:
 - `LeverageOptimizer` (read GMX pools; compute optimal leverage band)
 - `OracleManager` (aggregate GMX + DEX TWAPs; confidence and deviation checks)
 - `EmergencyControls` (pause, deleverage helpers)

## 10) Testing (No Mocks; Avalanche Fork)

- Hardhat mainnet fork (C-Chain) at a pinned block for determinism
- Impersonate whales to acquire test tokens
- Validate live GMX pool metrics before trading
- Unit tests: math and accounting
- Integration tests: real price reads, liquidity checks, guardrails, rebalancing dry-runs

### Minimal Test Matrix (Phase 1)
- Compile and deploy via CREATE2 (deterministic address)
- sAVAX deposit/withdraw flows
- Metrics reflect deposits and short-notional updates
- Read-only checks to GMX vault on fork (pool amounts, prices)
- Basic policy checks: refuse actions if liquidity/price unsafe

## 11) Operations and Roles

- Owner (multisig): parameters, pause, emergency deleverage
- Operator (automation): execute rebalances within configured bounds only
- Upgradability: prefer new versions (V2+) with storage gap or proxies after MVP stabilization

## 12) Roadmap

1. Phase 1 (MVP):
 - Minimal `AvalancheLSTStrategy` (compiles; sAVAX deposit/withdraw; metrics)
 - Fork tests (no mocks): prices/liquidity read-only
2. Phase 2:
 - Add GMX short creation/updates with liquidity/fee checks
 - Add OracleManager and leverage bands
3. Phase 3:
 - sAVAX yield checkpointing and reinvest policy
 - Emergency controls and circuit breakers
4. Phase 4:
 - Diversify to stETH.e and BTC.b (lending), add AAVE incentives

---

### Appendix: Key Parameters (initial)
- Rebalance threshold: 2% deviation
- Soft trigger: 1.5% (low gas + sufficient liquidity)
- Liquidity buffer: 10% of `poolAmounts`
- Max leverage caps: AVAX 10x, BTC 6x, ETH 4x
- Oracle deviation reject: 10%
- Emergency utilization threshold: 92%

This spec is implementation-ready for a minimal, compiling MVP that we can expand incrementally to full GMX + oracle integration while preserving safety and determinism.
