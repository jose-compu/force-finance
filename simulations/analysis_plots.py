"""
Visualization and analysis tools for delta-neutral strategy simulation
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.graph_objects as go
import plotly.subplots as sp
from typing import Dict, List
import warnings
warnings.filterwarnings('ignore')

# Set plotting style
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

class AnalysisPlotter:
    """Create comprehensive visualizations for simulation results"""
    
    def __init__(self, figsize=(15, 10)):
        self.figsize = figsize
        
    def plot_threshold_comparison(self, results_df: pd.DataFrame, save_path: str = None):
        """Plot comparison of different rebalancing thresholds"""
        print("   📊 Creating threshold comparison plots...")
        
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle('Delta-Neutral Strategy: Rebalancing Threshold Analysis', fontsize=16, fontweight='bold')
        
        # 1. Value Volatility vs Threshold
        axes[0, 0].plot(results_df['threshold'] * 100, results_df['value_volatility_pct'], 
                       marker='o', linewidth=2, markersize=8, color='red')
        axes[0, 0].set_xlabel('Rebalancing Threshold (%)')
        axes[0, 0].set_ylabel('Value Volatility (%)')
        axes[0, 0].set_title('Stablecoin Value Volatility')
        axes[0, 0].grid(True, alpha=0.3)
        
        # 2. Rebalance Frequency vs Threshold
        axes[0, 1].plot(results_df['threshold'] * 100, results_df['rebalance_frequency_per_day'], 
                       marker='s', linewidth=2, markersize=8, color='blue')
        axes[0, 1].set_xlabel('Rebalancing Threshold (%)')
        axes[0, 1].set_ylabel('Rebalances per Day')
        axes[0, 1].set_title('Rebalancing Frequency')
        axes[0, 1].grid(True, alpha=0.3)
        
        # 3. Total Costs vs Threshold
        axes[0, 2].plot(results_df['threshold'] * 100, results_df['cost_ratio_pct'], 
                       marker='^', linewidth=2, markersize=8, color='green')
        axes[0, 2].set_xlabel('Rebalancing Threshold (%)')
        axes[0, 2].set_ylabel('Total Costs (% of Capital)')
        axes[0, 2].set_title('Rebalancing Costs')
        axes[0, 2].grid(True, alpha=0.3)
        
        # 4. Max Asset Deviation vs Threshold
        axes[1, 0].plot(results_df['threshold'] * 100, results_df['max_asset_deviation'], 
                       marker='d', linewidth=2, markersize=8, color='purple')
        axes[1, 0].set_xlabel('Rebalancing Threshold (%)')
        axes[1, 0].set_ylabel('Maximum Asset Deviation')
        axes[1, 0].set_title('Maximum Delta Deviation')
        axes[1, 0].grid(True, alpha=0.3)
        
        # 5. Value Change vs Threshold
        axes[1, 1].plot(results_df['threshold'] * 100, results_df['value_change_pct'], 
                       marker='o', linewidth=2, markersize=8, color='orange')
        axes[1, 1].axhline(y=0, color='black', linestyle='--', alpha=0.5)
        axes[1, 1].set_xlabel('Rebalancing Threshold (%)')
        axes[1, 1].set_ylabel('Final Value Change (%)')
        axes[1, 1].set_title('Portfolio Value Change')
        axes[1, 1].grid(True, alpha=0.3)
        
        # 6. Efficiency Score (Combined metric)
        if 'overall_score' in results_df.columns:
            axes[1, 2].plot(results_df['threshold'] * 100, results_df['overall_score'], 
                           marker='*', linewidth=2, markersize=10, color='red')
            optimal_idx = results_df['overall_score'].idxmax()
            axes[1, 2].axvline(x=results_df.loc[optimal_idx, 'threshold'] * 100, 
                              color='red', linestyle='--', alpha=0.7, linewidth=2)
            axes[1, 2].set_xlabel('Rebalancing Threshold (%)')
            axes[1, 2].set_ylabel('Overall Efficiency Score')
            axes[1, 2].set_title('Optimal Threshold Analysis')
            axes[1, 2].grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            print(f"   💾 Saving threshold analysis plot to {save_path}...")
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"   ✅ Threshold plot saved successfully")
        else:
            plt.show()
        
        plt.close()  # Close the figure to free memory
    
    def plot_strategy_performance(self, strategy_history: pd.DataFrame, save_path: str = None):
        """Plot detailed performance metrics for a single strategy"""
        print("   📊 Creating strategy performance plots...")
        
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        fig.suptitle('Delta-Neutral Strategy Performance Over Time', fontsize=16, fontweight='bold')
        
        # Convert timestamp to datetime if needed
        if 'timestamp' in strategy_history.columns:
            strategy_history['timestamp'] = pd.to_datetime(strategy_history['timestamp'])
            strategy_history.set_index('timestamp', inplace=True)
        
        # 1. Portfolio Value Over Time
        axes[0, 0].plot(strategy_history.index, strategy_history['total_value'], 
                       linewidth=2, color='navy', label='Portfolio Value')
        axes[0, 0].axhline(y=strategy_history['total_value'].iloc[0], 
                          color='red', linestyle='--', alpha=0.7, label='Initial Value')
        axes[0, 0].set_ylabel('Portfolio Value ($)')
        axes[0, 0].set_title('Portfolio Value Stability')
        axes[0, 0].legend()
        axes[0, 0].grid(True, alpha=0.3)
        
        # 2. Delta Tracking
        axes[0, 1].plot(strategy_history.index, strategy_history['portfolio_delta'], 
                       linewidth=2, color='green', label='Portfolio Delta')
        axes[0, 1].axhline(y=0, color='black', linestyle='-', alpha=0.5, label='Target (0)')
        axes[0, 1].set_ylabel('Portfolio Delta')
        axes[0, 1].set_title('Delta Neutrality Tracking')
        axes[0, 1].legend()
        axes[0, 1].grid(True, alpha=0.3)
        
        # 3. Asset Deltas
        axes[1, 0].plot(strategy_history.index, strategy_history['eth_delta'], 
                       linewidth=2, color='blue', label='ETH Delta', alpha=0.8)
        axes[1, 0].plot(strategy_history.index, strategy_history['btc_delta'], 
                       linewidth=2, color='orange', label='BTC Delta', alpha=0.8)
        axes[1, 0].axhline(y=0, color='black', linestyle='-', alpha=0.5)
        axes[1, 0].set_ylabel('Asset Delta')
        axes[1, 0].set_title('Individual Asset Deltas')
        axes[1, 0].legend()
        axes[1, 0].grid(True, alpha=0.3)
        
        # 4. Maximum Deviation Over Time
        axes[1, 1].plot(strategy_history.index, strategy_history['max_deviation'], 
                       linewidth=2, color='purple', label='Max Deviation')
        if 'rebalance_threshold' in strategy_history.columns:
            threshold = strategy_history['rebalance_threshold'].iloc[0]
            axes[1, 1].axhline(y=threshold, color='red', linestyle='--', alpha=0.7, 
                              label=f'Threshold ({threshold:.1%})')
        axes[1, 1].set_ylabel('Maximum Asset Deviation')
        axes[1, 1].set_title('Deviation from Delta Neutrality')
        axes[1, 1].legend()
        axes[1, 1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            print(f"   💾 Saving strategy performance plot to {save_path}...")
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"   ✅ Strategy plot saved successfully")
        else:
            plt.show()
        
        plt.close()  # Close the figure to free memory
    
    def create_interactive_dashboard(self, results_df: pd.DataFrame, strategy_history: pd.DataFrame = None):
        """Create an interactive Plotly dashboard"""
        fig = sp.make_subplots(
            rows=3, cols=2,
            subplot_titles=['Value Volatility vs Threshold', 'Rebalancing Frequency vs Threshold',
                           'Costs vs Threshold', 'Portfolio Value Over Time',
                           'Delta Tracking', 'Rebalancing Events'],
            specs=[[{"type": "scatter"}, {"type": "scatter"}],
                   [{"type": "scatter"}, {"type": "scatter"}],
                   [{"type": "scatter"}, {"type": "scatter"}]]
        )
        
        # Threshold analysis plots
        fig.add_trace(
            go.Scatter(x=results_df['threshold'] * 100, y=results_df['value_volatility_pct'],
                      mode='lines+markers', name='Value Volatility',
                      line=dict(color='red', width=3), marker=dict(size=8)),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Scatter(x=results_df['threshold'] * 100, y=results_df['rebalance_frequency_per_day'],
                      mode='lines+markers', name='Rebalance Frequency',
                      line=dict(color='blue', width=3), marker=dict(size=8)),
            row=1, col=2
        )
        
        fig.add_trace(
            go.Scatter(x=results_df['threshold'] * 100, y=results_df['cost_ratio_pct'],
                      mode='lines+markers', name='Cost Ratio',
                      line=dict(color='green', width=3), marker=dict(size=8)),
            row=2, col=1
        )
        
        # If strategy history is provided, add time series plots
        if strategy_history is not None:
            if 'timestamp' in strategy_history.columns:
                x_time = strategy_history['timestamp']
            else:
                x_time = strategy_history.index
            
            fig.add_trace(
                go.Scatter(x=x_time, y=strategy_history['total_value'],
                          mode='lines', name='Portfolio Value',
                          line=dict(color='navy', width=2)),
                row=2, col=2
            )
            
            fig.add_trace(
                go.Scatter(x=x_time, y=strategy_history['portfolio_delta'],
                          mode='lines', name='Portfolio Delta',
                          line=dict(color='purple', width=2)),
                row=3, col=1
            )
            
            fig.add_trace(
                go.Scatter(x=x_time, y=strategy_history['max_deviation'],
                          mode='lines', name='Max Deviation',
                          line=dict(color='orange', width=2)),
                row=3, col=2
            )
        
        fig.update_layout(
            title_text="Delta-Neutral Strategy Analysis Dashboard",
            title_x=0.5,
            height=1000,
            showlegend=True
        )
        
        return fig
    
    def create_summary_table(self, results_df: pd.DataFrame) -> pd.DataFrame:
        """Create a formatted summary table"""
        summary = results_df.copy()
        
        # Format columns for display
        summary['Threshold (%)'] = (summary['threshold'] * 100).round(1)
        summary['Value Volatility (%)'] = summary['value_volatility_pct'].round(3)
        summary['Rebalances/Day'] = summary['rebalance_frequency_per_day'].round(2)
        summary['Cost Ratio (%)'] = summary['cost_ratio_pct'].round(3)
        summary['Max Deviation'] = summary['max_asset_deviation'].round(3)
        summary['Final Value Change (%)'] = summary['value_change_pct'].round(3)
        
        # Select and reorder columns
        display_cols = ['Threshold (%)', 'Value Volatility (%)', 'Rebalances/Day', 
                       'Cost Ratio (%)', 'Max Deviation', 'Final Value Change (%)']
        
        return summary[display_cols]

def generate_analysis_report(results_df: pd.DataFrame, 
                           strategy_history: pd.DataFrame = None,
                           save_plots: bool = True) -> Dict:
    """Generate a comprehensive analysis report"""
    
    plotter = AnalysisPlotter()
    
    # Create visualizations
    if save_plots:
        plotter.plot_threshold_comparison(results_df, 'threshold_analysis.png')
        if strategy_history is not None:
            plotter.plot_strategy_performance(strategy_history, 'strategy_performance.png')
    else:
        plotter.plot_threshold_comparison(results_df)
        if strategy_history is not None:
            plotter.plot_strategy_performance(strategy_history)
    
    # Create summary table
    summary_table = plotter.create_summary_table(results_df)
    
    # Find optimal threshold
    if 'overall_score' in results_df.columns:
        optimal_idx = results_df['overall_score'].idxmax()
        optimal_threshold = results_df.loc[optimal_idx, 'threshold']
        optimal_metrics = results_df.loc[optimal_idx]
    else:
        # Simple heuristic: minimize volatility while keeping costs reasonable
        results_df['simple_score'] = (1 / results_df['value_volatility_pct']) * (1 / (1 + results_df['cost_ratio_pct']))
        optimal_idx = results_df['simple_score'].idxmax()
        optimal_threshold = results_df.loc[optimal_idx, 'threshold']
        optimal_metrics = results_df.loc[optimal_idx]
    
    # Generate recommendations
    recommendations = {
        'optimal_threshold_pct': optimal_threshold * 100,
        'optimal_threshold_decimal': optimal_threshold,
        'expected_volatility_pct': optimal_metrics['value_volatility_pct'],
        'expected_rebalances_per_day': optimal_metrics['rebalance_frequency_per_day'],
        'expected_cost_ratio_pct': optimal_metrics['cost_ratio_pct'],
        'summary_table': summary_table,
        'full_results': results_df
    }
    
    # Print summary
    print("\n" + "="*60)
    print("DELTA-NEUTRAL STRATEGY ANALYSIS SUMMARY")
    print("="*60)
    print(f"📊 Optimal Rebalancing Threshold: {optimal_threshold*100:.1f}%")
    print(f"📈 Expected Value Volatility: {optimal_metrics['value_volatility_pct']:.3f}%")
    print(f"🔄 Expected Rebalances per Day: {optimal_metrics['rebalance_frequency_per_day']:.2f}")
    print(f"💰 Expected Cost Ratio: {optimal_metrics['cost_ratio_pct']:.3f}%")
    print(f"⚡ Maximum Asset Deviation: {optimal_metrics['max_asset_deviation']:.3f}")
    print("\n📋 Summary Table:")
    print(summary_table.to_string(index=False))
    
    return recommendations

if __name__ == "__main__":
    # This would be run as part of the main simulation
    print("Analysis and plotting utilities loaded successfully!")
    print("Run the main simulation to generate plots and analysis.")
