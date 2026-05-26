// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Fork Test Strategy
 * @dev Minimal contract to test CREATE2 deployment and Avalanche fork functionality
 */
contract ForkTestStrategy is Ownable, ReentrancyGuard {

    // Real Avalanche mainnet addresses
    address public constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address public constant USDC_E = 0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664;
    address public constant GMX_VAULT = 0x9ab2De34A33fB459b538c43f251eB825645e8595;

    uint256 public totalDeposits;
    mapping(address => uint256) public userDeposits;
    
    event DepositMade(address indexed user, uint256 amount);
    event WithdrawalMade(address indexed user, uint256 amount);

    constructor() {}

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20(USDC_E).transferFrom(msg.sender, address(this), amount);
        userDeposits[msg.sender] += amount;
        totalDeposits += amount;
        
        emit DepositMade(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(userDeposits[msg.sender] >= amount, "Insufficient balance");
        
        userDeposits[msg.sender] -= amount;
        totalDeposits -= amount;
        IERC20(USDC_E).transfer(msg.sender, amount);
        
        emit WithdrawalMade(msg.sender, amount);
    }

    function getProtocolInfo() external view returns (
        uint256 wavaxBalance,
        uint256 usdcBalance,
        uint256 gmxPoolAmount
    ) {
        wavaxBalance = IERC20(WAVAX).balanceOf(address(this));
        usdcBalance = IERC20(USDC_E).balanceOf(address(this));
        
        // Test GMX vault interaction on fork
        try this.getGMXPoolAmount() returns (uint256 amount) {
            gmxPoolAmount = amount;
        } catch {
            gmxPoolAmount = 0;
        }
    }

    function getGMXPoolAmount() external view returns (uint256) {
        (bool success, bytes memory data) = GMX_VAULT.staticcall(
            abi.encodeWithSignature("poolAmounts(address)", WAVAX)
        );
        
        if (success && data.length >= 32) {
            return abi.decode(data, (uint256));
        }
        return 0;
    }

    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            uint256 balance = address(this).balance;
            require(balance > 0, "No ETH to withdraw");
            
            (bool success, ) = payable(owner()).call{value: balance}("");
            require(success, "ETH transfer failed");
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            require(balance > 0, "No tokens to withdraw");
            IERC20(token).transfer(owner(), balance);
        }
    }

    receive() external payable {}
}
