import React, { useState } from 'react';

const TransactionSettings = ({ onSlippageChange, onDeadlineChange, slippage = 0.5, deadline = 20 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localSlippage, setLocalSlippage] = useState(slippage);
  const [localDeadline, setLocalDeadline] = useState(deadline);

  const handleSlippageChange = (value) => {
    setLocalSlippage(value);
    onSlippageChange && onSlippageChange(value);
  };

  const handleDeadlineChange = (value) => {
    setLocalDeadline(value);
    onDeadlineChange && onDeadlineChange(value);
  };

  const slippagePresets = [0.1, 0.5, 1.0];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Settings</span>
      </button>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Transaction Settings</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Slippage */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Slippage Tolerance
        </label>
        <div className="flex space-x-2 mb-2">
          {slippagePresets.map((preset) => (
            <button
              key={preset}
              onClick={() => handleSlippageChange(preset)}
              className={`px-3 py-1 text-sm rounded ${
                localSlippage === preset
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {preset}%
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="50"
            value={localSlippage}
            onChange={(e) => handleSlippageChange(parseFloat(e.target.value) || 0.5)}
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>

      {/* Transaction Deadline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Transaction Deadline
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            min="1"
            max="180"
            value={localDeadline}
            onChange={(e) => handleDeadlineChange(parseInt(e.target.value) || 20)}
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <span className="text-sm text-gray-500">minutes</span>
        </div>
      </div>
    </div>
  );
};

export default TransactionSettings;
