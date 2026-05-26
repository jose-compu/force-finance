# FORCE FINANCE STRATEGY REVISION
## Based on Impermanent Loss Analysis

### CRITICAL FINDING
Pure impermanent loss strategy creates **10.98% volatility** - completely unsuitable for stablecoin.

### RECOMMENDED HYBRID APPROACH

#### 1. **Controlled IL Exposure (25-40%)**
- Use IL for 25-40% of short exposure
- Provides real market dynamics
- Captures IL benefits without excessive volatility

#### 2. **Synthetic Short for Stability (60-75%)**
- Use derivatives/futures for majority of short exposure
- Provides stable, predictable hedging
- Lower volatility, consistent delta neutrality

#### 3. **Dynamic Rebalancing**
- **0.8% threshold** (compromise between 0.5% and 1.5%)
- Expected volatility: **~2-3%** (acceptable for stablecoin)
- Expected rebalances: **3-4 per day**

### SMART CONTRACT IMPLEMENTATION

```solidity
contract HybridDeltaNeutralStrategy {
 // Hybrid exposure parameters
 uint256 public constant IL_EXPOSURE_RATIO = 3000; // 30% IL, 70% synthetic
 uint256 public constant REBALANCE_THRESHOLD = 80; // 0.8% in basis points
 
 // Position tracking
 struct HybridPosition {
 uint256 longAmount;
 uint256 ilShortExposure; // From Uniswap LP positions
 uint256 syntheticShortExposure; // From derivatives
 uint256 lastRebalance;
 }
 
 function createPosition(uint256 amount) external {
 // 30% through IL (Uniswap LP)
 uint256 ilAmount = (amount * IL_EXPOSURE_RATIO) / BASIS_POINTS;
 _createUniswapPosition(ilAmount);
 
 // 70% through synthetic instruments
 uint256 syntheticAmount = amount - ilAmount;
 _createSyntheticShort(syntheticAmount);
 }
}
```

### EXPECTED PERFORMANCE

| Metric | Hybrid Strategy (Projected) |
|--------|----------------------------|
| **Value Volatility** | **2.5% ± 0.5%** |
| **Rebalance Frequency** | **3.5 times/day** |
| **Annual Costs** | **0.15% of TVL** |
| **Max Deviation** | **3.5%** |

### IMPLEMENTATION PRIORITY

1. **Phase 1**: Implement hybrid smart contract structure
2. **Phase 2**: Add Uniswap V3 integration for controlled IL
3. **Phase 3**: Integrate perpetuals/futures for synthetic exposure
4. **Phase 4**: Optimize IL_EXPOSURE_RATIO based on market conditions

### RISK MANAGEMENT

- **IL Monitoring**: Track IL in real-time
- **Volatility Circuit Breaker**: Reduce IL exposure if volatility > 5%
- **Emergency Mode**: Fall back to 100% synthetic in extreme markets

### CONCLUSION

**Pure IL strategy is unsuitable for stablecoin due to excessive volatility.**
**Hybrid approach balances real market dynamics with stability requirements.**

---

## IMPLEMENTATION STATUS (May 2026)

| Recommendation | Status | Location |
|----------------|--------|----------|
| 30% IL / 70% synthetic split | Implemented | `AvalancheLSTStrategy.sol` (`ilExposureBps`, hybrid short tracking) |
| 0.8% rebalance threshold | Implemented | `rebalanceDeviationThreshold = 80` |
| Volatility circuit breaker (>5%) | Implemented | `volatilityCircuitBreakerBps`, reduces IL to 15% |
| Emergency 100% synthetic mode | Implemented | `emergencySyntheticOnly` |
| Uniswap V3 IL leg (Phase 2) | Pending | IL notional tracked; LP integration not wired |
| GMX/perp synthetic leg (Phase 3) | Partial | `GMXFuturesManager` + synthetic notional tracking |
| Hybrid simulation benchmark | Implemented | `simulations/hybrid_strategy.py` |
