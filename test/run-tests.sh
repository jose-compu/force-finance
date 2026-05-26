#!/bin/bash

# Test runner script for Avalanche LST Strategy
# Runs comprehensive tests using mainnet forking

echo "🔧 Setting up Avalanche LST Strategy Testing Environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create one with AVALANCHE_RPC_URL"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Validate required environment variables
if [ -z "$AVALANCHE_RPC_URL" ] || [ "$AVALANCHE_RPC_URL" = "https://avalanche-mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID" ]; then
    echo "❌ Please set your Infura Project ID in AVALANCHE_RPC_URL"
    echo "   Update .env with: AVALANCHE_RPC_URL=https://avalanche-mainnet.infura.io/v3/YOUR_ACTUAL_PROJECT_ID"
    exit 1
fi

echo "✅ Environment variables loaded"
echo "🌐 Using Avalanche RPC: $AVALANCHE_RPC_URL"

# Run different test suites
echo ""
echo "🧪 Running Test Suite..."

echo "📋 1. Unit Tests - Oracle Manager"
npx hardhat test test/unit/AvalancheOracleManager.test.js --network hardhat

echo ""
echo "📋 2. Unit Tests - Strategy Contract"
npx hardhat test test/unit/AvalancheLSTStrategy.test.js --network hardhat

echo ""
echo "📋 3. Integration Tests - Real Contract Integration"
npx hardhat test test/integration/RealContractIntegration.test.js --network hardhat

echo ""
echo "📋 4. Integration Tests - Strategy with GMX"
npx hardhat test test/integration/StrategyGMXIntegration.test.js --network hardhat

echo ""
echo "🎉 All tests completed!"
echo ""
echo "💡 Next steps:"
echo "   - Review test output for any failures"
echo "   - Check gas usage reports"
echo "   - Verify real contract interactions"
