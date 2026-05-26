import React from 'react';

/**
 * Consistent Button Component
 */
const Button = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary', // 'primary', 'secondary', 'danger', 'success'
  size = 'md', // 'sm', 'md', 'lg'
  className = '',
  type = 'button',
  fullWidth = false
}) => {
  const baseClasses = `
    font-medium rounded-md transition-all duration-200
    border shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
    ${fullWidth ? 'w-full' : ''}
  `;

  const variantClasses = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500 hover:shadow-cyan-500/25',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-cyan-400 border-cyan-500 hover:shadow-cyan-500/25',
    danger: 'bg-red-600 hover:bg-red-500 text-white border-red-500 hover:shadow-red-500/25',
    success: 'bg-green-600 hover:bg-green-500 text-white border-green-500 hover:shadow-green-500/25',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const classes = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${className}
  `;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
