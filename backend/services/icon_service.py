import requests
import asyncio
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)

class IconService:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'CryptoPortfolio/1.0'
        })
    
    def get_coingecko_icon(self, asset_identifier: str) -> Dict:
        """
        Obtém o ícone de um ativo da API da CoinGecko
        
        Args:
            asset_identifier: ID, symbol ou nome do ativo
            
        Returns:
            Dict com success, icon_url e source
        """
        try:
            # Tentar primeiro como ID direto
            result = self._try_direct_id(asset_identifier)
            if result["success"]:
                return result
            
            # Se falhar, tentar buscar na lista de mercados
            result = self._try_markets_api(asset_identifier)
            if result["success"]:
                return result
            
            # Se ainda falhar, tentar buscar por search
            result = self._try_search_api(asset_identifier)
            if result["success"]:
                return result
            
            return {"success": False, "error": "Icon not found", "asset_identifier": asset_identifier}
            
        except Exception as e:
            logger.error(f"Erro ao buscar ícone para {asset_identifier}: {e}")
            return {"success": False, "error": str(e), "asset_identifier": asset_identifier}
    
    def _try_direct_id(self, asset_identifier: str) -> Dict:
        """Tenta buscar diretamente pelo ID"""
        try:
            api_url = f"https://api.coingecko.com/api/v3/coins/{asset_identifier}"
            response = self.session.get(api_url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                icon_url = data.get('image', {}).get('large')
                if icon_url:
                    return {"success": True, "icon_url": icon_url, "source": "direct_id"}
        except Exception as e:
            logger.debug(f"Direct ID search failed for {asset_identifier}: {e}")
        
        return {"success": False}
    
    def _try_markets_api(self, asset_identifier: str) -> Dict:
        """Tenta buscar pela API de mercados"""
        try:
            markets_url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={asset_identifier}"
            response = self.session.get(markets_url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    icon_url = data[0].get('image')
                    if icon_url:
                        return {"success": True, "icon_url": icon_url, "source": "markets"}
        except Exception as e:
            logger.debug(f"Markets API search failed for {asset_identifier}: {e}")
        
        return {"success": False}
    
    def _try_search_api(self, asset_identifier: str) -> Dict:
        """Tenta buscar pela API de search"""
        try:
            search_url = f"https://api.coingecko.com/api/v3/search?query={asset_identifier}"
            response = self.session.get(search_url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                coins = data.get('coins', [])
                if coins:
                    coin_id = coins[0].get('id')
                    if coin_id:
                        # Fazer nova consulta com o ID encontrado
                        coin_url = f"https://api.coingecko.com/api/v3/coins/{coin_id}"
                        coin_response = self.session.get(coin_url, timeout=10)
                        if coin_response.status_code == 200:
                            coin_data = coin_response.json()
                            icon_url = coin_data.get('image', {}).get('large')
                            if icon_url:
                                return {"success": True, "icon_url": icon_url, "source": "search"}
        except Exception as e:
            logger.debug(f"Search API search failed for {asset_identifier}: {e}")
        
        return {"success": False}
    
    def get_multiple_icons(self, asset_identifiers: List[str]) -> Dict[str, Dict]:
        """
        Obtém ícones para múltiplos ativos de uma vez
        
        Args:
            asset_identifiers: Lista de identificadores de ativos
            
        Returns:
            Dict mapeando identificador para resultado do ícone
        """
        results = {}
        
        # Primeiro, tentar buscar todos de uma vez pela API de mercados
        if asset_identifiers:
            try:
                ids_string = ",".join(asset_identifiers)
                markets_url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={ids_string}&per_page=250"
                response = self.session.get(markets_url, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    for item in data:
                        asset_id = item.get('id')
                        icon_url = item.get('image')
                        if asset_id and icon_url and asset_id in asset_identifiers:
                            results[asset_id] = {
                                "success": True,
                                "icon_url": icon_url,
                                "source": "bulk_markets"
                            }
            except Exception as e:
                logger.error(f"Erro na busca em lote: {e}")
        
        # Para os que não foram encontrados, buscar individualmente
        for identifier in asset_identifiers:
            if identifier not in results:
                results[identifier] = self.get_coingecko_icon(identifier)
        
        return results
    
    def close(self):
        """Fecha a sessão"""
        if hasattr(self, 'session'):
            self.session.close()