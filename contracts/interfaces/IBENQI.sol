// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IBENQI - BENQI Protocol Interfaces for Avalanche
 * @dev Production-ready interfaces for sAVAX staking and QI token rewards
 */

interface ISAVAXToken is IERC20 {
    /**
     * @dev Get the amount of AVAX that corresponds to `_sharesAmount` token shares.
     * @param _sharesAmount amount of shares to convert
     * @return amount of AVAX
     */
    function getPooledAvaxByShares(uint256 _sharesAmount) external view returns (uint256);

    /**
     * @dev Get the amount of shares that corresponds to `_avaxAmount` protocol-controlled AVAX.
     * @param _avaxAmount amount of AVAX to convert
     * @return amount of shares
     */
    function getSharesByPooledAvax(uint256 _avaxAmount) external view returns (uint256);

    /**
     * @dev Get total amount of AVAX controlled by the protocol
     * @return total pooled AVAX
     */
    function getTotalPooledAvax() external view returns (uint256);

    /**
     * @dev Get total amount of shares issued
     * @return total shares
     */
    function getTotalShares() external view returns (uint256);

    /**
     * @dev Submit AVAX for staking and receive sAVAX shares
     * @return shares amount of sAVAX shares minted
     */
    function submit() external payable returns (uint256 shares);

    /**
     * @dev Request withdrawal of AVAX by burning sAVAX shares
     * @param _amount amount of sAVAX to burn
     * @return shares amount of shares burned
     */
    function requestWithdrawal(uint256 _amount) external returns (uint256 shares);

    /**
     * @dev Claim pending withdrawals
     * @param _recipient address to receive AVAX
     */
    function claimWithdrawal(address _recipient) external;

    /**
     * @dev Get exchange rate: sAVAX to AVAX
     * @return rate exchange rate scaled by 1e18
     */
    function getExchangeRate() external view returns (uint256 rate);
}

interface IQIToken is IERC20 {
    /**
     * @dev Claim QI rewards from staking
     * @param holder address to claim rewards for
     */
    function claimReward(address holder) external;

    /**
     * @dev Get claimable QI rewards
     * @param holder address to check rewards for
     * @return amount of claimable QI tokens
     */
    function getClaimableReward(address holder) external view returns (uint256);
}

interface IBENQIComptroller {
    /**
     * @dev Claim QI rewards for multiple markets
     * @param holder address to claim rewards for
     * @param qiTokens array of qiToken addresses to claim rewards from
     */
    function claimReward(address holder, address[] memory qiTokens) external;

    /**
     * @dev Get reward speed for a market
     * @param qiToken address of the qiToken market
     * @return reward speed per block
     */
    function rewardSpeeds(address qiToken) external view returns (uint256);

    /**
     * @dev Enter markets to start earning rewards
     * @param qiTokens array of qiToken addresses to enter
     * @return results array indicating success for each market
     */
    function enterMarkets(address[] memory qiTokens) external returns (uint256[] memory);
}

interface IQiAVAX {
    /**
     * @dev Supply AVAX to the market
     */
    function mint() external payable;

    /**
     * @dev Redeem qiAVAX for underlying AVAX
     * @param redeemTokens amount of qiAVAX to redeem
     * @return success code
     */
    function redeem(uint256 redeemTokens) external returns (uint256);

    /**
     * @dev Get exchange rate from qiAVAX to AVAX
     * @return rate exchange rate scaled by 1e18
     */
    function exchangeRateStored() external view returns (uint256);

    /**
     * @dev Get supply rate per block
     * @return rate supply rate per block
     */
    function supplyRatePerBlock() external view returns (uint256);
}

interface IBENQI {
    function getExchangeRate() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}
