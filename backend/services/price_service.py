import requests
import time
from typing import Optional, Dict, Any

# Cache global em memória para preços
price_cache = {}
CACHE_DURATION = 600  # 10 minutos em segundos

class PriceService:
    @staticmethod
    def get_price(api_identifier: str) -> Optional[Dict[str, Any]]:
        """
        Busca o preço de um ativo pelo identificador da API do CoinGecko.
        
        Args:
            api_identifier: Identificador do CoinGecko (ex: 'bitcoin', 'ethereum')
            
        Returns:
            Dict com preços em USD e BRL, ou None se houver erro
        """
        current_time = time.time()
        
        # Verificar cache primeiro
        if api_identifier in price_cache:
            cached_data = price_cache[api_identifier]
            cache_age = current_time - cached_data['timestamp']
            
            # Se o cache tem menos de 10 minutos, usar dados em cache
            if cache_age < CACHE_DURATION:
                print(f"Cache hit for {api_identifier} (age: {cache_age:.1f}s)")
                return {
                    'usd': cached_data['usd'],
                    'brl': cached_data['brl'],
                    'cached': True,
                    'cache_age': cache_age
                }
        
        # Cache expirado ou não existe, buscar da API
        try:
            url = f"https://api.coingecko.com/api/v3/simple/price?ids={api_identifier}&vs_currencies=usd,brl"
            
            print(f"Fetching price from CoinGecko for {api_identifier}")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Verificar se o identificador existe na resposta
            if api_identifier not in data:
                print(f"Asset {api_identifier} not found in CoinGecko")
                return None
            
            asset_data = data[api_identifier]
            
            # Verificar se temos os preços necessários
            if 'usd' not in asset_data or 'brl' not in asset_data:
                print(f"Price data incomplete for {api_identifier}")
                return None
            
            # Atualizar cache
            price_cache[api_identifier] = {
                'usd': asset_data['usd'],
                'brl': asset_data['brl'],
                'timestamp': current_time
            }
            
            return {
                'usd': asset_data['usd'],
                'brl': asset_data['brl'],
                'cached': False,
                'cache_age': 0
            }
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching price for {api_identifier}: {e}")
            return None
        except ValueError as e:
            print(f"Error parsing JSON response for {api_identifier}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error fetching price for {api_identifier}: {e}")
            return None
    
    @staticmethod
    def get_multiple_prices(api_identifiers: list) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Busca preços para múltiplos ativos de uma vez (mais eficiente).
        
        Args:
            api_identifiers: Lista de identificadores do CoinGecko
            
        Returns:
            Dict mapeando cada identificador para seus dados de preço
        """
        if not api_identifiers:
            return {}
        
        result = {}
        uncached_identifiers = []
        current_time = time.time()
        
        # Verificar cache para cada identificador
        for identifier in api_identifiers:
            if identifier in price_cache:
                cached_data = price_cache[identifier]
                cache_age = current_time - cached_data['timestamp']
                
                if cache_age < CACHE_DURATION:
                    result[identifier] = {
                        'usd': cached_data['usd'],
                        'brl': cached_data['brl'],
                        'cached': True,
                        'cache_age': cache_age
                    }
                    continue
            
            uncached_identifiers.append(identifier)
        
        # Buscar dados não cacheados da API
        if uncached_identifiers:
            try:
                ids_param = ','.join(uncached_identifiers)
                url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids_param}&vs_currencies=usd,brl"
                
                print(f"Fetching prices from CoinGecko for: {uncached_identifiers}")
                response = requests.get(url, timeout=15)
                response.raise_for_status()
                
                data = response.json()
                
                # Processar resposta e atualizar cache
                for identifier in uncached_identifiers:
                    if identifier in data:
                        asset_data = data[identifier]
                        if 'usd' in asset_data and 'brl' in asset_data:
                            # Atualizar cache
                            price_cache[identifier] = {
                                'usd': asset_data['usd'],
                                'brl': asset_data['brl'],
                                'timestamp': current_time
                            }
                            
                            result[identifier] = {
                                'usd': asset_data['usd'],
                                'brl': asset_data['brl'],
                                'cached': False,
                                'cache_age': 0
                            }
                        else:
                            result[identifier] = None
                    else:
                        result[identifier] = None
                        
            except Exception as e:
                print(f"Error fetching multiple prices: {e}")
                # Para identificadores que falharam, definir como None
                for identifier in uncached_identifiers:
                    if identifier not in result:
                        result[identifier] = None
        
        return result
    
    @staticmethod
    def clear_cache():
        """Limpa o cache de preços (útil para testes)"""
        global price_cache
        price_cache = {}
        print("Price cache cleared")
    
    @staticmethod
    def get_cache_info() -> Dict[str, Any]:
        """Retorna informações sobre o estado do cache"""
        current_time = time.time()
        cache_info = []
        
        for identifier, data in price_cache.items():
            cache_age = current_time - data['timestamp']
            cache_info.append({
                'identifier': identifier,
                'age_seconds': cache_age,
                'expired': cache_age >= CACHE_DURATION,
                'usd': data['usd'],
                'brl': data['brl']
            })
        
        return {
            'total_entries': len(price_cache),
            'cache_duration_seconds': CACHE_DURATION,
            'entries': cache_info
        }