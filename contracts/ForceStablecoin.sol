// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ForceStablecoin (FUSD)
 * @dev Simple stablecoin implementation for the AvalancheLSTStrategy
 */
contract ForceStablecoin is ERC20, Ownable {
    mapping(address => bool) public minters;
    mapping(address => bool) public burners;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event BurnerAdded(address indexed burner);
    event BurnerRemoved(address indexed burner);

    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable() {}

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "ForceStablecoin: caller is not a minter");
        _;
    }

    modifier onlyBurner() {
        require(burners[msg.sender] || msg.sender == owner(), "ForceStablecoin: caller is not a burner");
        _;
    }

    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    function addBurner(address burner) external onlyOwner {
        burners[burner] = true;
        emit BurnerAdded(burner);
    }

    function removeBurner(address burner) external onlyOwner {
        burners[burner] = false;
        emit BurnerRemoved(burner);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyBurner {
        _burn(from, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
