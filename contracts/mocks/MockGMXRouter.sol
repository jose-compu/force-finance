// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockGMXRouter
 * @dev Mock implementation of GMX Router for testing
 */
contract MockGMXRouter {
    address public vault;
    address public usdg;
    uint256 public maxLeverage = 50;
    
    mapping(address => bool) public approvedPlugins;
    
    event Swap(
        address indexed account,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    event IncreasePosition(
        address indexed account,
        address collateralToken,
        address indexToken,
        uint256 collateralDelta,
        uint256 sizeDelta,
        bool isLong,
        uint256 price,
        uint256 fee
    );
    
    event DecreasePosition(
        address indexed account,
        address collateralToken,
        address indexToken,
        uint256 collateralDelta,
        uint256 sizeDelta,
        bool isLong,
        uint256 price,
        uint256 fee
    );
    
    constructor(address _vault, address _usdg) {
        vault = _vault;
        usdg = _usdg;
    }
    
    function swap(
        address[] calldata _path,
        uint256 _amountIn,
        uint256 _minOut,
        address _receiver
    ) external {
        require(_path.length >= 2, "Invalid path");
        require(_amountIn > 0, "Invalid amount");
        
        address tokenIn = _path[0];
        address tokenOut = _path[_path.length - 1];
        
        // Transfer tokens from sender
        IERC20(tokenIn).transferFrom(msg.sender, address(this), _amountIn);
        
        // Mock 1:1 swap for simplicity
        uint256 amountOut = _amountIn;
        require(amountOut >= _minOut, "Insufficient output");
        
        // Transfer tokens to receiver
        IERC20(tokenOut).transfer(_receiver, amountOut);
        
        emit Swap(msg.sender, tokenIn, tokenOut, _amountIn, amountOut);
    }
    
    function swapETHToTokens(
        address[] calldata _path,
        uint256 _minOut,
        address _receiver
    ) external payable {
        require(_path.length >= 1, "Invalid path");
        require(msg.value > 0, "No ETH sent");
        
        address tokenOut = _path[_path.length - 1];
        
        // Mock 1:1 swap for simplicity (1 ETH = 1 token)
        uint256 amountOut = msg.value;
        require(amountOut >= _minOut, "Insufficient output");
        
        // Transfer tokens to receiver
        IERC20(tokenOut).transfer(_receiver, amountOut);
        
        emit Swap(msg.sender, address(0), tokenOut, msg.value, amountOut);
    }
    
    function swapTokensToETH(
        address[] calldata _path,
        uint256 _amountIn,
        uint256 _minOut,
        address payable _receiver
    ) external {
        require(_path.length >= 1, "Invalid path");
        require(_amountIn > 0, "Invalid amount");
        
        address tokenIn = _path[0];
        
        // Transfer tokens from sender
        IERC20(tokenIn).transferFrom(msg.sender, address(this), _amountIn);
        
        // Mock 1:1 swap for simplicity
        uint256 amountOut = _amountIn;
        require(amountOut >= _minOut, "Insufficient output");
        require(address(this).balance >= amountOut, "Insufficient ETH balance");
        
        // Transfer ETH to receiver
        _receiver.transfer(amountOut);
        
        emit Swap(msg.sender, tokenIn, address(0), _amountIn, amountOut);
    }
    
    function increasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _amountIn,
        uint256 /* _minOut */,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _price
    ) external {
        require(_path.length > 0, "Invalid path");
        require(_sizeDelta > 0, "Invalid size");
        
        address collateralToken = _path[0];
        
        // Transfer collateral from sender
        if (_amountIn > 0) {
            IERC20(collateralToken).transferFrom(msg.sender, address(this), _amountIn);
        }
        
        emit IncreasePosition(
            msg.sender,
            collateralToken,
            _indexToken,
            _amountIn,
            _sizeDelta,
            _isLong,
            _price,
            0 // fee
        );
    }
    
    function decreasePosition(
        address _collateralToken,
        address _indexToken,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        bool _isLong,
        address _receiver,
        uint256 _price
    ) external {
        require(_sizeDelta > 0, "Invalid size");
        
        // Mock position decrease - transfer some collateral back
        if (_collateralDelta > 0) {
            IERC20(_collateralToken).transfer(_receiver, _collateralDelta);
        }
        
        emit DecreasePosition(
            msg.sender,
            _collateralToken,
            _indexToken,
            _collateralDelta,
            _sizeDelta,
            _isLong,
            _price,
            0 // fee
        );
    }
    
    function approvePlugin(address _plugin) external {
        approvedPlugins[_plugin] = true;
    }
    
    function denyPlugin(address _plugin) external {
        approvedPlugins[_plugin] = false;
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}
