/**
 * Strategy Chart Mapper Utility
 * Maps strategy parameters to TradingView technical indicators/studies
 * 
 * This utility converts our strategy configurations into TradingView-compatible
 * technical analysis studies that can be applied to charts.
 */

/**
 * Available TradingView studies/indicators
 * Reference: TradingView Pine Script built-in studies
 */
export const TRADINGVIEW_STUDIES = {
  // Moving Averages
  MA_SIMPLE: 'MA@tv-basicstudies',
  MA_EXPONENTIAL: 'MAExp@tv-basicstudies', 
  MA_WEIGHTED: 'MAWeighted@tv-basicstudies',
  
  // Oscillators
  RSI: 'RSI@tv-basicstudies',
  MACD: 'MACD@tv-basicstudies',
  STOCH: 'Stoch@tv-basicstudies',
  
  // Volatility
  BOLLINGER_BANDS: 'BB@tv-basicstudies',
  ATR: 'ATR@tv-basicstudies',
  
  // Volume
  VOLUME: 'Volume@tv-basicstudies',
  OBV: 'OBV@tv-basicstudies',
  
  // Trend
  PARABOLIC_SAR: 'ParabolicSAR@tv-basicstudies',
  SUPERTREND: 'Supertrend@tv-basicstudies',
  
  // Momentum
  CCI: 'CCI@tv-basicstudies',
  WILLIAMS_R: 'WilliamsR@tv-basicstudies',
  ROC: 'ROC@tv-basicstudies'
};

/**
 * Maps strategy types to their corresponding TradingView studies
 * Each strategy returns an array of study configurations
 */
export const STRATEGY_TO_STUDIES = {
  /**
   * RSI + MACD Strategy
   * Uses RSI for overbought/oversold levels and MACD for trend confirmation
   */
  'RSI_MACD': (parameters = {}) => {
    const {
      rsi_period = 14,
      rsi_oversold = 30,
      rsi_overbought = 70,
      macd_fast = 12,
      macd_slow = 26,
      macd_signal = 9
    } = parameters;

    return [
      {
        id: TRADINGVIEW_STUDIES.RSI,
        version: '49',
        inputs: {
          length: rsi_period,
          source: 'close',
          upper: rsi_overbought,
          lower: rsi_oversold
        }
      },
      {
        id: TRADINGVIEW_STUDIES.MACD,
        version: '49',
        inputs: {
          fast_length: macd_fast,
          slow_length: macd_slow,
          signal_smoothing: macd_signal,
          simple_ma: false,
          oscillator_ma: 'EMA',
          signal_ma: 'EMA'
        }
      }
    ];
  },

  /**
   * Bollinger Bands + RSI Strategy
   * Uses Bollinger Bands for volatility and RSI for momentum
   */
  'BOLLINGER_RSI': (parameters = {}) => {
    const {
      bb_period = 20,
      bb_std = 2.0,
      rsi_period = 14,
      rsi_threshold = 30
    } = parameters;

    return [
      {
        id: TRADINGVIEW_STUDIES.BOLLINGER_BANDS,
        version: '49',
        inputs: {
          length: bb_period,
          source: 'close',
          mult: bb_std
        }
      },
      {
        id: TRADINGVIEW_STUDIES.RSI,
        version: '49',
        inputs: {
          length: rsi_period,
          source: 'close',
          upper: 100 - rsi_threshold,
          lower: rsi_threshold
        }
      }
    ];
  },

  /**
   * Moving Average Crossover Strategy
   * Uses two moving averages of different periods for trend detection
   */
  'MOVING_AVERAGE_CROSSOVER': (parameters = {}) => {
    const {
      ma_short = 10,
      ma_long = 50,
      ma_type = 'EMA'
    } = parameters;

    // Map our MA type to TradingView studies
    const maStudyMap = {
      'SMA': TRADINGVIEW_STUDIES.MA_SIMPLE,
      'EMA': TRADINGVIEW_STUDIES.MA_EXPONENTIAL,
      'WMA': TRADINGVIEW_STUDIES.MA_WEIGHTED
    };

    const selectedMA = maStudyMap[ma_type] || TRADINGVIEW_STUDIES.MA_EXPONENTIAL;

    return [
      {
        id: selectedMA,
        version: '49',
        inputs: {
          length: ma_short,
          source: 'close',
          offset: 0
        }
      },
      {
        id: selectedMA,
        version: '49',
        inputs: {
          length: ma_long,
          source: 'close',
          offset: 0
        }
      }
    ];
  },

  /**
   * Momentum Breakout Strategy
   * Uses volume and volatility indicators for breakout detection
   */
  'MOMENTUM_BREAKOUT': (parameters = {}) => {
    const {
      lookback_period = 20,
      volume_multiplier = 1.5
    } = parameters;

    return [
      {
        id: TRADINGVIEW_STUDIES.VOLUME,
        version: '49',
        inputs: {}
      },
      {
        id: TRADINGVIEW_STUDIES.ATR,
        version: '49',
        inputs: {
          length: lookback_period
        }
      },
      {
        id: TRADINGVIEW_STUDIES.RSI,
        version: '49',
        inputs: {
          length: lookback_period,
          source: 'close'
        }
      }
    ];
  },

  /**
   * Mean Reversion Strategy
   * Uses statistical measures to identify price reversions to the mean
   */
  'MEAN_REVERSION': (parameters = {}) => {
    const {
      lookback_period = 20,
      z_score_entry = 2.0,
      z_score_exit = 0.5
    } = parameters;

    return [
      {
        id: TRADINGVIEW_STUDIES.BOLLINGER_BANDS,
        version: '49',
        inputs: {
          length: lookback_period,
          source: 'close',
          mult: z_score_entry
        }
      },
      {
        id: TRADINGVIEW_STUDIES.RSI,
        version: '49',
        inputs: {
          length: lookback_period,
          source: 'close'
        }
      },
      {
        id: TRADINGVIEW_STUDIES.CCI,
        version: '49',
        inputs: {
          length: lookback_period
        }
      }
    ];
  }
};

/**
 * Get TradingView studies configuration for a given strategy
 * @param {string} strategyType - The strategy type (e.g., 'RSI_MACD')
 * @param {object} parameters - Strategy parameters
 * @returns {array} Array of TradingView study configurations
 */
export function getStudiesForStrategy(strategyType, parameters = {}) {
  const mapper = STRATEGY_TO_STUDIES[strategyType];
  
  if (!mapper) {
    console.warn(`Strategy type "${strategyType}" not found in mapper`);
    return [];
  }

  try {
    return mapper(parameters);
  } catch (error) {
    console.error(`Error mapping strategy "${strategyType}" to studies:`, error);
    return [];
  }
}

/**
 * Get all available strategy types
 * @returns {array} Array of strategy type strings
 */
export function getAvailableStrategies() {
  return Object.keys(STRATEGY_TO_STUDIES);
}

/**
 * Validate if a strategy type is supported
 * @param {string} strategyType - The strategy type to validate
 * @returns {boolean} True if strategy is supported
 */
export function isStrategySupported(strategyType) {
  return Object.prototype.hasOwnProperty.call(STRATEGY_TO_STUDIES, strategyType);
}

/**
 * Get default parameters for a strategy type
 * @param {string} strategyType - The strategy type
 * @returns {object} Object with default parameter values
 */
export function getDefaultParameters(strategyType) {
  const defaults = {
    'RSI_MACD': {
      rsi_period: 14,
      rsi_oversold: 30,
      rsi_overbought: 70,
      macd_fast: 12,
      macd_slow: 26,
      macd_signal: 9
    },
    'BOLLINGER_RSI': {
      bb_period: 20,
      bb_std: 2.0,
      rsi_period: 14,
      rsi_threshold: 30
    },
    'MOVING_AVERAGE_CROSSOVER': {
      ma_short: 10,
      ma_long: 50,
      ma_type: 'EMA'
    },
    'MOMENTUM_BREAKOUT': {
      lookback_period: 20,
      volume_multiplier: 1.5
    },
    'MEAN_REVERSION': {
      lookback_period: 20,
      z_score_entry: 2.0,
      z_score_exit: 0.5
    }
  };

  return defaults[strategyType] || {};
}

export default {
  TRADINGVIEW_STUDIES,
  STRATEGY_TO_STUDIES,
  getStudiesForStrategy,
  getAvailableStrategies,
  isStrategySupported,
  getDefaultParameters
};