const { ethers } = require("hardhat");

async function main() {
    console.log("Getting contract factory...");
    const AvalancheLSTStrategy = await ethers.getContractFactory("AvalancheLSTStrategy");
    
    console.log("Contract interface:");
    console.log("Constructor inputs:", AvalancheLSTStrategy.interface.deploy.inputs);
    
    console.log("Attempting deployment...");
    try {
        const [owner] = await ethers.getSigners();
        const USDC_E_ADDRESS = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
        const strategy = await AvalancheLSTStrategy.deploy(owner.address, 200, USDC_E_ADDRESS);
        console.log("Deployment successful!");
        console.log("Strategy address:", strategy.address);
    } catch (error) {
        console.error("Deployment failed:", error.message);
    }
}

main().catch(console.error);
