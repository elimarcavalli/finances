/**
 * Asset Symbol Mapper Utility
 * Maps internal asset symbols to TradingView-compatible symbols
 * 
 * This utility handles the conversion between our internal asset representation
 * and the symbol format expected by TradingView charts.
 */

/**
 * TradingView Exchange Prefixes
 * Different exchanges use different symbol formats
 */
export const TRADINGVIEW_EXCHANGES = {
  BINANCE: 'BINANCE',
  COINBASE: 'COINBASE',
  BITSTAMP: 'BITSTAMP',
  KRAKEN: 'KRAKEN',
  FTX: 'FTX', // Note: FTX may not be available
  HUOBI: 'HUOBI',
  OKEX: 'OKX',
  BYBIT: 'BYBIT',
  
  // Traditional markets
  NYSE: 'NYSE',
  NASDAQ: 'NASDAQ',
  BMFBOVESPA: 'BMFBOVESPA', // Brazilian stock exchange
  
  // Forex
  FX: 'FX_IDC',
  OANDA: 'OANDA'
};

/**
 * Asset type mappings
 * Maps our internal asset types to appropriate TradingView exchanges
 */
export const ASSET_TYPE_MAPPINGS = {
  'crypto': TRADINGVIEW_EXCHANGES.BINANCE,
  'stock': TRADINGVIEW_EXCHANGES.NYSE,
  'stock_br': TRADINGVIEW_EXCHANGES.BMFBOVESPA,
  'forex': TRADINGVIEW_EXCHANGES.FX,
  'commodity': TRADINGVIEW_EXCHANGES.NASDAQ,
  'etf': TRADINGVIEW_EXCHANGES.NYSE,
  'index': TRADINGVIEW_EXCHANGES.NASDAQ
};

/**
 * Common symbol transformations
 * Maps our internal symbols to TradingView format
 */
export const SYMBOL_MAPPINGS = {
  // Cryptocurrencies - Binance format
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
  'USDT': 'USDTUSD', // Tether to USD
  'BNB': 'BNBUSDT',
  'ADA': 'ADAUSDT',
  'SOL': 'SOLUSDT',
  'DOT': 'DOTUSDT',
  'MATIC': 'MATICUSDT',
  'AVAX': 'AVAXUSDT',
  'LINK': 'LINKUSDT',
  'UNI': 'UNIUSDT',
  'LTC': 'LTCUSDT',
  'BCH': 'BCHUSDT',
  'XRP': 'XRPUSDT',
  'DOGE': 'DOGEUSDT',
  'SHIB': 'SHIBUSDT',
  
  // US Stocks (already in correct format mostly)
  'AAPL': 'AAPL',
  'GOOGL': 'GOOGL',
  'MSFT': 'MSFT',
  'AMZN': 'AMZN',
  'TSLA': 'TSLA',
  'META': 'META',
  'NVDA': 'NVDA',
  'NFLX': 'NFLX',
  
  // Brazilian Stocks (add .SA suffix for TradingView)
  'PETR4': 'PETR4.SA',
  'VALE3': 'VALE3.SA',
  'ITUB4': 'ITUB4.SA',
  'ABEV3': 'ABEV3.SA',
  'BBDC4': 'BBDC4.SA',
  'B3SA3': 'B3SA3.SA',
  'WEGE3': 'WEGE3.SA',
  'SUZB3': 'SUZB3.SA',
  
  // Forex pairs
  'USD/BRL': 'FX_IDC:USDBRL',
  'EUR/USD': 'FX_IDC:EURUSD',
  'GBP/USD': 'FX_IDC:GBPUSD',
  'USD/JPY': 'FX_IDC:USDJPY',
  'EUR/BRL': 'FX_IDC:EURBRL',
  
  // Commodities and ETFs
  'GOLD': 'TVC:GOLD',
  'OIL': 'TVC:USOIL',
  'SPY': 'AMEX:SPY',
  'QQQ': 'NASDAQ:QQQ',
  'BOVA11': 'BOVA11.SA' // Brazilian ETF
};

/**
 * Convert internal asset to TradingView symbol
 * @param {object} asset - Asset object from our database
 * @param {string} asset.symbol - Asset symbol
 * @param {string} asset.asset_class - Asset class/type
 * @param {string} asset.exchange - Optional exchange information
 * @returns {string} TradingView-compatible symbol
 */
export function assetToTradingViewSymbol(asset) {
  if (!asset || !asset.symbol) {
    console.warn('Invalid asset provided to assetToTradingViewSymbol:', asset);
    return 'BTCUSDT'; // Default fallback
  }

  const { symbol, asset_class, exchange } = asset;
  
  // Check if we have a direct mapping
  if (SYMBOL_MAPPINGS[symbol]) {
    return SYMBOL_MAPPINGS[symbol];
  }

  // Try to construct based on asset class
  const exchangePrefix = getExchangeForAssetClass(asset_class, exchange);
  
  if (exchangePrefix) {
    // For crypto assets, append USDT if not already present
    if (asset_class === 'crypto' || asset_class === 'cryptocurrency') {
      if (!symbol.includes('USDT') && !symbol.includes('USD') && !symbol.includes('BTC')) {
        return `${symbol}USDT`;
      }
    }
    
    // For Brazilian stocks, add .SA suffix
    if (asset_class === 'stock' && (exchange?.toLowerCase().includes('brazil') || 
        exchange?.toLowerCase().includes('bovespa'))) {
      return symbol.includes('.SA') ? symbol : `${symbol}.SA`;
    }
    
    // For forex pairs, use FX_IDC prefix
    if (asset_class === 'forex' || symbol.includes('/')) {
      const cleanSymbol = symbol.replace('/', '');
      return `FX_IDC:${cleanSymbol}`;
    }
    
    return symbol;
  }

  // Fallback: return symbol as-is with crypto default for unknown types
  if (asset_class === 'crypto' || asset_class === 'cryptocurrency') {
    return symbol.includes('USDT') ? symbol : `${symbol}USDT`;
  }
  
  return symbol;
}

/**
 * Get appropriate exchange for asset class
 * @param {string} assetClass - The asset class
 * @param {string} exchange - Optional exchange information
 * @returns {string|null} Exchange identifier or null
 */
function getExchangeForAssetClass(assetClass, exchange) {
  // Check if specific exchange is provided
  if (exchange) {
    const exchangeLower = exchange.toLowerCase();
    if (exchangeLower.includes('binance')) return TRADINGVIEW_EXCHANGES.BINANCE;
    if (exchangeLower.includes('coinbase')) return TRADINGVIEW_EXCHANGES.COINBASE;
    if (exchangeLower.includes('nyse')) return TRADINGVIEW_EXCHANGES.NYSE;
    if (exchangeLower.includes('nasdaq')) return TRADINGVIEW_EXCHANGES.NASDAQ;
    if (exchangeLower.includes('bovespa')) return TRADINGVIEW_EXCHANGES.BMFBOVESPA;
  }
  
  // Default mapping by asset class
  return ASSET_TYPE_MAPPINGS[assetClass] || null;
}

/**
 * Convert TradingView symbol back to our internal format
 * @param {string} tradingViewSymbol - TradingView symbol
 * @returns {string} Internal symbol format
 */
export function tradingViewSymbolToAsset(tradingViewSymbol) {
  if (!tradingViewSymbol) return '';
  
  // Remove exchange prefixes
  const symbol = tradingViewSymbol.replace(/^[A-Z_]+:/, '');
  
  // Handle common transformations
  if (symbol.endsWith('USDT')) {
    return symbol.replace('USDT', '');
  }
  
  if (symbol.endsWith('.SA')) {
    return symbol.replace('.SA', '');
  }
  
  if (symbol.includes('USD') && symbol.length === 6) {
    // Likely forex pair like EURUSD -> EUR/USD
    return `${symbol.substring(0, 3)}/${symbol.substring(3)}`;
  }
  
  return symbol;
}

/**
 * Get suggested TradingView symbol for a given internal symbol
 * @param {string} internalSymbol - Our internal symbol
 * @param {string} assetClass - Asset class for context
 * @returns {string} Suggested TradingView symbol
 */
export function getSuggestedTradingViewSymbol(internalSymbol, assetClass = 'crypto') {
  if (!internalSymbol) return 'BTCUSDT';
  
  const mockAsset = {
    symbol: internalSymbol,
    asset_class: assetClass
  };
  
  return assetToTradingViewSymbol(mockAsset);
}

/**
 * Validate if a TradingView symbol format looks correct
 * @param {string} symbol - Symbol to validate
 * @returns {boolean} True if format looks valid
 */
export function isValidTradingViewSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return false;
  
  // Basic validation patterns
  const patterns = [
    /^[A-Z]+USDT$/,           // Crypto pairs like BTCUSDT
    /^[A-Z]+\.SA$/,           // Brazilian stocks like PETR4.SA
    /^[A-Z_]+:[A-Z0-9/]+$/,   // Exchange:Symbol format like FX_IDC:EURUSD
    /^[A-Z]{2,5}$/            // Simple symbols like AAPL, GOOGL
  ];
  
  return patterns.some(pattern => pattern.test(symbol));
}

/**
 * Get popular symbols by category for dropdowns/suggestions
 * @param {string} category - Category ('crypto', 'stocks', 'forex', etc.)
 * @returns {array} Array of popular symbols for that category
 */
export function getPopularSymbolsByCategory(category) {
  const categories = {
    crypto: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'MATICUSDT'],
    stocks: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META'],
    stocks_br: ['PETR4.SA', 'VALE3.SA', 'ITUB4.SA', 'BBDC4.SA', 'ABEV3.SA'],
    forex: ['FX_IDC:EURUSD', 'FX_IDC:GBPUSD', 'FX_IDC:USDJPY', 'FX_IDC:USDBRL'],
    etf: ['AMEX:SPY', 'NASDAQ:QQQ', 'BOVA11.SA']
  };
  
  return categories[category] || categories.crypto;
}

export default {
  TRADINGVIEW_EXCHANGES,
  ASSET_TYPE_MAPPINGS,
  SYMBOL_MAPPINGS,
  assetToTradingViewSymbol,
  tradingViewSymbolToAsset,
  getSuggestedTradingViewSymbol,
  isValidTradingViewSymbol,
  getPopularSymbolsByCategory
};