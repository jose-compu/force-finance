#!/bin/bash

echo "🏔️  Starting Avalanche C-Chain Mainnet Fork for Local Development"
echo ""

# Check if .env exists and has AVALANCHE_RPC_URL
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating template..."
    cat > .env << EOF
# Avalanche RPC URL - Update with your Infura/Alchemy endpoint
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Optional: Use Infura for better reliability
# AVALANCHE_RPC_URL=https://avalanche-mainnet.infura.io/v3/YOUR_PROJECT_ID

# Private key for deployment (optional)
# PRIVATE_KEY=0x...

# Testing configuration
REPORT_GAS=true
NETWORK=avalanche
CHAIN_ID=43114
EOF
    echo "✅ Created .env template. Update AVALANCHE_RPC_URL if needed."
    echo ""
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo "🌐 Using RPC: $AVALANCHE_RPC_URL"
echo ""

# Compile contracts first
echo "🔨 Compiling contracts..."
npx hardhat compile

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed. Please fix contract errors first."
    exit 1
fi

echo "✅ Compilation successful!"
echo ""

# Start the hardhat node with Avalanche fork
echo "🚀 Starting Hardhat node with Avalanche mainnet fork..."
echo "   Chain ID: 43114"
echo "   Fork Block: Latest"
echo "   Accounts: 20 (10,000 AVAX each)"
echo ""

# Kill any existing hardhat processes
pkill -f "hardhat node" 2>/dev/null || true

# Start hardhat node in background (fork config is in hardhat.config.js)
npx hardhat node &
NODE_PID=$!

echo "🔄 Waiting for node to start..."
sleep 5

# Check if node started successfully
if ps -p $NODE_PID > /dev/null; then
    echo "✅ Hardhat node started successfully (PID: $NODE_PID)"
    echo ""
    
    # Deploy contracts with CREATE2
    echo "📦 Deploying contracts with CREATE2..."
    npx hardhat run scripts/deploy-create2-fork.js --network hardhat
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Deployment completed successfully!"
        echo ""
        echo "📋 Available Commands:"
        echo "   • Test deployment: ./test-fork-deployment.sh"
        echo "   • Run specific tests: npx hardhat test --network hardhat"
        echo "   • Interact with contracts: npx hardhat console --network hardhat"
        echo "   • Stop fork: kill $NODE_PID"
        echo ""
        echo "🔗 Fork Information:"
        echo "   • RPC URL: http://127.0.0.1:8545"
        echo "   • Chain ID: 43114"
        echo "   • Network: Avalanche Fork"
        echo ""
        echo "💡 The fork is running with real Avalanche mainnet state!"
        echo "   All GMX, BENQI, and token contracts are available at real addresses."
        echo ""
        
        # Keep the script running to maintain the fork
        echo "🔄 Fork is running... Press Ctrl+C to stop"
        trap "echo ''; echo '🛑 Stopping Avalanche fork...'; kill $NODE_PID 2>/dev/null || true; exit 0" INT
        
        # Wait for the node process
        wait $NODE_PID
    else
        echo "❌ Deployment failed!"
        kill $NODE_PID 2>/dev/null || true
        exit 1
    fi
else
    echo "❌ Failed to start Hardhat node"
    exit 1
fi
