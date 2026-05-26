import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContracts } from '../contexts/ContractContext';
import Icon from './Icon';

const Yield = () => {
  const { account, isConnected } = useWallet();
  const { contracts } = useContracts();


  
  const [activeTab, setActiveTab] = useState('stake');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Yield staking state
  const [yieldData, setYieldData] = useState({
    stakedAmount: '0',
    pendingRewards: '0',
    totalStaked: '0',
    yieldPool: '0',
    currentAPY: '5.0'
  });
  
  // Form states
  const [stakeForm, setStakeForm] = useState({ amount: '' });
  const [unstakeForm, setUnstakeForm] = useState({ amount: '' });

  // Mock LP pools data
  const mockPools = [
    {
      id: 0,
      name: 'FUSD/USDC',
      lpToken: 'FUSD-USDC LP',
      apy: '15.2%',
      totalStaked: '125,000',
      userStaked: '1,250',
      pendingRewards: '0.045',
      multiplier: '2x'
    },
    {
      id: 1,
      name: 'FUSD/ETH',
      lpToken: 'FUSD-ETH LP',
      apy: '22.8%',
      totalStaked: '89,500',
      userStaked: '0',
      pendingRewards: '0',
      multiplier: '3x'
    }
  ];

  // Refresh data
  const refreshData = useCallback(async () => {
    if (!account || !contracts.yieldDistributor) return;
    
    setRefreshing(true);
    try {
      // Mock data for demonstration
      setYieldData({
        stakedAmount: '1000.50',
        pendingRewards: '2.45',
        totalStaked: '2,500,000',
        yieldPool: '125.8',
        currentAPY: '5.5'
      });
    } catch (error) {
      console.error('Error refreshing yield data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [account, contracts.yieldDistributor]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle staking
  const handleStake = async (e) => {
    e.preventDefault();
    if (!stakeForm.amount) return;

    setLoading(true);
    try {
      // Mock staking transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStakeForm({ amount: '' });
      await refreshData();
      alert('FUSD staked successfully!');
    } catch (error) {
      console.error('Staking error:', error);
      alert('Staking failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle unstaking
  const handleUnstake = async (e) => {
    e.preventDefault();
    if (!unstakeForm.amount) return;

    setLoading(true);
    try {
      // Mock unstaking transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      setUnstakeForm({ amount: '' });
      await refreshData();
      alert('FUSD unstaked successfully!');
    } catch (error) {
      console.error('Unstaking error:', error);
      alert('Unstaking failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle claim rewards
  const handleClaimRewards = async () => {
    setLoading(true);
    try {
      // Mock claim transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshData();
      alert('Rewards claimed successfully!');
    } catch (error) {
      console.error('Claim error:', error);
      alert('Claim failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle LP farming (currently unused in UI but kept for future use)
  // const handleFarm = async (e) => {
  //   e.preventDefault();
  //   if (!farmForm.amount) return;

  //   setLoading(true);
  //   try {
  //     // Mock farming transaction
  //     await new Promise(resolve => setTimeout(resolve, 2000));
  //     setFarmForm({ poolId: 0, amount: '' });
  //     await refreshData();
  //     alert('LP tokens staked for farming!');
  //   } catch (error) {
  //     console.error('Farming error:', error);
  //     alert('Farming failed: ' + error.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center justify-center">
            <Icon name="yield" size={28} className="mr-3" />
            Yield Farming
          </h2>
          <p className="text-gray-300 mb-8">Connect your wallet to start earning yield</p>
          <div className="bg-gray-700 border border-cyan-500 rounded-lg p-6 text-left">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Earn Yield on Your FUSD</h3>
            <ul className="text-gray-300 space-y-2">
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Stake FUSD to earn base yield from protocol fees</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Farm LP tokens for additional rewards</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Earn up to 20%+ APY through combined strategies</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Claim rewards anytime with no lock-up period</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'stake', name: 'Stake FUSD', icon: 'stake' },
    { id: 'farm', name: 'LP Farming', icon: '🚜' },
    { id: 'rewards', name: 'My Rewards', icon: '🎁' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 flex items-center">
              <Icon name="yield" size={24} className="mr-2" />
              Yield Farming
            </h1>
            <p className="text-gray-300">Stake FUSD and farm LP tokens to earn rewards</p>
          </div>
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

      {/* Yield Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-1">My Staked FUSD</h3>
          <p className="text-2xl font-bold text-cyan-300">{yieldData.stakedAmount} FUSD</p>
        </div>
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Pending Rewards</h3>
          <p className="text-2xl font-bold text-green-400">{yieldData.pendingRewards} sAVAX</p>
        </div>
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Total Staked</h3>
          <p className="text-2xl font-bold text-white">{yieldData.totalStaked} FUSD</p>
        </div>
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Current APY</h3>
          <p className="text-2xl font-bold text-cyan-400">{yieldData.currentAPY}%</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg">
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-400 bg-gray-700'
                    : 'border-transparent text-gray-400 hover:text-cyan-300 hover:border-cyan-600'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors duration-200`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 bg-gray-800">
          {/* Stake FUSD Tab */}
          {activeTab === 'stake' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stake Form */}
                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-cyan-400 mb-4">Stake FUSD</h3>
                  <form onSubmit={handleStake} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Amount (FUSD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={stakeForm.amount}
                        onChange={(e) => setStakeForm({ amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !stakeForm.amount}
                      className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-3 px-4 rounded-md font-medium transition-colors duration-200 border border-green-500"
                    >
                      {loading ? 'Staking...' : 'Stake FUSD'}
                    </button>
                  </form>
                </div>

                {/* Unstake Form */}
                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-cyan-400 mb-4">Unstake FUSD</h3>
                  <form onSubmit={handleUnstake} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Amount (FUSD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={unstakeForm.amount}
                        onChange={(e) => setUnstakeForm({ amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !unstakeForm.amount}
                      className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-3 px-4 rounded-md font-medium transition-colors duration-200 border border-red-500"
                    >
                      {loading ? 'Unstaking...' : 'Unstake FUSD'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Yield Info */}
              <div className="bg-cyan-900/30 border border-cyan-500 rounded-lg p-6">
                <h4 className="font-semibold text-cyan-400 mb-2">How FUSD Staking Works</h4>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Stake your FUSD to earn yield from protocol trading fees</li>
                  <li>• Current APY: {yieldData.currentAPY}% (paid in sAVAX)</li>
                  <li>• Rewards are calculated continuously and can be claimed anytime</li>
                  <li>• No lock-up period - unstake your FUSD whenever you want</li>
                </ul>
              </div>
            </div>
          )}

          {/* LP Farming Tab */}
          {activeTab === 'farm' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-cyan-400">Available Farming Pools</h3>
              
              {/* Farming Pools */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {mockPools.map((pool) => (
                  <div key={pool.id} className="border border-cyan-500 rounded-lg p-6 bg-gray-700">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-cyan-400">{pool.name}</h4>
                        <p className="text-sm text-gray-400">{pool.lpToken}</p>
                      </div>
                      <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded-full text-xs font-medium border border-green-500">
                        {pool.multiplier} Bonus
                      </span>
                    </div>
                    
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">APY:</span>
                        <span className="text-sm font-medium text-green-400">{pool.apy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Total Staked:</span>
                        <span className="text-sm font-medium text-white">{pool.totalStaked}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Your Staked:</span>
                        <span className="text-sm font-medium text-white">{pool.userStaked}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Pending Rewards:</span>
                        <span className="text-sm font-medium text-green-400">{pool.pendingRewards} sAVAX</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors duration-200 border border-cyan-500">
                        Stake LP
                      </button>
                      {parseFloat(pool.userStaked) > 0 && (
                        <button className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors duration-200 border border-green-500">
                          Claim
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Farming Info */}
              <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-6">
                <h4 className="font-semibold text-yellow-400 mb-2">LP Farming Information</h4>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Provide liquidity to FUSD pairs on Trader Joe to get LP tokens</li>
                  <li>• Stake your LP tokens here to earn additional farming rewards</li>
                  <li>• Early farmers get bonus multipliers for limited time</li>
                  <li>• Rewards are paid in sAVAX and can be claimed anytime</li>
                </ul>
              </div>
            </div>
          )}

          {/* My Rewards Tab */}
          {activeTab === 'rewards' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">My Rewards Summary</h3>
              
              {/* Rewards Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h4 className="font-semibold text-green-900 mb-2">Total Pending</h4>
                  <p className="text-2xl font-bold text-green-600">
                    {(parseFloat(yieldData.pendingRewards) + mockPools.reduce((sum, pool) => sum + parseFloat(pool.pendingRewards), 0)).toFixed(3)} ETH
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h4 className="font-semibold text-blue-900 mb-2">Staking Rewards</h4>
                  <p className="text-xl font-bold text-blue-600">{yieldData.pendingRewards} ETH</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h4 className="font-semibold text-purple-900 mb-2">Farming Rewards</h4>
                  <p className="text-xl font-bold text-purple-600">
                    {mockPools.reduce((sum, pool) => sum + parseFloat(pool.pendingRewards), 0).toFixed(3)} ETH
                  </p>
                </div>
              </div>

              {/* Claim Actions */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Claim Rewards</h4>
                <div className="flex space-x-4">
                  <button
                    onClick={handleClaimRewards}
                    disabled={loading || parseFloat(yieldData.pendingRewards) === 0}
                    className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-2 px-6 rounded-md font-medium transition-colors duration-200"
                  >
                    {loading ? 'Claiming...' : 'Claim Staking Rewards'}
                  </button>
                  <button
                    onClick={handleClaimRewards}
                    disabled={loading}
                    className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white py-2 px-6 rounded-md font-medium transition-colors duration-200"
                  >
                    Claim All Farming Rewards
                  </button>
                </div>
              </div>

              {/* Rewards History */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Recent Rewards</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Today</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">FUSD Staking</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.125 ETH</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Claimed
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Yesterday</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">LP Farming</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.089 ETH</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Claimed
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Yield;
