import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContracts } from '../contexts/ContractContext';
import Icon from './Icon';

const Rebalancer = () => {
  const { isConnected } = useWallet();
  const { triggerRebalance, getRebalanceInfo } = useContracts();
  
  const [rebalanceData, setRebalanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Mock data for rebalancer stats (in production, fetch from contracts)
  const [rebalancerStats] = useState({
    totalRewards: 0.25,
    rebalanceCount: 3,
    successRate: 100,
    avgReward: 0.083,
    rank: 15,
    lastRebalance: '2 hours ago'
  });

  // Refresh rebalance data
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getRebalanceInfo();
      setRebalanceData(data);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Error refreshing rebalance data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [getRebalanceInfo]);

  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Handle rebalance trigger
  const handleRebalance = async () => {
    if (!rebalanceData?.needsRebalance) {
      alert('Rebalancing is not currently needed');
      return;
    }

    setLoading(true);
    try {
      await triggerRebalance();
      alert('Rebalancing triggered successfully! Reward will be distributed.');
      await refreshData();
    } catch (error) {
      console.error('Rebalance error:', error);
      alert('Rebalancing failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center justify-center">
            <Icon name="rebalancer" size={28} className="mr-3" />
            Rebalancer Dashboard
          </h2>
          <p className="text-gray-300 mb-8">Connect your wallet to participate in rebalancing</p>
          <div className="bg-gray-700 border border-cyan-500 rounded-lg p-6 text-left">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Earn Rewards by Rebalancing</h3>
            <ul className="text-gray-300 space-y-2">
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Monitor portfolio delta and trigger rebalancing when needed</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Earn AVAX rewards for successful rebalancing operations</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Higher rewards for urgent rebalancing (>10% deviation)</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>No technical knowledge required - just click to rebalance</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 flex items-center">
              <Icon name="rebalancer" size={24} className="mr-2" />
              Rebalancer Dashboard
            </h1>
            <p className="text-gray-300">Monitor and trigger portfolio rebalancing for rewards</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 border border-gray-600"
            >
              <Icon name="refresh" size={16} className="mr-1 inline" />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Rebalance Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Status */}
        <div className="lg:col-span-2 bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Portfolio Status</h2>
          
          {rebalanceData ? (
            <div className="space-y-4">
              {/* Status indicator */}
              <div className={`p-4 rounded-lg border-l-4 ${
                rebalanceData.needsRebalance ? 
                  rebalanceData.deviation > 10 ? 'border-red-500 bg-red-900/20' : 'border-yellow-500 bg-yellow-900/20'
                  : 'border-green-500 bg-green-900/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-semibold ${
                      rebalanceData.needsRebalance ? 
                        rebalanceData.deviation > 10 ? 'text-red-400' : 'text-yellow-400'
                        : 'text-green-400'
                    }`}>
                      {rebalanceData.needsRebalance ? 
                        rebalanceData.deviation > 10 ? '🚨 Urgent Rebalancing Needed' : '⚠️ Rebalancing Recommended'
                        : '✅ Portfolio Balanced'
                      }
                    </h3>
                    <p className={`text-sm mt-1 ${
                      rebalanceData.needsRebalance ? 
                        rebalanceData.deviation > 10 ? 'text-red-300' : 'text-yellow-300'
                        : 'text-green-300'
                    }`}>
                      Current deviation: {rebalanceData.deviation.toFixed(2)}% from target
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Portfolio Delta</p>
                    <p className="text-2xl font-bold text-cyan-300">
                      {rebalanceData.portfolioDelta.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Rebalance Action */}
              <div className="flex justify-center">
                <button
                  onClick={handleRebalance}
                  disabled={loading || !rebalanceData.needsRebalance}
                  className={`px-8 py-4 rounded-lg font-semibold text-lg transition-colors duration-200 ${
                    rebalanceData.needsRebalance
                      ? rebalanceData.deviation > 10
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Triggering Rebalance...' : 
                   rebalanceData.needsRebalance ? <><Icon name="target" size={16} className="mr-1" />Trigger Rebalance</> : 'No Rebalancing Needed'}
                </button>
              </div>

              {/* Estimated reward */}
              {rebalanceData.needsRebalance && (
                <div className="bg-cyan-900/30 border border-cyan-500 rounded-lg p-4">
                  <h4 className="font-semibold text-cyan-400 mb-2">Estimated Reward</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Base reward + deviation bonus:</span>
                    <span className="font-bold text-cyan-300">
                      ~{(0.1 + (rebalanceData.deviation / 100) * 0.2).toFixed(4)} AVAX
                    </span>
                  </div>
                  {rebalanceData.deviation > 10 && (
                    <p className="text-sm text-cyan-300 mt-2">
                      <Icon name="lightning" size={16} className="mr-1 inline" />Urgent rebalancing bonus: 2x multiplier applied!
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>

        {/* Your Stats */}
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Your Stats</h2>
          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">Total Rewards Earned</p>
              <p className="text-xl font-bold text-cyan-300">{rebalancerStats.totalRewards} AVAX</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">Rebalances Triggered</p>
              <p className="text-lg font-semibold text-white">{rebalancerStats.rebalanceCount}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">Success Rate</p>
              <p className="text-lg font-semibold text-green-400">{rebalancerStats.successRate}%</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">Avg Reward</p>
              <p className="text-lg font-semibold text-white">{rebalancerStats.avgReward} AVAX</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">Leaderboard Rank</p>
              <p className="text-lg font-semibold text-cyan-400">#{rebalancerStats.rank}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">Last Rebalance</p>
              <p className="text-sm text-gray-300">{rebalancerStats.lastRebalance}</p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-cyan-400 mb-4">How Rebalancing Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-cyan-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-cyan-500">
              <Icon name="monitor" size={32} className="text-cyan-400" />
            </div>
            <h3 className="font-semibold text-cyan-300 mb-2">Monitor</h3>
            <p className="text-sm text-gray-300">
              Watch the portfolio delta deviation from the target neutral position (0%).
            </p>
          </div>
          <div className="text-center">
            <div className="bg-green-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-green-500">
              <Icon name="target" size={32} className="text-green-400" />
            </div>
            <h3 className="font-semibold text-green-300 mb-2">Trigger</h3>
            <p className="text-sm text-gray-300">
              Click to trigger rebalancing when deviation exceeds 5% threshold.
            </p>
          </div>
          <div className="text-center">
            <div className="bg-yellow-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-yellow-500">
              <Icon name="earn" size={32} className="text-yellow-400" />
            </div>
            <h3 className="font-semibold text-yellow-300 mb-2">Earn</h3>
            <p className="text-sm text-gray-300">
              Receive AVAX rewards proportional to the deviation you helped correct.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-cyan-400 mb-4">Recent Rebalancing Activity</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Triggered By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Deviation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Reward
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">2 hours ago</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-400">0x1234...5678</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">8.2%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">0.084 AVAX</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900/50 text-green-400 border border-green-500">
                    Success
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">8 hours ago</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-400">0x9876...4321</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">12.5%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">0.125 AVAX</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900/50 text-green-400 border border-green-500">
                    Success
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">1 day ago</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-400">0x5555...7777</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">6.1%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">0.061 AVAX</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900/50 text-green-400 border border-green-500">
                    Success
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Last Update */}
      <div className="text-center text-sm text-gray-400">
        Last updated: {new Date(lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default Rebalancer;
