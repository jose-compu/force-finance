"""
FORCE FINANCE DELTA-NEUTRAL STRATEGY WITH PROPER IMPERMANENT LOSS MODELING

This implementation properly models impermanent loss from Uniswap V3 LP positions
as the source of synthetic short exposure, rather than using simplified synthetic positions.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from dataclasses import dataclass
import warnings
warnings.filterwarnings('ignore')

@dataclass
class LPPosition:
    """Represents a Uniswap V3 LP position with proper IL calculation"""
    token0_symbol: str
    token1_symbol: str
    token0_amount_initial: float
    token1_amount_initial: float
    token0_price_initial: float
    token1_price_initial: float
    liquidity: float
    
    def calculate_il_and_value(self, token0_price_current: float, token1_price_current: float) -> Tuple[float, float, float]:
        """
        Calculate impermanent loss and current value of LP position
        
        Returns:
        - impermanent_loss: IL as a fraction (negative = loss)
        - current_value: Current USD value of LP position
        - hodl_value: Value if tokens were held separately
        """
        # Calculate price ratio
        price_ratio = token0_price_current / self.token0_price_initial
        
        # For 50/50 pools, IL formula: 2*sqrt(price_ratio) / (1 + price_ratio) - 1
        sqrt_ratio = np.sqrt(price_ratio)
        il_factor = 2 * sqrt_ratio / (1 + price_ratio)
        impermanent_loss = il_factor - 1  # This will be negative for losses
        
        # Calculate initial value (USD)
        initial_value = (self.token0_amount_initial * self.token0_price_initial + 
                        self.token1_amount_initial * self.token1_price_initial)
        
        # Calculate HODL value (if tokens were held separately)
        hodl_value = (self.token0_amount_initial * token0_price_current + 
                     self.token1_amount_initial * token1_price_current)
        
        # Current LP value = HODL value + IL
        current_value = hodl_value * (1 + impermanent_loss)
        
        return impermanent_loss, current_value, hodl_value

@dataclass
class AssetPosition:
    """Enhanced position with proper IL modeling"""
    asset: str
    long_amount: float
    current_price: float
    lp_positions: List[LPPosition]
    
    @property
    def long_value(self) -> float:
        return self.long_amount * self.current_price
    
    @property
    def total_il(self) -> float:
        """Total impermanent loss from all LP positions"""
        total_il = 0
        for lp in self.lp_positions:
            if self.asset == 'ETH':
                il, _, _ = lp.calculate_il_and_value(self.current_price, 2000)  # ETH/USDC pool
            else:  # BTC
                il, _, _ = lp.calculate_il_and_value(self.current_price, 50000)  # BTC/USDC pool
            total_il += il
        return total_il
    
    @property
    def short_exposure_from_il(self) -> float:
        """Calculate effective short exposure from IL"""
        # IL acts as synthetic short - losses increase with price movements
        base_exposure = sum(lp.token0_amount_initial * lp.token0_price_initial + 
                           lp.token1_amount_initial * lp.token1_price_initial 
                           for lp in self.lp_positions)
        
        # IL creates convex loss profile (short gamma)
        il_exposure = base_exposure * abs(self.total_il)
        return base_exposure + il_exposure
    
    @property
    def delta(self) -> float:
        """Calculate position delta including IL effects"""
        total_exposure = self.long_value + self.short_exposure_from_il
        if total_exposure == 0:
            return 0
        net_exposure = self.long_value - self.short_exposure_from_il
        return net_exposure / total_exposure

class ILDeltaNeutralStrategy:
    """Delta-neutral strategy using impermanent loss for short exposure"""
    
    def __init__(self, initial_capital: float = 1000000, rebalance_threshold: float = 0.005,
                 target_allocation: Dict[str, float] = None):
        self.initial_capital = initial_capital
        self.rebalance_threshold = rebalance_threshold
        self.target_allocation = target_allocation or {'ETH': 0.5, 'BTC': 0.3, 'CASH': 0.2}
        
        # Strategy state
        self.cash = initial_capital * self.target_allocation['CASH']
        self.total_value = initial_capital
        self.positions = {}
        self.history = []
        
        # Performance tracking
        self.rebalance_count = 0
        self.total_rebalance_costs = 0
        self.max_deviation = 0
        self.rebalance_cost_bps = 0.0005  # 5 bps per rebalance
        
    def initialize_positions(self, eth_price: float, btc_price: float):
        """Initialize positions with LP positions for IL exposure"""
        eth_allocation = self.initial_capital * self.target_allocation['ETH']
        btc_allocation = self.initial_capital * self.target_allocation['BTC']
        
        # Create ETH position with ETH/USDC LP
        eth_long_amount = eth_allocation / eth_price
        
        # Create ETH/USDC LP position for short exposure
        # For 50/50 pool, we provide equal USD value of ETH and USDC
        lp_value = eth_allocation  # Use same allocation for LP
        eth_for_lp = lp_value / (2 * eth_price)
        usdc_for_lp = lp_value / 2
        
        eth_lp = LPPosition(
            token0_symbol='ETH',
            token1_symbol='USDC',
            token0_amount_initial=eth_for_lp,
            token1_amount_initial=usdc_for_lp,
            token0_price_initial=eth_price,
            token1_price_initial=1.0,  # USDC = $1
            liquidity=np.sqrt(eth_for_lp * usdc_for_lp)
        )
        
        self.positions['ETH'] = AssetPosition(
            asset='ETH',
            long_amount=eth_long_amount,
            current_price=eth_price,
            lp_positions=[eth_lp]
        )
        
        # Create BTC position with BTC/USDC LP
        btc_long_amount = btc_allocation / btc_price
        
        btc_for_lp = btc_allocation / (2 * btc_price)
        usdc_for_lp_btc = btc_allocation / 2
        
        btc_lp = LPPosition(
            token0_symbol='BTC',
            token1_symbol='USDC',
            token0_amount_initial=btc_for_lp,
            token1_amount_initial=usdc_for_lp_btc,
            token0_price_initial=btc_price,
            token1_price_initial=1.0,
            liquidity=np.sqrt(btc_for_lp * usdc_for_lp_btc)
        )
        
        self.positions['BTC'] = AssetPosition(
            asset='BTC',
            long_amount=btc_long_amount,
            current_price=btc_price,
            lp_positions=[btc_lp]
        )
        
        print(f"Initialized ETH: {eth_long_amount:.4f} ETH @ ${eth_price:.2f}")
        print(f"ETH LP: {eth_for_lp:.4f} ETH + ${usdc_for_lp:.2f} USDC")
        print(f"Initialized BTC: {btc_long_amount:.4f} BTC @ ${btc_price:.2f}")
        print(f"BTC LP: {btc_for_lp:.4f} BTC + ${usdc_for_lp_btc:.2f} USDC")
        
    def update_prices(self, eth_price: float, btc_price: float, timestamp):
        """Update positions with new prices and calculate IL effects"""
        self.positions['ETH'].current_price = eth_price
        self.positions['BTC'].current_price = btc_price
        
        # Calculate total values including IL effects
        total_long_value = sum(pos.long_value for pos in self.positions.values())
        
        # Calculate IL effects for each position
        total_il_pnl = 0
        for pos in self.positions.values():
            for lp in pos.lp_positions:
                if pos.asset == 'ETH':
                    il, current_lp_value, hodl_value = lp.calculate_il_and_value(eth_price, 1.0)
                else:  # BTC
                    il, current_lp_value, hodl_value = lp.calculate_il_and_value(btc_price, 1.0)
                
                # IL creates PnL (usually negative)
                il_pnl = current_lp_value - hodl_value
                total_il_pnl += il_pnl
        
        # Update total portfolio value
        # Long gains/losses + IL effects (which act as short exposure)
        initial_long_value = self.initial_capital * (self.target_allocation['ETH'] + self.target_allocation['BTC'])
        long_pnl = total_long_value - initial_long_value
        
        # Total value = initial cash + long PnL + IL PnL (which offsets long movements)
        self.total_value = self.cash + total_long_value + total_il_pnl
        
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
            'eth_il': self.positions['ETH'].total_il,
            'btc_il': self.positions['BTC'].total_il,
            'total_il_pnl': total_il_pnl,
            'max_deviation': max_asset_deviation,
            'rebalance_count': self.rebalance_count,
            'total_costs': self.total_rebalance_costs,
            'rebalance_threshold': self.rebalance_threshold
        })
    
    def _calculate_portfolio_delta(self) -> float:
        """Calculate overall portfolio delta including IL effects"""
        total_long_value = sum(pos.long_value for pos in self.positions.values())
        total_short_exposure = sum(pos.short_exposure_from_il for pos in self.positions.values())
        total_exposure = total_long_value + total_short_exposure
        
        if total_exposure == 0:
            return 0
        
        net_exposure = total_long_value - total_short_exposure
        return net_exposure / total_exposure
    
    def check_rebalance_needed(self) -> Tuple[bool, float]:
        """Check if rebalancing is needed based on delta deviation"""
        max_deviation = 0
        
        for pos in self.positions.values():
            deviation = abs(pos.delta)
            max_deviation = max(max_deviation, deviation)
        
        needs_rebalance = max_deviation > self.rebalance_threshold
        return needs_rebalance, max_deviation
    
    def rebalance(self) -> float:
        """Rebalance by adjusting LP positions to restore delta neutrality"""
        rebalance_cost = 0
        
        for asset, pos in self.positions.items():
            if abs(pos.delta) > self.rebalance_threshold:
                # In real implementation, would add/remove liquidity from Uniswap
                # Here we simulate the cost and effect
                
                target_lp_value = pos.long_value  # Target 1:1 for delta neutral
                current_lp_value = sum(lp.token0_amount_initial * lp.token0_price_initial + 
                                     lp.token1_amount_initial * lp.token1_price_initial 
                                     for lp in pos.lp_positions)
                
                adjustment = abs(target_lp_value - current_lp_value)
                cost = adjustment * self.rebalance_cost_bps
                rebalance_cost += cost
                
                # Simulate adjusting LP positions (simplified)
                # In reality, would call Uniswap PositionManager
                for lp in pos.lp_positions:
                    scale_factor = target_lp_value / current_lp_value if current_lp_value > 0 else 1
                    lp.token0_amount_initial *= scale_factor
                    lp.token1_amount_initial *= scale_factor
                    lp.liquidity *= scale_factor
        
        self.rebalance_count += 1
        self.total_rebalance_costs += rebalance_cost
        self.cash -= rebalance_cost
        
        return rebalance_cost
    
    def get_performance_metrics(self) -> Dict:
        """Calculate comprehensive performance metrics"""
        if not self.history:
            return {}
        
        df = pd.DataFrame(self.history)
        
        # Value stability (critical for stablecoin)
        value_volatility = df['total_value'].std() / df['total_value'].mean()
        
        # Calculate returns
        df['returns'] = df['total_value'].pct_change()
        sharpe_ratio = df['returns'].mean() / df['returns'].std() if df['returns'].std() > 0 else 0
        
        # Max drawdown
        rolling_max = df['total_value'].expanding().max()
        drawdown = (df['total_value'] - rolling_max) / rolling_max
        max_drawdown = drawdown.min()
        
        # Max appreciation
        rolling_min = df['total_value'].expanding().min()
        appreciation = (df['total_value'] - rolling_min) / rolling_min
        max_appreciation = appreciation.max()
        
        # Rebalancing metrics
        hours_elapsed = len(df)
        days_elapsed = hours_elapsed / 24
        rebalance_frequency = self.rebalance_count / days_elapsed if days_elapsed > 0 else 0
        
        return {
            'final_value': df['total_value'].iloc[-1],
            'value_change_pct': (df['total_value'].iloc[-1] - self.initial_capital) / self.initial_capital * 100,
            'value_volatility_pct': value_volatility * 100,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown_pct': max_drawdown * 100,
            'max_appreciation_pct': max_appreciation * 100,
            'avg_portfolio_delta': df['portfolio_delta'].mean(),
            'max_portfolio_delta': df['portfolio_delta'].abs().max(),
            'avg_il_eth': df['eth_il'].mean(),
            'avg_il_btc': df['btc_il'].mean(),
            'rebalance_count': self.rebalance_count,
            'rebalance_frequency_per_day': rebalance_frequency,
            'total_rebalance_costs': self.total_rebalance_costs,
            'cost_ratio_pct': (self.total_rebalance_costs / self.initial_capital) * 100,
            'max_asset_deviation': self.max_deviation,
            'threshold': self.rebalance_threshold
        }

def run_il_simulation(eth_data: pd.DataFrame, btc_data: pd.DataFrame, 
                      threshold: float = 0.005) -> ILDeltaNeutralStrategy:
    """Run simulation with proper IL modeling"""
    
    # Align timestamps
    eth_aligned = eth_data.set_index('timestamp').resample('1h').last().fillna(method='ffill')
    btc_aligned = btc_data.set_index('timestamp').resample('1h').last().fillna(method='ffill')
    
    # Find common time range
    start_time = max(eth_aligned.index.min(), btc_aligned.index.min())
    end_time = min(eth_aligned.index.max(), btc_aligned.index.max())
    
    eth_aligned = eth_aligned[start_time:end_time]
    btc_aligned = btc_aligned[start_time:end_time]
    
    if len(eth_aligned) == 0 or len(btc_aligned) == 0:
        raise ValueError("No overlapping data found")
    
    # Initialize strategy
    strategy = ILDeltaNeutralStrategy(rebalance_threshold=threshold)
    strategy.initialize_positions(
        eth_aligned['price'].iloc[0],
        btc_aligned['price'].iloc[0]
    )
    
    # Run simulation
    total_points = len(eth_aligned)
    progress_interval = max(1, total_points // 10)
    
    for i, (timestamp, eth_row) in enumerate(eth_aligned.iterrows()):
        if i < len(btc_aligned):
            btc_row = btc_aligned.iloc[i]
            
            # Update prices
            strategy.update_prices(eth_row['price'], btc_row['price'], timestamp)
            
            # Check if rebalancing needed
            needs_rebalance, deviation = strategy.check_rebalance_needed()
            
            if needs_rebalance:
                cost = strategy.rebalance()
                print(f"   ⚖️ Rebalanced at {timestamp}: deviation {deviation:.3f}, cost ${cost:.2f}, IL_ETH {strategy.positions['ETH'].total_il:.3f}")
            
            # Progress update
            if i % progress_interval == 0:
                progress = (i / total_points) * 100
                print(f"   📊 Progress: {progress:.1f}% ({i}/{total_points} data points)")
    
    print(f"   ✅ IL Simulation completed: {total_points} data points processed")
    return strategy

if __name__ == "__main__":
    print("🧪 Testing Impermanent Loss Delta-Neutral Strategy...")
    
    # Test with dummy data
    timestamps = pd.date_range('2025-01-01', periods=100, freq='1h')
    
    # Create realistic price movements
    eth_prices = 2000 * np.exp(np.cumsum(np.random.normal(0, 0.02, 100)))
    btc_prices = 50000 * np.exp(np.cumsum(np.random.normal(0, 0.02, 100)))
    
    eth_data = pd.DataFrame({
        'timestamp': timestamps,
        'price': eth_prices,
        'volatility_24h': np.random.uniform(0.01, 0.05, 100)
    })
    
    btc_data = pd.DataFrame({
        'timestamp': timestamps,
        'price': btc_prices,
        'volatility_24h': np.random.uniform(0.01, 0.05, 100)
    })
    
    # Run test simulation
    strategy = run_il_simulation(eth_data, btc_data, 0.01)
    metrics = strategy.get_performance_metrics()
    
    print(f"\n📊 Test Results:")
    print(f"   Value Volatility: {metrics['value_volatility_pct']:.3f}%")
    print(f"   Average ETH IL: {metrics['avg_il_eth']:.3f}")
    print(f"   Average BTC IL: {metrics['avg_il_btc']:.3f}")
    print(f"   Rebalances: {metrics['rebalance_count']}")
    print(f"   Final Value: ${metrics['final_value']:.2f}")
