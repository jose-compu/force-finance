#!/bin/bash

# Start Local Testnet with UI
# This script starts Hardhat node, deploys contracts, and starts the frontend

set -e

echo "🚀 Starting Force Finance Local Testnet..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
fi

# Check if frontend node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Frontend node_modules not found. Installing dependencies...${NC}"
    cd frontend && npm install && cd ..
fi

# Start Hardhat node in background
echo -e "${BLUE}📡 Starting Hardhat node...${NC}"
npx hardhat node > hardhat-node.log 2>&1 &
HARDHAT_PID=$!

# Wait for node to be ready
echo -e "${BLUE}⏳ Waiting for Hardhat node to be ready...${NC}"
sleep 5

# Deploy contracts
echo -e "${BLUE}📦 Deploying contracts to local network...${NC}"
npx hardhat run scripts/deploy-local.js --network localhost

# Start frontend
echo -e "${GREEN}✅ Contracts deployed!${NC}"
echo -e "${BLUE}🌐 Starting frontend...${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Local testnet is ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "📡 Hardhat Node: http://127.0.0.1:8545"
echo -e "🌐 Frontend: http://localhost:3000"
echo -e "📄 Contract addresses: deployments-local.json"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Start frontend
cd frontend && npm start

# Cleanup on exit
trap "kill $HARDHAT_PID 2>/dev/null" EXIT
