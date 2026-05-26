import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { logWalletInfo } from '../utils/walletDetection';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get the correct MetaMask provider when multiple wallets are present
  const getMetaMaskProvider = () => {
    if (!window.ethereum) {
      throw new Error('No Ethereum provider found');
    }

    // Log wallet detection info
    logWalletInfo();

    // If multiple providers, find MetaMask
    if (Array.isArray(window.ethereum)) {
      const metaMaskProvider = window.ethereum.find(provider => provider.isMetaMask);
      if (!metaMaskProvider) {
        throw new Error('MetaMask not found among installed wallets');
      }
      console.log('🦊 Found MetaMask among multiple providers');
      return metaMaskProvider;
    }

    // Single provider - check if it's MetaMask
    if (window.ethereum.isMetaMask) {
      console.log('🦊 Using MetaMask as single provider');
      return window.ethereum;
    }

    // Fallback to any ethereum provider
    console.warn('⚠️ Using non-MetaMask provider:', window.ethereum);
    return window.ethereum;
  };

  const connectWallet = async () => {
    setIsLoading(true);
    try {
      const ethereum = getMetaMaskProvider();
      
      // Request account access
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Create provider and signer using the correct ethereum provider
      const web3Provider = new ethers.BrowserProvider(ethereum);
      const web3Signer = await web3Provider.getSigner();
      const network = await web3Provider.getNetwork();

      setAccount(accounts[0]);
      setProvider(web3Provider);
      setSigner(web3Signer);
      setChainId(Number(network.chainId));
      setIsConnected(true);
      
      console.log('🔧 Wallet Connected:', {
        account: accounts[0],
        chainId: Number(network.chainId),
        isConnected: true
      });

      // Store connection state
      localStorage.setItem('walletConnected', 'true');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setIsConnected(false);
    setChainId(null);
    localStorage.removeItem('walletConnected');
  };

  const switchToMainnet = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }], // Mainnet
      });
    } catch (error) {
      console.error('Error switching to mainnet:', error);
      throw error;
    }
  };

  // Check if already connected on page load
  useEffect(() => {
    const checkConnection = async () => {
      // Log wallet detection info on page load to help debug provider conflicts
      if (window.ethereum) {
        console.log('🔍 Wallet providers detected on page load:');
        logWalletInfo();
      }
      
      if (window.ethereum && localStorage.getItem('walletConnected')) {
        try {
          const ethereum = getMetaMaskProvider();
          const accounts = await ethereum.request({
            method: 'eth_accounts'
          });

          if (accounts.length > 0) {
            const web3Provider = new ethers.BrowserProvider(ethereum);
            const web3Signer = await web3Provider.getSigner();
            const network = await web3Provider.getNetwork();

            setAccount(accounts[0]);
            setProvider(web3Provider);
            setSigner(web3Signer);
            setChainId(Number(network.chainId));
            setIsConnected(true);
          }
        } catch (error) {
          console.error('Error checking connection:', error);
          localStorage.removeItem('walletConnected');
        }
      }
    };

    checkConnection();
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== account) {
        setAccount(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account]);

  const value = {
    account,
    provider,
    signer,
    isConnected,
    chainId,
    isLoading,
    connectWallet,
    disconnectWallet,
    switchToMainnet,
    isMainnet: chainId === 1,
    isTestnet: chainId === 11155111, // Sepolia
    isLocalnet: chainId === 13337, // Force Finance Local
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
