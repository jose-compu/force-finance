import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Yield from '../Yield';
import { WalletProvider } from '../../contexts/WalletContext';
import { ContractProvider } from '../../contexts/ContractContext';

// Mock the contexts
jest.mock('../../contexts/WalletContext', () => ({
  useWallet: () => ({
    account: '0x1234567890123456789012345678901234567890',
    isConnected: true,
    provider: {},
    signer: {}
  }),
  WalletProvider: ({ children }) => <div>{children}</div>
}));

jest.mock('../../contexts/ContractContext', () => ({
  useContracts: () => ({
    contracts: {
      yieldDistributor: {},
      lpFarming: {}
    },
    getUserData: jest.fn().mockResolvedValue({
      stakedAmount: '1000',
      pendingRewards: '2.5'
    })
  }),
  ContractProvider: ({ children }) => <div>{children}</div>
}));

describe('Yield Component', () => {
  const renderWithProviders = (component) => {
    return render(
      <WalletProvider>
        <ContractProvider>
          {component}
        </ContractProvider>
      </WalletProvider>
    );
  };

  test('renders yield farming header', () => {
    renderWithProviders(<Yield />);
    expect(screen.getByText('Yield Farming')).toBeInTheDocument();
    expect(screen.getByText('Stake FUSD and farm LP tokens to earn rewards')).toBeInTheDocument();
  });

  test('displays yield overview cards', () => {
    renderWithProviders(<Yield />);
    
    expect(screen.getByText('My Staked FUSD')).toBeInTheDocument();
    expect(screen.getByText('Pending Rewards')).toBeInTheDocument();
    expect(screen.getByText('Total Staked')).toBeInTheDocument();
    expect(screen.getByText('Current APY')).toBeInTheDocument();
  });

  test('renders tab navigation', () => {
    renderWithProviders(<Yield />);
    
    expect(screen.getByText('Stake FUSD')).toBeInTheDocument();
    expect(screen.getByText('LP Farming')).toBeInTheDocument();
    expect(screen.getByText('My Rewards')).toBeInTheDocument();
  });

  test('switches between tabs correctly', () => {
    renderWithProviders(<Yield />);
    
    // Default tab should be "Stake FUSD"
    expect(screen.getByText('How FUSD Staking Works')).toBeInTheDocument();
    
    // Click LP Farming tab
    fireEvent.click(screen.getByText('LP Farming'));
    expect(screen.getByText('Available Farming Pools')).toBeInTheDocument();
    
    // Click My Rewards tab
    fireEvent.click(screen.getByText('My Rewards'));
    expect(screen.getByText('My Rewards Summary')).toBeInTheDocument();
  });

  test('stake form handles input correctly', () => {
    renderWithProviders(<Yield />);
    
    const stakeInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(stakeInput, { target: { value: '100' } });
    
    expect(stakeInput.value).toBe('100');
  });

  test('stake button is disabled when no amount entered', () => {
    renderWithProviders(<Yield />);
    
    const stakeButton = screen.getByText('Stake FUSD');
    expect(stakeButton).toBeDisabled();
  });

  test('stake button is enabled when amount is entered', () => {
    renderWithProviders(<Yield />);
    
    const stakeInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(stakeInput, { target: { value: '100' } });
    
    const stakeButton = screen.getByText('Stake FUSD');
    expect(stakeButton).not.toBeDisabled();
  });

  test('displays LP farming pools', () => {
    renderWithProviders(<Yield />);
    
    // Switch to LP Farming tab
    fireEvent.click(screen.getByText('LP Farming'));
    
    expect(screen.getByText('FUSD/USDC')).toBeInTheDocument();
    expect(screen.getByText('FUSD/ETH')).toBeInTheDocument();
    expect(screen.getByText('15.2%')).toBeInTheDocument();
    expect(screen.getByText('22.8%')).toBeInTheDocument();
  });

  test('shows rewards summary in rewards tab', () => {
    renderWithProviders(<Yield />);
    
    // Switch to My Rewards tab
    fireEvent.click(screen.getByText('My Rewards'));
    
    expect(screen.getByText('Total Pending')).toBeInTheDocument();
    expect(screen.getByText('Staking Rewards')).toBeInTheDocument();
    expect(screen.getByText('Farming Rewards')).toBeInTheDocument();
    expect(screen.getByText('Claim Staking Rewards')).toBeInTheDocument();
  });

  test('refresh button works', () => {
    renderWithProviders(<Yield />);
    
    const refreshButton = screen.getByText('↻ Refresh');
    fireEvent.click(refreshButton);
    
    // Button should be disabled during refresh
    expect(refreshButton).toBeDisabled();
  });
});

// Test for disconnected wallet state
describe('Yield Component - Disconnected Wallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock disconnected wallet
    jest.mock('../../contexts/WalletContext', () => ({
      useWallet: () => ({
        account: null,
        isConnected: false,
        provider: null,
        signer: null
      }),
      WalletProvider: ({ children }) => <div>{children}</div>
    }));
  });

  test('shows connect wallet message when disconnected', () => {
    render(<Yield />);
    
    expect(screen.getByText('Yield Farming')).toBeInTheDocument();
    expect(screen.getByText('Connect your wallet to start earning yield')).toBeInTheDocument();
    expect(screen.getByText('Earn Yield on Your FUSD')).toBeInTheDocument();
  });
});
