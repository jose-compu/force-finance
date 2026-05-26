import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Vault from './components/Vault';
import Yield from './components/Yield';
import Rebalancer from './components/Rebalancer';
import ForceDAO from './components/ForceDAO';
import Icon from './components/Icon';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { ContractProvider } from './contexts/ContractContext';
import './App.css';

function App() {
  return (
    <WalletProvider>
      <ContractProvider>
        <AppContent />
      </ContractProvider>
    </WalletProvider>
  );
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', icon: 'dashboard' },
    { name: 'Vault', id: 'vault', icon: 'vault' },
    { name: 'Yield', id: 'yield', icon: 'yield' },
    { name: 'FORCE DAO', id: 'dao', icon: 'dao' },
    { name: 'Rebalancer', id: 'rebalancer', icon: 'rebalancer' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 font-mono">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b border-cyan-500/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-4 min-h-[4.25rem] py-2">
            <div className="flex items-center gap-6 lg:gap-8 min-w-0">
              <div className="flex-shrink-0">
                <h1 className="text-xl lg:text-2xl font-display text-cyan-400 flex items-center tracking-widest whitespace-nowrap">
                  <Icon name="lightning" size={26} className="mr-2 text-cyan-400 flex-shrink-0" />
                  FORCE FINANCE
                </h1>
              </div>
              <nav className="hidden md:flex items-center gap-1 lg:gap-2">
                {navigation.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`inline-flex items-center gap-2 px-3 xl:px-4 py-2.5 text-sm xl:text-base font-sans font-semibold tracking-wide whitespace-nowrap rounded-md border transition-all duration-200 ${
                      currentPage === item.id
                        ? 'text-cyan-400 bg-gray-700/90 border-cyan-500/60 shadow-sm shadow-cyan-500/10'
                        : 'text-gray-200 border-transparent hover:text-cyan-300 hover:bg-gray-700/60 hover:border-cyan-600/40'
                    }`}
                  >
                    <Icon name={item.icon} size={20} className="flex-shrink-0 opacity-90" />
                    {item.name}
                  </button>
                ))}
              </nav>
            </div>
            <WalletConnection />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'vault' && <Vault />}
          {currentPage === 'yield' && <Yield />}
          {currentPage === 'dao' && <ForceDAO />}
          {currentPage === 'rebalancer' && <Rebalancer />}
        </div>
      </main>
    </div>
  );
}

// Wallet Connection Component - Now uses WalletContext
function WalletConnection() {
  const { account, isConnected, isLoading, connectWallet, disconnectWallet } = useWallet();



  if (isConnected && account) {
    return (
      <div className="flex items-center space-x-4">
        <div className="bg-cyan-900/80 text-cyan-200 px-3 py-1.5 rounded-md border border-cyan-500/60 text-sm xl:text-base font-sans font-medium">
          {`${account.substring(0, 6)}...${account.substring(38)}`}
        </div>
        <button
          onClick={disconnectWallet}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-md text-sm xl:text-base font-sans font-semibold transition-all duration-200 border border-red-500 shadow-lg hover:shadow-red-500/25"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isLoading}
      className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:bg-gray-600 text-white px-5 py-2.5 rounded-md text-sm xl:text-base font-sans font-semibold transition-all duration-200 border border-cyan-500 shadow-lg hover:shadow-cyan-500/25 whitespace-nowrap"
    >
      {isLoading ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}

export default App;
