import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContracts } from '../contexts/ContractContext';
import Icon from './Icon';
import MetricCard from './MetricCard';
import Button from './Button';

const Vault = () => {
  const { account, isConnected } = useWallet();
  const { 
    depositSAvax, 
    withdrawSAvax, 
    depositAVAX,
    getUserData,
    getStrategyMetrics,
    getClaimableYield,
    claimYield
  } = useContracts();

  const [activeTab, setActiveTab] = useState('deposit');
  const [userData, setUserData] = useState(null);
  const [strategyMetrics, setStrategyMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form states
  const [depositForm, setDepositForm] = useState({
    asset: 'SAVAX',
    amount: '',
    usdAmount: ''
  });
  const [withdrawForm, setWithdrawForm] = useState({
    fusdAmount: '',
    usdAmount: ''
  });
  const [avaxForm, setAvaxForm] = useState({
    amount: ''
  });

  // Avalanche LST assets
  const ASSETS = {
    SAVAX: {
      name: 'sAVAX',
      symbol: 'SAVAX',
      address: '0x2B2C81E08f1aF8835aB89c2Ffc7e21D6DfFC7E2C',
      decimals: 18,
      description: 'Staked AVAX (BENQI)'
    },
    STETH_E: {
      name: 'stETH.e',
      symbol: 'STETH_E',
      address: '0x3D9eAB723df76808bB84c05b20de27A2e69EF293',
      decimals: 18,
      description: 'Staked ETH (Lido)'
    },
    BTC_B: {
      name: 'BTC.b',
      symbol: 'BTC_B',
      address: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
      decimals: 8,
      description: 'Bitcoin (AAVE)'
    }
  };

  // Refresh user data
  const refreshUserData = useCallback(async () => {
    if (!account) return;
    
    setRefreshing(true);
    try {
      const [userDataResult, strategyMetricsResult] = await Promise.all([
        getUserData(account),
        getStrategyMetrics()
      ]);
      setUserData(userDataResult);
      setStrategyMetrics(strategyMetricsResult);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [account, getUserData, getStrategyMetrics]);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  // Handle sAVAX deposit
  const handleDepositSAvax = async (e) => {
    e.preventDefault();
    if (!depositForm.amount || !depositForm.usdAmount || !depositForm.asset) return;

    setLoading(true);
    try {
      const amount = ethers.parseEther(depositForm.amount);
      const usdAmount = ethers.parseEther(depositForm.usdAmount);
      
      if (depositForm.asset === 'SAVAX') {
        await depositSAvax(amount, usdAmount);
      } else {
        // For other assets, would need specific deposit functions
        alert('Asset not yet supported');
        return;
      }
      
      // Reset form and refresh data
      setDepositForm({ asset: 'SAVAX', amount: '', usdAmount: '' });
      await refreshUserData();
      
      alert('LST deposited successfully!');
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Deposit failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle AVAX deposit
  const handleDepositAVAX = async (e) => {
    e.preventDefault();
    if (!avaxForm.amount) return;

    setLoading(true);
    try {
      const amount = ethers.parseEther(avaxForm.amount);
      await depositAVAX(amount);
      
      // Reset form and refresh data
      setAvaxForm({ amount: '' });
      await refreshUserData();
      
      alert('AVAX deposited successfully!');
    } catch (error) {
      console.error('AVAX deposit error:', error);
      alert('AVAX deposit failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle withdrawal
  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawForm.fusdAmount || !withdrawForm.usdAmount) return;

    setLoading(true);
    try {
      const fusdAmount = ethers.parseEther(withdrawForm.fusdAmount);
      const usdAmount = ethers.parseEther(withdrawForm.usdAmount);
      
      await withdrawSAvax(fusdAmount, usdAmount);
      
      // Reset form and refresh data
      setWithdrawForm({ fusdAmount: '', usdAmount: '' });
      await refreshUserData();
      
      alert('Withdrawal successful!');
    } catch (error) {
      console.error('Withdrawal error:', error);
      alert('Withdrawal failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle yield claim
  const handleClaimYield = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      await claimYield(account);
      await refreshUserData();
      alert('Yield claimed successfully!');
    } catch (error) {
      console.error('Yield claim error:', error);
      alert('Yield claim failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-cyan-400 mb-4 flex items-center">
          <Icon name="vault" size={24} className="mr-2" />
          LST Vault
        </h2>
        <p className="text-gray-300">Please connect your wallet to access the vault.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-cyan-400 mb-4 flex items-center">
          <Icon name="vault" size={24} className="mr-2" />
          Avalanche LST Vault
        </h2>
        <p className="text-gray-300">
          Deposit Liquid Staking Tokens (LSTs) to mint FUSD stablecoin and earn yield from staking rewards.
        </p>
      </div>

      {/* Strategy Overview */}
      {strategyMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="Total LST Value"
            value={`$${parseFloat(strategyMetrics.totalLST || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Protocol collateral"
            icon="vault"
            loading={refreshing}
          />
          <MetricCard
            title="Short Notional"
            value={`$${parseFloat(strategyMetrics.shortNotional || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="GMX hedge positions"
            icon="target"
            loading={refreshing}
          />
          <MetricCard
            title="FUSD Supply"
            value={parseFloat(strategyMetrics.circulatingSupply || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            subtitle="Circulating stablecoin"
            icon="stake"
            loading={refreshing}
          />
        </div>
      )}

      {/* User Position */}
      {userData && (
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center">
            <Icon name="vault" size={20} className="mr-2" />
            Your Position
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <MetricCard
              title="Collateral Value"
              value={`$${parseFloat(userData.collateralValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              subtitle="Total deposited"
              icon="vault"
            />
            <MetricCard
              title="FUSD Minted"
              value={parseFloat(userData.fusdMinted || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              subtitle="Stablecoin balance"
              icon="stake"
            />
            <MetricCard
              title="Collateralization Ratio"
              value={`${(userData.collateralRatio * 100 || 0).toFixed(1)}%`}
              subtitle={userData.collateralRatio > 150 ? 'Safe' : userData.collateralRatio > 110 ? 'Warning' : 'Critical'}
              trend={userData.collateralRatio > 150 ? 'up' : userData.collateralRatio > 110 ? null : 'down'}
              icon="monitor"
            />
            <MetricCard
              title="Claimable Yield"
              value={`${parseFloat(userData.currentYieldIndex || 0).toFixed(4)} sAVAX`}
              subtitle="Available to claim"
              icon="yield"
            />
          </div>
          <Button
            onClick={handleClaimYield}
            disabled={loading}
            loading={loading}
            variant="primary"
            fullWidth
          >
            Claim Yield
          </Button>
        </div>
      )}

      {/* Operations */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <div className="flex space-x-4 mb-6">
          <Button
            onClick={() => setActiveTab('deposit')}
            variant={activeTab === 'deposit' ? 'primary' : 'secondary'}
            size="md"
          >
            Deposit LST
          </Button>
          <Button
            onClick={() => setActiveTab('avax')}
            variant={activeTab === 'avax' ? 'primary' : 'secondary'}
            size="md"
          >
            Deposit AVAX
          </Button>
          <Button
            onClick={() => setActiveTab('withdraw')}
            variant={activeTab === 'withdraw' ? 'primary' : 'secondary'}
            size="md"
          >
            Withdraw
          </Button>
        </div>

        {/* Deposit LST Form */}
        {activeTab === 'deposit' && (
          <form onSubmit={handleDepositSAvax} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select LST Asset
              </label>
              <select
                value={depositForm.asset}
                onChange={(e) => setDepositForm({ ...depositForm, asset: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {Object.entries(ASSETS).map(([key, asset]) => (
                  <option key={key} value={key}>
                    {asset.name} - {asset.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                LST Amount
              </label>
              <input
                type="number"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                placeholder="0.0"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                step="0.000001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                USD Value
              </label>
              <input
                type="number"
                value={depositForm.usdAmount}
                onChange={(e) => setDepositForm({ ...depositForm, usdAmount: e.target.value })}
                placeholder="0.0"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                step="0.01"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              variant="primary"
              fullWidth
            >
              Deposit LST
            </Button>
          </form>
        )}

        {/* Deposit AVAX Form */}
        {activeTab === 'avax' && (
          <form onSubmit={handleDepositAVAX} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                AVAX Amount
              </label>
              <input
                type="number"
                value={avaxForm.amount}
                onChange={(e) => setAvaxForm({ ...avaxForm, amount: e.target.value })}
                placeholder="0.0"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                step="0.01"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              variant="primary"
              fullWidth
            >
              Deposit AVAX
            </Button>
          </form>
        )}

        {/* Withdraw Form */}
        {activeTab === 'withdraw' && (
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                FUSD Amount to Burn
              </label>
              <input
                type="number"
                value={withdrawForm.fusdAmount}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, fusdAmount: e.target.value })}
                placeholder="0.0"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                USD Value to Withdraw
              </label>
              <input
                type="number"
                value={withdrawForm.usdAmount}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, usdAmount: e.target.value })}
                placeholder="0.0"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                step="0.01"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              variant="danger"
              fullWidth
            >
              Withdraw LST
            </Button>
          </form>
        )}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button
          onClick={refreshUserData}
          disabled={refreshing}
          loading={refreshing}
          variant="secondary"
        >
          Refresh Data
        </Button>
      </div>
    </div>
  );
};

export default Vault;
