import httpx
import asyncio
import time
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

class PriceService:
    def __init__(self):
        self.base_url = "https://api.coingecko.com/api/v3"
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
            for api_id in api_ids:
                if api_id in data and 'usd' in data[api_id]:
                    prices[api_id] = float(data[api_id]['usd'])
                else:
                    logger.warning(f"Price not found for {api_id}")
                    prices[api_id] = 0.0
            
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
    
    async def __aenter__(self):
        """Suporte para uso como async context manager"""
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Cleanup automático quando usado como async context manager"""
        await self.close()