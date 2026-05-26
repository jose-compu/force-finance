import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const TokenApproval = ({ 
  tokenContract, 
  spenderAddress, 
  requiredAmount, 
  tokenSymbol = 'Token',
  onApprovalChange,
  className = ""
}) => {
  const [allowance, setAllowance] = useState('0');
  const [isApproving, setIsApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);

  useEffect(() => {
    checkAllowance();
  }, [tokenContract, spenderAddress, requiredAmount]);

  const checkAllowance = async () => {
    if (!tokenContract || !spenderAddress || !window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) return;

      const currentAllowance = await tokenContract.allowance(accounts[0], spenderAddress);
      setAllowance(currentAllowance.toString());
      
      const required = ethers.parseEther(requiredAmount || '0');
      const needsApproval = currentAllowance < required;
      setNeedsApproval(needsApproval);
      
      onApprovalChange && onApprovalChange(!needsApproval);
    } catch (error) {
      console.error('Error checking allowance:', error);
    }
  };

  const handleApprove = async () => {
    if (!tokenContract) return;

    setIsApproving(true);
    try {
      // Approve maximum amount for better UX (user doesn't need to approve again)
      const maxAmount = ethers.MaxUint256;
      const tx = await tokenContract.approve(spenderAddress, maxAmount);
      await tx.wait();
      
      await checkAllowance();
    } catch (error) {
      console.error('Approval error:', error);
      alert('Approval failed: ' + error.message);
    } finally {
      setIsApproving(false);
    }
  };

  const formatAllowance = (amount) => {
    try {
      const formatted = ethers.formatEther(amount);
      const num = parseFloat(formatted);
      if (num === 0) return '0';
      if (num >= 1e15) return '∞'; // Max uint256 appears as infinity
      return num.toLocaleString();
    } catch {
      return '0';
    }
  };

  if (!needsApproval) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-green-800">
              {tokenSymbol} approved (allowance: {formatAllowance(allowance)})
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Approval Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              You need to approve {tokenSymbol} spending before proceeding.
              Current allowance: {formatAllowance(allowance)}
            </p>
          </div>
          <div className="mt-3">
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${
                isApproving 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500'
              }`}
            >
              {isApproving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Approving...
                </>
              ) : (
                `Approve ${tokenSymbol}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenApproval;
