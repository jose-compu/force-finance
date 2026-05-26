import React from 'react';
import Icon from './Icon';

/**
 * Consistent Metric Card Component
 * Used across Dashboard, Vault, Rebalancer, and Yield components
 */
const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  trendValue,
  loading = false,
  className = '',
  onClick
}) => {
  const cardClasses = `
    bg-gray-800 border border-cyan-500 rounded-lg p-6
    transition-all duration-200 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/25
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `;

  return (
    <div className={cardClasses} onClick={onClick}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {icon && (
            <Icon 
              name={icon} 
              size={24} 
              className="mr-2 text-cyan-400" 
            />
          )}
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            {title}
          </h3>
        </div>
        {trend && (
          <div className={`flex items-center text-sm ${
            trend === 'up' ? 'text-green-400' : 
            trend === 'down' ? 'text-red-400' : 
            'text-gray-400'
          }`}>
            <Icon 
              name={trend === 'up' ? 'arrow-up' : 'arrow-down'} 
              size={16} 
              className="mr-1" 
            />
            {trendValue}
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      ) : (
        <>
          <div className="text-3xl font-bold text-cyan-400 mb-2">
            {value}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-400">
              {subtitle}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default MetricCard;
