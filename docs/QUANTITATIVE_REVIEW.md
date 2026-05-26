> [Force Finance](../README.md) · `docs/QUANTITATIVE_REVIEW.md`

# Force Finance - Quantitative Finance Review

## Overall Assessment: **MODERATE RISK** 

### Strengths 

1. **Solid Foundation**
 - 150% collateralization provides 50% buffer
 - Delta-neutral strategy is mathematically sound
 - Comprehensive failure scenario testing implemented
 - Multiple failsafes (insolvency detection, liquidation protection, emergency controls)

2. **Risk Management**
 - Automatic rebalancing at 5% deviation (2% hard, 1.5% soft)
 - Liquidation buffer (5% from liquidation price)
 - Protocol health monitoring with real-time solvency checks
 - Emergency mode with pause functionality

3. **Yield Generation**
 - Captures LST staking rewards (sAVAX ~5-7% APY)
 - Compound-style yield distribution to FUSD holders
 - No lock-up periods

### Critical Risks 

1. **Delta-Neutral Complexity**
 - Perfect delta neutrality is impossible in practice
 - Rebalancing lag creates exposure windows
 - GMX short positions can be liquidated independently
 - **Risk**: Temporary delta exposure during volatile periods

2. **GMX Liquidation Risk**
 - 10x leverage on futures (high risk)
 - Liquidation buffer (5%) may be insufficient in flash crashes
 - GMX pool utilization limits can prevent rebalancing
 - **Risk**: Cascading liquidations if GMX positions fail

3. **Oracle Dependency**
 - Price feeds are critical for rebalancing decisions
 - Fallback prices ($22) are arbitrary and may be wrong
 - Oracle manipulation could trigger incorrect rebalancing
 - **Risk**: Protocol makes bad decisions based on bad data

4. **Rebalancing Costs**
 - Gas costs on Avalanche (mitigated)
 - Slippage on GMX positions
 - Keeper rewards reduce protocol profitability
 - **Risk**: High-frequency rebalancing erodes value

5. **sAVAX Depegging**
 - Exchange rate can drop (negative yield)
 - No protection against BENQI protocol failure
 - **Risk**: Collateral value collapse

6. **Protocol Insolvency**
 - 5% buffer may be insufficient in extreme scenarios
 - Mass withdrawals could trigger bank run
 - **Risk**: FUSD holders unable to redeem

### Quantitative Concerns

1. **Volatility Projections**
 - Hybrid strategy targets 2-3% volatility (acceptable)
 - But simulations show 10.98% with pure IL approach
 - Current implementation unclear on IL vs synthetic split
 - **Concern**: Actual volatility may exceed targets

2. **Rebalancing Frequency**
 - 3-4 rebalances/day expected
 - Each rebalance has costs (gas + slippage)
 - **Concern**: Costs could exceed yield in low-volatility periods

3. **Capital Efficiency**
 - 150% collateralization = 66.7% capital efficiency
 - Lower than many DeFi protocols (often 80-90%)
 - **Concern**: Opportunity cost of over-collateralization

### Verdict

**The product is FUNCTIONALLY SOUND but OPERATIONALLY RISKY.**

**Good for:**
- Users seeking yield on stablecoins
- Small to medium scale (under $10M TVL)
- Controlled, monitored deployment

**Dangerous for:**
- Large scale deployment without extensive testing
- Unmonitored operation (requires active oversight)
- Extreme market conditions (flash crashes, oracle failures)

### Recommendations

**Before Mainnet:**
1. Extensive testnet deployment (3+ months)
2. Start with <$1M TVL limit
3. Implement circuit breakers for extreme volatility
4. Multi-oracle price aggregation (not just fallback)
5. Insurance fund for extreme scenarios
6. Real-time monitoring dashboard

**Ongoing:**
1. Continuous monitoring of delta exposure
2. Regular stress testing
3. Gradual TVL increases with proven stability
4. Community governance for parameter adjustments

### Conclusion

The protocol is **well-designed with good safeguards**, but delta-neutral strategies are inherently complex and can fail in edge cases. The 150% collateralization and comprehensive failsafes provide reasonable protection, but **operational risk remains high** due to:
- GMX liquidation dependencies
- Oracle reliability
- Rebalancing execution risk
- Market correlation breakdowns

**Recommendation**: Proceed with **caution, extensive testing, and gradual scaling**.
