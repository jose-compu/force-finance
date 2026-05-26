#!/bin/bash

echo "🔄 Restarting Force Finance with Chain ID 13337..."

# Switch to Node.js 20
echo "🔧 Switching to Node.js 20..."
source ~/.nvm/nvm.sh
nvm use 20.19.3
echo "✅ Using Node.js version: $(node --version)"

# Kill all existing processes
echo "⏹️  Stopping all running processes..."
pkill -f "hardhat node" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
pkill -f "concurrently" 2>/dev/null || true

# Wait for processes to stop
sleep 3

# Clean cache and deployment files
echo "🧹 Cleaning cache and deployment files..."
rm -rf cache/ 2>/dev/null || true
rm -rf artifacts/ 2>/dev/null || true
rm frontend/src/deployments.json 2>/dev/null || true
rm deployments-local.json 2>/dev/null || true
rm -rf frontend/node_modules/.cache 2>/dev/null || true
rm -rf frontend/build 2>/dev/null || true

# Verify hardhat config has correct chain ID
echo "✅ Hardhat config chain ID: $(grep -A1 'chainId:' hardhat.config.js | grep '13337' | wc -l | tr -d ' ') occurrences of 13337"

# Start fresh with correct chain ID
echo "🚀 Starting Force Finance with Chain ID 13337..."
echo "⏰ Allowing extra time for node startup (25s delay for deployment)..."
npm run dev

echo "✅ Force Finance restarted!"
echo "📋 Configure MetaMask:"
echo "   - Network Name: Force Finance Local"
echo "   - RPC URL: http://127.0.0.1:8545"
echo "   - Chain ID: 13337"
echo "   - Currency Symbol: ETH"
