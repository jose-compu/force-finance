// Wallet detection utility to debug provider conflicts
export const detectWallets = () => {
  const detectedWallets = [];
  
  // Check for common wallet providers
  const walletChecks = [
    { name: 'MetaMask', check: () => window.ethereum?.isMetaMask },
    { name: 'Coinbase', check: () => window.ethereum?.isCoinbaseWallet },
    { name: 'WalletConnect', check: () => window.ethereum?.isWalletConnect },
    { name: 'Trust Wallet', check: () => window.ethereum?.isTrust },
    { name: 'Brave Wallet', check: () => window.ethereum?.isBraveWallet },
    { name: 'Opera Wallet', check: () => window.ethereum?.isOpera },
    { name: 'Rainbow', check: () => window.ethereum?.isRainbow },
    { name: 'Frame', check: () => window.ethereum?.isFrame },
  ];
  
  walletChecks.forEach(wallet => {
    try {
      if (wallet.check()) {
        detectedWallets.push(wallet.name);
      }
    } catch (error) {
      console.log(`Error checking ${wallet.name}:`, error);
    }
  });
  
  // Check if multiple providers exist
  const providers = [];
  if (window.ethereum) providers.push('ethereum');
  if (window.web3) providers.push('web3');
  if (window.BinanceChain) providers.push('BinanceChain');
  if (window.tronWeb) providers.push('tronWeb');
  
  return {
    wallets: detectedWallets,
    providers: providers,
    ethereum: {
      isMetaMask: window.ethereum?.isMetaMask,
      isArray: Array.isArray(window.ethereum),
      providerCount: Array.isArray(window.ethereum) ? window.ethereum.length : 1
    }
  };
};

// Debug function to log wallet information
export const logWalletInfo = () => {
  console.log('🔍 Wallet Detection Results:', detectWallets());
  
  if (window.ethereum) {
    console.log('🦊 Ethereum object details:', {
      isMetaMask: window.ethereum.isMetaMask,
      isCoinbaseWallet: window.ethereum.isCoinbaseWallet,
      providers: Array.isArray(window.ethereum) ? window.ethereum.map(p => p.constructor.name) : 'Single provider'
    });
  }
};
