# services/backtesting_service.py

import pandas as pd
import numpy as np
import pandas_ta as ta
import logging
from datetime import date
from typing import Dict, Optional
from services.historical_data_service import HistoricalDataService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Classe de Backtest (Pronta para Produção)
# ---------------------------------------------------------------------------
class BacktestingService:
    def __init__(self, historical_data_service: HistoricalDataService = None):
        self.historical_data_service = historical_data_service or HistoricalDataService()
        # Fator de anualização para diferentes timeframes (aproximado)
        self.annualization_factor = {'1d': 252, '4h': 252*6, '1h': 252*24}

    def run_backtest(self, asset_symbol: str, timeframe: str, start_date: date, 
                     end_date: date, base_strategy_name: str, parameters: dict) -> Dict:
        """
        Orquestra a execução de um backtest vetorizado.
        """
        try:
            # 1. Obter dados históricos
            df = self.historical_data_service.get_historical_data(asset_symbol, timeframe, start_date, end_date)
            
            if df is None or len(df) < 50: # Mínimo de períodos para calcular indicadores
                raise ValueError("Dados históricos insuficientes para o período.")

            # 2. Aplicar indicadores técnicos
            df = self._apply_indicators(df.copy(), base_strategy_name, parameters)

            # 3. Gerar sinais de negociação
            df = self._generate_signals(df.copy(), base_strategy_name, parameters)

            # 4. Executar a simulação (backtest vetorizado)
            df = self._execute_simulation(df.copy(), parameters)

            # 5. Calcular métricas de performance
            metrics = self._calculate_metrics(df.copy(), self.annualization_factor.get(timeframe, 252))

            # 6. Calcular o Fitness Score final (usando a mesma fórmula do seu otimizador)
            metrics['fitness_score'] = self._calculate_fitness_score(metrics)
            
            return metrics

        except Exception as e:
            # Em caso de qualquer erro, retorna um resultado com penalidade máxima
            return self._get_error_result(str(e))

    def _apply_indicators(self, df: pd.DataFrame, strategy_name: str, parameters: dict) -> pd.DataFrame:
        """Aplica os indicadores necessários para a estratégia."""
        
        if strategy_name == 'RSI_MACD':
            # RSI
            rsi_period = int(parameters.get('rsi_period', 14))
            df.ta.rsi(length=rsi_period, append=True)
            
            # MACD
            macd_fast = int(parameters.get('macd_fast', 12))
            macd_slow = int(parameters.get('macd_slow', 26))
            macd_signal = int(parameters.get('macd_signal', 9))
            df.ta.macd(fast=macd_fast, slow=macd_slow, signal=macd_signal, append=True)
            
        elif strategy_name == 'BOLLINGER_RSI':
            # Bollinger Bands
            bb_period = int(parameters.get('bb_period', 20))
            bb_std = float(parameters.get('bb_std', 2.0))
            df.ta.bbands(length=bb_period, std=bb_std, append=True)
            
            # RSI
            rsi_period = int(parameters.get('rsi_period', 14))
            df.ta.rsi(length=rsi_period, append=True)
            
        elif strategy_name == 'MOVING_AVERAGE_CROSSOVER':
            # Moving Averages
            ma_short = int(parameters.get('ma_short', 10))
            ma_long = int(parameters.get('ma_long', 50))
            ma_type = parameters.get('ma_type', 'EMA')
            
            if ma_type == 'SMA':
                df.ta.sma(length=ma_short, append=True)
                df.ta.sma(length=ma_long, append=True)
            elif ma_type == 'EMA':
                df.ta.ema(length=ma_short, append=True)
                df.ta.ema(length=ma_long, append=True)
            elif ma_type == 'WMA':
                df.ta.wma(length=ma_short, append=True)
                df.ta.wma(length=ma_long, append=True)
                
        elif strategy_name == 'MOMENTUM_BREAKOUT':
            # ATR para volatilidade
            lookback_period = int(parameters.get('lookback_period', 20))
            df.ta.atr(length=lookback_period, append=True)
            
            # Rolling max/min para breakout
            df[f'high_max_{lookback_period}'] = df['high'].rolling(window=lookback_period).max()
            df[f'low_min_{lookback_period}'] = df['low'].rolling(window=lookback_period).min()
            
            # Volume SMA
            df.ta.sma(close=df['volume'], length=lookback_period, append=True, prefix='vol')
            
        elif strategy_name == 'MEAN_REVERSION':
            # Z-Score calculation
            lookback_period = int(parameters.get('lookback_period', 20))
            df['price_mean'] = df['close'].rolling(window=lookback_period).mean()
            df['price_std'] = df['close'].rolling(window=lookback_period).std()
            df['z_score'] = (df['close'] - df['price_mean']) / df['price_std']
            
        elif strategy_name == 'RSI_Strategy':  # Manter compatibilidade com testes existentes
            rsi_period = int(parameters.get('rsi_period', 14))
            df.ta.rsi(length=rsi_period, append=True)
            
        else:
            logger.warning(f"Estratégia não implementada: {strategy_name}")
            
        df.dropna(inplace=True)
        return df

    def _generate_signals(self, df: pd.DataFrame, strategy_name: str, parameters: dict) -> pd.DataFrame:
        """Gera sinais de compra (1) e venda (-1) com base nos indicadores."""
        df['signal'] = 0
        
        if strategy_name == 'RSI_MACD':
            # Obter colunas RSI e MACD
            rsi_col = df.columns[df.columns.str.startswith('RSI_')].tolist()[0]
            macd_col = df.columns[df.columns.str.startswith('MACD_')].tolist()[0]
            macds_col = df.columns[df.columns.str.startswith('MACDs_')].tolist()[0]
            
            oversold_level = parameters.get('rsi_oversold', 30)
            overbought_level = parameters.get('rsi_overbought', 70)
            
            # Sinais de compra: RSI oversold + MACD bullish crossover
            rsi_oversold = df[rsi_col] <= oversold_level
            macd_bullish = (df[macd_col] > df[macds_col]) & (df[macd_col].shift(1) <= df[macds_col].shift(1))
            buy_signals = rsi_oversold & macd_bullish
            
            # Sinais de venda: RSI overbought + MACD bearish crossover  
            rsi_overbought = df[rsi_col] >= overbought_level
            macd_bearish = (df[macd_col] < df[macds_col]) & (df[macd_col].shift(1) >= df[macds_col].shift(1))
            sell_signals = rsi_overbought & macd_bearish
            
            df.loc[buy_signals, 'signal'] = 1
            df.loc[sell_signals, 'signal'] = -1
            
        elif strategy_name == 'BOLLINGER_RSI':
            # Obter colunas Bollinger e RSI
            bb_lower_col = df.columns[df.columns.str.startswith('BBL_')].tolist()[0]
            bb_upper_col = df.columns[df.columns.str.startswith('BBU_')].tolist()[0]
            rsi_col = df.columns[df.columns.str.startswith('RSI_')].tolist()[0]
            
            rsi_threshold = parameters.get('rsi_threshold', 30)
            
            # Sinais de compra: Preço toca banda inferior + RSI oversold
            price_at_lower = df['close'] <= df[bb_lower_col]
            rsi_oversold = df[rsi_col] <= rsi_threshold
            buy_signals = price_at_lower & rsi_oversold
            
            # Sinais de venda: Preço toca banda superior + RSI overbought
            price_at_upper = df['close'] >= df[bb_upper_col]
            rsi_overbought = df[rsi_col] >= (100 - rsi_threshold)
            sell_signals = price_at_upper & rsi_overbought
            
            df.loc[buy_signals, 'signal'] = 1
            df.loc[sell_signals, 'signal'] = -1
            
        elif strategy_name == 'MOVING_AVERAGE_CROSSOVER':
            # Obter colunas das médias móveis
            ma_short = int(parameters.get('ma_short', 10))
            ma_long = int(parameters.get('ma_long', 50))
            ma_type = parameters.get('ma_type', 'EMA')
            
            short_col = f'{ma_type}_{ma_short}'
            long_col = f'{ma_type}_{ma_long}'
            
            # Sinais de compra: MA curta cruza para cima da MA longa
            buy_signals = (df[short_col] > df[long_col]) & (df[short_col].shift(1) <= df[long_col].shift(1))
            
            # Sinais de venda: MA curta cruza para baixo da MA longa
            sell_signals = (df[short_col] < df[long_col]) & (df[short_col].shift(1) >= df[long_col].shift(1))
            
            df.loc[buy_signals, 'signal'] = 1
            df.loc[sell_signals, 'signal'] = -1
            
        elif strategy_name == 'MOMENTUM_BREAKOUT':
            lookback_period = int(parameters.get('lookback_period', 20))
            breakout_threshold = float(parameters.get('breakout_threshold', 0.02))
            volume_multiplier = float(parameters.get('volume_multiplier', 1.5))
            
            # Obter colunas
            atr_col = df.columns[df.columns.str.startswith('ATRr_')].tolist()[0]
            vol_sma_col = f'vol_SMA_{lookback_period}'
            high_max_col = f'high_max_{lookback_period}'
            low_min_col = f'low_min_{lookback_period}'
            
            # Sinais de compra: Breakout acima do máximo + volume alto
            price_breakout_up = df['close'] > df[high_max_col].shift(1) * (1 + breakout_threshold)
            volume_surge = df['volume'] > df[vol_sma_col] * volume_multiplier
            buy_signals = price_breakout_up & volume_surge
            
            # Sinais de venda: Breakout abaixo do mínimo + volume alto
            price_breakout_down = df['close'] < df[low_min_col].shift(1) * (1 - breakout_threshold)
            sell_signals = price_breakout_down & volume_surge
            
            df.loc[buy_signals, 'signal'] = 1
            df.loc[sell_signals, 'signal'] = -1
            
        elif strategy_name == 'MEAN_REVERSION':
            z_score_entry = float(parameters.get('z_score_entry', 2.0))
            z_score_exit = float(parameters.get('z_score_exit', 0.5))
            
            # Sinais de compra: Z-score muito negativo (preço muito abaixo da média)
            buy_signals = df['z_score'] <= -z_score_entry
            
            # Sinais de venda: Z-score muito positivo (preço muito acima da média)
            sell_signals = df['z_score'] >= z_score_entry
            
            # Sinais de fechamento de posições (neutral)
            close_long = (df['z_score'] >= -z_score_exit) & (df['z_score'].shift(1) < -z_score_exit)
            close_short = (df['z_score'] <= z_score_exit) & (df['z_score'].shift(1) > z_score_exit)
            
            df.loc[buy_signals, 'signal'] = 1
            df.loc[sell_signals, 'signal'] = -1
            df.loc[close_long | close_short, 'signal'] = 0
            
        elif strategy_name == 'RSI_Strategy':  # Manter compatibilidade
            rsi_col = df.columns[df.columns.str.startswith('RSI_')].tolist()[0]
            oversold_level = parameters.get('rsi_oversold', 30)
            overbought_level = parameters.get('rsi_overbought', 70)
            
            # Sinal de compra: RSI cruza para CIMA do nível 'oversold'
            buy_signals = (df[rsi_col] > oversold_level) & (df[rsi_col].shift(1) <= oversold_level)
            # Sinal de venda: RSI cruza para BAIXO do nível 'overbought'
            sell_signals = (df[rsi_col] < overbought_level) & (df[rsi_col].shift(1) >= overbought_level)

            df.loc[buy_signals, 'signal'] = 1
            df.loc[sell_signals, 'signal'] = -1
        
        else:
            logger.warning(f"Lógica de sinais não implementada para: {strategy_name}")
        
        return df

    def _execute_simulation(self, df: pd.DataFrame, parameters: dict) -> pd.DataFrame:
        """Executa a simulação baseada em sinais."""
        # A posição é o sinal do dia anterior (agimos na abertura do dia seguinte)
        df['position'] = df['signal'].replace(to_replace=0, method='ffill').shift(1)
        df['position'].fillna(0, inplace=True)
        
        # Calcular os retornos do ativo
        df['asset_returns'] = df['close'].pct_change()
        
        # Calcular os retornos da estratégia
        df['strategy_returns'] = df['asset_returns'] * df['position']
        
        df.dropna(inplace=True)
        return df

    def _calculate_metrics(self, df: pd.DataFrame, annualization: int) -> Dict:
        """Calcula as métricas de performance do backtest."""
        if df.empty or 'strategy_returns' not in df.columns:
            return self._get_error_result("DataFrame vazio após simulação.")

        # Equity Curve e Drawdown
        equity_curve = (1 + df['strategy_returns']).cumprod()
        running_max = equity_curve.cummax()
        drawdown = (equity_curve - running_max) / running_max
        
        # Métricas
        net_profit_percent = (equity_curve.iloc[-1] - 1) * 100
        max_drawdown_percent = abs(drawdown.min()) * 100
        
        # Sharpe Ratio
        mean_return = df['strategy_returns'].mean()
        std_dev = df['strategy_returns'].std()
        sharpe_ratio = (mean_return / std_dev) * np.sqrt(annualization) if std_dev > 0 else 0
        
        # Trades e Win Rate
        trades = df['position'].diff().fillna(0).abs()
        total_trades = int((trades > 0).sum() / 2) # Cada trade tem entrada e saída
        
        winning_trades = (df['strategy_returns'][df['position'] != df['position'].shift(1)] > 0).sum()
        win_rate_percent = (winning_trades / total_trades) * 100 if total_trades > 0 else 0

        return {
            'total_trades': total_trades,
            'win_rate_percent': round(win_rate_percent, 2),
            'net_profit_percent': round(net_profit_percent, 2),
            'max_drawdown_percent': round(max_drawdown_percent, 2),
            'sharpe_ratio': round(sharpe_ratio, 4)
        }

    def _calculate_fitness_score(self, metrics: dict) -> float:
        """Calcula uma pontuação única para o resultado do backtest."""
        # Fórmula idêntica à que estava na sua simulação para consistência
        fitness_score = (
            metrics['net_profit_percent'] * 0.4 + 
            (100 - metrics['max_drawdown_percent']) * 0.3 + 
            metrics['win_rate_percent'] * 0.002 +
            (metrics['sharpe_ratio'] * 10) * 0.1
        )
        # Penaliza estratégias com poucos trades
        if metrics['total_trades'] < 10:
            fitness_score -= 20
            
        return round(fitness_score, 10)
    
    def _get_error_result(self, error_message: str = "") -> dict:
        """Retorna um dicionário de resultado padrão para erros."""
        print(f"Erro no backtest: {error_message}")
        return {
            'total_trades': 0, 'win_rate_percent': 0.0,
            'net_profit_percent': -100.0, 'max_drawdown_percent': 100.0,
            'sharpe_ratio': -10.0, 'fitness_score': -1000.0
        }