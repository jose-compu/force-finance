"""
Delta-Neutral Stablecoin Strategy Simulation
Simulates the Force Finance stablecoin with different rebalancing thresholds
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from dataclasses import dataclass
from typing import Dict, List, Tuple
import warnings
warnings.filterwarnings('ignore')

@dataclass
class Position:
    """Represents a position in the portfolio"""
    asset: str
    long_amount: float  # Amount of asset held long
    short_exposure: float  # USD value of short exposure
    current_price: float
    
    @property
    def long_value(self) -> float:
        """Current USD value of long position"""
        return self.long_amount * self.current_price
    
    @property
    def net_exposure(self) -> float:
        """Net exposure (long - short) in USD"""
        return self.long_value - self.short_exposure
    
    @property
    def delta(self) -> float:
        """Position delta: net_exposure / total_value"""
        total_value = self.long_value + self.short_exposure
        if total_value == 0:
            return 0
        return self.net_exposure / total_value

class DeltaNeutralStrategy:
    """Simulates a delta-neutral stablecoin strategy"""
    
    def __init__(self, 
                 initial_capital: float = 1_000_000,  # $1M initial
                 rebalance_threshold: float = 0.05,   # 5% deviation threshold
                 rebalance_cost_bps: float = 5,       # 5 basis points cost per rebalance
                 target_allocation: Dict[str, float] = None):
        
        self.initial_capital = initial_capital
        self.rebalance_threshold = rebalance_threshold
        self.rebalance_cost_bps = rebalance_cost_bps / 10000  # Convert to decimal
        
        # Default allocation: 50% ETH, 30% BTC, 20% Cash
        self.target_allocation = target_allocation or {'ETH': 0.5, 'BTC': 0.3, 'Cash': 0.2}
        
        # Initialize positions
        self.positions = {}
        self.cash = initial_capital * self.target_allocation['Cash']
        self.total_value = initial_capital
        
        # Tracking metrics
        self.rebalance_count = 0
        self.total_rebalance_costs = 0
        self.max_deviation = 0
        self.history = []
        
    def initialize_positions(self, eth_price: float, btc_price: float):
        """Initialize starting positions"""
        eth_allocation = self.initial_capital * self.target_allocation['ETH']
        btc_allocation = self.initial_capital * self.target_allocation['BTC']
        
        # Create delta-neutral positions
        # For each asset: buy spot, short equivalent amount
        self.positions['ETH'] = Position(
            asset='ETH',
            long_amount=eth_allocation / eth_price,
            short_exposure=eth_allocation,  # Short same USD amount
            current_price=eth_price
        )
        
        self.positions['BTC'] = Position(
            asset='BTC',
            long_amount=btc_allocation / btc_price,
            short_exposure=btc_allocation,  # Short same USD amount
            current_price=btc_price
        )
        
        print(f"Initialized with ETH: {self.positions['ETH'].long_amount:.4f} @ ${eth_price:.2f}")
        print(f"Initialized with BTC: {self.positions['BTC'].long_amount:.4f} @ ${btc_price:.2f}")
        print(f"Initial cash: ${self.cash:.2f}")
    
    def update_prices(self, eth_price: float, btc_price: float, timestamp):
        """Update positions with new prices"""
        self.positions['ETH'].current_price = eth_price
        self.positions['BTC'].current_price = btc_price
        
        # Calculate total portfolio value
        total_long_value = sum(pos.long_value for pos in self.positions.values())
        total_short_exposure = sum(pos.short_exposure for pos in self.positions.values())
        
        # PnL from long positions
        long_pnl = total_long_value - self.initial_capital * (self.target_allocation['ETH'] + self.target_allocation['BTC'])
        
        # PnL from short positions (inverse of price movement)
        initial_short_value = self.initial_capital * (self.target_allocation['ETH'] + self.target_allocation['BTC'])
        short_pnl = initial_short_value - total_short_exposure  # Simplified: assumes perfect hedge
        
        # Update total value (should remain stable if delta-neutral)
        self.total_value = self.cash + total_long_value + short_pnl
        
        # Calculate portfolio delta
        portfolio_delta = self._calculate_portfolio_delta()
        
        # Track maximum deviation
        max_asset_deviation = max(abs(pos.delta) for pos in self.positions.values())
        self.max_deviation = max(self.max_deviation, max_asset_deviation)
        
        # Record history
        self.history.append({
            'timestamp': timestamp,
            'total_value': self.total_value,
            'portfolio_delta': portfolio_delta,
            'eth_delta': self.positions['ETH'].delta,
            'btc_delta': self.positions['BTC'].delta,
            'eth_price': eth_price,
            'btc_price': btc_price,
            'max_deviation': max_asset_deviation,
            'rebalance_count': self.rebalance_count,
            'total_costs': self.total_rebalance_costs
        })
    
    def _calculate_portfolio_delta(self) -> float:
        """Calculate overall portfolio delta"""
        total_long_value = sum(pos.long_value for pos in self.positions.values())
        total_short_exposure = sum(pos.short_exposure for pos in self.positions.values())
        total_exposure = total_long_value + total_short_exposure
        
        if total_exposure == 0:
            return 0
        
        net_exposure = total_long_value - total_short_exposure
        return net_exposure / total_exposure
    
    def check_rebalance_needed(self) -> Tuple[bool, float]:
        """Check if rebalancing is needed"""
        max_deviation = 0
        
        for pos in self.positions.values():
            deviation = abs(pos.delta)  # Target delta is 0
            max_deviation = max(max_deviation, deviation)
        
        needs_rebalance = max_deviation > self.rebalance_threshold
        return needs_rebalance, max_deviation
    
    def rebalance(self) -> float:
        """Perform rebalancing to restore delta neutrality"""
        rebalance_cost = 0
        
        for asset, pos in self.positions.items():
            if abs(pos.delta) > self.rebalance_threshold:
                # Calculate required adjustment
                target_short_exposure = pos.long_value  # Perfect delta neutral
                adjustment = abs(target_short_exposure - pos.short_exposure)
                
                # Apply rebalancing cost
                cost = adjustment * self.rebalance_cost_bps
                rebalance_cost += cost
                
                # Update short exposure
                pos.short_exposure = target_short_exposure
        
        self.rebalance_count += 1
        self.total_rebalance_costs += rebalance_cost
        self.cash -= rebalance_cost  # Costs come from cash
        
        return rebalance_cost
    
    def get_performance_metrics(self) -> Dict:
        """Calculate performance metrics"""
        df = pd.DataFrame(self.history)
        
        if len(df) == 0:
            return {}
        
        # Value stability (lower is better for stablecoin)
        value_volatility = df['total_value'].std() / df['total_value'].mean()
        max_drawdown = (df['total_value'].min() - self.initial_capital) / self.initial_capital
        max_appreciation = (df['total_value'].max() - self.initial_capital) / self.initial_capital
        
        # Delta tracking
        avg_portfolio_delta = df['portfolio_delta'].abs().mean()
        max_portfolio_delta = df['portfolio_delta'].abs().max()
        
        # Rebalancing efficiency
        rebalance_frequency = self.rebalance_count / len(df) * 24  # per day assuming hourly data
        cost_ratio = self.total_rebalance_costs / self.initial_capital
        
        return {
            'final_value': df['total_value'].iloc[-1],
            'value_change_pct': (df['total_value'].iloc[-1] - self.initial_capital) / self.initial_capital * 100,
            'value_volatility_pct': value_volatility * 100,
            'max_drawdown_pct': max_drawdown * 100,
            'max_appreciation_pct': max_appreciation * 100,
            'avg_portfolio_delta': avg_portfolio_delta,
            'max_portfolio_delta': max_portfolio_delta,
            'rebalance_count': self.rebalance_count,
            'rebalance_frequency_per_day': rebalance_frequency,
            'total_rebalance_costs': self.total_rebalance_costs,
            'cost_ratio_pct': cost_ratio * 100,
            'max_asset_deviation': self.max_deviation
        }

def run_simulation(eth_data: pd.DataFrame, 
                   btc_data: pd.DataFrame,
                   rebalance_threshold: float = 0.05,
                   initial_capital: float = 1_000_000) -> DeltaNeutralStrategy:
    """Run a complete simulation with given parameters"""
    
    # Align data by timestamp
    common_index = eth_data.index.intersection(btc_data.index)
    eth_aligned = eth_data.loc[common_index]
    btc_aligned = btc_data.loc[common_index]
    
    if len(common_index) < 100:
        raise ValueError("Insufficient overlapping data points")
    
    # Initialize strategy
    strategy = DeltaNeutralStrategy(
        initial_capital=initial_capital,
        rebalance_threshold=rebalance_threshold,
        rebalance_cost_bps=5  # 5 basis points
    )
    
    # Initialize with first prices
    strategy.initialize_positions(
        eth_aligned['price'].iloc[0],
        btc_aligned['price'].iloc[0]
    )
    
    print(f"Running simulation with {len(common_index)} data points...")
    print(f"Rebalance threshold: {rebalance_threshold*100:.1f}%")
    
    # Run simulation
    total_points = len(common_index)
    print_interval = max(1, total_points // 10)  # Print progress 10 times
    
    for i, timestamp in enumerate(common_index):
        # Progress reporting
        if i % print_interval == 0:
            progress = (i / total_points) * 100
            print(f"   📊 Progress: {progress:.1f}% ({i}/{total_points} data points)")
        
        eth_price = eth_aligned.loc[timestamp, 'price']
        btc_price = btc_aligned.loc[timestamp, 'price']
        
        # Update prices
        strategy.update_prices(eth_price, btc_price, timestamp)
        
        # Check if rebalancing is needed
        needs_rebalance, deviation = strategy.check_rebalance_needed()
        
        if needs_rebalance:
            cost = strategy.rebalance()
            print(f"   ⚖️ Rebalanced at {timestamp}: deviation {deviation:.3f}, cost ${cost:.2f}")
    
    print(f"   ✅ Simulation completed: {total_points} data points processed")
    
    return strategy

def compare_thresholds(eth_data: pd.DataFrame, 
                      btc_data: pd.DataFrame,
                      thresholds: List[float] = [0.005, 0.01, 0.02, 0.05, 0.1]) -> pd.DataFrame:
    """Compare different rebalancing thresholds"""
    
    results = []
    
    for threshold in thresholds:
        print(f"\n{'='*50}")
        print(f"Testing threshold: {threshold*100:.1f}%")
        print(f"{'='*50}")
        
        try:
            strategy = run_simulation(eth_data, btc_data, threshold)
            metrics = strategy.get_performance_metrics()
            metrics['threshold'] = threshold
            results.append(metrics)
            
            print(f"Results for {threshold*100:.1f}% threshold:")
            print(f"  Value change: {metrics['value_change_pct']:.3f}%")
            print(f"  Value volatility: {metrics['value_volatility_pct']:.3f}%")
            print(f"  Rebalances: {metrics['rebalance_count']}")
            print(f"  Total costs: ${metrics['total_rebalance_costs']:.2f}")
            print(f"  Max deviation: {metrics['max_asset_deviation']:.3f}")
            
        except Exception as e:
            print(f"Error with threshold {threshold}: {e}")
    
    return pd.DataFrame(results)

def main():
    """Main simulation runner"""
    from data_fetcher import CryptoDataFetcher
    
    print("Starting Delta-Neutral Strategy Simulation")
    print("="*50)
    
    # Fetch data
    fetcher = CryptoDataFetcher()
    eth_data = fetcher.get_crypto_data('ETH', period_days=60)  # 2 months
    btc_data = fetcher.get_crypto_data('BTC', period_days=60)
    
    # Run threshold comparison
    results_df = compare_thresholds(eth_data, btc_data)
    
    # Display results
    print("\n" + "="*80)
    print("SIMULATION RESULTS SUMMARY")
    print("="*80)
    
    print(results_df[['threshold', 'value_change_pct', 'value_volatility_pct', 
                     'rebalance_count', 'cost_ratio_pct', 'max_asset_deviation']].round(3))
    
    # Find optimal threshold
    # Score based on: low volatility, low costs, reasonable rebalance frequency
    results_df['volatility_score'] = 1 / (1 + results_df['value_volatility_pct'])
    results_df['cost_score'] = 1 / (1 + results_df['cost_ratio_pct'])
    results_df['frequency_score'] = np.exp(-results_df['rebalance_frequency_per_day'] / 10)  # Penalize high frequency
    results_df['overall_score'] = (results_df['volatility_score'] * 
                                  results_df['cost_score'] * 
                                  results_df['frequency_score'])
    
    best_threshold = results_df.loc[results_df['overall_score'].idxmax(), 'threshold']
    
    print(f"\n🎯 RECOMMENDED THRESHOLD: {best_threshold*100:.1f}%")
    print(f"   This threshold provides the best balance of:")
    print(f"   - Low value volatility")
    print(f"   - Reasonable rebalancing costs")
    print(f"   - Manageable rebalancing frequency")
    
    return results_df, best_threshold

if __name__ == "__main__":
    results_df, optimal_threshold = main()
