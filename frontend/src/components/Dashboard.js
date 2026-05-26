import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContracts } from '../contexts/ContractContext';
import Icon from './Icon';
import MetricCard from './MetricCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const { account, isConnected } = useWallet();
  const { getVaultHealth, getUserData, getRebalanceInfo } = useContracts();
  
  const [vaultData, setVaultData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [rebalanceData, setRebalanceData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mock historical data for charts
  const historicalData = [
    { time: '00:00', price: 1.000, delta: 0.1 },
    { time: '04:00', price: 1.002, delta: -0.2 },
    { time: '08:00', price: 0.998, delta: 0.3 },
    { time: '12:00', price: 1.001, delta: -0.1 },
    { time: '16:00', price: 0.999, delta: 0.2 },
    { time: '20:00', price: 1.000, delta: 0.0 },
  ];

  const portfolioData = [
    { name: 'ETH', value: 65, color: '#3B82F6' },
    { name: 'BTC', value: 30, color: '#F59E0B' },
    { name: 'Cash', value: 5, color: '#10B981' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }

      try {
        const [vaultHealth, userInfo, rebalanceInfo] = await Promise.all([
          getVaultHealth(),
          account ? getUserData(account) : null,
          getRebalanceInfo(),
        ]);

        setVaultData(vaultHealth);
        setUserData(userInfo);
        setRebalanceData(rebalanceInfo);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [isConnected, account, getVaultHealth, getUserData, getRebalanceInfo]);

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-800 rounded-lg p-8 max-w-3xl mx-auto border border-cyan-500">
          <h2 className="text-3xl font-bold text-cyan-400 mb-4 flex items-center justify-center">
            <Icon name="lightning" size={32} className="mr-3" />
            Welcome to Force Finance
          </h2>
          <p className="text-gray-300 mb-8 text-lg">Connect your wallet to access the delta-neutral stablecoin protocol</p>
          <div className="bg-gray-700 border border-cyan-500 rounded-lg p-6 text-left">
            <h3 className="text-xl font-semibold text-cyan-400 mb-4">How it works:</h3>
            <ul className="text-gray-300 space-y-3">
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Deposit sAVAX, stETH.e, or BTC.b as collateral</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Mint FUSD stablecoins at 150% collateralization</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Earn yield from LST staking rewards automatically distributed</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Hold FORCE tokens to earn 20% of protocol fees</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">▸</span>
                <span>Participate in rebalancing for additional rewards</span>
              </li>
          </ul>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="cyberpunk-spinner w-12 h-12"></div>
        <p className="ml-4 text-cyan-400">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-cyan-400 mb-2 flex items-center">
          <Icon name="dashboard" size={24} className="mr-2" />
          Dashboard
        </h1>
        <p className="text-gray-300">Monitor your positions and protocol health</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="FUSD Price"
          value="$1.000"
          subtitle="Stablecoin peg"
          trend="up"
          trendValue="+0.02%"
          icon="stake"
        />
        <MetricCard
          title="Total Collateral"
          value={vaultData ? `$${parseFloat(vaultData.totalCollateral || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
          subtitle="Protocol TVL"
          icon="vault"
          loading={loading}
        />
        <MetricCard
          title="Protocol Health"
          value={vaultData?.isSolvent ? 'Solvent' : 'At Risk'}
          subtitle={vaultData ? `${(vaultData.healthRatio / 100).toFixed(1)}% ratio` : 'N/A'}
          trend={vaultData?.isSolvent ? 'up' : 'down'}
          icon="monitor"
          loading={loading}
        />
        <MetricCard
          title="Rebalance Status"
          value={rebalanceData?.needsRebalance ? 'Needed' : 'Healthy'}
          subtitle={rebalanceData ? `${rebalanceData.deviation.toFixed(2)}% deviation` : 'N/A'}
          trend={!rebalanceData?.needsRebalance ? 'up' : 'down'}
          icon="target"
          loading={loading}
        />
      </div>

      {/* User Position (if connected) */}
      {userData && (
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4 flex items-center">
            <Icon name="vault" size={20} className="mr-2" />
            Your Position
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">Collateral Value</p>
              <p className="text-2xl font-bold text-white">${parseFloat(userData.collateralValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">FUSD Minted</p>
              <p className="text-2xl font-bold text-cyan-300">{parseFloat(userData.fusdMinted || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FUSD</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <p className="text-sm text-gray-400 mb-1">Collateral Ratio</p>
              <p className={`text-2xl font-bold ${userData.collateralRatio > 150 ? 'text-green-400' : userData.collateralRatio > 110 ? 'text-yellow-400' : 'text-red-400'}`}>
                {userData.collateralRatio ? (userData.collateralRatio * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Chart */}
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4">FUSD Price (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#9ca3af" />
              <YAxis domain={[0.995, 1.005]} stroke="#9ca3af" />
              <Tooltip 
                formatter={(value) => [`$${value.toFixed(4)}`, 'Price']}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Portfolio Allocation */}
        <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4">Portfolio Allocation</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={portfolioData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {portfolioData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`${value}%`, 'Allocation']}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center space-x-6 mt-4">
            {portfolioData.map((item) => (
              <div key={item.name} className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2`} style={{ backgroundColor: item.color }}></div>
                <span className="text-sm text-gray-300">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delta Chart */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-cyan-400 mb-4">Portfolio Delta (24h)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={historicalData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#9ca3af" />
            <YAxis domain={[-0.5, 0.5]} stroke="#9ca3af" />
            <Tooltip 
              formatter={(value) => [`${value.toFixed(2)}%`, 'Delta']}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4', borderRadius: '8px' }}
            />
            <Line type="monotone" dataKey="delta" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Protocol Stats */}
      <div className="bg-gray-800 border border-cyan-500 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-cyan-400 mb-4">Protocol Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center bg-gray-700 rounded-lg p-4 border border-gray-600">
            <p className="text-sm text-gray-400 mb-1">Total Value Locked</p>
            <p className="text-xl font-bold text-white">{vaultData ? `$${(parseFloat(vaultData.totalCollateral || 0) / 1000000).toFixed(2)}M` : '$0.00'}</p>
          </div>
          <div className="text-center bg-gray-700 rounded-lg p-4 border border-gray-600">
            <p className="text-sm text-gray-400 mb-1">FUSD Supply</p>
            <p className="text-xl font-bold text-cyan-300">{vaultData ? `${(parseFloat(vaultData.circulatingSupply || 0) / 1000000).toFixed(2)}M` : '0'}</p>
          </div>
          <div className="text-center bg-gray-700 rounded-lg p-4 border border-gray-600">
            <p className="text-sm text-gray-400 mb-1">Health Ratio</p>
            <p className={`text-xl font-bold ${vaultData?.isSolvent ? 'text-green-400' : 'text-red-400'}`}>
              {vaultData ? `${(vaultData.healthRatio / 100).toFixed(1)}%` : 'N/A'}
            </p>
          </div>
          <div className="text-center bg-gray-700 rounded-lg p-4 border border-gray-600">
            <p className="text-sm text-gray-400 mb-1">Status</p>
            <p className={`text-xl font-bold ${vaultData?.isActive ? 'text-green-400' : 'text-gray-400'}`}>
              {vaultData?.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
