import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContracts } from '../contexts/ContractContext';

const ForceDAO = () => {
  const { account } = useWallet();
  const { contracts } = useContracts();
  const [daoStats, setDaoStats] = useState({
    userBalance: '0',
    pendingRewards: '0',
    totalSupply: '0',
    totalDistributed: '0',
    currentBalance: '0'
  });
  const [loading, setLoading] = useState(false);

  const loadDAOData = useCallback(async () => {
    if (!contracts.forceDAO || !account) return;

    try {
      const [userBalance, pendingRewards, daoStats] = await Promise.all([
        contracts.forceDAO.balanceOf(account),
        contracts.forceDAO.pendingRewards(account),
        contracts.forceDAO.getDAOStats()
      ]);

      setDaoStats({
        userBalance: ethers.formatEther(userBalance),
        pendingRewards: ethers.formatEther(pendingRewards),
        totalSupply: ethers.formatEther(daoStats[0]),
        totalDistributed: ethers.formatEther(daoStats[1]),
        currentBalance: ethers.formatEther(daoStats[2])
      });
    } catch (error) {
      console.error('Error loading DAO data:', error);
    }
  }, [contracts.forceDAO, account]);

  const claimRewards = async () => {
    if (!contracts.forceDAO) return;

    setLoading(true);
    try {
      const tx = await contracts.forceDAO.claimRewards();
      await tx.wait();
      await loadDAOData();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      alert('Failed to claim rewards: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDAOData();
    const interval = setInterval(loadDAOData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [contracts.forceDAO, account, loadDAOData]);

  const userSharePercentage = daoStats.totalSupply > 0 
    ? ((parseFloat(daoStats.userBalance) / parseFloat(daoStats.totalSupply)) * 100).toFixed(4)
    : '0';

  const hasRewards = parseFloat(daoStats.pendingRewards) > 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">FORCE DAO</h2>
        
        {/* DAO Overview */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Your Position</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">FORCE Balance:</span>
                <span className="font-medium">{parseFloat(daoStats.userBalance).toLocaleString()} FORCE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Your Share:</span>
                <span className="font-medium">{userSharePercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pending Rewards:</span>
                <span className={`font-medium ${hasRewards ? 'text-green-600' : ''}`}>
                  {parseFloat(daoStats.pendingRewards).toFixed(6)} ETH
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Protocol Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Supply:</span>
                <span className="font-medium">{parseFloat(daoStats.totalSupply).toLocaleString()} FORCE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Distributed:</span>
                <span className="font-medium">{parseFloat(daoStats.totalDistributed).toFixed(4)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Available Pool:</span>
                <span className="font-medium">{parseFloat(daoStats.currentBalance).toFixed(4)} ETH</span>
              </div>
            </div>
          </div>
        </div>

        {/* Claim Rewards */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-700">Claim Rewards</h3>
              <p className="text-sm text-gray-500">
                FORCE holders receive 20% of all protocol fees automatically
              </p>
            </div>
            <button
              onClick={claimRewards}
              disabled={loading || !hasRewards}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                hasRewards && !loading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Claiming...' : hasRewards ? 'Claim Rewards' : 'No Rewards'}
            </button>
          </div>
          
          {hasRewards && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">
                    You have <strong>{parseFloat(daoStats.pendingRewards).toFixed(6)} ETH</strong> ready to claim!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">How FORCE DAO Works</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Hold FORCE tokens to automatically earn 20% of all protocol fees</li>
            <li>• No staking required - just hold tokens in your wallet</li>
            <li>• Claim your accumulated rewards anytime</li>
            <li>• Your share is proportional to your FORCE token holdings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ForceDAO;
