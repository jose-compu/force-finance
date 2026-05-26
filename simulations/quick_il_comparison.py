"""
Quick comparison between strategies to show the IL impact
"""

import sys
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Add the simulations directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from delta_neutral_strategy import DeltaNeutralStrategy, run_simulation
from impermanent_loss_strategy import ILDeltaNeutralStrategy, run_il_simulation

def create_realistic_data(hours=1000):
    """Create realistic crypto price movements"""
    timestamps = pd.date_range('2025-01-01', periods=hours, freq='1h')
    
    # Create correlated but volatile price movements
    np.random.seed(42)  # For reproducible results
    
    # ETH with higher volatility
    eth_returns = np.random.normal(0, 0.015, hours)  # 1.5% hourly volatility
    eth_prices = 2000 * np.exp(np.cumsum(eth_returns))
    
    # BTC with correlation but different volatility
    btc_returns = 0.7 * eth_returns + np.random.normal(0, 0.012, hours)  # 70% correlation
    btc_prices = 50000 * np.exp(np.cumsum(btc_returns))
    
    eth_data = pd.DataFrame({
        'timestamp': timestamps,
        'price': eth_prices,
        'volatility_24h': np.abs(eth_returns)
    })
    
    btc_data = pd.DataFrame({
        'timestamp': timestamps,
        'price': btc_prices,
        'volatility_24h': np.abs(btc_returns)
    })
    
    return eth_data, btc_data

def run_comparison():
    """Run quick comparison"""
    
    print("🧪 QUICK IL vs SIMPLIFIED STRATEGY COMPARISON")
    print("=" * 55)
    
    # Create test data
    eth_data, btc_data = create_realistic_data(500)  # 500 hours ≈ 20 days
    
    print(f"📊 Test data: {len(eth_data)} hours of price movements")
    print(f"   ETH: ${eth_data['price'].iloc[0]:.2f} → ${eth_data['price'].iloc[-1]:.2f}")
    print(f"   BTC: ${btc_data['price'].iloc[0]:.2f} → ${btc_data['price'].iloc[-1]:.2f}")
    
    # Test threshold
    threshold = 0.01  # 1%
    
    print(f"\n🔄 Testing with {threshold*100:.1f}% rebalance threshold")
    print("-" * 50)
    
    # Run simplified strategy
    print("1️⃣ Running SIMPLIFIED strategy...")
    simple_strategy = run_simulation(eth_data, btc_data, threshold)
    simple_metrics = simple_strategy.get_performance_metrics()
    
    print("2️⃣ Running IMPERMANENT LOSS strategy...")
    il_strategy = run_il_simulation(eth_data, btc_data, threshold)
    il_metrics = il_strategy.get_performance_metrics()
    
    # Compare results
    print("\n📊 COMPARISON RESULTS")
    print("=" * 50)
    
    print(f"{'Metric':<25} {'Simplified':<12} {'IL-Based':<12} {'Difference':<12}")
    print("-" * 61)
    
    metrics_to_compare = [
        ('Value Volatility (%)', 'value_volatility_pct'),
        ('Final Value Change (%)', 'value_change_pct'),
        ('Rebalances', 'rebalance_count'),
        ('Rebalances/Day', 'rebalance_frequency_per_day'),
        ('Cost Ratio (%)', 'cost_ratio_pct'),
        ('Max Deviation', 'max_asset_deviation'),
    ]
    
    for label, key in metrics_to_compare:
        simple_val = simple_metrics.get(key, 0)
        il_val = il_metrics.get(key, 0)
        diff = il_val - simple_val
        
        if 'pct' in key or 'ratio' in key:
            print(f"{label:<25} {simple_val:>11.3f} {il_val:>11.3f} {diff:>+11.3f}")
        elif key == 'rebalance_count':
            print(f"{label:<25} {simple_val:>11.0f} {il_val:>11.0f} {diff:>+11.0f}")
        else:
            print(f"{label:<25} {simple_val:>11.3f} {il_val:>11.3f} {diff:>+11.3f}")
    
    # IL-specific metrics
    if 'avg_il_eth' in il_metrics:
        print(f"\n📈 IL-SPECIFIC METRICS (IL Strategy Only)")
        print("-" * 40)
        print(f"Average ETH IL: {il_metrics['avg_il_eth']:.4f}")
        print(f"Average BTC IL: {il_metrics['avg_il_btc']:.4f}")
    
    # Create simple plot
    create_comparison_plot(simple_strategy, il_strategy)
    
    print(f"\n🎯 KEY INSIGHTS:")
    print("-" * 20)
    
    vol_diff = il_metrics['value_volatility_pct'] - simple_metrics['value_volatility_pct']
    if abs(vol_diff) > 0.1:
        print(f"🔴 VOLATILITY DIFFERENCE: {vol_diff:+.3f}% - IL strategy shows {'higher' if vol_diff > 0 else 'lower'} volatility")
    else:
        print("🟢 VOLATILITY SIMILAR: Both strategies show comparable volatility")
    
    rebal_diff = il_metrics['rebalance_count'] - simple_metrics['rebalance_count']
    if abs(rebal_diff) > 5:
        print(f"🔄 REBALANCING DIFFERENCE: {rebal_diff:+.0f} rebalances - IL strategy requires {'more' if rebal_diff > 0 else 'fewer'} rebalances")
    
    value_diff = il_metrics['value_change_pct'] - simple_metrics['value_change_pct']
    if abs(value_diff) > 1:
        print(f"💰 VALUE DIFFERENCE: {value_diff:+.3f}% - IL strategy shows {'better' if value_diff > 0 else 'worse'} final performance")

def create_comparison_plot(simple_strategy, il_strategy):
    """Create side-by-side value charts"""
    
    simple_df = pd.DataFrame(simple_strategy.history)
    il_df = pd.DataFrame(il_strategy.history)
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Strategy Comparison: Simplified vs Impermanent Loss', fontsize=14, fontweight='bold')
    
    # Portfolio values
    axes[0, 0].plot(simple_df['total_value'], label='Simplified', color='blue', linewidth=2)
    axes[0, 0].plot(il_df['total_value'], label='IL-Based', color='red', linewidth=2)
    axes[0, 0].axhline(y=1000000, color='black', linestyle='--', alpha=0.5, label='Initial Value')
    axes[0, 0].set_title('Portfolio Value Over Time')
    axes[0, 0].set_ylabel('Value ($)')
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)
    
    # Delta comparison
    axes[0, 1].plot(simple_df['portfolio_delta'], label='Simplified', color='blue', alpha=0.7)
    axes[0, 1].plot(il_df['portfolio_delta'], label='IL-Based', color='red', alpha=0.7)
    axes[0, 1].axhline(y=0, color='black', linestyle='--', alpha=0.5)
    axes[0, 1].set_title('Portfolio Delta')
    axes[0, 1].set_ylabel('Delta')
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)
    
    # Price movements
    axes[1, 0].plot(simple_df['eth_price'], label='ETH Price', color='orange')
    axes[1, 0].plot(simple_df['btc_price']/25, label='BTC Price/25', color='purple')  # Scale down BTC for visibility
    axes[1, 0].set_title('Underlying Asset Prices')
    axes[1, 0].set_ylabel('Price ($)')
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)
    
    # IL visualization (IL strategy only)
    if 'eth_il' in il_df.columns:
        axes[1, 1].plot(il_df['eth_il'], label='ETH IL', color='green')
        axes[1, 1].plot(il_df['btc_il'], label='BTC IL', color='brown')
        axes[1, 1].axhline(y=0, color='black', linestyle='--', alpha=0.5)
        axes[1, 1].set_title('Impermanent Loss Over Time')
        axes[1, 1].set_ylabel('IL')
        axes[1, 1].legend()
        axes[1, 1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('quick_il_comparison.png', dpi=300, bbox_inches='tight')
    print(f"\n📊 Comparison plot saved as 'quick_il_comparison.png'")

if __name__ == "__main__":
    run_comparison()
