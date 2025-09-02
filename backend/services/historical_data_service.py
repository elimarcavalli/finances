"""
Serviço para buscar e cachear dados históricos de preços.
Substitui o DataService mock no backtesting_service.py.
"""

import pandas as pd
import numpy as np
import requests
import logging
from datetime import date, datetime, timedelta
from typing import Dict, Optional, List
from services.database_service import DatabaseService
import time

logger = logging.getLogger(__name__)

class HistoricalDataService:
    """
    Serviço responsável por buscar dados históricos de preços com sistema de cache.
    Usa CoinGecko como fonte principal de dados.
    """
    
    def __init__(self):
        self.db_service = DatabaseService()
        # URLs da API do CoinGecko
        self.coingecko_base_url = "https://api.coingecko.com/api/v3"
        
        # Mapeamento de símbolos para IDs do CoinGecko
        self.symbol_to_coingecko_id = {
            'BTCUSDT': 'bitcoin',
            'ETHUSDT': 'ethereum', 
            'ADAUSDT': 'cardano',
            'BNBUSDT': 'binancecoin',
            'XRPUSDT': 'ripple',
            'SOLUSDT': 'solana',
            'DOTUSDT': 'polkadot',
            'DOGEUSDT': 'dogecoin',
            'AVAXUSDT': 'avalanche-2',
            'LINKUSDT': 'chainlink'
        }
        
        # Mapeamento de timeframes para intervals CoinGecko
        self.timeframe_mapping = {
            '1d': 'daily',
            '4h': 'hourly',  # Será adaptado para 4h
            '1h': 'hourly'
        }

    def get_historical_data(self, asset_symbol: str, timeframe: str, start_date: date, end_date: date) -> Optional[pd.DataFrame]:
        """
        Busca dados históricos com sistema de cache.
        
        Args:
            asset_symbol: Símbolo do ativo (ex: BTCUSDT)
            timeframe: Timeframe (1d, 4h, 1h)
            start_date: Data de início
            end_date: Data de fim
            
        Returns:
            DataFrame com colunas [open, high, low, close, volume] e índice de datas
        """
        try:
            logger.info(f"Buscando dados históricos: {asset_symbol} {timeframe} {start_date} - {end_date}")
            
            # 1. Verificar se temos dados em cache
            cached_data = self._get_cached_data(asset_symbol, timeframe, start_date, end_date)
            
            # 2. Identificar lacunas nos dados
            missing_dates = self._identify_missing_dates(cached_data, start_date, end_date, timeframe)
            
            # 3. Buscar dados faltantes da API
            if missing_dates:
                logger.info(f"Buscando {len(missing_dates)} dias faltantes da API")
                new_data = self._fetch_from_api(asset_symbol, timeframe, missing_dates[0], missing_dates[-1])
                
                if new_data is not None and not new_data.empty:
                    # Salvar novos dados no cache
                    self._save_to_cache(asset_symbol, timeframe, new_data)
                    
                    # Combinar com dados em cache
                    if cached_data is not None and not cached_data.empty:
                        cached_data = pd.concat([cached_data, new_data]).sort_index().drop_duplicates()
                    else:
                        cached_data = new_data
            
            # 4. Filtrar dados para o período solicitado
            if cached_data is not None and not cached_data.empty:
                cached_data = cached_data.loc[start_date:end_date]
                
                # Validar se temos dados suficientes
                if len(cached_data) < 10:  # Mínimo de 10 pontos de dados
                    logger.warning(f"Dados insuficientes: apenas {len(cached_data)} pontos para {asset_symbol}")
                    return None
                
                logger.info(f"Retornando {len(cached_data)} pontos de dados históricos")
                return cached_data
            
            logger.warning(f"Nenhum dado disponível para {asset_symbol} no período {start_date} - {end_date}")
            return None
            
        except Exception as e:
            logger.error(f"Erro ao buscar dados históricos: {str(e)}")
            return None

    def _get_cached_data(self, asset_symbol: str, timeframe: str, start_date: date, end_date: date) -> Optional[pd.DataFrame]:
        """Busca dados em cache no banco de dados."""
        try:
            self.db_service.ensure_connection()
            cursor = self.db_service.connection.cursor(dictionary=True)
            
            query = """
                SELECT date, open_price as `open`, high_price as `high`, 
                       low_price as `low`, close_price as `close`, volume
                FROM historical_price_data 
                WHERE asset_symbol = %s AND timeframe = %s 
                  AND date >= %s AND date <= %s
                ORDER BY date
            """
            cursor.execute(query, (asset_symbol, timeframe, start_date, end_date))
            rows = cursor.fetchall()
            cursor.close()
            
            if not rows:
                return None
                
            # Converter para DataFrame
            df = pd.DataFrame(rows)
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            
            # Converter colunas para float
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = df[col].astype(float)
            
            logger.info(f"Carregados {len(df)} pontos do cache")
            return df
            
        except Exception as e:
            logger.error(f"Erro ao buscar dados em cache: {str(e)}")
            return None

    def _identify_missing_dates(self, cached_data: Optional[pd.DataFrame], start_date: date, end_date: date, timeframe: str) -> List[date]:
        """Identifica datas faltantes no cache."""
        if cached_data is None or cached_data.empty:
            # Se não há dados em cache, precisamos de todo o período
            return [start_date]
        
        # Verificar se temos dados para o período completo
        cached_start = cached_data.index.min().date()
        cached_end = cached_data.index.max().date()
        
        missing_dates = []
        
        # Dados faltantes antes do período em cache
        if start_date < cached_start:
            missing_dates.append(start_date)
        
        # Dados faltantes depois do período em cache
        if end_date > cached_end:
            missing_dates.append(cached_end + timedelta(days=1))
            
        return missing_dates

    def _fetch_from_api(self, asset_symbol: str, timeframe: str, start_date: date, end_date: date) -> Optional[pd.DataFrame]:
        """Busca dados da API do CoinGecko."""
        try:
            # Mapear símbolo para ID do CoinGecko 
            coingecko_id = self.symbol_to_coingecko_id.get(asset_symbol)
            if not coingecko_id:
                logger.error(f"Símbolo {asset_symbol} não encontrado no mapeamento CoinGecko")
                return None
            
            # Calcular timestamps Unix
            start_timestamp = int(datetime.combine(start_date, datetime.min.time()).timestamp())
            end_timestamp = int(datetime.combine(end_date, datetime.min.time()).timestamp())
            
            # URL da API CoinGecko para dados históricos
            url = f"{self.coingecko_base_url}/coins/{coingecko_id}/market_chart/range"
            params = {
                'vs_currency': 'usd',
                'from': start_timestamp,
                'to': end_timestamp
            }
            
            logger.info(f"Chamando CoinGecko API: {url}")
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code == 429:  # Rate limit
                logger.warning("Rate limit atingido, aguardando...")
                time.sleep(60)  # Aguardar 1 minuto
                response = requests.get(url, params=params, timeout=30)
            
            response.raise_for_status()
            data = response.json()
            
            # Processar dados da resposta
            if 'prices' not in data or not data['prices']:
                logger.warning(f"Nenhum dado de preço recebido da API para {asset_symbol}")
                return None
            
            # Converter para DataFrame
            prices = data['prices']
            
            df_data = []
            for i, [timestamp, price] in enumerate(prices):
                dt = datetime.fromtimestamp(timestamp / 1000)
                
                # Para dados diários, usar apenas um ponto por dia
                if timeframe == '1d':
                    dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
                
                df_data.append({
                    'date': dt,
                    'open': price,  # CoinGecko não fornece OHLC detalhado na API gratuita
                    'high': price,
                    'low': price,
                    'close': price,
                    'volume': 0  # Volume não disponível nesta API
                })
            
            if not df_data:
                return None
            
            df = pd.DataFrame(df_data)
            df.set_index('date', inplace=True)
            
            # Para timeframes menores, simular dados OHLC baseados no preço
            if timeframe in ['4h', '1h']:
                df = self._simulate_ohlc_data(df, timeframe)
            
            logger.info(f"Buscados {len(df)} pontos da API CoinGecko")
            return df
            
        except requests.RequestException as e:
            logger.error(f"Erro na requisição para CoinGecko: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Erro ao processar dados da API: {str(e)}")
            return None

    def _simulate_ohlc_data(self, df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
        """
        Simula dados OHLC mais realistas baseados nos preços disponíveis.
        Para uso em backtesting quando dados detalhados não estão disponíveis.
        """
        try:
            df_copy = df.copy()
            
            for i in range(len(df_copy)):
                base_price = df_copy.iloc[i]['close']
                
                # Simular volatilidade baseada no timeframe
                volatility = 0.02 if timeframe == '1d' else 0.01  # 2% para daily, 1% para intraday
                
                # Gerar variação aleatória
                variation = np.random.normal(0, volatility)
                high_var = abs(np.random.normal(0, volatility/2))
                low_var = abs(np.random.normal(0, volatility/2))
                
                # Calcular OHLC
                open_price = base_price * (1 + variation)
                high_price = max(open_price, base_price) * (1 + high_var)
                low_price = min(open_price, base_price) * (1 - low_var)
                close_price = base_price
                
                df_copy.iloc[i, df_copy.columns.get_loc('open')] = open_price
                df_copy.iloc[i, df_copy.columns.get_loc('high')] = high_price
                df_copy.iloc[i, df_copy.columns.get_loc('low')] = low_price
                df_copy.iloc[i, df_copy.columns.get_loc('close')] = close_price
                df_copy.iloc[i, df_copy.columns.get_loc('volume')] = np.random.randint(100000, 1000000)
            
            return df_copy
            
        except Exception as e:
            logger.error(f"Erro ao simular dados OHLC: {str(e)}")
            return df

    def _save_to_cache(self, asset_symbol: str, timeframe: str, df: pd.DataFrame) -> None:
        """Salva dados no cache do banco de dados."""
        try:
            self.db_service.ensure_connection()
            cursor = self.db_service.connection.cursor()
            
            # Preparar dados para inserção
            insert_data = []
            for date_index, row in df.iterrows():
                insert_data.append((
                    asset_symbol,
                    timeframe,
                    date_index.date(),
                    float(row['open']),
                    float(row['high']),
                    float(row['low']),
                    float(row['close']),
                    float(row['volume'])
                ))
            
            # Inserção em lote com ON DUPLICATE KEY UPDATE
            query = """
                INSERT INTO historical_price_data 
                (asset_symbol, timeframe, date, open_price, high_price, low_price, close_price, volume)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    open_price = VALUES(open_price),
                    high_price = VALUES(high_price),
                    low_price = VALUES(low_price),
                    close_price = VALUES(close_price),
                    volume = VALUES(volume),
                    updated_at = CURRENT_TIMESTAMP
            """
            
            cursor.executemany(query, insert_data)
            self.db_service.connection.commit()
            cursor.close()
            
            logger.info(f"Salvos {len(insert_data)} pontos no cache")
            
        except Exception as e:
            self.db_service.connection.rollback()
            logger.error(f"Erro ao salvar dados no cache: {str(e)}")

    def clear_cache(self, asset_symbol: str = None, timeframe: str = None) -> None:
        """
        Limpa o cache de dados históricos.
        
        Args:
            asset_symbol: Se especificado, limpa apenas dados deste ativo
            timeframe: Se especificado, limpa apenas dados deste timeframe
        """
        try:
            self.db_service.ensure_connection()
            cursor = self.db_service.connection.cursor()
            
            if asset_symbol and timeframe:
                query = "DELETE FROM historical_price_data WHERE asset_symbol = %s AND timeframe = %s"
                cursor.execute(query, (asset_symbol, timeframe))
            elif asset_symbol:
                query = "DELETE FROM historical_price_data WHERE asset_symbol = %s"
                cursor.execute(query, (asset_symbol,))
            else:
                query = "DELETE FROM historical_price_data"
                cursor.execute(query)
            
            self.db_service.connection.commit()
            cursor.close()
            
            logger.info("Cache limpo com sucesso")
            
        except Exception as e:
            self.db_service.connection.rollback()
            logger.error(f"Erro ao limpar cache: {str(e)}")

    def get_cache_stats(self) -> Dict:
        """Retorna estatísticas do cache de dados."""
        try:
            self.db_service.ensure_connection()
            cursor = self.db_service.connection.cursor(dictionary=True)
            
            # Estatísticas gerais
            query = """
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(DISTINCT asset_symbol) as unique_assets,
                    COUNT(DISTINCT timeframe) as unique_timeframes,
                    MIN(date) as earliest_date,
                    MAX(date) as latest_date
                FROM historical_price_data
            """
            cursor.execute(query)
            stats = cursor.fetchone()
            
            # Estatísticas por ativo
            query = """
                SELECT asset_symbol, COUNT(*) as records, MIN(date) as from_date, MAX(date) as to_date
                FROM historical_price_data
                GROUP BY asset_symbol
                ORDER BY records DESC
            """
            cursor.execute(query)
            by_asset = cursor.fetchall()
            
            cursor.close()
            
            return {
                'general': stats,
                'by_asset': by_asset
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas do cache: {str(e)}")
            return {'general': {}, 'by_asset': []}