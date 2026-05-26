const { ethers } = require("hardhat");

const WETH_E = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";
const WBTC_E = "0x50b7545627a5162F82A992c33b87aDc75187B218";

async function seedOracleCache(oracleManager, price = ethers.utils.parseEther("25")) {
    await oracleManager.updatePriceCache(WETH_E, price);
    await oracleManager.updatePriceCache(WBTC_E, price);
}

module.exports = {
    WETH_E,
    WBTC_E,
    seedOracleCache,
};
