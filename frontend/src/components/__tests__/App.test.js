import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../../App';

// Mock the wallet and contract contexts
jest.mock('../../contexts/WalletContext', () => ({
  useWallet: () => ({
    account: null,
    isConnected: false,
    provider: null,
    signer: null
  }),
  WalletProvider: ({ children }) => <div data-testid="wallet-provider">{children}</div>
}));

jest.mock('../../contexts/ContractContext', () => ({
  useContracts: () => ({
    contracts: {},
    getUserData: jest.fn(),
    getVaultHealth: jest.fn(),
    getRebalanceInfo: jest.fn()
  }),
  ContractProvider: ({ children }) => <div data-testid="contract-provider">{children}</div>
}));

// Mock individual components to avoid complex rendering
jest.mock('../Dashboard', () => {
  return function Dashboard() {
    return <div data-testid="dashboard">Dashboard Component</div>;
  };
});

jest.mock('../Vault', () => {
  return function Vault() {
    return <div data-testid="vault">Vault Component</div>;
  };
});

jest.mock('../Yield', () => {
  return function Yield() {
    return <div data-testid="yield">Yield Component</div>;
  };
});

jest.mock('../Rebalancer', () => {
  return function Rebalancer() {
    return <div data-testid="rebalancer">Rebalancer Component</div>;
  };
});

describe('App Component', () => {
  test('renders Force Finance header', () => {
    render(<App />);
    expect(screen.getByText('⚡ Force Finance')).toBeInTheDocument();
  });

  test('renders navigation menu', () => {
    render(<App />);
    
    expect(screen.getByText('📊 Dashboard')).toBeInTheDocument();
    expect(screen.getByText('🏦 Vault')).toBeInTheDocument();
    expect(screen.getByText('🌾 Yield')).toBeInTheDocument();
    expect(screen.getByText('⚖️ Rebalancer')).toBeInTheDocument();
  });

  test('renders dashboard by default', () => {
    render(<App />);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  test('navigation switches between components', () => {
    render(<App />);
    
    // Click Vault
    fireEvent.click(screen.getByText('🏦 Vault'));
    expect(screen.getByTestId('vault')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    
    // Click Yield
    fireEvent.click(screen.getByText('🌾 Yield'));
    expect(screen.getByTestId('yield')).toBeInTheDocument();
    expect(screen.queryByTestId('vault')).not.toBeInTheDocument();
    
    // Click Rebalancer
    fireEvent.click(screen.getByText('⚖️ Rebalancer'));
    expect(screen.getByTestId('rebalancer')).toBeInTheDocument();
    expect(screen.queryByTestId('yield')).not.toBeInTheDocument();
    
    // Click Dashboard
    fireEvent.click(screen.getByText('📊 Dashboard'));
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('rebalancer')).not.toBeInTheDocument();
  });

  test('navigation highlights active tab', () => {
    render(<App />);
    
    const dashboardTab = screen.getByText('📊 Dashboard');
    const vaultTab = screen.getByText('🏦 Vault');
    
    // Dashboard should be active by default
    expect(dashboardTab.closest('button')).toHaveClass('border-blue-500', 'text-blue-600');
    
    // Click Vault tab
    fireEvent.click(vaultTab);
    expect(vaultTab.closest('button')).toHaveClass('border-blue-500', 'text-blue-600');
    expect(dashboardTab.closest('button')).not.toHaveClass('border-blue-500', 'text-blue-600');
  });

  test('renders connect wallet button when disconnected', () => {
    render(<App />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  test('wraps app in providers', () => {
    render(<App />);
    expect(screen.getByTestId('wallet-provider')).toBeInTheDocument();
    expect(screen.getByTestId('contract-provider')).toBeInTheDocument();
  });
});

// Test wallet connection component separately
describe('WalletConnection Component', () => {
  // Mock window.ethereum
  const mockEthereum = {
    request: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  };

  beforeEach(() => {
    global.window.ethereum = mockEthereum;
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.window.ethereum;
  });

  test('connect wallet button triggers connection', async () => {
    mockEthereum.request.mockResolvedValue(['0x1234567890123456789012345678901234567890']);
    
    render(<App />);
    
    const connectButton = screen.getByText('Connect Wallet');
    fireEvent.click(connectButton);
    
    expect(mockEthereum.request).toHaveBeenCalledWith({
      method: 'eth_requestAccounts'
    });
  });

  test('shows connecting state during wallet connection', async () => {
    mockEthereum.request.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<App />);
    
    const connectButton = screen.getByText('Connect Wallet');
    fireEvent.click(connectButton);
    
    // Should show connecting state
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });
});
