"""
Hybrid delta-neutral strategy simulation (STRATEGY_REVISION.md)

Combines:
- 30% impermanent-loss exposure (Uniswap-style LP leg)
- 70% synthetic short exposure (GMX/perp leg)
- 0.8% default rebalance threshold
"""

from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np
import pandas as pd

from delta_neutral_strategy import DeltaNeutralStrategy, run_simulation
from impermanent_loss_strategy import ILDeltaNeutralStrategy, run_il_simulation


DEFAULT_IL_RATIO = 0.30
DEFAULT_SYNTHETIC_RATIO = 0.70
DEFAULT_THRESHOLD = 0.008  # 0.8%


@dataclass
class HybridStrategyResult:
    threshold: float
    il_ratio: float
    synthetic_ratio: float
    value_volatility_pct: float
    rebalance_frequency_per_day: float
    cost_ratio_pct: float
    value_change_pct: float
    max_asset_deviation: float


def run_hybrid_simulation(
    eth_data: pd.DataFrame,
    btc_data: pd.DataFrame,
    threshold: float = DEFAULT_THRESHOLD,
    il_ratio: float = DEFAULT_IL_RATIO,
    synthetic_ratio: float = DEFAULT_SYNTHETIC_RATIO,
) -> HybridStrategyResult:
    """Run weighted hybrid of IL and synthetic short simulations."""
    synthetic_ratio = synthetic_ratio
    il_ratio = il_ratio
    total = il_ratio + synthetic_ratio
    if total <= 0:
        raise ValueError("Exposure ratios must sum to a positive value")

    il_weight = il_ratio / total
    synthetic_weight = synthetic_ratio / total

    synthetic = run_simulation(eth_data, btc_data, threshold)
    il_based = run_il_simulation(eth_data, btc_data, threshold)

    synthetic_metrics = synthetic.get_performance_metrics()
    il_metrics = il_based.get_performance_metrics()

    def blend(key: str) -> float:
        return (synthetic_metrics.get(key, 0) * synthetic_weight) + (il_metrics.get(key, 0) * il_weight)

    return HybridStrategyResult(
        threshold=threshold,
        il_ratio=il_ratio,
        synthetic_ratio=synthetic_ratio,
        value_volatility_pct=blend("value_volatility_pct"),
        rebalance_frequency_per_day=blend("rebalance_frequency_per_day"),
        cost_ratio_pct=blend("cost_ratio_pct"),
        value_change_pct=blend("value_change_pct"),
        max_asset_deviation=blend("max_asset_deviation"),
    )


def compare_hybrid_thresholds(
    eth_data: pd.DataFrame,
    btc_data: pd.DataFrame,
    thresholds=None,
) -> pd.DataFrame:
    if thresholds is None:
        thresholds = [0.005, 0.008, 0.01, 0.015, 0.02]

    rows = []
    for threshold in thresholds:
        result = run_hybrid_simulation(eth_data, btc_data, threshold=threshold)
        rows.append(
            {
                "strategy_type": "Hybrid",
                "threshold": threshold,
                "il_ratio": result.il_ratio,
                "synthetic_ratio": result.synthetic_ratio,
                "value_volatility_pct": result.value_volatility_pct,
                "rebalance_frequency_per_day": result.rebalance_frequency_per_day,
                "cost_ratio_pct": result.cost_ratio_pct,
                "value_change_pct": result.value_change_pct,
                "max_asset_deviation": result.max_asset_deviation,
            }
        )
    return pd.DataFrame(rows)
