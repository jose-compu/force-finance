// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

// File-scope interfaces
interface IWAVAX {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

// Optional rewards interface for non-rebasing LSTs (future use)
interface ISAVAXLike {
    function getExchangeRate() external view returns (uint256);
}

// FUSD stablecoin interface with yield distribution
interface IFUSD {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title AvalancheLSTStrategy (MVP)
 * @dev Minimal LST strategy for Avalanche to establish a compilable baseline.
 *      Focus now expanded: sAVAX deposit/withdraw, AVAX->WAVAX handling, and
 *      sAVAX yield tracking via exchange-rate checkpoints. External staking
 *      integration remains a future step; a generic rewards interface is provided.
 *      
 *      FUSD stablecoin minting/burning for collateral management and USD peg stability.
 *      Yield distribution to FUSD holders using industry standard DeFi interfaces.
 *      Public rebalancing with deviation thresholds and caller rewards.
 */
contract AvalancheLSTStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // Avalanche mainnet token addresses (constants used for bookkeeping)
    address public WAVAX; // Can be set after deployment
    address public SAVAX; // Can be set after deployment
    address public FUSD; // Can be set after deployment

    // Strategy parameters
    address public feeRecipient;
    uint256 public managementFeeBps; // e.g., 200 = 2%
    uint256 public collateralizationRatio; // e.g., 150 = 150% (1.5x collateral)
    uint256 public liquidationThreshold; // e.g., 120 = 120% (1.2x collateral)
    
    // GMX Futures Management
    address public futuresManager;
    address public usdcE; // USDC.e for GMX collateral

    // Rebalancing parameters
    uint256 public rebalanceDeviationThreshold; // e.g., 500 = 5% deviation
    uint256 public emergencyRebalanceThreshold; // e.g., 1000 = 10% deviation
    uint256 public rebalanceRewardAmount; // Reward for successful rebalancing
    uint256 public lastRebalanceTime;
    uint256 public rebalanceCooldown; // Minimum time between rebalances

    // Hybrid delta-neutral parameters (STRATEGY_REVISION.md)
    uint256 public constant HYBRID_BASIS_POINTS = 10000;
    uint256 public constant DEFAULT_IL_EXPOSURE_BPS = 3000; // 30% IL, 70% synthetic
    uint256 public constant DEFAULT_SYNTHETIC_EXPOSURE_BPS = 7000;
    uint256 public ilExposureBps = DEFAULT_IL_EXPOSURE_BPS;
    uint256 public volatilityCircuitBreakerBps = 500; // 5% observed move reduces IL allocation
    uint256 public reducedIlExposureBps = 1500; // 15% IL when circuit breaker active
    bool public emergencySyntheticOnly;
    uint256 public lastObservedVolatilityBps;
    uint256 public lastSAvaxObservedPrice;

    struct Position {
        uint256 sAvaxAmount;        // LST exposure (token units)
        uint256 shortNotionalUsd;    // Total short notional (1e18-scaled USD)
        uint256 ilShortNotionalUsd; // IL-based short leg (Uniswap LP placeholder)
        uint256 syntheticShortNotionalUsd; // GMX/perp synthetic short leg
        bool isActive;
    }

    struct UserPosition {
        uint256 collateralValue;     // Total collateral value in USD (1e18)
        uint256 fusdMinted;          // FUSD minted to user
        uint256 lastUpdateTime;      // Last update timestamp
    }

    struct RebalanceState {
        uint256 targetLSTRatio;      // Target LST to total value ratio
        uint256 currentLSTRatio;     // Current LST to total value ratio
        uint256 deviation;           // Current deviation from target
        bool needsRebalance;         // Whether rebalancing is needed
        uint256 lastCheckTime;       // Last time deviation was checked
    }

    Position public portfolio;
    mapping(address => UserPosition) public userPositions;
    RebalanceState public rebalanceState;

    // Accounting (informational for now)
    uint256 public totalDepositedUsd;
    uint256 public totalWithdrawnUsd;
    uint256 public totalFusdMinted;
    uint256 public totalFusdBurned;

    // sAVAX yield tracking via exchange-rate checkpoint
    bool public sAvaxYieldTrackingEnabled;
    uint256 public sAvaxLastExchangeRate; // 1e18 scale

    // Yield distribution system (Compound-style)
    uint256 public yieldIndex; // Global yield index (1e18)
    uint256 public lastYieldUpdate; // Last yield update timestamp
    mapping(address => uint256) public userYieldIndex; // User's last yield index
    mapping(address => uint256) public userAccruedYield; // User's accrued yield
    uint256 public totalYieldDistributed; // Total yield distributed to FUSD holders
    
    // ===== Insurance/Reserve Fund =====
    uint256 public insuranceFundBalance; // Insurance fund balance (in sAVAX)
    uint256 public insuranceFundTargetBps = 500; // 5% of TVL target
    uint256 public insuranceFundFeeBps = 200; // 2% of fees go to insurance fund
    uint256 public insuranceFundMinBps = 100; // 1% of TVL minimum threshold
    
    // ===== Rate Limiting & Gradual Withdrawals =====
    uint256 public dailyWithdrawalLimitBps = 1000; // 10% of TVL per day
    uint256 public userDailyWithdrawalLimitBps = 100; // 1% of TVL per user per day
    uint256 public lastWithdrawalReset; // Last time withdrawal limits were reset
    mapping(address => uint256) public userDailyWithdrawn; // User's daily withdrawal amount
    mapping(address => uint256) public userLastWithdrawalTime; // User's last withdrawal timestamp
    
    // ===== Timelock for Critical Parameters =====
    uint256 public constant TIMELOCK_DURATION = 48 hours;
    struct PendingChange {
        uint256 newValue;
        uint256 executeTime;
        string parameter;
        bool exists;
    }
    mapping(string => PendingChange) public pendingChanges;

    // Events
    event FeeRecipientUpdated(address indexed newRecipient);
    event ManagementFeeUpdated(uint256 feeBps);
    event CollateralizationRatioUpdated(uint256 newRatio);
    event LiquidationThresholdUpdated(uint256 newThreshold);
    event Deposit(address indexed user, uint256 usdAmount, uint256 sAvaxAmount, uint256 fusdMinted);
    event Withdraw(address indexed user, uint256 usdAmount, uint256 sAvaxAmount, uint256 fusdBurned);
    event PortfolioUpdated(uint256 sAvaxAmount, uint256 shortNotionalUsd);
    event AvaxWrapped(address indexed sender, uint256 amountWavax);
    event EnableSAvaxYieldTracking(uint256 initialExchangeRate);
    event SAvaxYieldCheckpoint(uint256 previousRate, uint256 currentRate, uint256 impliedSAvaxGrowth);
    event FUSDMinted(address indexed user, uint256 amount);
    event FUSDBurned(address indexed user, uint256 amount);
    event LiquidationWarning(address indexed user, uint256 collateralRatio);
    event YieldDistributed(uint256 amount, uint256 newYieldIndex);
    event YieldClaimed(address indexed user, uint256 amount);
    event YieldAccrued(address indexed user, uint256 amount);
    event RebalanceThresholdUpdated(uint256 newThreshold);
    event EmergencyRebalanceThresholdUpdated(uint256 newThreshold);
    event RebalanceRewardUpdated(uint256 newReward);
    event RebalanceCooldownUpdated(uint256 newCooldown);
    event RebalanceExecuted(address indexed caller, uint256 deviation, uint256 reward);
    event EmergencyRebalanceExecuted(address indexed caller, uint256 deviation, uint256 reward);
    event DeviationChecked(uint256 currentDeviation, bool needsRebalance);
    event HybridExposureUpdated(uint256 ilShortNotionalUsd, uint256 syntheticShortNotionalUsd, uint256 effectiveIlExposureBps);
    event EmergencySyntheticModeUpdated(bool enabled);
    event VolatilityCircuitBreakerTriggered(uint256 observedVolatilityBps, uint256 effectiveIlExposureBps);
    
    // Insurance fund events
    event InsuranceFundAccrued(uint256 usdAmount, uint256 sAvaxAmount);
    event InsuranceFundWithdrawn(address indexed recipient, uint256 amount);
    event InsuranceFundParamsUpdated(uint256 targetBps, uint256 feeBps, uint256 minBps);
    
    // Withdrawal limit events
    event WithdrawalLimitsUpdated(uint256 dailyLimitBps, uint256 userDailyLimitBps);
    
    // Timelock events
    event ParameterChangeProposed(string indexed parameter, uint256 newValue, uint256 executeTime);
    event ParameterChangeCancelled(string indexed parameter);

    constructor(address _feeRecipient, uint256 _managementFeeBps, address _usdcE) {
        feeRecipient = _feeRecipient;
        managementFeeBps = _managementFeeBps;
        usdcE = _usdcE;
        collateralizationRatio = 150; // 150% collateralization
        liquidationThreshold = 120;   // 120% liquidation threshold
        
        // Rebalancing parameters (STRATEGY_REVISION.md: 0.8% hybrid threshold)
        rebalanceDeviationThreshold = 80; // 0.8% deviation
        emergencyRebalanceThreshold = 1500; // 15% deviation
        rebalanceRewardAmount = 0.1 ether; // 0.1 AVAX reward
        rebalanceCooldown = 3600; // 1 hour cooldown
        
        // Initialize rebalance state
        rebalanceState.targetLSTRatio = 8000; // 80% LST, 20% short
        rebalanceState.currentLSTRatio = 8000;
        rebalanceState.deviation = 0;
        rebalanceState.needsRebalance = false;
        rebalanceState.lastCheckTime = block.timestamp;
        
        yieldIndex = 1e18; // Start at 1.0
        lastYieldUpdate = block.timestamp;
        
        // Initialize withdrawal limits
        dailyWithdrawalResetTime = block.timestamp + 1 days;
    }

    // Admin
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    function setManagementFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "fee too high"); // ≤ 10%
        managementFeeBps = _feeBps;
        emit ManagementFeeUpdated(_feeBps);
    }

    function setCollateralizationRatio(uint256 _ratio) external onlyOwner {
        require(_ratio >= 110, "ratio too low"); // Minimum 110%
        _proposeParameterChange("collateralizationRatio", _ratio);
    }
    
    function executeCollateralizationRatioChange() external onlyOwner {
        PendingChange memory change = pendingChanges["collateralizationRatio"];
        require(change.exists && block.timestamp >= change.executeTime, "Timelock not expired");
        require(change.newValue >= 110, "ratio too low");
        collateralizationRatio = change.newValue;
        delete pendingChanges["collateralizationRatio"];
        emit CollateralizationRatioUpdated(change.newValue);
    }

    function setLiquidationThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold >= 105, "threshold too low"); // Minimum 105%
        liquidationThreshold = _threshold;
        emit LiquidationThresholdUpdated(_threshold);
    }

    // Rebalancing admin functions
    function setRebalanceThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold > 0 && _threshold < emergencyRebalanceThreshold, "invalid threshold");
        _proposeParameterChange("rebalanceDeviationThreshold", _threshold);
    }
    
    function executeRebalanceThresholdChange() external onlyOwner {
        PendingChange memory change = pendingChanges["rebalanceDeviationThreshold"];
        require(change.exists && block.timestamp >= change.executeTime, "Timelock not expired");
        require(change.newValue > 0 && change.newValue < emergencyRebalanceThreshold, "invalid threshold");
        rebalanceDeviationThreshold = change.newValue;
        delete pendingChanges["rebalanceDeviationThreshold"];
        emit RebalanceThresholdUpdated(change.newValue);
    }

    function setEmergencyRebalanceThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold > rebalanceDeviationThreshold, "must be > rebalance threshold");
        _proposeParameterChange("emergencyRebalanceThreshold", _threshold);
    }
    
    function executeEmergencyRebalanceThresholdChange() external onlyOwner {
        PendingChange memory change = pendingChanges["emergencyRebalanceThreshold"];
        require(change.exists && block.timestamp >= change.executeTime, "Timelock not expired");
        require(change.newValue > rebalanceDeviationThreshold, "must be > rebalance threshold");
        emergencyRebalanceThreshold = change.newValue;
        delete pendingChanges["emergencyRebalanceThreshold"];
        emit EmergencyRebalanceThresholdUpdated(change.newValue);
    }

    function setRebalanceReward(uint256 _reward) external onlyOwner {
        rebalanceRewardAmount = _reward;
        emit RebalanceRewardUpdated(_reward);
    }

    function setRebalanceCooldown(uint256 _cooldown) external onlyOwner {
        rebalanceCooldown = _cooldown;
        emit RebalanceCooldownUpdated(_cooldown);
    }

    function setFUSDAddress(address _fusd) external onlyOwner {
        require(_fusd != address(0), "invalid FUSD address");
        FUSD = _fusd;
    }

    function setSAVAXAddress(address _savax) external onlyOwner {
        require(_savax != address(0), "invalid SAVAX address");
        SAVAX = _savax;
    }

    function setWAVAXAddress(address _wavax) external onlyOwner {
        require(_wavax != address(0), "invalid WAVAX address");
        WAVAX = _wavax;
    }
    
    function setFuturesManager(address _futuresManager) external onlyOwner {
        require(_futuresManager != address(0), "invalid futures manager address");
        futuresManager = _futuresManager;
    }

    // ===== Deposits =====
    // sAVAX deposit (user transfers sAVAX in) - mints FUSD
    function depositSAvax(uint256 amount, uint256 usdAmount) external nonReentrant {
        require(amount > 0, "zero amount");
        require(usdAmount > 0, "zero USD value");
        require(!_isProtocolInsolvent(), "protocol insolvent");
        
        IERC20(SAVAX).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate management fee (deducted from collateral value, not from deposit amount)
        uint256 feeAmount = (usdAmount * managementFeeBps) / 10000;
        
        // Accrue insurance fund from fees (convert fee to sAVAX proportionally)
        if (feeAmount > 0) {
            uint256 sAvaxFee = (amount * feeAmount) / usdAmount;
            _accrueInsuranceFund(feeAmount, sAvaxFee);
        }
        
        // Calculate FUSD to mint based on collateralization ratio (after fee)
        uint256 netCollateralValue = usdAmount - feeAmount;
        uint256 fusdToMint = (netCollateralValue * 100) / collateralizationRatio; // 1e18 scale
        
        // Update user position
        UserPosition storage userPos = userPositions[msg.sender];
        userPos.collateralValue += netCollateralValue;
        userPos.fusdMinted += fusdToMint;
        userPos.lastUpdateTime = block.timestamp;

        // Update global portfolio
        portfolio.sAvaxAmount += amount;
        portfolio.isActive = true;
        totalDepositedUsd += usdAmount;
        totalFusdMinted += fusdToMint;

        // Mint FUSD to user
        IFUSD(FUSD).mint(msg.sender, fusdToMint);

        // Update yield tracking for new FUSD holder
        _updateUserYield(msg.sender);

        // Check if rebalancing is needed after deposit
        _checkRebalanceNeeded();
    
        // Create GMX short position to hedge the new sAVAX exposure
        _createGMXShortPosition(usdAmount);

        emit Deposit(msg.sender, usdAmount, amount, fusdToMint);
        emit FUSDMinted(msg.sender, fusdToMint);
        emit PortfolioUpdated(portfolio.sAvaxAmount, portfolio.shortNotionalUsd);
    }

    // Accept AVAX; wrap to WAVAX for future staking flow to sAVAX (integration TBD)
    function depositAVAX() external payable nonReentrant {
        require(msg.value > 0, "no AVAX sent");
        IWAVAX(WAVAX).deposit{value: msg.value}();
        emit AvaxWrapped(msg.sender, msg.value);
        // NOTE: Future: route to BENQI staking to mint sAVAX, then update portfolio.sAvaxAmount
    }

    // Accept WAVAX directly from user (for future staking routing)
    function depositWAVAX(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        IERC20(WAVAX).safeTransferFrom(msg.sender, address(this), amount);
        emit AvaxWrapped(msg.sender, amount);
        // NOTE: Future: route to BENQI staking to mint sAVAX, then update portfolio.sAvaxAmount
    }

    // ===== Withdrawals =====
    // User burns FUSD to withdraw collateral
    function withdrawSAvax(uint256 fusdAmount, uint256 usdAmount) external nonReentrant {
        require(fusdAmount > 0, "zero FUSD amount");
        require(usdAmount > 0, "zero USD value");
        require(!_isProtocolInsolvent(), "protocol insolvent");
        
        // Check withdrawal limits
        require(_checkWithdrawalLimits(msg.sender, usdAmount), "withdrawal limit exceeded");
        
        UserPosition storage userPos = userPositions[msg.sender];
        require(userPos.fusdMinted >= fusdAmount, "insufficient FUSD minted");
        
        // Calculate sAVAX amount to return (simplified - should use oracle)
        uint256 sAvaxToReturn = usdAmount; // Simplified: 1:1 ratio for MVP
        
        require(portfolio.sAvaxAmount >= sAvaxToReturn, "insufficient sAVAX in portfolio");
        
        // Update yield tracking before burning FUSD
        _updateUserYield(msg.sender);
        
        // Burn FUSD from user
        IFUSD(FUSD).burn(msg.sender, fusdAmount);
        
        // Update user position
        userPos.collateralValue -= usdAmount;
        userPos.fusdMinted -= fusdAmount;
        userPos.lastUpdateTime = block.timestamp;
        
        // Update withdrawal tracking
        _updateWithdrawalTracking(msg.sender, usdAmount);
        
        // Update global portfolio
        portfolio.sAvaxAmount -= sAvaxToReturn;
        if (portfolio.sAvaxAmount == 0 && portfolio.shortNotionalUsd == 0) {
            portfolio.isActive = false;
        }
        totalWithdrawnUsd += usdAmount;
        totalFusdBurned += fusdAmount;

        // Transfer sAVAX back to user
        IERC20(SAVAX).safeTransfer(msg.sender, sAvaxToReturn);

        // Check if rebalancing is needed after withdrawal
        _checkRebalanceNeeded();

        emit Withdraw(msg.sender, usdAmount, sAvaxToReturn, fusdAmount);
        emit FUSDBurned(msg.sender, fusdAmount);
        emit PortfolioUpdated(portfolio.sAvaxAmount, portfolio.shortNotionalUsd);
    }

    // Owner-controlled withdrawals (treasury-managed) for MVP
    function withdrawSAvaxTreasury(uint256 amount, uint256 usdAmount) external nonReentrant onlyOwner {
        require(amount > 0 && amount <= portfolio.sAvaxAmount, "invalid amount");
        IERC20(SAVAX).safeTransfer(msg.sender, amount);

        portfolio.sAvaxAmount -= amount;
        if (portfolio.sAvaxAmount == 0 && portfolio.shortNotionalUsd == 0) {
            portfolio.isActive = false;
        }
        totalWithdrawnUsd += usdAmount;

        emit Withdraw(msg.sender, usdAmount, amount, 0);
        emit PortfolioUpdated(portfolio.sAvaxAmount, portfolio.shortNotionalUsd);
    }

    // ===== Hedging Placeholder =====
    function setShortNotionalUsd(uint256 newShortNotionalUsd) external onlyOwner {
        (uint256 ilAmount, uint256 syntheticAmount) = _splitShortExposure(newShortNotionalUsd);
        portfolio.shortNotionalUsd = newShortNotionalUsd;
        portfolio.ilShortNotionalUsd = ilAmount;
        portfolio.syntheticShortNotionalUsd = syntheticAmount;
        emit HybridExposureUpdated(
            portfolio.ilShortNotionalUsd,
            portfolio.syntheticShortNotionalUsd,
            _effectiveIlExposureBps()
        );
        emit PortfolioUpdated(portfolio.sAvaxAmount, portfolio.shortNotionalUsd);
    }

    function setEmergencySyntheticOnly(bool enabled) external onlyOwner {
        emergencySyntheticOnly = enabled;
        emit EmergencySyntheticModeUpdated(enabled);
    }

    function getHybridExposureMetrics() external view returns (
        uint256 ilExposureRatioBps,
        uint256 syntheticExposureRatioBps,
        uint256 ilShortNotionalUsd,
        uint256 syntheticShortNotionalUsd,
        uint256 effectiveIlExposureBps,
        bool syntheticOnlyMode,
        uint256 observedVolatilityBps
    ) {
        uint256 effectiveIlBps = _effectiveIlExposureBps();
        return (
            ilExposureBps,
            HYBRID_BASIS_POINTS - ilExposureBps,
            portfolio.ilShortNotionalUsd,
            portfolio.syntheticShortNotionalUsd,
            effectiveIlBps,
            emergencySyntheticOnly,
            lastObservedVolatilityBps
        );
    }

    function _effectiveIlExposureBps() internal view returns (uint256) {
        if (emergencySyntheticOnly) {
            return 0;
        }
        if (lastObservedVolatilityBps >= volatilityCircuitBreakerBps) {
            return reducedIlExposureBps;
        }
        return ilExposureBps;
    }

    function _splitShortExposure(uint256 totalUsd) internal view returns (uint256 ilAmount, uint256 syntheticAmount) {
        uint256 effectiveIlBps = _effectiveIlExposureBps();
        ilAmount = (totalUsd * effectiveIlBps) / HYBRID_BASIS_POINTS;
        syntheticAmount = totalUsd - ilAmount;
    }

    function _applyShortExposureIncrease(uint256 usdAmount) internal {
        (uint256 ilAmount, uint256 syntheticAmount) = _splitShortExposure(usdAmount);
        portfolio.shortNotionalUsd += usdAmount;
        portfolio.ilShortNotionalUsd += ilAmount;
        portfolio.syntheticShortNotionalUsd += syntheticAmount;
        emit HybridExposureUpdated(
            portfolio.ilShortNotionalUsd,
            portfolio.syntheticShortNotionalUsd,
            _effectiveIlExposureBps()
        );
    }

    function _applyShortExposureDecrease(uint256 usdAmount) internal {
        if (usdAmount == 0 || portfolio.shortNotionalUsd == 0) {
            return;
        }
        if (usdAmount > portfolio.shortNotionalUsd) {
            usdAmount = portfolio.shortNotionalUsd;
        }

        uint256 ilReduction = (usdAmount * portfolio.ilShortNotionalUsd) / portfolio.shortNotionalUsd;
        uint256 syntheticReduction = usdAmount - ilReduction;

        portfolio.shortNotionalUsd -= usdAmount;
        portfolio.ilShortNotionalUsd -= ilReduction;
        portfolio.syntheticShortNotionalUsd -= syntheticReduction;

        emit HybridExposureUpdated(
            portfolio.ilShortNotionalUsd,
            portfolio.syntheticShortNotionalUsd,
            _effectiveIlExposureBps()
        );
    }

    // ===== sAVAX Yield Tracking =====
    function enableSAvaxYieldTracking() external onlyOwner {
        uint256 er = ISAVAXLike(SAVAX).getExchangeRate();
        sAvaxLastExchangeRate = er;
        sAvaxYieldTrackingEnabled = true;
        emit EnableSAvaxYieldTracking(er);
    }

    function getSAvaxYieldDelta() public view returns (bool enabled, uint256 previousRate, uint256 currentRate, uint256 impliedSAvaxGrowth) {
        enabled = sAvaxYieldTrackingEnabled;
        previousRate = sAvaxLastExchangeRate;
        if (!enabled || portfolio.sAvaxAmount == 0 || previousRate == 0) {
            return (enabled, previousRate, 0, 0);
        }
        currentRate = ISAVAXLike(SAVAX).getExchangeRate();
        if (currentRate <= previousRate) {
            return (enabled, previousRate, currentRate, 0);
        }
        // Approximate implied growth in sAVAX units if balance was held across rate change
        // growth = sAvaxAmount * (currentRate - previousRate) / 1e18
        impliedSAvaxGrowth = (portfolio.sAvaxAmount * (currentRate - previousRate)) / 1e18;
    }

    function checkpointSAvaxYield() external returns (uint256 impliedGrowth) {
        require(sAvaxYieldTrackingEnabled, "tracking disabled");
        require(portfolio.sAvaxAmount > 0 && sAvaxLastExchangeRate > 0, "no position");
        uint256 currentRate = ISAVAXLike(SAVAX).getExchangeRate();
        if (currentRate > sAvaxLastExchangeRate) {
            impliedGrowth = (portfolio.sAvaxAmount * (currentRate - sAvaxLastExchangeRate)) / 1e18;
            emit SAvaxYieldCheckpoint(sAvaxLastExchangeRate, currentRate, impliedGrowth);
            
            // Distribute yield to FUSD holders
            _distributeYieldToFUSDHolders(impliedGrowth);
        } else {
            emit SAvaxYieldCheckpoint(sAvaxLastExchangeRate, currentRate, 0);
        }
        sAvaxLastExchangeRate = currentRate;
    }

    // ===== Advanced Rebalancing System =====
    
    // Oracle manager for price feeds
    address public oracleManager;
    
    // Advanced rebalancing parameters
    uint256 public liquidationBuffer = 1000; // 10% buffer from liquidation (increased for flash crash protection)
    uint256 public profitThreshold = 1000; // 10% profit triggers partial closing
    uint256 public softRebalanceThreshold = 80; // 0.8% soft trigger (STRATEGY_REVISION.md)
    uint256 public maxGasPrice = 200 gwei; // Skip non-emergency rebalancing if gas too high
    
    // GMX utilization thresholds
    uint256 public maxUtilizationThreshold = 9000; // 90% - don't increase if above
    uint256 public liquidityBufferBps = 1000; // 10% minimum liquidity buffer
    
    // Keeper incentives
    mapping(address => uint256) public keeperRewards;
    mapping(address => uint256) public keeperStats;
    
    // Events for advanced rebalancing
    event LiquidationProtection(uint256 currentPrice, uint256 liquidationPrice, uint256 adjustmentMade);
    event ProfitTaken(uint256 profitAmount, uint256 newSAvaxPurchased, uint256 newShortOpened);
    event KeeperRewardPaid(address indexed keeper, uint256 reward);
    event GMXUtilizationCheck(uint256 utilization, bool withinLimits);
    event OracleDeviationCheck(uint256 deviation, bool withinLimits);
    
    // Set oracle manager
    function setOracleManager(address _oracleManager) external onlyOwner {
        require(_oracleManager != address(0), "invalid oracle manager");
        oracleManager = _oracleManager;
    }
    
    // Check if rebalancing is needed (enhanced)
    function _checkRebalanceNeeded() internal {
        if (!portfolio.isActive) return;
        
        // Get current prices from oracle
        (uint256 sAvaxPrice, uint256 avaxPrice) = _getCurrentPrices();
        if (sAvaxPrice == 0 || avaxPrice == 0) return;

        if (lastSAvaxObservedPrice > 0) {
            uint256 priceDelta = sAvaxPrice > lastSAvaxObservedPrice
                ? sAvaxPrice - lastSAvaxObservedPrice
                : lastSAvaxObservedPrice - sAvaxPrice;
            lastObservedVolatilityBps = (priceDelta * HYBRID_BASIS_POINTS) / lastSAvaxObservedPrice;
            if (lastObservedVolatilityBps >= volatilityCircuitBreakerBps) {
                emit VolatilityCircuitBreakerTriggered(lastObservedVolatilityBps, _effectiveIlExposureBps());
            }
        }
        lastSAvaxObservedPrice = sAvaxPrice;
        
        // Calculate current LST value in USD
        uint256 lstValueUsd = (portfolio.sAvaxAmount * sAvaxPrice) / 1e18;
        uint256 totalValue = lstValueUsd + portfolio.shortNotionalUsd;
        if (totalValue == 0) return;
        
        uint256 currentLSTRatio = (lstValueUsd * 10000) / totalValue;
        uint256 deviation = currentLSTRatio > rebalanceState.targetLSTRatio ? 
            currentLSTRatio - rebalanceState.targetLSTRatio : 
            rebalanceState.targetLSTRatio - currentLSTRatio;
        
        rebalanceState.currentLSTRatio = currentLSTRatio;
        rebalanceState.deviation = deviation;
        
        // Enhanced rebalancing triggers
        bool needsRebalance = false;
        
        // 1. Hard threshold (2% as per specs)
        if (deviation >= rebalanceDeviationThreshold) {
            needsRebalance = true;
        }
        // 2. Soft threshold (1.5% with conditions)
        else if (deviation >= softRebalanceThreshold) {
            if (tx.gasprice <= maxGasPrice && _hasGMXLiquidity()) {
                needsRebalance = true;
            }
        }
        // 3. sAVAX exchange rate change trigger
        else if (_checkSAvaxExchangeRateChange()) {
            needsRebalance = true;
        }
        // 4. Oracle deviation trigger
        else if (_checkOracleDeviation()) {
            needsRebalance = true;
        }
        // 5. GMX utilization band change
        else if (_checkGMXUtilizationBandChange()) {
            needsRebalance = true;
        }
        
        rebalanceState.needsRebalance = needsRebalance;
        rebalanceState.lastCheckTime = block.timestamp;
        
        emit DeviationChecked(deviation, needsRebalance);
    }
    
    // Check sAVAX exchange rate change (10 bps trigger)
    function _checkSAvaxExchangeRateChange() internal view returns (bool) {
        if (!sAvaxYieldTrackingEnabled || sAvaxLastExchangeRate == 0) return false;
        
        uint256 currentRate = ISAVAXLike(SAVAX).getExchangeRate();
        uint256 rateDelta = currentRate > sAvaxLastExchangeRate ? 
            currentRate - sAvaxLastExchangeRate : 
            sAvaxLastExchangeRate - currentRate;
        
        // 10 basis points = 0.1% = 1e15 (on 1e18 scale)
        return (rateDelta * 10000) / sAvaxLastExchangeRate >= 10;
    }
    
    // Check oracle price deviation (10% trigger)
    function _checkOracleDeviation() internal view returns (bool) {
        if (oracleManager == address(0)) return false;
        
        // AvalancheOracleManager now supports multi-source aggregation
        // Deviation checking is handled internally by the oracle manager
        // This trigger is for when oracle sources diverge significantly
        // For now, return false as oracle manager handles this internally
        return false;
    }
    
    // Check GMX utilization band changes
    function _checkGMXUtilizationBandChange() internal view returns (bool) {
        if (futuresManager == address(0)) return false;
        
        // Check if GMX utilization crossed leverage band boundaries
        // This would integrate with GMX vault to check pool utilization
        // For now, return false as placeholder
        return false;
    }
    
    // Check if GMX has sufficient liquidity
    function _hasGMXLiquidity() internal view returns (bool) {
        if (futuresManager == address(0)) return false;
        
        // Check GMX pool liquidity and utilization
        // Return true if utilization < 90% and liquidity buffer >= 10%
        // For now, return true as placeholder
        return true;
    }
    
    // Get current prices from oracle
    function _getCurrentPrices() internal view returns (uint256 sAvaxPrice, uint256 avaxPrice) {
        if (oracleManager == address(0)) {
            // Fallback prices for MVP
            return (22e18, 22e18); // $22 for both
        }
        
        // Integrate with AvalancheOracleManager (supports multi-DEX aggregation)
        try IAvalancheOracleManager(oracleManager).getPrice(SAVAX) returns (uint256 price, uint256) {
            sAvaxPrice = price;
        } catch {
            sAvaxPrice = 22e18; // Fallback
        }
        
        try IAvalancheOracleManager(oracleManager).getPrice(WAVAX) returns (uint256 price, uint256) {
            avaxPrice = price;
        } catch {
            avaxPrice = 22e18; // Fallback
        }
        
        // Ensure prices are valid
        if (sAvaxPrice == 0) sAvaxPrice = 22e18;
        if (avaxPrice == 0) avaxPrice = 22e18;
    }

    // Check if protocol is insolvent (FUSD supply > collateral value)
    function _isProtocolInsolvent() internal view returns (bool) {
        if (FUSD == address(0) || portfolio.sAvaxAmount == 0) return false;
        
        uint256 totalFUSD = IFUSD(FUSD).totalSupply();
        if (totalFUSD == 0) return false;
        
        // Get current sAVAX price
        (uint256 sAvaxPrice, ) = _getCurrentPrices();
        if (sAvaxPrice == 0) return false; // Can't determine if oracle fails
        
        // Calculate total collateral value
        uint256 totalCollateralValue = (portfolio.sAvaxAmount * sAvaxPrice) / 1e18;
        
        // Protocol is insolvent if FUSD supply exceeds collateral value
        // Add 5% buffer to account for short positions and other assets
        return totalFUSD > (totalCollateralValue * 105) / 100;
    }

    // Public function to check protocol solvency
    function isProtocolSolvent() external view returns (bool) {
        return !_isProtocolInsolvent();
    }

    // Get protocol health metrics
    function getProtocolHealth() external view returns (
        uint256 totalFUSDSupply,
        uint256 totalCollateralValue,
        uint256 healthRatio,
        bool isSolvent
    ) {
        totalFUSDSupply = IFUSD(FUSD).totalSupply();
        (uint256 sAvaxPrice, ) = _getCurrentPrices();
        totalCollateralValue = (portfolio.sAvaxAmount * sAvaxPrice) / 1e18;
        
        if (totalFUSDSupply == 0) {
            healthRatio = type(uint256).max;
        } else {
            healthRatio = (totalCollateralValue * 10000) / totalFUSDSupply;
        }
        
        isSolvent = !_isProtocolInsolvent();
    }

    // Public function to check rebalancing status
    function checkRebalanceStatus() external view returns (
        uint256 targetRatio,
        uint256 currentRatio,
        uint256 deviation,
        bool needsRebalance,
        uint256 lastCheckTime
    ) {
        return (
            rebalanceState.targetLSTRatio,
            rebalanceState.currentLSTRatio,
            rebalanceState.deviation,
            rebalanceState.needsRebalance,
            rebalanceState.lastCheckTime
        );
    }

    // Public rebalancing function - anyone can call if deviation threshold is met
    function executeRebalance() external nonReentrant returns (bool success, uint256 reward) {
        require(portfolio.isActive, "no active portfolio");
        require(block.timestamp >= lastRebalanceTime + rebalanceCooldown, "rebalance cooldown");
        require(rebalanceState.needsRebalance, "no rebalancing needed");
        require(rebalanceState.deviation >= rebalanceDeviationThreshold, "deviation below threshold");
        
        // Check for liquidation risk first
        if (_isLiquidationRisk()) {
            return _executeLiquidationProtection();
        }
        
        // Check for profit-taking opportunity
        if (_shouldTakeProfit()) {
            return _executeProfitTaking();
        }
        
        // Execute standard rebalancing
        return _executeStandardRebalance();
    }
    
    // Execute standard rebalancing
    function _executeStandardRebalance() internal returns (bool success, uint256 reward) {
        // 1. Claim and checkpoint LST yields
        if (sAvaxYieldTrackingEnabled && portfolio.sAvaxAmount > 0 && sAvaxLastExchangeRate > 0) {
            uint256 currentRate = ISAVAXLike(SAVAX).getExchangeRate();
            if (currentRate > sAvaxLastExchangeRate) {
                uint256 impliedGrowth = (portfolio.sAvaxAmount * (currentRate - sAvaxLastExchangeRate)) / 1e18;
                _distributeYieldToFUSDHolders(impliedGrowth);
                emit SAvaxYieldCheckpoint(sAvaxLastExchangeRate, currentRate, impliedGrowth);
            }
            sAvaxLastExchangeRate = currentRate;
        }
        
        // 2. Calculate required adjustments
        (uint256 sAvaxPrice, ) = _getCurrentPrices();
        uint256 lstValueUsd = (portfolio.sAvaxAmount * sAvaxPrice) / 1e18;
        uint256 targetShortNotional = lstValueUsd; // 1:1 hedge ratio
        
        // 3. Determine adjustment needed
        uint256 shortAdjustment = 0;
        bool increaseShort = false;
        
        if (portfolio.shortNotionalUsd < targetShortNotional) {
            shortAdjustment = targetShortNotional - portfolio.shortNotionalUsd;
            increaseShort = true;
        } else if (portfolio.shortNotionalUsd > targetShortNotional) {
            shortAdjustment = portfolio.shortNotionalUsd - targetShortNotional;
            increaseShort = false;
        }
        
        // 4. Validate GMX liquidity and utilization
        if (increaseShort && !_hasGMXLiquidity()) {
            return (false, 0); // Skip if insufficient liquidity
        }
        
        // 5. Execute GMX position adjustments
        if (shortAdjustment > 0) {
            if (increaseShort) {
                _increaseGMXShortPosition(shortAdjustment);
            } else {
                _decreaseGMXShortPosition(shortAdjustment);
            }
        }
        
        // 6. Update state
        rebalanceState.currentLSTRatio = rebalanceState.targetLSTRatio;
        rebalanceState.deviation = 0;
        rebalanceState.needsRebalance = false;
        lastRebalanceTime = block.timestamp;
        
        // 7. Calculate and pay keeper reward
        reward = _calculateKeeperReward(shortAdjustment);
        if (reward > 0) {
            keeperRewards[msg.sender] += reward;
            keeperStats[msg.sender]++;
            
            if (address(this).balance >= reward) {
                (bool transferSuccess, ) = payable(msg.sender).call{value: reward}("");
                if (transferSuccess) {
                    emit KeeperRewardPaid(msg.sender, reward);
                }
            }
        }
        
        emit RebalanceExecuted(msg.sender, rebalanceState.deviation, reward);
        return (true, reward);
    }
    
    // Check if position is at liquidation risk
    function _isLiquidationRisk() internal view returns (bool) {
        if (futuresManager == address(0)) return false;
        
        // Calculate distance to liquidation
        uint256 liquidationDistance = _calculateLiquidationDistance();
        return liquidationDistance > 0 && liquidationDistance < liquidationBuffer;
    }
    
    // Check if should take profit
    function _shouldTakeProfit() internal view returns (bool) {
        if (futuresManager == address(0)) return false;
        
        uint256 unrealizedPnL = _calculateUnrealizedPnL();
        return unrealizedPnL > 0 &&
               portfolio.shortNotionalUsd > 0 &&
               (unrealizedPnL * 10000) / portfolio.shortNotionalUsd >= profitThreshold;
    }
    
    // Execute liquidation protection
    function _executeLiquidationProtection() internal returns (bool success, uint256 reward) {
        uint256 adjustmentNeeded = _calculateLiquidationAdjustment();
        
        // Reduce short position to increase liquidation buffer
        _decreaseGMXShortPosition(adjustmentNeeded);
        
        // Update state
        lastRebalanceTime = block.timestamp;
        
        // Higher reward for liquidation protection
        reward = _calculateKeeperReward(adjustmentNeeded) * 2;
        if (reward > 0) {
            keeperRewards[msg.sender] += reward;
            keeperStats[msg.sender]++;
            
            if (address(this).balance >= reward) {
                (bool transferSuccess, ) = payable(msg.sender).call{value: reward}("");
                if (transferSuccess) {
                    emit KeeperRewardPaid(msg.sender, reward);
                }
            }
        }
        
        (, uint256 avaxPrice) = _getCurrentPrices();
        emit LiquidationProtection(avaxPrice, 0, adjustmentNeeded);
        return (true, reward);
    }
    
    // Execute profit taking
    function _executeProfitTaking() internal returns (bool success, uint256 reward) {
        uint256 profitAmount = _calculateUnrealizedPnL();
        
        // Close portion of winning short position
        (uint256 sAvaxPrice, uint256 avaxPrice) = _getCurrentPrices();
        uint256 positionToClose = (profitAmount * 1e18) / avaxPrice;
        _decreaseGMXShortPosition(positionToClose);
        
        // Use profits to buy more sAVAX (simplified - would need DEX integration)
        uint256 newSAvaxAmount = (profitAmount * 1e18) / sAvaxPrice;
        
        // Open new short to hedge the additional sAVAX
        uint256 newShortSize = profitAmount; // 1:1 hedge
        _increaseGMXShortPosition(newShortSize);
        
        // Update state
        lastRebalanceTime = block.timestamp;
        
        reward = _calculateKeeperReward(profitAmount);
        if (reward > 0) {
            keeperRewards[msg.sender] += reward;
            keeperStats[msg.sender]++;
            
            if (address(this).balance >= reward) {
                (bool transferSuccess, ) = payable(msg.sender).call{value: reward}("");
                if (transferSuccess) {
                    emit KeeperRewardPaid(msg.sender, reward);
                }
            }
        }
        
        emit ProfitTaken(profitAmount, newSAvaxAmount, newShortSize);
        return (true, reward);
    }
    
    // Calculate keeper reward
    function _calculateKeeperReward(uint256 rebalanceAmount) internal view returns (uint256) {
        if (rebalanceAmount == 0) return rebalanceRewardAmount;
        
        // Base reward plus percentage of rebalanced amount
        uint256 percentageReward = (rebalanceAmount * 50) / 10000; // 0.5%
        uint256 totalReward = rebalanceRewardAmount + percentageReward;
        
        // Cap at maximum reward
        return totalReward > rebalanceRewardAmount * 5 ? rebalanceRewardAmount * 5 : totalReward;
    }
    
    // Helper functions for position management
    function _increaseGMXShortPosition(uint256 usdAmount) internal {
        _applyShortExposureIncrease(usdAmount);
        if (futuresManager == address(0)) return;

        (, uint256 syntheticAmount) = _splitShortExposure(usdAmount);
        if (syntheticAmount == 0) return;

        // Placeholder for GMXFuturesManager position increase
    }
    
    function _decreaseGMXShortPosition(uint256 usdAmount) internal {
        _applyShortExposureDecrease(usdAmount);
        if (futuresManager == address(0)) return;

        // Placeholder for GMXFuturesManager position decrease
    }
    
    // Calculate distance to liquidation
    function _calculateLiquidationDistance() internal pure returns (uint256) {
        // Placeholder implementation
        // In production, this would calculate actual liquidation distance
        return 1000; // 10% safe distance
    }
    
    // Calculate unrealized PnL
    function _calculateUnrealizedPnL() internal pure returns (uint256) {
        // Placeholder implementation
        // In production, this would calculate actual PnL from GMX positions
        return 0;
    }
    
    // Calculate liquidation adjustment needed
    function _calculateLiquidationAdjustment() internal view returns (uint256) {
        // Placeholder implementation
        // In production, this would calculate required adjustment
        return portfolio.shortNotionalUsd / 10; // Reduce by 10%
    }

    // Emergency rebalancing - anyone can call if emergency threshold is met
    function executeEmergencyRebalance() external nonReentrant returns (bool success, uint256 reward) {
        require(portfolio.isActive, "no active portfolio");
        require(rebalanceState.deviation >= emergencyRebalanceThreshold, "deviation below emergency threshold");
        
        // Emergency rebalancing bypasses cooldown
        // Perform more aggressive rebalancing logic
        
        // For MVP, we'll just update the state
        rebalanceState.currentLSTRatio = rebalanceState.targetLSTRatio;
        rebalanceState.deviation = 0;
        rebalanceState.needsRebalance = false;
        lastRebalanceTime = block.timestamp;
        
        // Pay higher reward for emergency rebalancing
        uint256 emergencyReward = rebalanceRewardAmount * 2; // Double reward
        if (emergencyReward > 0 && address(this).balance >= emergencyReward) {
            (bool transferSuccess, ) = payable(msg.sender).call{value: emergencyReward}("");
            if (transferSuccess) {
                reward = emergencyReward;
            }
        }
        
        emit EmergencyRebalanceExecuted(msg.sender, rebalanceState.deviation, reward);
        return (true, reward);
    }

    // Manual rebalancing trigger (owner only)
    function triggerRebalance() external onlyOwner {
        _checkRebalanceNeeded();
    }
    
    // Claim keeper rewards
    function claimKeeperRewards() external nonReentrant {
        uint256 reward = keeperRewards[msg.sender];
        require(reward > 0, "no rewards to claim");
        
        keeperRewards[msg.sender] = 0;
        
        // Transfer reward in AVAX
        if (address(this).balance >= reward) {
            (bool claimSuccess, ) = payable(msg.sender).call{value: reward}("");
            if (claimSuccess) {
                emit KeeperRewardPaid(msg.sender, reward);
            }
        }
    }
    
    // Get keeper stats
    function getKeeperStats(address keeper) external view returns (uint256 rewards, uint256 successfulRebalances) {
        return (keeperRewards[keeper], keeperStats[keeper]);
    }
    
    // Update advanced rebalancing parameters (admin only)
    function updateAdvancedRebalancingParams(
        uint256 _liquidationBuffer,
        uint256 _profitThreshold,
        uint256 _softRebalanceThreshold,
        uint256 _maxGasPrice
    ) external onlyOwner {
        require(_liquidationBuffer > 0 && _liquidationBuffer <= 2000, "invalid liquidation buffer"); // Max 20%
        require(_profitThreshold > 0 && _profitThreshold < 5000, "invalid profit threshold"); // Max 50%
        require(_softRebalanceThreshold < rebalanceDeviationThreshold, "soft threshold too high");
        
        liquidationBuffer = _liquidationBuffer;
        profitThreshold = _profitThreshold;
        softRebalanceThreshold = _softRebalanceThreshold;
        maxGasPrice = _maxGasPrice;
    }
    
    // Update GMX utilization parameters (admin only)
    function updateGMXUtilizationParams(
        uint256 _maxUtilizationThreshold,
        uint256 _liquidityBufferBps
    ) external onlyOwner {
        require(_maxUtilizationThreshold <= 9500, "utilization threshold too high"); // Max 95%
        require(_liquidityBufferBps >= 500 && _liquidityBufferBps <= 2000, "invalid liquidity buffer"); // 5-20%
        
        maxUtilizationThreshold = _maxUtilizationThreshold;
        liquidityBufferBps = _liquidityBufferBps;
    }

    // ===== Yield Distribution System =====
    
    // Distribute yield to FUSD holders (Compound-style)
    function _distributeYieldToFUSDHolders(uint256 yieldAmount) internal {
        uint256 fusdSupply = IFUSD(FUSD).totalSupply();
        if (fusdSupply == 0) return;

        // Calculate new yield index
        uint256 yieldPerToken = (yieldAmount * 1e18) / fusdSupply;
        yieldIndex += yieldPerToken;
        totalYieldDistributed += yieldAmount;
        lastYieldUpdate = block.timestamp;

        emit YieldDistributed(yieldAmount, yieldIndex);
    }

    // Update user's yield tracking
    function _updateUserYield(address user) internal {
        uint256 userFUSDBalance = IFUSD(FUSD).balanceOf(user);
        if (userFUSDBalance == 0) {
            userYieldIndex[user] = yieldIndex;
            return;
        }

        // Calculate accrued yield
        uint256 deltaIndex = yieldIndex - userYieldIndex[user];
        if (deltaIndex > 0) {
            uint256 accruedYield = (userFUSDBalance * deltaIndex) / 1e18;
            userAccruedYield[user] += accruedYield;
            emit YieldAccrued(user, accruedYield);
        }

        userYieldIndex[user] = yieldIndex;
    }

    // Claim accrued yield (industry standard interface)
    function claimYield(address user) external returns (uint256) {
        _updateUserYield(user);
        uint256 amount = userAccruedYield[user];
        if (amount > 0) {
            userAccruedYield[user] = 0;
            // Transfer yield in sAVAX (or other yield token)
            IERC20(SAVAX).safeTransfer(user, amount);
            emit YieldClaimed(user, amount);
        }
        return amount;
    }

    // Get user's claimable yield
    function getClaimableYield(address user) external view returns (uint256) {
        uint256 userFUSDBalance = IFUSD(FUSD).balanceOf(user);
        if (userFUSDBalance == 0) return userAccruedYield[user];

        uint256 deltaIndex = yieldIndex - userYieldIndex[user];
        uint256 pendingYield = (userFUSDBalance * deltaIndex) / 1e18;
        return userAccruedYield[user] + pendingYield;
    }

    // Manual yield distribution (for external yield sources)
    function distributeExternalYield(uint256 amount) external onlyOwner {
        require(amount > 0, "zero amount");
        _distributeYieldToFUSDHolders(amount);
    }

    // ===== Views =====
    function getStrategyMetrics() external view returns (
        uint256 totalLSTAmount,
        uint256 shortNotionalUsd,
        bool isActive,
        uint256 totalInUsd,
        uint256 totalOutUsd
    ) {
        return (
            portfolio.sAvaxAmount,
            portfolio.shortNotionalUsd,
            portfolio.isActive,
            totalDepositedUsd,
            totalWithdrawnUsd
        );
    }

    function getUserPosition(address user) external view returns (
        uint256 collateralValue,
        uint256 fusdMinted,
        uint256 lastUpdateTime,
        uint256 userCollateralizationRatio
    ) {
        UserPosition storage userPos = userPositions[user];
        uint256 ratio = userPos.collateralValue > 0 ? 
            (userPos.collateralValue * 100) / userPos.fusdMinted : 0;
        return (
            userPos.collateralValue,
            userPos.fusdMinted,
            userPos.lastUpdateTime,
            ratio
        );
    }

    function getFUSDMetrics() external view returns (
        uint256 totalMinted,
        uint256 totalBurned,
        uint256 circulatingSupply
    ) {
        return (
            totalFusdMinted,
            totalFusdBurned,
            totalFusdMinted - totalFusdBurned
        );
    }

    function getYieldMetrics() external view returns (
        uint256 currentYieldIndex,
        uint256 totalYieldDistributedAmount,
        uint256 lastUpdateTime
    ) {
        return (
            yieldIndex,
            totalYieldDistributed,
            lastYieldUpdate
        );
    }

    function getRebalancingMetrics() external view returns (
        uint256 rebalanceThreshold,
        uint256 emergencyThreshold,
        uint256 rewardAmount,
        uint256 cooldown,
        uint256 lastRebalance
    ) {
        return (
            rebalanceDeviationThreshold,
            emergencyRebalanceThreshold,
            rebalanceRewardAmount,
            rebalanceCooldown,
            lastRebalanceTime
        );
    }

    // Receive AVAX for WAVAX.wrap
    receive() external payable {}
    
    // ===== GMX Futures Management =====
    
    /**
     * @dev Create GMX futures short position to hedge LST exposure
     */
    function _createGMXShortPosition(uint256 usdAmount) internal {
        _applyShortExposureIncrease(usdAmount);
        if (futuresManager == address(0)) return;

        (, uint256 syntheticAmount) = _splitShortExposure(usdAmount);
        if (syntheticAmount == 0) return;
        
        // Calculate required collateral (10% for futures vs 15% for perpetuals)
        uint256 collateralAmount = (syntheticAmount * 10) / 100;
        
        // Ensure we have enough USDC.e
        uint256 usdcBalance = IERC20(usdcE).balanceOf(address(this));
        if (usdcBalance < collateralAmount) {
            return;
        }
        
        // Approve USDC.e for futures manager
        IERC20(usdcE).approve(futuresManager, collateralAmount);
        
        // Create futures short position via futures manager (synthetic leg only)
        uint256 expirationTime = block.timestamp + 30 days;
        IGFuturesManager(futuresManager).openFuturesPosition(
            WAVAX,
            syntheticAmount,
            false,
            10,
            collateralAmount,
            expirationTime
        );
    }
    
    /**
     * @dev Deposit USDC.e collateral to futures manager
     */
    function depositUSDCECollateral(uint256 amount) external onlyOwner {
        require(amount > 0, "zero amount");
        IERC20(usdcE).safeTransferFrom(msg.sender, address(this), amount);
        
        // Transfer to futures manager
        IERC20(usdcE).approve(futuresManager, amount);
        IGFuturesManager(futuresManager).depositCollateral(amount);
    }
    
    /**
     * @dev Withdraw USDC.e collateral from futures manager
     */
    function withdrawUSDCECollateral(uint256 amount) external onlyOwner {
        require(amount > 0, "zero amount");
        IGFuturesManager(futuresManager).withdrawCollateral(amount);
        IERC20(usdcE).safeTransfer(msg.sender, amount);
    }
    
    /**
     * @dev Get GMX futures manager collateral balance
     */
    function getGMXCollateralBalance() external view returns (uint256) {
        if (futuresManager == address(0)) return 0;
        return IGFuturesManager(futuresManager).getCollateralBalance();
    }
    
    /**
     * @dev Get user's active GMX futures positions
     */
    function getUserGMXPositions(address user) external view returns (bytes32[] memory) {
        if (futuresManager == address(0)) {
            bytes32[] memory empty;
            return empty;
        }
        return IGFuturesManager(futuresManager).getUserActiveFuturesPositions(user);
    }
    
    // ===== Insurance Fund Functions =====
    
    /**
     * @dev Accrue insurance fund from fees
     */
    function _accrueInsuranceFund(uint256 feeAmount, uint256 sAvaxFee) internal {
        uint256 insuranceContribution = (feeAmount * insuranceFundFeeBps) / 10000;
        if (insuranceContribution > 0 && sAvaxFee > 0) {
            // Convert USD fee to sAVAX proportionally
            uint256 sAvaxContribution = (sAvaxFee * insuranceFundFeeBps) / 10000;
            insuranceFundBalance += sAvaxContribution;
            emit InsuranceFundAccrued(insuranceContribution, sAvaxContribution);
        }
    }
    
    /**
     * @dev Get insurance fund status
     */
    function getInsuranceFundStatus() external view returns (
        uint256 balance,
        uint256 targetAmount,
        uint256 minAmount,
        bool isAboveTarget,
        bool isAboveMinimum
    ) {
        balance = insuranceFundBalance;
        (uint256 sAvaxPrice, ) = _getCurrentPrices();
        uint256 tvl = (portfolio.sAvaxAmount * sAvaxPrice) / 1e18;
        
        targetAmount = (tvl * insuranceFundTargetBps) / 10000;
        minAmount = (tvl * insuranceFundMinBps) / 10000;
        isAboveTarget = balance >= targetAmount;
        isAboveMinimum = balance >= minAmount;
    }
    
    /**
     * @dev Emergency withdrawal from insurance fund (only when protocol health < 120%)
     */
    function emergencyWithdrawFromInsuranceFund(uint256 amount) external onlyOwner {
        require(insuranceFundBalance >= amount, "insufficient insurance fund");
        
        // Only allow if protocol health is critical
        (,, uint256 healthRatio, bool isSolvent) = this.getProtocolHealth();
        require(!isSolvent || healthRatio < 12000, "protocol health acceptable"); // 120% = 12000 bps
        
        insuranceFundBalance -= amount;
        IERC20(SAVAX).safeTransfer(msg.sender, amount);
        emit InsuranceFundWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Set insurance fund parameters
     */
    function setInsuranceFundParams(
        uint256 _targetBps,
        uint256 _feeBps,
        uint256 _minBps
    ) external onlyOwner {
        require(_targetBps <= 1000, "target too high"); // Max 10%
        require(_feeBps <= 1000, "fee too high"); // Max 10%
        require(_minBps <= 500, "min too high"); // Max 5%
        insuranceFundTargetBps = _targetBps;
        insuranceFundFeeBps = _feeBps;
        insuranceFundMinBps = _minBps;
        emit InsuranceFundParamsUpdated(_targetBps, _feeBps, _minBps);
    }
    
    // ===== Rate Limiting Functions =====
    
    // Daily withdrawal tracking
    uint256 public dailyWithdrawnAmount; // Total withdrawn today
    uint256 public dailyWithdrawalResetTime; // When daily limit resets
    
    /**
     * @dev Check if withdrawal is within limits
     */
    function _checkWithdrawalLimits(address user, uint256 usdAmount) internal view returns (bool) {
        // Get current TVL
        (uint256 sAvaxPrice, ) = _getCurrentPrices();
        uint256 tvl = (portfolio.sAvaxAmount * sAvaxPrice) / 1e18;
        if (tvl == 0) return true; // No TVL, allow withdrawal
        
        // Check daily global limit
        uint256 dailyLimit = (tvl * dailyWithdrawalLimitBps) / 10000;
        uint256 currentDailyWithdrawn = block.timestamp >= dailyWithdrawalResetTime ? 0 : dailyWithdrawnAmount;
        if (currentDailyWithdrawn + usdAmount > dailyLimit) {
            return false;
        }
        
        // Check per-user daily limit
        uint256 userLimit = (tvl * userDailyWithdrawalLimitBps) / 10000;
        uint256 userWithdrawn = block.timestamp >= userLastWithdrawalTime[user] + 1 days ? 0 : userDailyWithdrawn[user];
        if (userWithdrawn + usdAmount > userLimit) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Update withdrawal tracking
     */
    function _updateWithdrawalTracking(address user, uint256 usdAmount) internal {
        // Reset daily global limit if 24 hours have passed
        if (block.timestamp >= dailyWithdrawalResetTime) {
            dailyWithdrawnAmount = 0;
            dailyWithdrawalResetTime = block.timestamp + 1 days;
        }
        dailyWithdrawnAmount += usdAmount;
        
        // Update user withdrawal tracking
        if (block.timestamp >= userLastWithdrawalTime[user] + 1 days) {
            userDailyWithdrawn[user] = 0;
        }
        userDailyWithdrawn[user] += usdAmount;
        userLastWithdrawalTime[user] = block.timestamp;
    }
    
    /**
     * @dev Set withdrawal limit parameters
     */
    function setWithdrawalLimits(
        uint256 _dailyLimitBps,
        uint256 _userDailyLimitBps
    ) external onlyOwner {
        require(_dailyLimitBps <= 2000, "daily limit too high"); // Max 20%
        require(_userDailyLimitBps <= 500, "user limit too high"); // Max 5%
        dailyWithdrawalLimitBps = _dailyLimitBps;
        userDailyWithdrawalLimitBps = _userDailyLimitBps;
        emit WithdrawalLimitsUpdated(_dailyLimitBps, _userDailyLimitBps);
    }
    
    /**
     * @dev Get user's withdrawal status
     */
    function getUserWithdrawalStatus(address user) external view returns (
        uint256 dailyWithdrawn,
        uint256 dailyLimit,
        uint256 timeUntilReset,
        bool canWithdraw
    ) {
        (uint256 sAvaxPrice, ) = _getCurrentPrices();
        uint256 tvl = (portfolio.sAvaxAmount * sAvaxPrice) / 1e18;
        
        if (block.timestamp >= userLastWithdrawalTime[user] + 1 days) {
            dailyWithdrawn = 0;
        } else {
            dailyWithdrawn = userDailyWithdrawn[user];
        }
        
        dailyLimit = (tvl * userDailyWithdrawalLimitBps) / 10000;
        timeUntilReset = userLastWithdrawalTime[user] + 1 days > block.timestamp ?
            userLastWithdrawalTime[user] + 1 days - block.timestamp : 0;
        canWithdraw = dailyWithdrawn < dailyLimit;
    }
    
    // ===== Timelock Functions =====
    
    /**
     * @dev Propose a parameter change (requires timelock)
     */
    function _proposeParameterChange(string memory param, uint256 newValue) internal {
        pendingChanges[param] = PendingChange({
            newValue: newValue,
            executeTime: block.timestamp + TIMELOCK_DURATION,
            parameter: param,
            exists: true
        });
        emit ParameterChangeProposed(param, newValue, block.timestamp + TIMELOCK_DURATION);
    }
    
    /**
     * @dev Get pending parameter change
     */
    function getPendingChange(string calldata param) external view returns (
        uint256 newValue,
        uint256 executeTime,
        bool exists,
        bool canExecute
    ) {
        PendingChange memory change = pendingChanges[param];
        return (
            change.newValue,
            change.executeTime,
            change.exists,
            change.exists && block.timestamp >= change.executeTime
        );
    }
    
    /**
     * @dev Cancel pending parameter change
     */
    function cancelPendingChange(string calldata param) external onlyOwner {
        require(pendingChanges[param].exists, "No pending change");
        delete pendingChanges[param];
        emit ParameterChangeCancelled(param);
    }
}

// Interface for AvalancheOracleManager
interface IAvalancheOracleManager {
    function getPrice(address token) external view returns (uint256 price, uint256 confidence);
    function getPrices(address[] calldata tokens) external view returns (uint256[] memory prices, uint256[] memory confidences);
}

// Interface for GMXFuturesManager
interface IGFuturesManager {
    function openFuturesPosition(
        address token,
        uint256 size,
        bool isLong,
        uint256 leverage,
        uint256 collateral,
        uint256 expirationTime
    ) external returns (bytes32);
    
    function closeFuturesPosition(bytes32 positionKey) external returns (uint256 pnl, uint256 collateralReturned);
    
    function adjustFuturesPosition(
        bytes32 positionKey,
        uint256 sizeDelta,
        bool isIncrease
    ) external returns (uint256 newSize, uint256 collateralDelta);
    
    function depositCollateral(uint256 amount) external;
    
    function withdrawCollateral(uint256 amount) external;
    
    function getCollateralBalance() external view returns (uint256);
    
    function getUserActiveFuturesPositions(address user) external view returns (bytes32[] memory);
}
