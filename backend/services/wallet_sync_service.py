"""
Serviço de Sincronização de Carteiras Web3
Responsável pela sincronização automática de saldos e posições on-chain
"""

import requests
import time
from typing import Dict, List, Any, Optional
from decimal import Decimal
from web3 import Web3
from services.database_service import DatabaseService
from services.price_service import PriceService

# ABI mínima para tokens ERC-20
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
]

class WalletSyncService:
    def __init__(self, database_service: DatabaseService):
        self.db = database_service
        self.price_service = PriceService()
        
        # Configuração Polygon
        self.polygon_rpc = "https://polygon-rpc.com"
        self.polygonscan_api_key = "YourPolygonScanAPIKey"  # Configure sua API key
        self.polygonscan_base_url = "https://api.polygonscan.com/api"
        
        # Inicializar Web3
        self.w3 = Web3(Web3.HTTPProvider(self.polygon_rpc))
        
    def sync_wallet_holdings(self, user_id: int, account_id: int, public_address: str) -> Dict[str, Any]:
        """
        Função central de sincronização de carteira
        Busca todos os tokens ERC-20 e saldo nativo da blockchain
        """
        try:
            result = {
                "success": True,
                "tokens_synced": 0,
                "native_balance_updated": False,
                "errors": []
            }
            
            print(f"Iniciando sincronização para address: {public_address}")
            
            # 1. Buscar tokens ERC-20 do endereço
            tokens = self._fetch_tokens_from_polygonscan(public_address)
            print(f"Encontrados {len(tokens)} tokens no PolygonScan")
            
            # 2. Sincronizar cada token
            for token in tokens:
                try:
                    self._sync_token_holding(user_id, account_id, public_address, token)
                    result["tokens_synced"] += 1
                except Exception as e:
                    print(f"Erro ao sincronizar token {token.get('contractAddress')}: {e}")
                    result["errors"].append(f"Token {token.get('contractAddress')}: {str(e)}")
            
            # 3. Atualizar saldo nativo (MATIC)
            try:
                self._update_native_balance(account_id, public_address)
                result["native_balance_updated"] = True
                print("Saldo nativo (MATIC) atualizado")
            except Exception as e:
                print(f"Erro ao atualizar saldo nativo: {e}")
                result["errors"].append(f"Saldo nativo: {str(e)}")
            
            return result
            
        except Exception as e:
            print(f"Erro geral na sincronização: {e}")
            return {
                "success": False,
                "error": str(e),
                "tokens_synced": 0,
                "native_balance_updated": False
            }
    
    def _fetch_tokens_from_polygonscan(self, address: str) -> List[Dict[str, Any]]:
        """
        Busca tokens ERC-20 do endereço via PolygonScan API
        """
        try:
            url = f"{self.polygonscan_base_url}"
            params = {
                "module": "account",
                "action": "tokentx",
                "address": address,
                "page": "1",
                "offset": "10000",
                "startblock": "0",
                "endblock": "99999999",
                "sort": "asc",
                "apikey": self.polygonscan_api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("status") != "1":
                print(f"PolygonScan API error: {data.get('message', 'Unknown error')}")
                return []
            
            # Extrair contratos únicos de tokens que o usuário possui
            token_contracts = set()
            for tx in data.get("result", []):
                if tx.get("to", "").lower() == address.lower():
                    token_contracts.add(tx.get("contractAddress"))
            
            # Verificar saldo atual para cada token
            tokens_with_balance = []
            for contract_address in token_contracts:
                try:
                    balance = self._get_token_balance(address, contract_address)
                    if balance > 0:
                        tokens_with_balance.append({
                            "contractAddress": contract_address,
                            "balance": balance
                        })
                except Exception as e:
                    print(f"Erro ao verificar saldo do token {contract_address}: {e}")
                    continue
                    
            return tokens_with_balance
            
        except Exception as e:
            print(f"Erro ao buscar tokens no PolygonScan: {e}")
            # Fallback: retornar lista vazia se API falhar
            return []
    
    def _get_token_balance(self, address: str, contract_address: str) -> int:
        """
        Busca saldo de um token ERC-20 específico
        """
        try:
            contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(contract_address),
                abi=ERC20_ABI
            )
            
            balance = contract.functions.balanceOf(
                Web3.to_checksum_address(address)
            ).call()
            
            return balance
            
        except Exception as e:
            print(f"Erro ao buscar saldo do token {contract_address}: {e}")
            return 0
    
    def _sync_token_holding(self, user_id: int, account_id: int, public_address: str, token_data: Dict[str, Any]):
        """
        Sincroniza um token específico
        """
        contract_address = token_data["contractAddress"]
        balance_raw = token_data["balance"]
        
        cursor = self.db.connection.cursor(dictionary=True)
        
        try:
            # 1. Verificar se ativo já existe no DB
            cursor.execute("""
                SELECT id, name, symbol, decimals 
                FROM assets 
                WHERE contract_address = %s
            """, (contract_address,))
            
            asset = cursor.fetchone()
            
            if not asset:
                # 2. Buscar informações do token na blockchain
                token_info = self._get_token_info(contract_address)
                if not token_info:
                    print(f"Não foi possível obter informações do token {contract_address}")
                    return
                
                # 3. Criar novo ativo no DB
                asset_id = self._create_asset_from_token(cursor, contract_address, token_info)
                decimals = token_info["decimals"]
                symbol = token_info["symbol"]
            else:
                asset_id = asset["id"]
                decimals = asset["decimals"]
                symbol = asset["symbol"]
            
            # 4. Calcular quantidade real (considerando decimals)
            quantity = Decimal(balance_raw) / (Decimal(10) ** decimals)
            
            # 5. Upsert asset_holding
            if quantity > 0:
                self._upsert_asset_holding(cursor, user_id, account_id, asset_id, quantity)
                print(f"Sincronizado: {quantity} {symbol}")
            else:
                # Se saldo for zero, remover holding se existir
                self._remove_asset_holding(cursor, account_id, asset_id)
                print(f"Removido holding: {symbol} (saldo zero)")
            
            self.db.connection.commit()
            
        except Exception as e:
            self.db.connection.rollback()
            raise e
        finally:
            cursor.close()
    
    def _get_token_info(self, contract_address: str) -> Optional[Dict[str, Any]]:
        """
        Busca informações do token (name, symbol, decimals) na blockchain
        """
        try:
            contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(contract_address),
                abi=ERC20_ABI
            )
            
            name = contract.functions.name().call()
            symbol = contract.functions.symbol().call()
            decimals = contract.functions.decimals().call()
            
            return {
                "name": name,
                "symbol": symbol,
                "decimals": decimals
            }
            
        except Exception as e:
            print(f"Erro ao buscar informações do token {contract_address}: {e}")
            return None
    
    def _create_asset_from_token(self, cursor, contract_address: str, token_info: Dict[str, Any]) -> int:
        """
        Cria um novo ativo no banco de dados baseado no token
        """
        # Tentar mapear price_api_identifier pelo símbolo
        price_api_identifier = self._map_symbol_to_coingecko_id(token_info["symbol"])
        
        cursor.execute("""
            INSERT INTO assets (
                name, symbol, asset_class, contract_address, 
                decimals, price_api_identifier, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (
            token_info["name"],
            token_info["symbol"],
            "CRIPTO",
            contract_address,
            token_info["decimals"],
            price_api_identifier
        ))
        
        return cursor.lastrowid
    
    def _map_symbol_to_coingecko_id(self, symbol: str) -> Optional[str]:
        """
        Mapeia símbolos conhecidos para IDs do CoinGecko
        """
        symbol_mapping = {
            "USDC": "usd-coin",
            "USDT": "tether",
            "WETH": "weth",
            "WMATIC": "wmatic",
            "DAI": "dai",
            "LINK": "chainlink",
            "AAVE": "aave",
            "CRV": "curve-dao-token",
            "SUSHI": "sushi",
            "UNI": "uniswap"
        }
        
        return symbol_mapping.get(symbol.upper())
    
    def _upsert_asset_holding(self, cursor, user_id: int, account_id: int, asset_id: int, quantity: Decimal):
        """
        Insere ou atualiza uma posição de ativo
        """
        cursor.execute("""
            INSERT INTO asset_holdings (account_id, asset_id, quantity, acquisition_date)
            VALUES (%s, %s, %s, CURDATE())
            ON DUPLICATE KEY UPDATE quantity = %s
        """, (account_id, asset_id, quantity, quantity))
    
    def _remove_asset_holding(self, cursor, account_id: int, asset_id: int):
        """
        Remove uma posição de ativo se o saldo for zero
        """
        cursor.execute("""
            DELETE FROM asset_holdings 
            WHERE account_id = %s AND asset_id = %s
        """, (account_id, asset_id))
    
    def _update_native_balance(self, account_id: int, public_address: str):
        """
        Atualiza o saldo nativo (MATIC) da conta
        """
        try:
            # Buscar saldo MATIC
            balance_wei = self.w3.eth.get_balance(Web3.to_checksum_address(public_address))
            balance_matic = Decimal(balance_wei) / Decimal(10**18)  # Converter wei para MATIC
            
            cursor = self.db.connection.cursor()
            cursor.execute("""
                UPDATE accounts 
                SET balance = %s 
                WHERE id = %s
            """, (balance_matic, account_id))
            
            self.db.connection.commit()
            cursor.close()
            
            print(f"Saldo MATIC atualizado: {balance_matic}")
            
        except Exception as e:
            print(f"Erro ao atualizar saldo nativo: {e}")
            raise e