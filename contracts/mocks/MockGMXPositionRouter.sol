// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockGMXPositionRouter
 * @dev Mock implementation of GMX Position Router for testing
 */
contract MockGMXPositionRouter {
    uint256 public constant MIN_EXECUTION_FEE = 0.001 ether;
    
    // Track position requests
    mapping(bytes32 => bool) public increasePositionRequests;
    mapping(bytes32 => bool) public decreasePositionRequests;
    
    uint256 private requestCounter;
    
    event CreateIncreasePosition(
        address indexed account,
        address[] path,
        address indexToken,
        uint256 amountIn,
        uint256 minOut,
        uint256 sizeDelta,
        bool isLong,
        uint256 acceptablePrice,
        uint256 executionFee,
        bytes32 referralCode,
        address callbackTarget
    );
    
    event CreateDecreasePosition(
        address indexed account,
        address[] path,
        address indexToken,
        uint256 collateralDelta,
        uint256 sizeDelta,
        bool isLong,
        address receiver,
        uint256 acceptablePrice,
        uint256 minOut,
        uint256 executionFee,
        bool withdrawETH,
        address callbackTarget
    );
    
    function createIncreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _acceptablePrice,
        uint256 _executionFee,
        bytes32 _referralCode,
        address _callbackTarget
    ) external payable returns (bytes32) {
        require(msg.value >= MIN_EXECUTION_FEE, "Insufficient execution fee");
        
        bytes32 requestKey = keccak256(abi.encodePacked(
            msg.sender,
            _indexToken,
            _sizeDelta,
            _isLong,
            requestCounter++
        ));
        
        increasePositionRequests[requestKey] = true;
        
        emit CreateIncreasePosition(
            msg.sender,
            _path,
            _indexToken,
            _amountIn,
            _minOut,
            _sizeDelta,
            _isLong,
            _acceptablePrice,
            _executionFee,
            _referralCode,
            _callbackTarget
        );
        
        return requestKey;
    }
    
    function createDecreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        bool _isLong,
        address _receiver,
        uint256 _acceptablePrice,
        uint256 _minOut,
        uint256 _executionFee,
        bool _withdrawETH,
        address _callbackTarget
    ) external payable returns (bytes32) {
        require(msg.value >= MIN_EXECUTION_FEE, "Insufficient execution fee");
        
        bytes32 requestKey = keccak256(abi.encodePacked(
            msg.sender,
            _indexToken,
            _sizeDelta,
            _isLong,
            requestCounter++
        ));
        
        decreasePositionRequests[requestKey] = true;
        
        emit CreateDecreasePosition(
            msg.sender,
            _path,
            _indexToken,
            _collateralDelta,
            _sizeDelta,
            _isLong,
            _receiver,
            _acceptablePrice,
            _minOut,
            _executionFee,
            _withdrawETH,
            _callbackTarget
        );
        
        return requestKey;
    }
    
    function minExecutionFee() external pure returns (uint256) {
        return MIN_EXECUTION_FEE;
    }
    
    function executeIncreasePosition(bytes32 _key, address payable /* _executionFeeReceiver */) external returns (bool) {
        require(increasePositionRequests[_key], "Request not found");
        increasePositionRequests[_key] = false;
        return true;
    }
    
    function executeDecreasePosition(bytes32 _key, address payable /* _executionFeeReceiver */) external returns (bool) {
        require(decreasePositionRequests[_key], "Request not found");
        decreasePositionRequests[_key] = false;
        return true;
    }
    
    function cancelIncreasePosition(bytes32 _key, address payable /* _executionFeeReceiver */) external returns (bool) {
        require(increasePositionRequests[_key], "Request not found");
        increasePositionRequests[_key] = false;
        return true;
    }
    
    function cancelDecreasePosition(bytes32 _key, address payable /* _executionFeeReceiver */) external returns (bool) {
        require(decreasePositionRequests[_key], "Request not found");
        decreasePositionRequests[_key] = false;
        return true;
    }
    
    function getRequestKey(address _account, uint256 _index) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_account, _index));
    }
    
    // Allow contract to receive ETH for execution fees
    receive() external payable {}
}
