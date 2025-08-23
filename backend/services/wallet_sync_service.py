"""
Serviço de Sincronização de Carteiras Web3
Responsável pela sincronização automática de saldos e posições on-chain
"""

import asyncio
import time
import logging
from typing import Dict, List, Any, Optional
from decimal import Decimal, getcontext
from web3 import Web3

from services.database_service import DatabaseService
from services.price_service import PriceService

# Configurar precisão alta para Decimal
getcontext().prec = 50

logger = logging.getLogger(__name__)

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
        
        # Inicializar Web3
        self.w3 = Web3(Web3.HTTPProvider(self.polygon_rpc))
        
    async def sync_wallet_holdings(self, user_id: int, account_id: int, public_address: str) -> Dict[str, Any]:
        """
        Função central de sincronização de carteira com pipeline otimizada
        """
        try:
            result = {
                "success": True,
                "tokens_synced": 0,
                "total_value_brl": Decimal('0.0'),
                "errors": []
            }
            
            logger.info(f"Iniciando sincronização para address: {public_address}")
            
            # 1. Pré-carregar todos os ativos crypto do banco de dados
            crypto_assets = self._load_crypto_assets()
            logger.info(f"Carregados {len(crypto_assets)} ativos crypto do banco")
            
            # 2. Coletar todos os price_api_identifier
            api_ids = [asset['price_api_identifier'] for asset in crypto_assets.values() 
                      if asset['price_api_identifier']]
            
            # 3. Buscar todos os preços em uma única chamada
            crypto_prices_usd = {}
            usd_to_brl_rate = 0.0
            
            async with self.price_service as price_svc:
                if api_ids:
                    crypto_prices_usd = await price_svc.get_crypto_prices_in_usd(api_ids)
                    logger.info(f"Obtidos preços para {len(crypto_prices_usd)} ativos")
                
                usd_to_brl_rate = await price_svc.get_usd_to_brl_rate()
                logger.info(f"Taxa USD/BRL: {usd_to_brl_rate}")
            
            # 4. Buscar tokens da carteira
            tokens = await self._fetch_wallet_tokens(public_address)
            logger.info(f"Encontrados {len(tokens)} tokens na carteira")
            
            # 5. Acumulador para valor total da carteira
            total_wallet_value_brl = Decimal('0.0')
            
            # 6. Processar cada token encontrado na carteira
            for token in tokens:
                try:
                    contract_address = token["contractAddress"].lower()
                    raw_balance = token["balance"]
                    
                    # Encontrar o ativo correspondente no banco de dados
                    asset = crypto_assets.get(contract_address)
                    
                    if not asset:
                        # Ativo não existe no banco, criar dinamicamente
                        asset = await self._create_asset_from_contract(contract_address)
                        if not asset:
                            logger.warning(f"Não foi possível criar ativo para {contract_address}")
                            continue
                            
                    # Executar cálculo de precisão
                    decimals = asset['decimals']
                    api_id = asset['price_api_identifier']
                    
                    actual_quantity = Decimal(raw_balance) / (Decimal(10) ** decimals)
                    price_usd = Decimal(str(crypto_prices_usd.get(api_id, 0.0)))
                    value_brl = actual_quantity * price_usd * Decimal(str(usd_to_brl_rate))
                    
                    # Criar movimento de sincronização
                    self._create_sync_movement(
                        user_id, account_id, asset['id'], 
                        float(actual_quantity), float(price_usd * Decimal(str(usd_to_brl_rate)))
                    )
                    
                    # Somar ao total da carteira
                    total_wallet_value_brl += value_brl
                    
                    result["tokens_synced"] += 1
                    logger.info(f"Sincronizado: {actual_quantity} {asset['symbol']} = R$ {value_brl}")
                    
                except Exception as e:
                    logger.error(f"Erro ao sincronizar token {token.get('contractAddress')}: {e}")
                    result["errors"].append(f"Token {token.get('contractAddress')}: {str(e)}")
            
            # 7. Saldo da conta agora é calculado dinamicamente, não precisa mais ser atualizado
            result["total_value_brl"] = float(total_wallet_value_brl)
            
            logger.info(f"Sincronização concluída. Valor total: R$ {total_wallet_value_brl}")
            return result
            
        except Exception as e:
            logger.error(f"Erro geral na sincronização: {e}")
            return {
                "success": False,
                "error": str(e),
                "tokens_synced": 0,
                "total_value_brl": 0.0
            }
    
    def _load_crypto_assets(self) -> Dict[str, Dict[str, Any]]:
        """
        Carrega todos os ativos do tipo 'CRIPTO' do banco de dados
        Retorna um dicionário mapeado pelo contract_address (lowercase)
        """
        cursor = self.db.connection.cursor(dictionary=True)
        
        try:
            cursor.execute("""
                SELECT id, symbol, name, contract_address, decimals, price_api_identifier
                FROM assets 
                WHERE asset_class = 'CRIPTO' AND contract_address IS NOT NULL
            """)
            
            assets = cursor.fetchall()
            
            # Mapear por contract_address (lowercase) para busca eficiente
            assets_map = {}
            for asset in assets:
                if asset['contract_address']:
                    key = asset['contract_address'].lower()
                    assets_map[key] = asset
                    
            return assets_map
            
        finally:
            cursor.close()
    
    async def _fetch_wallet_tokens(self, address: str) -> List[Dict[str, Any]]:
        """
        Busca tokens com saldo > 0 da carteira do usuário
        Implementação simplificada que verifica ativos conhecidos
        """
        tokens_with_balance = []
        
        # Carregar ativos conhecidos
        crypto_assets = self._load_crypto_assets()
        
        # Verificar saldo de cada ativo conhecido
        for contract_address, asset in crypto_assets.items():
            try:
                balance = self._get_token_balance(address, contract_address)
                if balance > 0:
                    tokens_with_balance.append({
                        "contractAddress": contract_address,
                        "balance": balance
                    })
            except Exception as e:
                logger.warning(f"Erro ao verificar saldo do token {contract_address}: {e}")
                continue
                
        return tokens_with_balance
    
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
            logger.error(f"Erro ao buscar saldo do token {contract_address}: {e}")
            return 0
    
    async def _create_asset_from_contract(self, contract_address: str) -> Optional[Dict[str, Any]]:
        """
        Cria um novo ativo no banco de dados baseado no contrato
        """
        try:
            # Buscar informações do token na blockchain
            token_info = self._get_token_info(contract_address)
            if not token_info:
                return None
            
            # Tentar mapear price_api_identifier pelo símbolo
            price_api_identifier = self._map_symbol_to_coingecko_id(token_info["symbol"])
            
            cursor = self.db.connection.cursor(dictionary=True)
            
            try:
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
                
                asset_id = cursor.lastrowid
                self.db.connection.commit()
                
                return {
                    'id': asset_id,
                    'symbol': token_info["symbol"],
                    'name': token_info["name"],
                    'contract_address': contract_address,
                    'decimals': token_info["decimals"],
                    'price_api_identifier': price_api_identifier
                }
                
            finally:
                cursor.close()
                
        except Exception as e:
            logger.error(f"Erro ao criar ativo para contrato {contract_address}: {e}")
            if 'cursor' in locals():
                cursor.close()
            return None
    
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
            logger.error(f"Erro ao buscar informações do token {contract_address}: {e}")
            return None
    
    def _map_symbol_to_coingecko_id(self, symbol: str) -> Optional[str]:
        """
        Mapeia símbolos conhecidos para IDs do CoinGecko
        Expandido com tokens mais comuns do Polygon
        """
        symbol_mapping = {
            # Stablecoins
            "USDC": "usd-coin",
            "USDT": "tether", 
            "DAI": "dai",
            "TUSD": "true-usd",
            "FRAX": "frax",
            "USDC.E": "usd-coin", # USDC bridged
            "USDT.E": "tether",  # USDT bridged
            
            # Majors
            "WETH": "weth",
            "ETH": "ethereum",
            "WBTC": "wrapped-bitcoin",
            "BTC": "bitcoin",
            
            # Polygon ecosystem
            "WMATIC": "wmatic",
            "MATIC": "matic-network",
            "POL": "polygon-ecosystem-token",
            
            # DeFi tokens populares no Polygon
            "LINK": "chainlink",
            "AAVE": "aave",
            "CRV": "curve-dao-token",
            "SUSHI": "sushi",
            "UNI": "uniswap",
            "COMP": "compound-coin",
            "YFI": "yearn-finance",
            "BAL": "balancer",
            "1INCH": "1inch",
            "SNX": "havven",
            
            # Gaming/NFT tokens
            "SAND": "the-sandbox",
            "MANA": "decentraland",
            "GHST": "aavegotchi",
            
            # Outros
            "QI": "qi-dao",
            "QUICK": "quickswap",
            "DQUICK": "dragon-quick"
        }
        
        mapped_id = symbol_mapping.get(symbol.upper())
        
        # LOG para rastreamento
        if mapped_id:
            logger.info(f"Token {symbol} mapeado para CoinGecko ID: {mapped_id}")
        else:
            logger.warning(f"Token {symbol} NÃO mapeado - preço será 0.00")
        
        return mapped_id
    
    def _create_sync_movement(self, user_id: int, account_id: int, asset_id: int, 
                             quantity: float, price_per_unit: float):
        """
        Cria um movimento de sincronização na tabela asset_movements
        Primeiro verifica se já existe um movimento de sincronização para evitar duplicatas
        Com validações defensivas completas
        """
        cursor = self.db.connection.cursor()
        
        try:
            # Validações defensivas dos parâmetros de entrada
            if not isinstance(user_id, int) or user_id <= 0:
                raise ValueError(f"user_id inválido: {user_id}")
            if not isinstance(account_id, int) or account_id <= 0:
                raise ValueError(f"account_id inválido: {account_id}")
            if not isinstance(asset_id, int) or asset_id <= 0:
                raise ValueError(f"asset_id inválido: {asset_id}")
            if quantity is None or quantity < 0:
                logger.warning(f"Quantidade inválida {quantity} para asset {asset_id}, ignorando")
                return
            if price_per_unit is None or price_per_unit < 0:
                logger.warning(f"Preço inválido {price_per_unit} para asset {asset_id}, usando 0.00")
                price_per_unit = 0.00
            
            logger.info(f"Criando movimento de sincronização: user_id={user_id}, account_id={account_id}, asset_id={asset_id}, quantity={quantity}, price={price_per_unit}")
            
            # Verificar se já existe movimento de sincronização hoje para este ativo/conta
            cursor.execute("""
                SELECT id FROM asset_movements 
                WHERE user_id = %s AND account_id = %s AND asset_id = %s 
                AND movement_type = 'SINCRONIZACAO' 
                AND DATE(movement_date) = CURDATE()
            """, (user_id, account_id, asset_id))
            
            existing_movement = cursor.fetchone()
            
            if existing_movement:
                # Atualizar movimento existente
                cursor.execute("""
                    UPDATE asset_movements 
                    SET quantity = %s, price_per_unit = %s, movement_date = NOW()
                    WHERE id = %s
                """, (quantity, price_per_unit, existing_movement[0]))
                logger.info(f"Movimento de sincronização atualizado para asset {asset_id}")
            else:
                # Criar novo movimento
                cursor.execute("""
                    INSERT INTO asset_movements 
                    (user_id, account_id, asset_id, movement_type, movement_date, quantity, price_per_unit, notes)
                    VALUES (%s, %s, %s, 'SINCRONIZACAO', NOW(), %s, %s, 'Sincronização automática da carteira')
                """, (user_id, account_id, asset_id, quantity, price_per_unit))
                logger.info(f"Novo movimento de sincronização criado para asset {asset_id}")
            
            self.db.connection.commit()
            logger.info(f"Transação commitada com sucesso para asset {asset_id}")
            
        except mysql.connector.Error as db_err:
            self.db.connection.rollback()
            logger.error(f"Erro de banco ao criar movimento de sincronização: {db_err}")
            raise Exception(f"Erro de banco de dados: {db_err}")
        except ValueError as val_err:
            logger.error(f"Erro de validação ao criar movimento: {val_err}")
            raise val_err
        except Exception as e:
            self.db.connection.rollback()
            logger.error(f"Erro geral ao criar movimento de sincronização: {e}")
            raise Exception(f"Erro interno ao criar movimento: {e}")
        finally:
            cursor.close()