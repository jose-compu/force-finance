// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IGMXRouter.sol";

/**
 * @title MockGMXFuturesManager
 * @dev Test-friendly version of GMXFuturesManager with injectable mock contracts
 */
contract MockGMXFuturesManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // GMX Protocol Addresses (injectable for testing)
    address public immutable gmxRouter;
    address public immutable gmxVault;
    address public immutable gmxPositionRouter;
    
    // Strategy and Oracle
    address public strategy;
    address public immutable oracleManager;
    
    // Collateral token (USDC.e)
    address public immutable usdcE;
    
    // Futures-specific parameters
    uint256 public constant FUTURES_COLLATERAL_RATIO = 1000; // 10% (vs 15% for perpetuals)
    uint256 public constant MAX_LEVERAGE = 10; // 10x max leverage for futures
    uint256 public constant MIN_EXECUTION_FEE = 0.001 ether; // 0.001 AVAX
    
    // Position tracking
    mapping(bytes32 => FuturesPosition) public futuresPositions;
    mapping(address => bytes32[]) public userFuturesPositions;
    mapping(bytes32 => bool) public activeFuturesPositions;
    
    // Risk management
    uint256 public maxPositionSize; // Maximum position size in USD
    uint256 public maxTotalExposure; // Maximum total exposure across all positions
    uint256 public liquidationBuffer = 200; // 2% buffer before liquidation
    
    // Events
    event FuturesPositionOpened(
        bytes32 indexed positionKey,
        address indexed token,
        uint256 size,
        bool isLong,
        uint256 collateral,
        uint256 expirationTime
    );
    
    event FuturesPositionClosed(
        bytes32 indexed positionKey,
        uint256 pnl,
        uint256 collateralReturned,
        uint256 executionFee
    );
    
    event FuturesPositionAdjusted(
        bytes32 indexed positionKey,
        uint256 newSize,
        uint256 collateralDelta,
        bool isIncrease
    );
    
    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event StrategySet(address indexed strategy);
    event MaxPositionSizeUpdated(uint256 newSize);
    event MaxTotalExposureUpdated(uint256 newExposure);
    
    struct FuturesPosition {
        address token;
        uint256 size;
        bool isLong;
        uint256 entryPrice;
        uint256 collateral;
        uint256 leverage;
        uint256 expirationTime;
        uint256 timestamp;
        bool isActive;
        uint256 lastRebalanceTime;
    }
    
    constructor(
        address _oracleManager, 
        address _usdcE,
        address _gmxRouter,
        address _gmxVault,
        address _gmxPositionRouter
    ) {
        require(_oracleManager != address(0), "Invalid oracle manager");
        require(_usdcE != address(0), "Invalid USDC.e address");
        require(_gmxRouter != address(0), "Invalid GMX router");
        require(_gmxVault != address(0), "Invalid GMX vault");
        require(_gmxPositionRouter != address(0), "Invalid GMX position router");
        
        oracleManager = _oracleManager;
        usdcE = _usdcE;
        gmxRouter = _gmxRouter;
        gmxVault = _gmxVault;
        gmxPositionRouter = _gmxPositionRouter;
        
        // Initialize risk parameters
        maxPositionSize = 1000000 * 1e6; // $1M max position
        maxTotalExposure = 5000000 * 1e6; // $5M max total exposure
    }
    
    modifier onlyStrategy() {
        require(msg.sender == strategy, "Only strategy can call");
        _;
    }
    
    /**
     * @dev Set the strategy contract address
     */
    function setStrategy(address _strategy) external onlyOwner {
        require(_strategy != address(0), "Invalid strategy address");
        strategy = _strategy;
        emit StrategySet(_strategy);
    }
    
    /**
     * @dev Open a new GMX futures position with optimized parameters
     */
    function openFuturesPosition(
        address token,
        uint256 size,
        bool isLong,
        uint256 leverage,
        uint256 collateral,
        uint256 expirationTime
    ) external onlyStrategy nonReentrant returns (bytes32 positionKey) {
        require(size > 0, "Invalid position size");
        require(leverage <= MAX_LEVERAGE, "Leverage too high");
        require(collateral >= size * FUTURES_COLLATERAL_RATIO / 10000, "Insufficient collateral");
        require(expirationTime > block.timestamp, "Invalid expiration time");
        require(size <= maxPositionSize, "Position size exceeds limit");
        
        // Check total exposure limits
        uint256 currentTotalExposure = getTotalFuturesExposure();
        require(currentTotalExposure + size <= maxTotalExposure, "Total exposure limit exceeded");
        
        // Generate position key
        positionKey = keccak256(abi.encodePacked(
            address(this),
            token,
            size,
            isLong,
            leverage,
            block.timestamp
        ));
        
        require(!activeFuturesPositions[positionKey], "Position already exists");
        
        // Transfer collateral from strategy
        IERC20(usdcE).safeTransferFrom(strategy, address(this), collateral);
        
        // Create futures position
        futuresPositions[positionKey] = FuturesPosition({
            token: token,
            size: size,
            isLong: isLong,
            entryPrice: getCurrentPrice(token),
            collateral: collateral,
            leverage: leverage,
            expirationTime: expirationTime,
            timestamp: block.timestamp,
            isActive: true,
            lastRebalanceTime: block.timestamp
        });
        
        activeFuturesPositions[positionKey] = true;
        userFuturesPositions[strategy].push(positionKey);
        
        // Execute GMX futures position
        _executeGMXFuturesOpen(positionKey, token, size, isLong, leverage, collateral);
        
        emit FuturesPositionOpened(positionKey, token, size, isLong, collateral, expirationTime);
    }
    
    /**
     * @dev Close a GMX futures position
     */
    function closeFuturesPosition(bytes32 positionKey) external onlyStrategy nonReentrant returns (uint256 pnl, uint256 collateralReturned) {
        require(activeFuturesPositions[positionKey], "Position not found");
        
        FuturesPosition storage position = futuresPositions[positionKey];
        require(position.isActive, "Position already closed");
        
        // Calculate PnL
        pnl = calculateFuturesPnL(positionKey);
        
        // Close position
        position.isActive = false;
        activeFuturesPositions[positionKey] = false;
        
        // Execute GMX futures close
        collateralReturned = _executeGMXFuturesClose(positionKey, position.token, position.size, position.isLong);
        
        // Transfer funds back to strategy
        if (pnl > 0) {
            IERC20(usdcE).safeTransfer(strategy, pnl);
        }
        if (collateralReturned > 0) {
            IERC20(usdcE).safeTransfer(strategy, collateralReturned);
        }
        
        emit FuturesPositionClosed(positionKey, pnl, collateralReturned, 0);
    }
    
    /**
     * @dev Adjust a GMX futures position size
     */
    function adjustFuturesPosition(
        bytes32 positionKey,
        uint256 sizeDelta,
        bool isIncrease
    ) external onlyStrategy nonReentrant {
        require(activeFuturesPositions[positionKey], "Position not found");
        
        FuturesPosition storage position = futuresPositions[positionKey];
        require(position.isActive, "Position not active");
        
        if (isIncrease) {
            position.size += sizeDelta;
        } else {
            require(position.size >= sizeDelta, "Size delta too large");
            position.size -= sizeDelta;
        }
        
        emit FuturesPositionAdjusted(positionKey, position.size, sizeDelta, isIncrease);
    }
    
    /**
     * @dev Calculate PnL for a futures position
     */
    function calculateFuturesPnL(bytes32 positionKey) public view returns (uint256) {
        require(activeFuturesPositions[positionKey], "Position not found");
        
        FuturesPosition storage position = futuresPositions[positionKey];
        if (!position.isActive) return 0;
        
        uint256 currentPrice = getCurrentPrice(position.token);
        uint256 priceDelta;
        
        if (position.isLong) {
            priceDelta = currentPrice > position.entryPrice ? 
                currentPrice - position.entryPrice : 0;
        } else {
            priceDelta = position.entryPrice > currentPrice ? 
                position.entryPrice - currentPrice : 0;
        }
        
        return (position.size * priceDelta) / position.entryPrice;
    }
    
    /**
     * @dev Get total futures exposure across all positions
     */
    function getTotalFuturesExposure() public view returns (uint256 totalExposure) {
        bytes32[] memory positions = userFuturesPositions[strategy];
        
        for (uint256 i = 0; i < positions.length; i++) {
            if (activeFuturesPositions[positions[i]]) {
                totalExposure += futuresPositions[positions[i]].size;
            }
        }
    }
    
    /**
     * @dev Get current price from oracle
     */
    function getCurrentPrice(address /* token */) public pure returns (uint256) {
        // This would integrate with your oracle manager
        // For now, return a placeholder price
        return 1e18; // $1.00 placeholder
    }
    
    /**
     * @dev Execute GMX futures position opening
     */
    function _executeGMXFuturesOpen(
        bytes32 /* positionKey */,
        address token,
        uint256 size,
        bool isLong,
        uint256 /* leverage */,
        uint256 collateral
    ) internal {
        // Approve GMX router to spend USDC.e
        IERC20(usdcE).safeApprove(gmxRouter, 0);
        IERC20(usdcE).safeApprove(gmxRouter, collateral);
        
        // Create path for GMX position
        address[] memory path = new address[](1);
        path[0] = usdcE;
        
        // Calculate execution fee
        uint256 executionFee = IGMXPositionRouter(gmxPositionRouter).minExecutionFee();
        
        // Create increase position request
        IGMXPositionRouter(gmxPositionRouter).createIncreasePosition{value: executionFee}(
            path,
            token,
            collateral,
            0, // minOut
            size,
            isLong,
            0, // acceptablePrice (market order)
            executionFee,
            bytes32(0), // referralCode
            address(0) // callbackTarget
        );
    }
    
    /**
     * @dev Execute GMX futures position closing
     */
    function _executeGMXFuturesClose(
        bytes32 positionKey,
        address token,
        uint256 size,
        bool isLong
    ) internal returns (uint256 collateralReturned) {
        // Create path for GMX position
        address[] memory path = new address[](1);
        path[0] = usdcE;
        
        // Calculate execution fee
        uint256 executionFee = IGMXPositionRouter(gmxPositionRouter).minExecutionFee();
        
        // Create decrease position request
        IGMXPositionRouter(gmxPositionRouter).createDecreasePosition{value: executionFee}(
            path,
            token,
            0, // collateralDelta
            size,
            isLong,
            address(this), // receiver
            0, // acceptablePrice (market order)
            0, // minOut
            executionFee,
            false, // withdrawETH
            address(0) // callbackTarget
        );
        
        // Return estimated collateral (actual amount will be determined after execution)
        return futuresPositions[positionKey].collateral;
    }
    
    /**
     * @dev Deposit USDC.e collateral for futures positions
     */
    function depositCollateral(uint256 amount) external onlyStrategy {
        require(amount > 0, "Invalid amount");
        IERC20(usdcE).safeTransferFrom(strategy, address(this), amount);
        emit CollateralDeposited(strategy, amount);
    }
    
    /**
     * @dev Withdraw USDC.e collateral from futures positions
     */
    function withdrawCollateral(uint256 amount) external onlyStrategy {
        require(amount > 0, "Invalid amount");
        uint256 balance = IERC20(usdcE).balanceOf(address(this));
        require(balance >= amount, "Insufficient collateral balance");
        
        IERC20(usdcE).safeTransfer(strategy, amount);
        emit CollateralWithdrawn(strategy, amount);
    }
    
    /**
     * @dev Get current USDC.e collateral balance
     */
    function getCollateralBalance() external view returns (uint256) {
        return IERC20(usdcE).balanceOf(address(this));
    }
    
    /**
     * @dev Get all active futures positions for a user
     */
    function getUserActiveFuturesPositions(address user) external view returns (bytes32[] memory) {
        bytes32[] memory allPositions = userFuturesPositions[user];
        uint256 activeCount = 0;
        
        // Count active positions
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (activeFuturesPositions[allPositions[i]]) {
                activeCount++;
            }
        }
        
        // Create array with active positions
        bytes32[] memory activePositions = new bytes32[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (activeFuturesPositions[allPositions[i]]) {
                activePositions[index] = allPositions[i];
                index++;
            }
        }
        
        return activePositions;
    }
    
    /**
     * @dev Emergency functions
     */
    function emergencyCloseAllPositions() external onlyOwner {
        bytes32[] memory positions = userFuturesPositions[strategy];
        
        for (uint256 i = 0; i < positions.length; i++) {
            if (activeFuturesPositions[positions[i]]) {
                // Close position directly without calling external function
                FuturesPosition storage position = futuresPositions[positions[i]];
                if (position.isActive) {
                    position.isActive = false;
                    activeFuturesPositions[positions[i]] = false;
                    
                    // Execute GMX futures close
                    _executeGMXFuturesClose(positions[i], position.token, position.size, position.isLong);
                    
                    // Transfer collateral back to strategy
                    if (position.collateral > 0) {
                        IERC20(usdcE).safeTransfer(strategy, position.collateral);
                    }
                }
            }
        }
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "ETH transfer failed");
    }
    
    /**
     * @dev Update risk parameters
     */
    function setMaxPositionSize(uint256 newSize) external onlyOwner {
        maxPositionSize = newSize;
        emit MaxPositionSizeUpdated(newSize);
    }
    
    function setMaxTotalExposure(uint256 newExposure) external onlyOwner {
        maxTotalExposure = newExposure;
        emit MaxTotalExposureUpdated(newExposure);
    }
    
    /**
     * @dev Receive function for execution fees
     */
    receive() external payable {}
}
