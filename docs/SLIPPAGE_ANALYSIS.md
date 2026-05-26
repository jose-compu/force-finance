> [Force Finance](../README.md) · `docs/SLIPPAGE_ANALYSIS.md`

# Slippage Protection Analysis - Avalanche Context

## Question: Is 0.5% Slippage Too Small for Volatile Cryptos?

### Context
- **Assets**: AVAX, sAVAX, BTC, ETH (highly volatile)
- **Network**: Avalanche (very cheap gas: ~$0.01-0.10 per transaction)
- **Rebalancing**: 8% threshold (less frequent, larger trades)

## Analysis

### 1. **0.5% Slippage: Reasonable or Too Small?**

**For Normal Conditions**: **Reasonable**
- High-liquidity pairs (WAVAX/USDC, sAVAX/USDC) on Trader Joe V2
- Typical market conditions: 0.5% is achievable
- Protects against sandwich attacks and MEV bots

**For Volatile Conditions**: **Too Small**
- Flash crashes: Prices can move 1-2% in seconds
- High volatility periods: 0.5% will cause frequent reverts
- Failed rebalances → delta drift → increased liquidation risk

### 2. **Avalanche Advantage: Cheap Gas**

**Key Insight**: Since gas is cheap, we can optimize differently:

**Option A: Tight Slippage + Frequent Rebalances**
- 0.5% slippage limit
- Rebalance at 5% deviation (more frequent)
- Smaller trades = less slippage per trade
- More gas spent, but total cost still low

**Option B: Dynamic Slippage + Less Frequent**
- 1% normal, 2.5% emergency
- Rebalance at 8% deviation (current)
- Larger trades, but slippage adapts to conditions
- Less gas, but higher slippage per trade

**Recommendation**: **Option B (Dynamic Slippage)** - Better for current 8% threshold

### 3. **Recommended Slippage Tiers**

| Condition | Slippage | Rationale |
|-----------|----------|-----------|
| **Soft Rebalance** (low gas) | 0.5% | Can afford to retry if fails |
| **Standard Rebalance** | 1.0% | Normal market conditions |
| **High Volatility** | 1.5% | During volatile periods |
| **Emergency Rebalance** | 2.5% | Must execute to maintain delta |
| **Liquidation Risk** | 3.0% | Must execute to avoid liquidation |

### 4. **Implementation Strategy**

**Dynamic Slippage Logic**:
```solidity
// Detect market conditions
bool isHighVolatility = _checkVolatility() > volatilityThreshold;
bool isLiquidationRisk = _isLiquidationRisk();
bool isEmergency = deviation >= emergencyRebalanceThreshold;

// Select appropriate slippage
uint256 maxSlippage = _getMaxSlippage(isEmergency, isLiquidationRisk, isHighVolatility);

// Check before executing
if (!_checkSlippage(expectedPrice, actualPrice, maxSlippage)) {
 if (isLiquidationRisk) {
 // Must execute - accept higher slippage
 maxSlippage = liquidationSlippageBps;
 } else {
 // Can retry later - revert
 revert("Slippage too high");
 }
}
```

**TWAP for Slippage Calculation**:
- Use 30-minute TWAP (already implemented in oracle)
- Prevents manipulation of slippage checks
- More accurate "fair" price reference

### 5. **Cost-Benefit Analysis**

**Scenario 1: 0.5% Fixed Slippage**
- Low slippage cost per trade
- High revert rate during volatility (10-20%)
- Delta drift from failed rebalances
- May miss critical rebalances during crashes

**Scenario 2: Dynamic Slippage (Recommended)**
- Adapts to market conditions
- Lower revert rate (5-10%)
- Better execution during volatility
- Slightly higher slippage cost (but still reasonable)

**Scenario 3: 1% Fixed Slippage**
- Simple implementation
- Reasonable for most conditions
- May be too loose in normal conditions
- May be too tight during crashes

### 6. **Real-World Considerations**

**Avalanche DEX Liquidity**:
- Trader Joe V2: High liquidity for major pairs
- sAVAX/USDC: Moderate liquidity (~$5-10M)
- During high volatility: Liquidity can drop 30-50%

**Price Impact Estimates**:
- $100k trade: ~0.2-0.5% slippage (normal)
- $500k trade: ~0.8-1.5% slippage (normal)
- $1M+ trade: ~1.5-3% slippage (normal)
- During volatility: Add 50-100% to above

### 7. **Final Recommendation**

**Use Dynamic Slippage**:
1. **0.5%** for soft rebalances (when gas is low, can retry)
2. **1.0%** for standard rebalances (normal conditions)
3. **1.5%** during high volatility
4. **2.5%** for emergency rebalances
5. **3.0%** when liquidation risk (must execute)

**Why This Works**:
- Protects against MEV in normal conditions (0.5-1%)
- Allows execution during volatility (1.5-2.5%)
- Ensures critical rebalances execute (3%)
- Cheap gas on Avalanche allows retries if needed

**Monitoring**:
- Track revert rate: If >15%, increase normal slippage to 1.5%
- Track average slippage: Should be <1% in normal conditions
- Alert if slippage >2% in non-emergency situations

## Conclusion

**0.5% is reasonable for normal conditions**, but **too tight for volatile cryptos during market stress**. 

**Dynamic slippage (0.5-3% based on conditions)** provides the best balance:
- Safety in normal conditions (tight slippage)
- Execution during volatility (relaxed slippage)
- Critical rebalances always execute (highest slippage)

Since Avalanche gas is cheap, we can afford to:
- Retry failed rebalances
- Use tighter slippage when possible
- Accept higher slippage only when necessary
