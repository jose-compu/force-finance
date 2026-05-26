"""
STRATEGY COMPARISON: Synthetic Short vs Real Impermanent Loss

This script compares the original simplified strategy with the proper IL-based strategy
to show the critical differences in modeling.
"""

import sys
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, List
import warnings

# Add the simulations directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from delta_neutral_strategy import DeltaNeutralStrategy, run_simulation
from impermanent_loss_strategy import ILDeltaNeutralStrategy, run_il_simulation
from hybrid_strategy import run_hybrid_simulation, compare_hybrid_thresholds, DEFAULT_THRESHOLD
from data_fetcher import CryptoDataFetcher

warnings.filterwarnings('ignore')

def compare_strategies(eth_data: pd.DataFrame, btc_data: pd.DataFrame, 
                      thresholds: List[float] = [0.005, 0.01, 0.015, 0.02]) -> pd.DataFrame:
    """Compare both strategies across different thresholds"""
    
    results = []
    
    for threshold in thresholds:
        print(f"\n🔄 Testing threshold: {threshold*100:.1f}%")
        print("=" * 50)
        
        # Run original (simplified) strategy
        print("📊 Running SIMPLIFIED synthetic short strategy...")
        try:
            simple_strategy = run_simulation(eth_data, btc_data, threshold)
            simple_metrics = simple_strategy.get_performance_metrics()
            simple_metrics['strategy_type'] = 'Simplified'
            simple_metrics['threshold'] = threshold
            results.append(simple_metrics)
            
            print(f"   ✅ Simple strategy completed")
            print(f"   Value volatility: {simple_metrics['value_volatility_pct']:.3f}%")
            print(f"   Rebalances: {simple_metrics['rebalance_count']}")
            
        except Exception as e:
            print(f"   ❌ Simple strategy failed: {e}")
        
        # Run IL-based strategy
        print("📊 Running IMPERMANENT LOSS strategy...")
        try:
            il_strategy = run_il_simulation(eth_data, btc_data, threshold)
            il_metrics = il_strategy.get_performance_metrics()
            il_metrics['strategy_type'] = 'Impermanent_Loss'
            il_metrics['threshold'] = threshold
            results.append(il_metrics)
            
            print(f"   ✅ IL strategy completed")
            print(f"   Value volatility: {il_metrics['value_volatility_pct']:.3f}%")
            print(f"   Average ETH IL: {il_metrics.get('avg_il_eth', 0):.3f}")
            print(f"   Average BTC IL: {il_metrics.get('avg_il_btc', 0):.3f}")
            print(f"   Rebalances: {il_metrics['rebalance_count']}")
            
        except Exception as e:
            print(f"   ❌ IL strategy failed: {e}")

        print("📊 Running HYBRID strategy (30% IL / 70% synthetic)...")
        try:
            hybrid_result = run_hybrid_simulation(eth_data, btc_data, threshold=threshold)
            results.append(
                {
                    "strategy_type": "Hybrid",
                    "threshold": threshold,
                    "value_volatility_pct": hybrid_result.value_volatility_pct,
                    "rebalance_frequency_per_day": hybrid_result.rebalance_frequency_per_day,
                    "cost_ratio_pct": hybrid_result.cost_ratio_pct,
                    "value_change_pct": hybrid_result.value_change_pct,
                    "max_asset_deviation": hybrid_result.max_asset_deviation,
                }
            )
            print(f"   ✅ Hybrid strategy completed")
            print(f"   Value volatility: {hybrid_result.value_volatility_pct:.3f}%")
            print(f"   Rebalances/day: {hybrid_result.rebalance_frequency_per_day:.1f}")
        except Exception as e:
            print(f"   ❌ Hybrid strategy failed: {e}")
    
    return pd.DataFrame(results)

def create_comparison_plots(results_df: pd.DataFrame):
    """Create detailed comparison plots"""
    
    if results_df.empty:
        print("❌ No results to plot")
        return
    
    # Separate strategies
    simple_results = results_df[results_df['strategy_type'] == 'Simplified']
    il_results = results_df[results_df['strategy_type'] == 'Impermanent_Loss']
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle('Strategy Comparison: Simplified vs Impermanent Loss', fontsize=16, fontweight='bold')
    
    # 1. Value Volatility Comparison
    if not simple_results.empty and not il_results.empty:
        axes[0, 0].plot(simple_results['threshold'] * 100, simple_results['value_volatility_pct'], 
                       'b-o', label='Simplified', linewidth=2, markersize=8)
        axes[0, 0].plot(il_results['threshold'] * 100, il_results['value_volatility_pct'], 
                       'r-s', label='IL-Based', linewidth=2, markersize=8)
        axes[0, 0].set_xlabel('Rebalance Threshold (%)')
        axes[0, 0].set_ylabel('Value Volatility (%)')
        axes[0, 0].set_title('Stablecoin Value Volatility')
        axes[0, 0].legend()
        axes[0, 0].grid(True, alpha=0.3)
    
    # 2. Rebalancing Frequency
    if not simple_results.empty and not il_results.empty:
        axes[0, 1].plot(simple_results['threshold'] * 100, simple_results['rebalance_frequency_per_day'], 
                       'b-o', label='Simplified', linewidth=2, markersize=8)
        axes[0, 1].plot(il_results['threshold'] * 100, il_results['rebalance_frequency_per_day'], 
                       'r-s', label='IL-Based', linewidth=2, markersize=8)
        axes[0, 1].set_xlabel('Rebalance Threshold (%)')
        axes[0, 1].set_ylabel('Rebalances per Day')
        axes[0, 1].set_title('Rebalancing Frequency')
        axes[0, 1].legend()
        axes[0, 1].grid(True, alpha=0.3)
    
    # 3. Cost Ratio
    if not simple_results.empty and not il_results.empty:
        axes[0, 2].plot(simple_results['threshold'] * 100, simple_results['cost_ratio_pct'], 
                       'b-o', label='Simplified', linewidth=2, markersize=8)
        axes[0, 2].plot(il_results['threshold'] * 100, il_results['cost_ratio_pct'], 
                       'r-s', label='IL-Based', linewidth=2, markersize=8)
        axes[0, 2].set_xlabel('Rebalance Threshold (%)')
        axes[0, 2].set_ylabel('Cost Ratio (%)')
        axes[0, 2].set_title('Annual Cost Ratio')
        axes[0, 2].legend()
        axes[0, 2].grid(True, alpha=0.3)
    
    # 4. Final Value Change
    if not simple_results.empty and not il_results.empty:
        axes[1, 0].plot(simple_results['threshold'] * 100, simple_results['value_change_pct'], 
                       'b-o', label='Simplified', linewidth=2, markersize=8)
        axes[1, 0].plot(il_results['threshold'] * 100, il_results['value_change_pct'], 
                       'r-s', label='IL-Based', linewidth=2, markersize=8)
        axes[1, 0].axhline(y=0, color='black', linestyle='--', alpha=0.5)
        axes[1, 0].set_xlabel('Rebalance Threshold (%)')
        axes[1, 0].set_ylabel('Value Change (%)')
        axes[1, 0].set_title('Final Value Change')
        axes[1, 0].legend()
        axes[1, 0].grid(True, alpha=0.3)
    
    # 5. Max Deviation
    if not simple_results.empty and not il_results.empty:
        axes[1, 1].plot(simple_results['threshold'] * 100, simple_results['max_asset_deviation'] * 100, 
                       'b-o', label='Simplified', linewidth=2, markersize=8)
        axes[1, 1].plot(il_results['threshold'] * 100, il_results['max_asset_deviation'] * 100, 
                       'r-s', label='IL-Based', linewidth=2, markersize=8)
        axes[1, 1].set_xlabel('Rebalance Threshold (%)')
        axes[1, 1].set_ylabel('Max Deviation (%)')
        axes[1, 1].set_title('Maximum Delta Deviation')
        axes[1, 1].legend()
        axes[1, 1].grid(True, alpha=0.3)
    
    # 6. Efficiency Score (1/volatility)
    if not simple_results.empty and not il_results.empty:
        simple_eff = 1 / simple_results['value_volatility_pct']
        il_eff = 1 / il_results['value_volatility_pct']
        
        axes[1, 2].plot(simple_results['threshold'] * 100, simple_eff, 
                       'b-o', label='Simplified', linewidth=2, markersize=8)
        axes[1, 2].plot(il_results['threshold'] * 100, il_eff, 
                       'r-s', label='IL-Based', linewidth=2, markersize=8)
        axes[1, 2].set_xlabel('Rebalance Threshold (%)')
        axes[1, 2].set_ylabel('Efficiency Score')
        axes[1, 2].set_title('Strategy Efficiency (Higher = Better)')
        axes[1, 2].legend()
        axes[1, 2].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('strategy_comparison.png', dpi=300, bbox_inches='tight')
    print("📊 Comparison plot saved as 'strategy_comparison.png'")
    
def create_summary_table(results_df: pd.DataFrame):
    """Create summary comparison table"""
    
    if results_df.empty:
        print("❌ No results to summarize")
        return
    
    # Group by strategy type and calculate averages
    summary = results_df.groupby(['strategy_type', 'threshold']).agg({
        'value_volatility_pct': 'mean',
        'rebalance_frequency_per_day': 'mean',
        'cost_ratio_pct': 'mean',
        'value_change_pct': 'mean',
        'max_asset_deviation': 'mean'
    }).round(3)
    
    print("\n" + "="*80)
    print("📊 STRATEGY COMPARISON SUMMARY")
    print("="*80)
    
    for threshold in sorted(results_df['threshold'].unique()):
        print(f"\n🎯 Threshold: {threshold*100:.1f}%")
        print("-" * 60)
        
        threshold_data = results_df[results_df['threshold'] == threshold]
        
        if not threshold_data.empty:
            for _, row in threshold_data.iterrows():
                strategy = row['strategy_type']
                print(f"{strategy:15} | Vol: {row['value_volatility_pct']:6.3f}% | "
                      f"Rebal/day: {row['rebalance_frequency_per_day']:5.1f} | "
                      f"Costs: {row['cost_ratio_pct']:6.3f}% | "
                      f"ΔValue: {row['value_change_pct']:+7.3f}%")
    
    # Find optimal thresholds for each strategy
    print(f"\n🏆 OPTIMAL THRESHOLDS:")
    print("-" * 40)
    
    for strategy_type in ['Simplified', 'Impermanent_Loss']:
        strategy_data = results_df[results_df['strategy_type'] == strategy_type]
        if not strategy_data.empty:
            # Optimize for lowest volatility
            optimal_idx = strategy_data['value_volatility_pct'].idxmin()
            optimal_row = strategy_data.loc[optimal_idx]
            
            print(f"{strategy_type}:")
            print(f"  Optimal threshold: {optimal_row['threshold']*100:.1f}%")
            print(f"  Value volatility: {optimal_row['value_volatility_pct']:.3f}%")
            print(f"  Rebalances/day: {optimal_row['rebalance_frequency_per_day']:.1f}")
            print(f"  Annual costs: {optimal_row['cost_ratio_pct']:.3f}%")
            
            if strategy_type == 'Impermanent_Loss':
                print(f"  Avg ETH IL: {optimal_row.get('avg_il_eth', 0):.3f}")
                print(f"  Avg BTC IL: {optimal_row.get('avg_il_btc', 0):.3f}")
            print()

def main():
    """Run comprehensive strategy comparison"""
    
    print("🔄 FORCE FINANCE STRATEGY COMPARISON")
    print("=" * 60)
    print("Comparing Simplified vs Impermanent Loss based strategies")
    print()
    
    # Fetch real market data
    print("📊 Step 1: Fetching real market data...")
    try:
        fetcher = CryptoDataFetcher()
        eth_data = fetcher.fetch_coingecko_data('ethereum', days=30)
        btc_data = fetcher.fetch_coingecko_data('bitcoin', days=30)
        
        print(f"   ✅ ETH data: {len(eth_data)} points")
        print(f"   ✅ BTC data: {len(btc_data)} points")
        
    except Exception as e:
        print(f"   ❌ Data fetch failed: {e}")
        print("   Using synthetic data for testing...")
        
        # Generate synthetic data
        timestamps = pd.date_range('2025-01-01', periods=500, freq='1h')
        eth_prices = 2000 * np.exp(np.cumsum(np.random.normal(0, 0.01, 500)))
        btc_prices = 50000 * np.exp(np.cumsum(np.random.normal(0, 0.01, 500)))
        
        eth_data = pd.DataFrame({
            'timestamp': timestamps,
            'price': eth_prices,
            'volatility_24h': np.random.uniform(0.01, 0.05, 500)
        })
        
        btc_data = pd.DataFrame({
            'timestamp': timestamps,
            'price': btc_prices,
            'volatility_24h': np.random.uniform(0.01, 0.05, 500)
        })
    
    # Run comparison
    print("\n📊 Step 2: Running strategy comparison...")
    thresholds = [0.005, 0.008, 0.01, 0.015, 0.02]  # include 0.8% STRATEGY_REVISION target
    
    results_df = compare_strategies(eth_data, btc_data, thresholds)
    
    if not results_df.empty:
        # Save results
        results_df.to_csv('strategy_comparison_results.csv', index=False)
        print(f"\n💾 Results saved to 'strategy_comparison_results.csv'")
        
        # Create analysis
        create_summary_table(results_df)
        create_comparison_plots(results_df)
        
        print(f"\n✅ Strategy comparison completed!")
        print(f"📁 Generated files:")
        print(f"   - strategy_comparison_results.csv")
        print(f"   - strategy_comparison.png")
        
    else:
        print("\n❌ No results generated - check for errors above")

if __name__ == "__main__":
    main()
