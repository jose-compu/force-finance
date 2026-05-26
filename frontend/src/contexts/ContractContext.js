import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './WalletContext';

// Contract ABIs for Avalanche LST Strategy
const AVALANCHE_LST_STRATEGY_ABI = [
  "function depositSAvax(uint256 amount, uint256 usdAmount)",
  "function withdrawSAvax(uint256 fusdAmount, uint256 usdAmount)",
  "function depositAVAX() payable",
  "function depositWAVAX(uint256 amount)",
  "function triggerRebalance()",
  "function executeRebalance() returns (bool, uint256)",
  "function executeEmergencyRebalance() returns (bool, uint256)",
  "function getUserPosition(address user) view returns (uint256, uint256, uint256, uint256)",
  "function getStrategyMetrics() view returns (uint256, uint256, bool, uint256, uint256)",
  "function getFUSDMetrics() view returns (uint256, uint256, uint256)",
  "function getYieldMetrics() view returns (uint256, uint256, uint256)",
  "function getRebalancingMetrics() view returns (uint256, uint256, uint256, uint256, uint256)",
  "function claimYield(address user) returns (uint256)",
  "function getClaimableYield(address user) view returns (uint256)",
  "function getGMXCollateralBalance() view returns (uint256)",
  "function getUserGMXPositions(address user) view returns (bytes32[])",
  "function depositUSDCECollateral(uint256 amount)",
  "function withdrawUSDCECollateral(uint256 amount)"
];

const FUSD_STABLECOIN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function burn(address from, uint256 amount)",
  "function totalSupply() view returns (uint256)"
];

const GMX_FUTURES_MANAGER_ABI = [
  "function openFuturesPosition(address token, uint256 size, bool isLong, uint256 leverage, uint256 collateral, uint256 expirationTime) returns (bytes32)",
  "function closeFuturesPosition(bytes32 positionKey) returns (uint256 pnl, uint256 collateralReturned)",
  "function adjustFuturesPosition(bytes32 positionKey, uint256 sizeDelta, bool isIncrease) returns (uint256 newSize, uint256 collateralDelta)",
  "function getFuturesPosition(bytes32 positionKey) view returns (address, uint256, bool, uint256, uint256, uint256, uint256, uint256, bool, uint256)",
  "function getUserActiveFuturesPositions(address user) view returns (bytes32[])",
  "function getCollateralBalance() view returns (uint256)",
  "function depositCollateral(uint256 amount)",
  "function withdrawCollateral(uint256 amount)",
  "function getTotalFuturesExposure() view returns (uint256)",
  "function calculateFuturesPnL(bytes32 positionKey) view returns (uint256)"
];

const ORACLE_MANAGER_ABI = [
  "function getPrice(address) view returns (uint256, uint256)",
  "function getPrices(address[]) view returns (uint256[], uint256[])"
];

const REBALANCER_ABI = [
  "function rebalance() returns (uint256)",
  "function emergencyRebalance() returns (uint256)",
  "function getRebalanceInfo() view returns (bool, uint256, uint256)"
];

const ContractContext = createContext();

export const useContracts = () => {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error('useContracts must be used within a ContractProvider');
  }
  return context;
};

export const ContractProvider = ({ children }) => {
  const { signer, isConnected, chainId } = useWallet();
  const [contracts, setContracts] = useState({});
  const [contractAddresses, setContractAddresses] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Load deployment addresses (local or Avalanche)
  const loadDeploymentAddresses = () => {
    try {
      return require('../deployments.json');
    } catch {
      return require('../deployments.example.json');
    }
  };

  const DEPLOYMENTS = loadDeploymentAddresses();

  // Contract addresses (memoized to prevent object recreation)
  // Support both local and Avalanche deployment structures
  const memoizedAddresses = useMemo(() => {
    const contracts = DEPLOYMENTS.contracts || {};
    return {
      strategy: contracts.strategy || contracts.AvalancheLSTStrategy || "0x...",
      futuresManager: contracts.gmxFuturesManager || contracts.GMXFuturesManager || contracts.PositionManager || "0x...",
      oracle: contracts.oracleManager || contracts.AvalancheOracleManager || "0x...",
      rebalancer: contracts.rebalancingEngine || contracts.RebalancingEngine || contracts.DeltaNeutralRebalancer || "0x...",
      emergencyControls: contracts.emergencyControls || contracts.EmergencyControls || "0x...",
      fusd: contracts.fusd || contracts.ForceStablecoin || "0x...",
      // Token addresses (mocks for local, real for Avalanche)
      wavax: contracts.mockWAVAX || DEPLOYMENTS.tokens?.WAVAX || "0x...",
      usdcE: contracts.mockUSDC || DEPLOYMENTS.tokens?.USDC_E || "0x...",
      savax: contracts.mockSAVAX || DEPLOYMENTS.tokens?.SAVAX || "0x...",
      stethE: DEPLOYMENTS.tokens?.STETH_E || "0x...",
      btcB: DEPLOYMENTS.tokens?.BTC_B || "0x..."
    };
  }, [DEPLOYMENTS]);

  // Initialize contracts when wallet is connected
  useEffect(() => {
    const initializeContracts = async () => {
      if (!signer || !isConnected) {
        setContracts({});
        return;
      }

      setIsLoading(true);
      try {
        console.log('🔧 Contract Context Debug:', { 
          network: DEPLOYMENTS.network || 'unknown',
          chainId, 
          addresses: memoizedAddresses, 
          isConnected 
        });
        setContractAddresses(memoizedAddresses);

        // Create contract instances
        const strategyContract = new ethers.Contract(memoizedAddresses.strategy, AVALANCHE_LST_STRATEGY_ABI, signer);
        const futuresManagerContract = memoizedAddresses.futuresManager ? 
          new ethers.Contract(memoizedAddresses.futuresManager, GMX_FUTURES_MANAGER_ABI, signer) : null;
        const oracleContract = new ethers.Contract(memoizedAddresses.oracle, ORACLE_MANAGER_ABI, signer);
        const rebalancerContract = new ethers.Contract(memoizedAddresses.rebalancer, REBALANCER_ABI, signer);
        const fusdContract = new ethers.Contract(memoizedAddresses.fusd, FUSD_STABLECOIN_ABI, signer);

        setContracts({
          strategy: strategyContract,
          gmxFuturesManager: futuresManagerContract,
          oracle: oracleContract,
          rebalancer: rebalancerContract,
          fusd: fusdContract,
        });
      } catch (error) {
        console.error('Error initializing contracts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeContracts();
  }, [signer, isConnected, chainId, memoizedAddresses]);

  // Contract interaction helpers for Avalanche LST Strategy
  const depositSAvax = async (amount, usdAmount) => {
    if (!contracts.strategy) throw new Error('Strategy contract not available');
    
    try {
      const tx = await contracts.strategy.depositSAvax(amount, usdAmount);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error depositing sAVAX:', error);
      throw error;
    }
  };

  const withdrawSAvax = async (fusdAmount, usdAmount) => {
    if (!contracts.strategy) throw new Error('Strategy contract not available');
    
    try {
      const tx = await contracts.strategy.withdrawSAvax(fusdAmount, usdAmount);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error withdrawing sAVAX:', error);
      throw error;
    }
  };

  const depositAVAX = async (amount) => {
    if (!contracts.strategy) throw new Error('Strategy contract not available');
    
    try {
      const tx = await contracts.strategy.depositAVAX({ value: amount });
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error depositing AVAX:', error);
      throw error;
    }
  };

  const triggerRebalance = async () => {
    if (!contracts.strategy) throw new Error('Strategy contract not available');
    
    try {
      const tx = await contracts.strategy.triggerRebalance();
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error triggering rebalance:', error);
      throw error;
    }
  };

  const executeRebalance = async () => {
    if (!contracts.strategy) throw new Error('Strategy contract not available');
    
    try {
      const tx = await contracts.strategy.executeRebalance();
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error executing rebalance:', error);
      throw error;
    }
  };

  const claimYield = async (userAddress) => {
    if (!contracts.strategy) throw new Error('Strategy contract not available');
    
    try {
      const tx = await contracts.strategy.claimYield(userAddress);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error claiming yield:', error);
      throw error;
    }
  };

  // Data fetching helpers
  const getUserData = async (userAddress) => {
    if (!contracts.strategy || !userAddress) return null;
    
    try {
      const [collateralValue, fusdMinted, lastUpdateTime, collateralRatio] = await contracts.strategy.getUserPosition(userAddress);
      const [totalLST, shortNotional, isActive, totalIn, totalOut] = await contracts.strategy.getStrategyMetrics();
      const [totalMinted, totalBurned, circulatingSupply] = await contracts.strategy.getFUSDMetrics();
      const [currentYieldIndex, totalYieldDistributed, lastYieldUpdate] = await contracts.strategy.getYieldMetrics();

      return {
        collateralValue: ethers.formatEther(collateralValue),
        fusdMinted: ethers.formatEther(fusdMinted),
        lastUpdateTime: lastUpdateTime.toString(),
        collateralRatio: Number(collateralRatio) / 100, // Convert from basis points
        totalLST: ethers.formatEther(totalLST),
        shortNotional: ethers.formatEther(shortNotional),
        isActive,
        totalIn: ethers.formatEther(totalIn),
        totalOut: ethers.formatEther(totalOut),
        totalMinted: ethers.formatEther(totalMinted),
        totalBurned: ethers.formatEther(totalBurned),
        circulatingSupply: ethers.formatEther(circulatingSupply),
        currentYieldIndex: ethers.formatEther(currentYieldIndex),
        totalYieldDistributed: ethers.formatEther(totalYieldDistributed),
        lastYieldUpdate: lastYieldUpdate.toString()
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  const getStrategyMetrics = async () => {
    if (!contracts.strategy) return null;
    
    try {
      const [totalLST, shortNotional, isActive, totalIn, totalOut] = await contracts.strategy.getStrategyMetrics();
      const [totalMinted, totalBurned, circulatingSupply] = await contracts.strategy.getFUSDMetrics();
      const [currentYieldIndex, totalYieldDistributed, lastYieldUpdate] = await contracts.strategy.getYieldMetrics();
      const [rebalanceThreshold, emergencyThreshold, rewardAmount, cooldown, lastRebalance] = await contracts.strategy.getRebalancingMetrics();
      
      return {
        totalLST: ethers.formatEther(totalLST),
        shortNotional: ethers.formatEther(shortNotional),
        isActive,
        totalIn: ethers.formatEther(totalIn),
        totalOut: ethers.formatEther(totalOut),
        totalMinted: ethers.formatEther(totalMinted),
        totalBurned: ethers.formatEther(totalBurned),
        circulatingSupply: ethers.formatEther(circulatingSupply),
        currentYieldIndex: ethers.formatEther(currentYieldIndex),
        totalYieldDistributed: ethers.formatEther(totalYieldDistributed),
        lastYieldUpdate: lastYieldUpdate.toString(),
        rebalanceThreshold: Number(rebalanceThreshold) / 100,
        emergencyThreshold: Number(emergencyThreshold) / 100,
        rewardAmount: ethers.formatEther(rewardAmount),
        cooldown: cooldown.toString(),
        lastRebalance: lastRebalance.toString()
      };
    } catch (error) {
      console.error('Error fetching strategy metrics:', error);
      return null;
    }
  };

  const getClaimableYield = async (userAddress) => {
    if (!contracts.strategy || !userAddress) return "0";
    
    try {
      const yieldAmount = await contracts.strategy.getClaimableYield(userAddress);
      return ethers.formatEther(yieldAmount);
    } catch (error) {
      console.error('Error fetching claimable yield:', error);
      return "0";
    }
  };

  const getGMXCollateralBalance = async () => {
    if (!contracts.strategy) return "0";
    
    try {
      const balance = await contracts.strategy.getGMXCollateralBalance();
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching GMX collateral balance:', error);
      return "0";
    }
  };

  const getUserGMXPositions = async (userAddress) => {
    if (!contracts.strategy || !userAddress) return [];
    
    try {
      const positions = await contracts.strategy.getUserGMXPositions(userAddress);
      return positions;
    } catch (error) {
      console.error('Error fetching user GMX positions:', error);
      return [];
    }
  };

  const getVaultHealth = async () => {
    if (!contracts.strategy) return null;
    
    try {
      const [totalLST, shortNotional, isActive, totalIn, totalOut] = await contracts.strategy.getStrategyMetrics();
      const [totalMinted, totalBurned, circulatingSupply] = await contracts.strategy.getFUSDMetrics();
      const health = await contracts.strategy.getProtocolHealth();
      
      return {
        totalCollateral: health.totalCollateralValue,
        totalFUSD: health.totalFUSDSupply,
        healthRatio: health.healthRatio,
        isSolvent: health.isSolvent,
        totalLST: ethers.formatEther(totalLST),
        shortNotional: ethers.formatEther(shortNotional),
        circulatingSupply: ethers.formatEther(circulatingSupply),
        isActive
      };
    } catch (error) {
      console.error('Error fetching vault health:', error);
      return null;
    }
  };

  const getRebalanceInfo = async () => {
    if (!contracts.strategy) return null;
    
    try {
      const [targetRatio, currentRatio, deviation, needsRebalance, lastCheckTime] = await contracts.strategy.checkRebalanceStatus();
      const [totalLST, shortNotional] = await contracts.strategy.getStrategyMetrics();
      
      // Calculate portfolio delta (simplified)
      const lstValue = parseFloat(ethers.formatEther(totalLST)) * 20; // Assume $20 per sAVAX
      const shortValue = parseFloat(ethers.formatEther(shortNotional));
      const totalValue = lstValue + shortValue;
      const portfolioDelta = totalValue > 0 ? ((lstValue - shortValue) / totalValue) * 100 : 0;
      
      return {
        targetRatio: Number(targetRatio) / 100,
        currentRatio: Number(currentRatio) / 100,
        deviation: Number(deviation) / 100,
        needsRebalance,
        lastCheckTime: lastCheckTime.toString(),
        portfolioDelta
      };
    } catch (error) {
      console.error('Error fetching rebalance info:', error);
      return null;
    }
  };

  const value = {
    contracts,
    contractAddresses,
    isLoading,
    // Contract interaction methods
    depositSAvax,
    withdrawSAvax,
    depositAVAX,
    triggerRebalance,
    executeRebalance,
    claimYield,
    // Data fetching methods
    getUserData,
    getStrategyMetrics,
    getClaimableYield,
    getGMXCollateralBalance,
    getUserGMXPositions,
    getVaultHealth,
    getRebalanceInfo,
  };

  return (
    <ContractContext.Provider value={value}>
      {children}
    </ContractContext.Provider>
  );
};
