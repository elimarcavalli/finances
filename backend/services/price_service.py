import httpx
import asyncio
import time
import logging
import os
from typing import Dict, List
from .database_service import DatabaseService
from datetime import datetime

logger = logging.getLogger(__name__)

class PriceService:
    def __init__(self, db_service: DatabaseService = None):
        self.base_url = "https://api.coingecko.com/api/v3"
        self.alpha_vantage_base = "https://www.alphavantage.co/query"
        self.db_service = db_service
        self._client = None
        
    async def _get_client(self) -> httpx.AsyncClient:
        """Obtém ou cria o cliente HTTP assíncrono"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def close(self):
        """Fecha o cliente HTTP"""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def get_crypto_prices_in_usd(self, api_ids: List[str]) -> Dict[str, float]:
        """
        Busca preços de múltiplas criptomoedas em USD de uma só vez.
        
        Args:
            api_ids: Lista de identificadores de API do CoinGecko (ex: ['bitcoin', 'ethereum'])
            
        Returns:
            Dict mapeando cada ID para seu preço em USD
            Ex: {'bitcoin': 45000.0, 'ethereum': 3500.0}
            Retorna dict vazio em caso de erro
        """
        if not api_ids:
            return {}
            
        try:
            client = await self._get_client()
            ids_param = ','.join(api_ids)
            url = f"{self.base_url}/simple/price"
            params = {
                'ids': ids_param,
                'vs_currencies': 'usd',
                'include_market_cap': 'true',
                'include_24hr_vol': 'true',
                'include_24hr_change': 'true',
                'include_last_updated_at': 'true'
            }
            
            logger.info(f"Fetching crypto prices for: {api_ids}")
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()

            # Processar resposta e extrair apenas os preços em USD
            prices = {}
            logger.info(f"[PRICE_SERVICE] Resposta da API: {data}")
            
            for api_id in api_ids:
                if api_id in data and 'usd' in data[api_id]:
                    raw_price = data[api_id]['usd']
                    logger.info(f"[PRICE_SERVICE] Preço bruto da API para {api_id}: {raw_price} (tipo: {type(raw_price)})")
                    
                    # USAR DECIMAL para máxima precisão em valores muito pequenos
                    from decimal import Decimal, getcontext
                    getcontext().prec = 50  # Aumentar precisão para 50 dígitos
                    
                    try:
                        usd_price_decimal = Decimal(str(raw_price))
                        usd_price = float(usd_price_decimal)
                        
                        logger.info(f"[PRICE_SERVICE] Preço após conversão para {api_id}: ${usd_price} (Decimal: {usd_price_decimal})")
                        
                        # PROTEÇÃO: Apenas incluir no resultado se o preço for válido e maior que zero
                        if usd_price_decimal > 0:
                            prices[api_id] = usd_price
                            logger.info(f"[PRICE_SERVICE] Preço válido para {api_id}: ${usd_price}")
                        else:
                            logger.warning(f"[PRICE_SERVICE] Preço zero/inválido para {api_id}: {usd_price}")
                    except Exception as e:
                        logger.error(f"[PRICE_SERVICE] Erro ao converter preço para {api_id}: {e}")
                else:
                    logger.warning(f"[PRICE_SERVICE] Preço não encontrado na API para {api_id}")
                    # NÃO adicionar ao dict prices - deixar que o asset_service trate a ausência
            
            logger.info(f"Successfully fetched {len(prices)} crypto prices")
            return prices
            
        except httpx.RequestError as e:
            logger.error(f"HTTP request error fetching crypto prices: {e}")
            return {}
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP status error fetching crypto prices: {e.response.status_code}")
            return {}
        except Exception as e:
            logger.error(f"Unexpected error fetching crypto prices: {e}")
            return {}
    
    async def get_usd_to_brl_rate(self) -> float:
        """
        Busca a cotação USD/BRL usando o preço do Tether (USDT) em BRL.
        
        Returns:
            Taxa de conversão USD para BRL como float
            Retorna 0.0 em caso de erro
        """
        try:
            client = await self._get_client()
            url = f"{self.base_url}/simple/price"
            params = {
                'ids': 'tether',
                'vs_currencies': 'brl'
            }
            
            logger.info("Fetching USD to BRL exchange rate via Tether")
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            if 'tether' in data and 'brl' in data['tether']:
                rate = float(data['tether']['brl'])
                logger.info(f"USD to BRL rate: {rate}")
                return rate
            else:
                logger.error("USD to BRL rate not found in response")
                return 0.0
                
        except httpx.RequestError as e:
            logger.error(f"HTTP request error fetching USD to BRL rate: {e}")
            return 0.0
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP status error fetching USD to BRL rate: {e.response.status_code}")
            return 0.0
        except Exception as e:
            logger.error(f"Unexpected error fetching USD to BRL rate: {e}")
            return 0.0
    
    def _fetch_price_alpha_vantage(self, symbol: str) -> dict:
        """
        Busca dados de preço usando Alpha Vantage API (para ações brasileiras).
        
        Args:
            symbol: Símbolo da ação (ex: 'PETR4.SAO')
            
        Returns:
            Dict com dados padronizados ou erro
        """
        api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        if not api_key:
            return {"success": False, "error": "ALPHA_VANTAGE_API_KEY não encontrada no .env"}

        try:
            import requests
            url = f"{self.alpha_vantage_base}"
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': symbol,
                'apikey': api_key
            }

            logger.info(f"Buscando cotação para {symbol} na Alpha Vantage")
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            # Verificar se a API retornou uma nota (rate limit)
            if 'Note' in data:
                error_message = f"API Rate Limit Atingido: {data['Note']}"
                logger.warning(error_message)
                return {"success": False, "error": error_message}

            # Verificar se a resposta contém os dados esperados
            if 'Global Quote' not in data or not data['Global Quote']:
                logger.error(f"Resposta inesperada ou vazia da Alpha Vantage para {symbol}: {data}")
                return {"success": False, "error": "Formato de resposta inválido ou ticker não encontrado na Alpha Vantage"}

            global_quote = data['Global Quote']
            if '05. price' not in global_quote:
                logger.error(f"Campo '05. price' não encontrado na resposta: {global_quote}")
                return {"success": False, "error": "Preço não encontrado na resposta da API"}

            # Extrair dados padronizados
            price_current = float(global_quote['05. price'])
            
            return {
                "success": True,
                "price_current": price_current,
                "av_data": {
                    'av_open': float(global_quote.get('02. open', 0)),
                    'av_high': float(global_quote.get('03. high', 0)),
                    'av_low': float(global_quote.get('04. low', 0)),
                    'av_volume': int(global_quote.get('06. volume', 0)) if global_quote.get('06. volume', '0').replace(',', '').isdigit() else 0,
                    'av_latest_trading_day': global_quote.get('07. latest trading day'),
                    'av_previous_close': float(global_quote.get('08. previous close', 0)),
                    'av_change': float(global_quote.get('09. change', 0)),
                    'av_change_percent': global_quote.get('10. change percent', '0%').replace('%', '')
                }
            }

        except requests.RequestException as e:
            logger.error(f"Erro na requisição para Alpha Vantage: {e}")
            return {"success": False, "error": f"Erro ao conectar com Alpha Vantage: {str(e)}"}
        except Exception as e:
            logger.error(f"Erro inesperado ao buscar cotação: {e}")
            return {"success": False, "error": f"Erro inesperado: {str(e)}"}

    def _fetch_price_finnhub(self, symbol: str) -> dict:
        """
        Busca dados de preço usando Finnhub API (para ações americanas).
        
        Args:
            symbol: Símbolo da ação (ex: 'AAPL')
            
        Returns:
            Dict com dados padronizados ou erro
        """
        api_key = os.getenv('FINNHUB_API_KEY')
        if not api_key:
            return {"success": False, "error": "FINNHUB_API_KEY não encontrada no .env"}

        try:
            import requests
            import time
            from datetime import datetime, timezone

            quote_url = "https://finnhub.io/api/v1/quote"
            params = {
                'symbol': symbol,
                'token': api_key
            }

            logger.info(f"Buscando cotação para {symbol} na Finnhub")
            response = requests.get(quote_url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            # Validar resposta básica
            if not data or ('c' not in data):
                logger.error(f"Resposta inesperada ou vazia da Finnhub para {symbol}: {data}")
                return {"success": False, "error": "Formato de resposta inválido ou ticker não encontrado na Finnhub"}

            # Extrair dados
            price_current = data.get('c', 0)
            price_open = data.get('o', 0)
            price_high = data.get('h', 0)
            price_low = data.get('l', 0)
            price_previous_close = data.get('pc', 0)
            timestamp = data.get('t', None)

            if not price_current or float(price_current) <= 0:
                logger.error(f"Preço inválido. Não atualizando DB.")
                return {"success": False, "error": f"Preço inválido (quote retornou 0 ou vazio)"}

            # Obter volume via candles
            av_volume = 0
            try:
                candle_url = "https://finnhub.io/api/v1/stock/candle"
                now_ts = int(time.time())
                from_ts = now_ts - (3 * 24 * 60 * 60)
                candle_params = {
                    'symbol': symbol,
                    'resolution': 'D',
                    'from': from_ts,
                    'to': now_ts,
                    'token': api_key
                }
                candle_resp = requests.get(candle_url, params=candle_params, timeout=30)
                candle_resp.raise_for_status()
                candle_data = candle_resp.json()
                
                if candle_data.get('s') == 'ok' and 'v' in candle_data and candle_data['v']:
                    av_volume = int(candle_data['v'][-1]) if candle_data['v'][-1] is not None else 0
            except Exception as e:
                logger.warning(f"Erro ao obter volume para {symbol}: {e}")
                av_volume = 0

            # Processar data
            av_latest_trading_day = None
            if timestamp:
                try:
                    av_latest_trading_day = datetime.fromtimestamp(int(timestamp), tz=timezone.utc).date().isoformat()
                except Exception:
                    av_latest_trading_day = None

            # Calcular mudanças
            try:
                av_change = float(price_current) - float(price_previous_close)
                if price_previous_close and float(price_previous_close) != 0:
                    av_change_percent = (av_change / float(price_previous_close)) * 100
                else:
                    av_change_percent = 0.0
            except Exception:
                av_change = 0.0
                av_change_percent = 0.0

            return {
                "success": True,
                "price_current": float(price_current),
                "av_data": {
                    'av_open': float(price_open) if price_open is not None else 0.0,
                    'av_high': float(price_high) if price_high is not None else 0.0,
                    'av_low': float(price_low) if price_low is not None else 0.0,
                    'av_volume': int(av_volume) if av_volume is not None else 0,
                    'av_latest_trading_day': av_latest_trading_day,
                    'av_previous_close': float(price_previous_close) if price_previous_close is not None else 0.0,
                    'av_change': float(av_change),
                    'av_change_percent': float(av_change_percent)
                }
            }

        except requests.RequestException as e:
            logger.error(f"Erro na requisição para Finnhub: {e}")
            return {"success": False, "error": f"Erro ao conectar com Finnhub: {str(e)}"}
        except Exception as e:
            logger.error(f"Erro inesperado ao buscar cotação na Finnhub: {e}")
            return {"success": False, "error": f"Erro inesperado: {str(e)}"}

    def _update_asset_in_database(self, asset_id: int, asset_class: str, price_current: float, av_data: dict) -> float:
        """
        Atualiza o banco de dados com os dados de preço obtidos.
        
        Args:
            asset_id: ID do ativo
            asset_class: Classe do ativo (ACAO_BR ou ACAO_US)
            price_current: Preço atual
            av_data: Dados adicionais da API
            
        Returns:
            Preço em BRL para o retorno
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            if asset_class == 'ACAO_BR':
                # Ação brasileira: preço já está em BRL
                price_brl = price_current
                update_query = """
                    UPDATE assets 
                    SET last_price_brl = %s, 
                        last_price_usdt = 0, 
                        av_open = %s,
                        av_high = %s, 
                        av_low = %s,
                        av_volume = %s,
                        av_latest_trading_day = %s,
                        av_previous_close = %s,
                        av_change = %s,
                        av_change_percent = %s,
                        last_price_updated_at = NOW()
                    WHERE id = %s
                """
                cursor.execute(update_query, (
                    price_brl, av_data['av_open'], av_data['av_high'], 
                    av_data['av_low'], av_data['av_volume'], av_data['av_latest_trading_day'],
                    av_data['av_previous_close'], av_data['av_change'], 
                    av_data['av_change_percent'], asset_id
                ))
                
                logger.info(f"Preço atualizado (BR): R$ {price_brl}")
                return price_brl
                
            elif asset_class == 'ACAO_US':
                # Ação americana: preço está em USD, precisa converter
                price_usd = price_current
                
                # Buscar taxa USDT para conversão USD -> BRL
                cursor.execute(
                    "SELECT last_price_brl FROM assets WHERE symbol = 'USDT' AND asset_class = 'CRIPTO'"
                )
                usdt_result = cursor.fetchone()
                
                if usdt_result and usdt_result.get('last_price_brl'):
                    usd_to_brl_rate = float(usdt_result['last_price_brl'])
                    price_brl_converted = price_usd * usd_to_brl_rate
                    
                    logger.info(f"Taxa USD/BRL via USDT: {usd_to_brl_rate}")
                    logger.info(f"Conversão: ${price_usd} USD = R$ {price_brl_converted} BRL")
                else:
                    logger.warning("Taxa USDT não encontrada, usando preço USD sem conversão")
                    price_brl_converted = 0
                
                update_query = """
                    UPDATE assets 
                    SET last_price_usdt = %s,
                        last_price_brl = %s,
                        av_open = %s,
                        av_high = %s,
                        av_low = %s,
                        av_volume = %s,
                        av_latest_trading_day = %s,
                        av_previous_close = %s,
                        av_change = %s,
                        av_change_percent = %s,
                        last_price_updated_at = NOW()
                    WHERE id = %s
                """
                cursor.execute(update_query, (
                    price_usd, price_brl_converted, av_data['av_open'], av_data['av_high'],
                    av_data['av_low'], av_data['av_volume'], av_data['av_latest_trading_day'],
                    av_data['av_previous_close'], av_data['av_change'],
                    av_data['av_change_percent'], asset_id
                ))
                
                logger.info(f"Preço atualizado (US): ${price_usd} USD / R$ {price_brl_converted} BRL")
                return price_brl_converted
                
        finally:
            cursor.close()
            
        return 0.0

    def update_stock_price(self, asset_id: int) -> dict:
        """
        Atualiza o preço de um ativo do tipo ação (BR ou US) usando a API apropriada.
        Usa Alpha Vantage para ACAO_BR e Finnhub para ACAO_US.
        """
        if not self.db_service:
            raise Exception("DatabaseService não foi fornecido ao PriceService")

        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # 1. Buscar o ativo
            cursor.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
            asset = cursor.fetchone()

            if not asset:
                return {"success": False, "error": f"Ativo com ID {asset_id} não encontrado"}

            if asset['asset_class'] not in ['ACAO_BR', 'ACAO_US']:
                return {"success": False, "error": f"Ativo {asset['symbol']} não é do tipo ACAO_BR ou ACAO_US"}

            # 2. Formatar símbolo baseado na classe
            symbol = asset['symbol']
            if asset['asset_class'] == 'ACAO_BR' and not symbol.endswith('.SAO'):
                symbol = f"{symbol}.SAO"

            # 3. Chamar a API apropriada usando Strategy Pattern
            if asset['asset_class'] == 'ACAO_BR':
                api_result = self._fetch_price_alpha_vantage(symbol)
            else:  # ACAO_US
                api_result = self._fetch_price_finnhub(symbol)

            # 4. Verificar se a chamada da API foi bem-sucedida
            if not api_result['success']:
                return api_result

            # 5. Atualizar banco de dados
            price_brl = self._update_asset_in_database(
                asset_id, 
                asset['asset_class'], 
                api_result['price_current'], 
                api_result['av_data']
            )
            
            # 6. Commit das alterações
            self.db_service.connection.commit()

            # 7. Buscar ativo atualizado para retornar
            cursor.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
            updated_asset = cursor.fetchone()

            return {
                "success": True,
                "symbol": asset['symbol'],
                "price_brl": price_brl,
                "updated_at": updated_asset.get('last_price_updated_at') if updated_asset else None,
                "asset": updated_asset,
                "av_data": api_result['av_data']
            }

        except Exception as e:
            self.db_service.connection.rollback()
            logger.error(f"Erro inesperado no update_stock_price: {e}")
            return {"success": False, "error": f"Erro inesperado: {str(e)}"}
        finally:
            cursor.close()

    def get_assets_by_class(self, asset_class: str) -> list:
        """
        Busca todos os asset_ids de uma classe específica
        """
        if not self.db_service:
            raise Exception("DatabaseService não foi fornecido ao PriceService")
        
        print(f"[PRICE_SERVICE] asset_class: {asset_class}")

        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Buscar assets que o usuário possui (via asset_holdings)
            query = """
                SELECT DISTINCT a.id, a.symbol, a.asset_class, a.last_price_updated_at
                FROM assets a
                WHERE a.asset_class = %s
                ORDER BY a.last_price_updated_at
            """
            cursor.execute(query, (asset_class,))
            return cursor.fetchall()
        except Exception as e:
            logger.error(f"Erro ao buscar ativos da classe {asset_class}: {e}")
            return []
        finally:
            cursor.close()
    
    async def __aenter__(self):
        """Suporte para uso como async context manager"""
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Cleanup automático quando usado como async context manager"""
        await self.close()