const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏔️  Testing Avalanche LST Strategy Contract Compilation\n');

// List of our new Avalanche-specific contracts
const avalancheContracts = [
  'AvalancheLSTStrategy.sol',
  'AvalancheOracleManager.sol',
  'PositionManager.sol',
  'RebalancingEngine.sol',
  'EmergencyControls.sol',
  'LeverageOptimizer.sol'
];

// Temporarily rename problematic contracts to avoid compilation conflicts
const problematicContracts = [
  'DeltaNeutralStrategy.sol',
  'ForceVault.sol',
  'ForceDAOToken.sol',
  'YieldDistributor.sol',
  'RebalanceIncentives.sol',
  'LPFarming.sol',
  'ForceStablecoin.sol'
];

console.log('📁 Temporarily moving legacy contracts...');
const tempDir = './contracts/temp_legacy';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Move problematic contracts temporarily
problematicContracts.forEach(contract => {
  const sourcePath = `./contracts/${contract}`;
  const destPath = `${tempDir}/${contract}`;
  
  if (fs.existsSync(sourcePath)) {
    fs.renameSync(sourcePath, destPath);
    console.log(`   Moved ${contract}`);
  }
});

try {
  console.log('\n🔨 Compiling Avalanche contracts...');
  
  // Run compilation
  execSync('npx hardhat compile', { stdio: 'inherit' });
  
  console.log('\n✅ Avalanche contracts compiled successfully!');
  
  // List compiled contracts
  console.log('\n📋 Successfully compiled contracts:');
  avalancheContracts.forEach(contract => {
    const artifactPath = `./artifacts/contracts/${contract}/${contract.replace('.sol', '.json')}`;
    if (fs.existsSync(artifactPath)) {
      console.log(`   ✅ ${contract}`);
    } else {
      console.log(`   ❌ ${contract} (artifact not found)`);
    }
  });
  
} catch (error) {
  console.error('\n❌ Compilation failed:', error.message);
} finally {
  // Restore problematic contracts
  console.log('\n📁 Restoring legacy contracts...');
  problematicContracts.forEach(contract => {
    const sourcePath = `${tempDir}/${contract}`;
    const destPath = `./contracts/${contract}`;
    
    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, destPath);
      console.log(`   Restored ${contract}`);
    }
  });
  
  // Clean up temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
}

console.log('\n🎯 Next steps:');
console.log('   1. Update .env with your Infura Project ID');
console.log('   2. Run: ./test/run-tests.sh');
console.log('   3. Test with real Avalanche mainnet data');
