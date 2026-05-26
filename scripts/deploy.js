const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy UniswapV3Oracle
  console.log("\nDeploying UniswapV3Oracle...");
  const UniswapV3Oracle = await ethers.getContractFactory("UniswapV3Oracle");
  const oracle = await UniswapV3Oracle.deploy();
  await oracle.waitForDeployment();
  console.log("UniswapV3Oracle deployed to:", await oracle.getAddress());

  // Deploy ForceStablecoin
  console.log("\nDeploying ForceStablecoin...");
  const ForceStablecoin = await ethers.getContractFactory("ForceStablecoin");
  const stablecoin = await ForceStablecoin.deploy("Force USD", "FUSD");
  await stablecoin.waitForDeployment();
  console.log("ForceStablecoin deployed to:", await stablecoin.getAddress());

  // Deploy YieldDistributor
  console.log("\nDeploying YieldDistributor...");
  const YieldDistributor = await ethers.getContractFactory("YieldDistributor");
  const yieldDistributor = await YieldDistributor.deploy(await stablecoin.getAddress());
  await yieldDistributor.waitForDeployment();
  console.log("YieldDistributor deployed to:", await yieldDistributor.getAddress());

  // Deploy LPFarming
  console.log("\nDeploying LPFarming...");
  const LPFarming = await ethers.getContractFactory("LPFarming");
  const currentTime = Math.floor(Date.now() / 1000);
  const lpFarming = await LPFarming.deploy(
    currentTime, // start time
    currentTime + (365 * 24 * 60 * 60), // end time (1 year)
    currentTime + (30 * 24 * 60 * 60)   // bonus end time (30 days)
  );
  await lpFarming.waitForDeployment();
  console.log("LPFarming deployed to:", await lpFarming.getAddress());

  // Deploy RebalanceIncentives
  console.log("\nDeploying RebalanceIncentives...");
  const RebalanceIncentives = await ethers.getContractFactory("RebalanceIncentives");
  const incentives = await RebalanceIncentives.deploy(deployer.address); // Using deployer as treasury
  await incentives.waitForDeployment();
  console.log("RebalanceIncentives deployed to:", await incentives.getAddress());

  // Deploy DeltaNeutralStrategy
  console.log("\nDeploying DeltaNeutralStrategy...");
  const DeltaNeutralStrategy = await ethers.getContractFactory("DeltaNeutralStrategy");
  const strategy = await DeltaNeutralStrategy.deploy(
    await oracle.getAddress(),
    ethers.ZeroAddress // Vault address will be set later
  );
  await strategy.waitForDeployment();
  console.log("DeltaNeutralStrategy deployed to:", await strategy.getAddress());

  // Deploy ForceVault
  console.log("\nDeploying ForceVault...");
  const ForceVault = await ethers.getContractFactory("ForceVault");
  const vault = await ForceVault.deploy(
    await stablecoin.getAddress(),
    await oracle.getAddress(),
    await strategy.getAddress(),
    await incentives.getAddress(),
    await yieldDistributor.getAddress()
  );
  await vault.waitForDeployment();
  console.log("ForceVault deployed to:", await vault.getAddress());

  // Set up contract relationships
  console.log("\nSetting up contract relationships...");
  
  // Set vault in stablecoin
  await stablecoin.setVault(await vault.getAddress());
  console.log("Vault set in ForceStablecoin");

  // Transfer ownership of strategy to vault
  await strategy.transferOwnership(await vault.getAddress());
  console.log("DeltaNeutralStrategy ownership transferred to vault");

  // Transfer ownership of yield distributor to vault
  await yieldDistributor.transferOwnership(await vault.getAddress());
  console.log("YieldDistributor ownership transferred to vault");

  // Transfer ownership of incentives to vault
  await incentives.transferOwnership(await vault.getAddress());
  console.log("RebalanceIncentives ownership transferred to vault");

  // Fund incentive pool with 1 ETH
  console.log("\nFunding pools...");
  await incentives.fundIncentivePool({ value: ethers.parseEther("1.0") });
  console.log("Incentive pool funded with 1 ETH");
  
  await yieldDistributor.fundIncentivePool({ value: ethers.parseEther("2.0") });
  console.log("Yield pool funded with 2 ETH");
  
  await lpFarming.depositRewards({ value: ethers.parseEther("5.0") });
  console.log("LP farming pool funded with 5 ETH");

  // Deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("ForceStablecoin:", await stablecoin.getAddress());
  console.log("UniswapV3Oracle:", await oracle.getAddress());
  console.log("YieldDistributor:", await yieldDistributor.getAddress());
  console.log("LPFarming:", await lpFarming.getAddress());
  console.log("DeltaNeutralStrategy:", await strategy.getAddress());
  console.log("RebalanceIncentives:", await incentives.getAddress());
  console.log("ForceVault:", await vault.getAddress());
  
  // Save deployment addresses
  const deploymentData = {
    network: await deployer.provider.getNetwork(),
    timestamp: Date.now(),
    deployer: deployer.address,
    contracts: {
      ForceStablecoin: await stablecoin.getAddress(),
      UniswapV3Oracle: await oracle.getAddress(),
      YieldDistributor: await yieldDistributor.getAddress(),
      LPFarming: await lpFarming.getAddress(),
      DeltaNeutralStrategy: await strategy.getAddress(),
      RebalanceIncentives: await incentives.getAddress(),
      ForceVault: await vault.getAddress()
    }
  };
  
  const fs = require('fs');
  fs.writeFileSync(
    './deployments.json',
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("\nDeployment data saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
