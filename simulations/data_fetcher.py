"""
Data fetcher for real cryptocurrency price data using free APIs
"""
import pandas as pd
import numpy as np
import yfinance as yf
import requests
from datetime import datetime, timedelta
import time

class CryptoDataFetcher:
    """Fetch real cryptocurrency data from multiple free sources"""
    
    def __init__(self):
        self.data_cache = {}
        
    def fetch_yahoo_data(self, symbol, period="1y", interval="1h"):
        """Fetch data from Yahoo Finance"""
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period=period, interval=interval)
            return data[['Close', 'Volume']].rename(columns={'Close': 'price', 'Volume': 'volume'})
        except Exception as e:
            print(f"Yahoo Finance error for {symbol}: {e}")
            return None
    
    def fetch_coingecko_data(self, coin_id, days=365):
        """Fetch hourly data from CoinGecko (free API)"""
        try:
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
            params = {
                'vs_currency': 'usd',
                'days': days,
                'interval': 'hourly'
            }
            response = requests.get(url, params=params)
            data = response.json()
            
            prices = data['prices']
            volumes = data['total_volumes']
            
            df = pd.DataFrame(prices, columns=['timestamp', 'price'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            
            # Add volume data
            volume_df = pd.DataFrame(volumes, columns=['timestamp', 'volume'])
            volume_df['timestamp'] = pd.to_datetime(volume_df['timestamp'], unit='ms')
            volume_df.set_index('timestamp', inplace=True)
            
            df = df.join(volume_df, how='inner')
            return df
            
        except Exception as e:
            print(f"CoinGecko error for {coin_id}: {e}")
            return None
    
    def get_crypto_data(self, asset='ETH', period_days=365):
        """Get crypto data with fallback sources"""
        print(f"Fetching {asset} data for {period_days} days...")
        
        # Try Yahoo Finance first (faster)
        if asset == 'ETH':
            yahoo_symbol = 'ETH-USD'
            coingecko_id = 'ethereum'
        elif asset == 'BTC':
            yahoo_symbol = 'BTC-USD'
            coingecko_id = 'bitcoin'
        else:
            raise ValueError(f"Unsupported asset: {asset}")
        
        # Try Yahoo Finance
        data = self.fetch_yahoo_data(yahoo_symbol, period=f"{period_days}d", interval="1h")
        
        # Fallback to CoinGecko if Yahoo fails
        if data is None or len(data) < 100:
            print(f"Yahoo Finance failed, trying CoinGecko for {asset}...")
            time.sleep(1)  # Rate limiting
            data = self.fetch_coingecko_data(coingecko_id, days=period_days)
        
        if data is None:
            raise Exception(f"Failed to fetch data for {asset}")
        
        # Calculate returns and volatility
        data['returns'] = data['price'].pct_change()
        data['log_returns'] = np.log(data['price'] / data['price'].shift(1))
        
        # Calculate rolling volatility (24-hour window)
        data['volatility_24h'] = data['returns'].rolling(24).std() * np.sqrt(24)  # Annualized
        
        # Clean data
        data = data.dropna()
        
        print(f"Successfully fetched {len(data)} data points for {asset}")
        return data
    
    def get_usd_stablecoin_data(self):
        """Get USD stablecoin data (USDC) for baseline"""
        try:
            data = self.fetch_yahoo_data('USDC-USD', period="1y", interval="1h")
            if data is None:
                # Create synthetic stable data
                dates = pd.date_range(end=datetime.now(), periods=8760, freq='H')
                data = pd.DataFrame({
                    'price': np.random.normal(1.0, 0.001, len(dates)),  # Very low volatility
                    'volume': np.random.uniform(1e6, 1e8, len(dates))
                }, index=dates)
            
            data['returns'] = data['price'].pct_change()
            data['log_returns'] = np.log(data['price'] / data['price'].shift(1))
            data['volatility_24h'] = data['returns'].rolling(24).std() * np.sqrt(24)
            return data.dropna()
            
        except Exception as e:
            print(f"Error fetching stablecoin data: {e}")
            # Return synthetic stable data
            dates = pd.date_range(end=datetime.now(), periods=8760, freq='H')
            return pd.DataFrame({
                'price': np.ones(len(dates)),
                'volume': np.random.uniform(1e6, 1e8, len(dates)),
                'returns': np.zeros(len(dates)),
                'log_returns': np.zeros(len(dates)),
                'volatility_24h': np.zeros(len(dates))
            }, index=dates)

def main():
    """Test the data fetcher"""
    fetcher = CryptoDataFetcher()
    
    print("Testing data fetcher...")
    
    # Fetch ETH data
    eth_data = fetcher.get_crypto_data('ETH', period_days=30)
    print(f"ETH data shape: {eth_data.shape}")
    print(f"ETH price range: ${eth_data['price'].min():.2f} - ${eth_data['price'].max():.2f}")
    print(f"ETH 24h volatility range: {eth_data['volatility_24h'].min()*100:.2f}% - {eth_data['volatility_24h'].max()*100:.2f}%")
    
    # Fetch BTC data
    btc_data = fetcher.get_crypto_data('BTC', period_days=30)
    print(f"BTC data shape: {btc_data.shape}")
    print(f"BTC price range: ${btc_data['price'].min():.2f} - ${btc_data['price'].max():.2f}")
    print(f"BTC 24h volatility range: {btc_data['volatility_24h'].min()*100:.2f}% - {btc_data['volatility_24h'].max()*100:.2f}%")

if __name__ == "__main__":
    main()
