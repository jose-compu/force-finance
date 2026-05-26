"""
Main simulation runner for Delta-Neutral Stablecoin Strategy
Orchestrates data fetching, simulation, and analysis
"""
import sys
import os
import pandas as pd
import numpy as np
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_fetcher import CryptoDataFetcher
from delta_neutral_strategy import DeltaNeutralStrategy, run_simulation, compare_thresholds
from hybrid_strategy import compare_hybrid_thresholds, DEFAULT_THRESHOLD, run_hybrid_simulation
from analysis_plots import generate_analysis_report, AnalysisPlotter

def main():
    """Main simulation and analysis pipeline"""
    
    print("🚀 FORCE FINANCE DELTA-NEUTRAL STRATEGY SIMULATION")
    print("=" * 60)
    print("Analyzing optimal rebalancing thresholds using real market data")
    print("=" * 60)
    
    try:
        # Step 1: Fetch Real Market Data
        print("\n📊 Step 1: Fetching real cryptocurrency market data...")
        fetcher = CryptoDataFetcher()
        
        # Fetch 90 days of data for more robust analysis
        print("   - Fetching ETH data (90 days)...")
        eth_data = fetcher.get_crypto_data('ETH', period_days=90)
        
        print("   - Fetching BTC data (90 days)...")
        btc_data = fetcher.get_crypto_data('BTC', period_days=90)
        
        print(f"   ✅ Data fetched: {len(eth_data)} ETH points, {len(btc_data)} BTC points")
        
        # Step 2: Data Quality Check
        print("\n🔍 Step 2: Data quality analysis...")
        common_index = eth_data.index.intersection(btc_data.index)
        print(f"   - Overlapping data points: {len(common_index)}")
        
        eth_volatility = eth_data['volatility_24h'].mean() * 100
        btc_volatility = btc_data['volatility_24h'].mean() * 100
        print(f"   - ETH average 24h volatility: {eth_volatility:.2f}%")
        print(f"   - BTC average 24h volatility: {btc_volatility:.2f}%")
        
        eth_price_range = (eth_data['price'].min(), eth_data['price'].max())
        btc_price_range = (btc_data['price'].min(), btc_data['price'].max())
        print(f"   - ETH price range: ${eth_price_range[0]:.2f} - ${eth_price_range[1]:.2f}")
        print(f"   - BTC price range: ${btc_price_range[0]:.2f} - ${btc_price_range[1]:.2f}")
        
        # Step 3: Threshold Analysis
        print("\n⚖️ Step 3: Testing different rebalancing thresholds...")
        thresholds = [0.005, 0.008, 0.01, 0.015, 0.02, 0.03, 0.05, 0.075, 0.1]
        
        print(f"   Testing thresholds: {[f'{t*100:.1f}%' for t in thresholds]}")
        
        results_df = compare_thresholds(eth_data, btc_data, thresholds)
        hybrid_df = compare_hybrid_thresholds(eth_data, btc_data, [0.005, 0.008, 0.01, 0.015, 0.02])
        hybrid_optimal = hybrid_df.loc[hybrid_df["value_volatility_pct"].idxmin()]
        
        print("\n🧮 Hybrid strategy benchmark (STRATEGY_REVISION.md):")
        print(f"   - Target threshold: {DEFAULT_THRESHOLD * 100:.1f}%")
        print(f"   - Best hybrid threshold: {hybrid_optimal['threshold'] * 100:.1f}%")
        print(f"   - Hybrid volatility: {hybrid_optimal['value_volatility_pct']:.3f}%")
        print(f"   - Hybrid rebalances/day: {hybrid_optimal['rebalance_frequency_per_day']:.1f}")
        
        # Step 4: Analysis and Visualization
        print("\n📈 Step 4: Generating analysis and visualizations...")
        
        # Run detailed simulation with optimal threshold for visualization
        if len(results_df) > 0:
            # Find best threshold for detailed analysis
            results_df['efficiency_score'] = (
                (1 / (1 + results_df['value_volatility_pct'])) *  # Lower volatility better
                (1 / (1 + results_df['cost_ratio_pct'])) *        # Lower costs better
                np.exp(-results_df['rebalance_frequency_per_day'] / 5)  # Reasonable frequency
            )
            
            best_idx = results_df['efficiency_score'].idxmax()
            best_threshold = results_df.loc[best_idx, 'threshold']
            
            print(f"   - Running detailed simulation with optimal threshold: {best_threshold*100:.1f}%")
            
            # Run detailed simulation
            detailed_strategy = run_simulation(eth_data, btc_data, best_threshold)
            strategy_history = pd.DataFrame(detailed_strategy.history)
            
            # Generate comprehensive analysis
            recommendations = generate_analysis_report(results_df, strategy_history, save_plots=True)
            
            # Step 5: Smart Contract Recommendations
            print("\n🔧 Step 5: Smart Contract Implementation Recommendations")
            print("=" * 60)
            
            optimal_threshold_pct = recommendations['optimal_threshold_pct']
            basis_points = int(round(optimal_threshold_pct * 10000 / 100))  # percent to bps
            hybrid_at_target = run_hybrid_simulation(eth_data, btc_data, threshold=DEFAULT_THRESHOLD)
            
            print(f"📝 RECOMMENDED SMART CONTRACT PARAMETERS:")
            print(f"   - REBALANCE_THRESHOLD: 80 basis points (0.8%, STRATEGY_REVISION.md)")
            print(f"   - IL_EXPOSURE_BPS: 3000 (30%)")
            print(f"   - SYNTHETIC_EXPOSURE_BPS: 7000 (70%)")
            print(f"   - Hybrid volatility at 0.8%: {hybrid_at_target.value_volatility_pct:.3f}%")
            print(f"   - Hybrid rebalances/day at 0.8%: {hybrid_at_target.rebalance_frequency_per_day:.1f}")
            print(f"   - Simulation-optimal synthetic threshold: {basis_points} bps ({optimal_threshold_pct:.1f}%)")
            print(f"   - Expected daily rebalances (synthetic-only sim): {recommendations['expected_rebalances_per_day']:.1f}")
            print(f"   - Expected annual costs (synthetic-only sim): {recommendations['expected_cost_ratio_pct']:.2f}% of TVL")
            print(f"   - Expected stablecoin volatility (synthetic-only sim): {recommendations['expected_volatility_pct']:.3f}%")
            
            solidity_update = f"""
// IMPLEMENTED IN AvalancheLSTStrategy.sol (STRATEGY_REVISION.md)
uint256 public rebalanceDeviationThreshold = 80; // 0.8%
uint256 public ilExposureBps = 3000; // 30% IL
uint256 public constant DEFAULT_SYNTHETIC_EXPOSURE_BPS = 7000; // 70% synthetic
bool public emergencySyntheticOnly; // fallback to 100% synthetic
uint256 public volatilityCircuitBreakerBps = 500; // reduce IL above 5% observed move

// Simulation benchmark at 0.8% hybrid threshold:
// - Value volatility: {hybrid_at_target.value_volatility_pct:.3f}%
// - Rebalances/day: {hybrid_at_target.rebalance_frequency_per_day:.1f}
// - Cost ratio: {hybrid_at_target.cost_ratio_pct:.3f}%
            """
            
            print(f"\n💻 SOLIDITY CODE UPDATE:")
            print(solidity_update)
            
            # Save results
            results_df.to_csv('simulation_results.csv', index=False)
            strategy_history.to_csv('detailed_strategy_history.csv', index=False)
            
            with open('smart_contract_recommendations.txt', 'w') as f:
                f.write("FORCE FINANCE DELTA-NEUTRAL STRATEGY ANALYSIS\n")
                f.write("=" * 50 + "\n\n")
                f.write(f"Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Data Period: {len(common_index)} hours of real market data\n\n")
                f.write("RECOMMENDED PARAMETERS:\n")
                f.write(f"- Rebalancing Threshold: {optimal_threshold_pct:.1f}% ({basis_points} basis points)\n")
                f.write(f"- Expected Stablecoin Volatility: {recommendations['expected_volatility_pct']:.3f}%\n")
                f.write(f"- Expected Daily Rebalances: {recommendations['expected_rebalances_per_day']:.1f}\n")
                f.write(f"- Expected Annual Costs: {recommendations['expected_cost_ratio_pct']:.2f}% of TVL\n\n")
                f.write("SOLIDITY UPDATE:\n")
                f.write(solidity_update)
            
            print(f"\n💾 Results saved:")
            print(f"   - simulation_results.csv")
            print(f"   - detailed_strategy_history.csv") 
            print(f"   - smart_contract_recommendations.txt")
            print(f"   - threshold_analysis.png")
            print(f"   - strategy_performance.png")
            
            return recommendations
        
        else:
            print("❌ No simulation results generated")
            return None
            
    except Exception as e:
        print(f"❌ Simulation failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def run_quick_test():
    """Run a quick test with limited data for development"""
    print("🧪 Running quick test simulation...")
    
    try:
        fetcher = CryptoDataFetcher()
        eth_data = fetcher.get_crypto_data('ETH', period_days=7)  # 1 week
        btc_data = fetcher.get_crypto_data('BTC', period_days=7)
        
        # Test just a few thresholds
        results_df = compare_thresholds(eth_data, btc_data, [0.01, 0.02, 0.05])
        
        if len(results_df) > 0:
            print("\n✅ Quick test completed successfully!")
            print("Results:")
            print(results_df[['threshold', 'value_volatility_pct', 'rebalance_count', 'cost_ratio_pct']].round(3))
            return True
        else:
            print("❌ Quick test failed")
            return False
            
    except Exception as e:
        print(f"❌ Quick test failed: {e}")
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Run Delta-Neutral Strategy Simulation')
    parser.add_argument('--quick', action='store_true', help='Run quick test with limited data')
    parser.add_argument('--no-plots', action='store_true', help='Skip plot generation')
    
    args = parser.parse_args()
    
    if args.quick:
        success = run_quick_test()
        sys.exit(0 if success else 1)
    else:
        recommendations = main()
        sys.exit(0 if recommendations else 1)
