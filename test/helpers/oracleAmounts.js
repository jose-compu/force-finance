const { ethers } = require("hardhat");

const SAVAX_ORACLE_PRICE_USD = 22;

function oracleAlignedDeposit(savaxTokens) {
    const amount = ethers.utils.parseEther(String(savaxTokens));
    const usd = amount.mul(SAVAX_ORACLE_PRICE_USD);
    return { amount, usd };
}

module.exports = {
    SAVAX_ORACLE_PRICE_USD,
    oracleAlignedDeposit,
};
