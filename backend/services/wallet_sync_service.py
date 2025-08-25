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
            
            # Verificar se já existe movimento de sincronização para este ativo/conta
            cursor.execute("""
                SELECT id FROM asset_movements 
                WHERE user_id = %s AND account_id = %s AND asset_id = %s 
                AND movement_type = 'SINCRONIZACAO' 
            """, (user_id, account_id, asset_id))
            
            existing_movement = cursor.fetchone()
            
            if existing_movement:
                # Atualizar movimento existente
                cursor.execute("""
                    UPDATE asset_movements 
                    SET quantity = %s, movement_date = NOW()
                    WHERE id = %s
                """, (quantity, existing_movement[0]))
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
    
    def reconcile_wallet_history(self, user_id: int, account_id: int, public_address: str) -> Dict[str, Any]:
        """
        NOVA FUNCIONALIDADE: Reconciliação profunda com histórico on-chain
        Usa a API do PolygonScan para obter TODO o histórico de transações de tokens ERC-20
        e reconstrói completamente o histórico da carteira
        """
        import requests
        import json
        from datetime import datetime
        
        logger.info(f"[RECONCILE] Iniciando reconciliação profunda para carteira {public_address}")
        
        try:
            # 1. Buscar histórico completo de transações de tokens na API do PolygonScan
            polygonscan_api_key = "UJSDR6UFV3PB3514ACGV255GHPJU9K2PPN"  # Substituir pela chave real
            api_url = "https://api.polygonscan.com/api"
            
            params = {
                "module": "account",
                "action": "tokentx",
                "address": public_address,
                "startblock": 0,
                "endblock": 99999999,
                "sort": "asc",
                "apikey": polygonscan_api_key
            }
            
            print(f"[RECONCILE] Chamando PolygonScan API para {public_address}")
            response = requests.get(api_url, params=params, timeout=30)
            
            if response.status_code != 200:
                raise Exception(f"Erro na API PolygonScan: {response.status_code}")
                
            data = response.json()
            
            if data.get("status") != "1":
                raise Exception(f"PolygonScan retornou erro: {data.get('message', 'Unknown error')}")
            
            transactions = data.get("result", [])
            print(f"[RECONCILE] {len(transactions)} transações encontradas no histórico on-chain")
            
            # 2. Iniciar transação ACID no banco de dados
            cursor = self.db.connection.cursor(dictionary=True)
            self.db.connection.autocommit = False
            
            try:
                # 3. Limpar histórico antigo para evitar duplicatas
                print(f"[RECONCILE] Limpando histórico antigo da conta {account_id}")
                cursor.execute("DELETE FROM asset_movements WHERE account_id = %s", (account_id,))
                deleted_count = cursor.rowcount
                print(f"[RECONCILE] {deleted_count} movimentos antigos removidos")
                
                # 4. Buscar todas as carteiras do usuário para identificar transferências internas
                cursor.execute("""
                    SELECT public_address 
                    FROM accounts 
                    WHERE user_id = %s AND type = 'CARTEIRA_CRIPTO' AND public_address IS NOT NULL
                """, (user_id,))
                user_wallets = set(row['public_address'].lower() for row in cursor.fetchall())
                print(f"[RECONCILE] Carteiras do usuário: {user_wallets}")
                
                # 5. Processar cada transação do histórico on-chain
                processed_count = 0
                created_assets = 0
                
                for tx in transactions:
                    tx_hash = tx.get("hash")
                    from_address = tx.get("from", "").lower()
                    to_address = tx.get("to", "").lower()
                    contract_address = tx.get("contractAddress", "").lower()
                    value = tx.get("value", "0")
                    block_number = tx.get("blockNumber")
                    gas_fee = tx.get("gasPrice", "0")  # Aproximação da taxa de gás
                    timestamp = tx.get("timeStamp", "0")
                    token_name = tx.get("tokenName", "")
                    token_symbol = tx.get("tokenSymbol", "")
                    token_decimal = int(tx.get("tokenDecimal", "18"))
                    
                    # Converter timestamp para datetime
                    tx_date = datetime.fromtimestamp(int(timestamp)) if timestamp != "0" else datetime.now()
                    
                    # Verificar se já existe movimento com este tx_hash (dupla segurança)
                    cursor.execute("SELECT id FROM asset_movements WHERE tx_hash = %s", (tx_hash,))
                    if cursor.fetchone():
                        print(f"[RECONCILE] Transação {tx_hash} já processada, pulando...")
                        continue
                    
                    # Determinar tipo de movimento
                    current_address = public_address.lower()
                    if to_address == current_address:
                        movement_type = "TRANSFERENCIA_ENTRADA"
                    elif from_address == current_address:
                        movement_type = "TRANSFERENCIA_SAIDA"
                    else:
                        print(f"[RECONCILE] Transação {tx_hash} não envolve esta carteira, pulando...")
                        continue
                    
                    # Buscar ou criar asset baseado no contractAddress
                    cursor.execute("SELECT id FROM assets WHERE LOWER(contract_address) = %s", (contract_address,))
                    asset_row = cursor.fetchone()
                    
                    if asset_row:
                        asset_id = asset_row['id']
                        print(f"[RECONCILE] Asset encontrado: {asset_id} para contrato {contract_address}")
                    else:
                        # Auto-discovery: criar novo asset
                        print(f"[RECONCILE] Criando novo asset para contrato {contract_address}")
                        cursor.execute("""
                            INSERT INTO assets (name, symbol, asset_class, contract_address, price_api_identifier)
                            VALUES (%s, %s, 'CRIPTO', %s, %s)
                        """, (token_name or f"Token {token_symbol}", token_symbol, contract_address, token_symbol.lower()))
                        asset_id = cursor.lastrowid
                        created_assets += 1
                        print(f"[RECONCILE] Novo asset criado: ID {asset_id}")
                    
                    # Calcular quantidade real (considerando decimais)
                    quantity = Decimal(value) / Decimal(10 ** token_decimal)
                    
                    # Inserir novo movimento com dados on-chain completos
                    cursor.execute("""
                        INSERT INTO asset_movements 
                        (user_id, account_id, asset_id, movement_type, movement_date, quantity, 
                         tx_hash, from_address, to_address, block_number, gas_fee, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        user_id, account_id, asset_id, movement_type, tx_date, float(quantity),
                        tx_hash, from_address, to_address, int(block_number) if block_number else None,
                        float(gas_fee) if gas_fee != "0" else None,
                        f"Reconciliação on-chain: {token_symbol} via {tx_hash[:10]}..."
                    ))
                    
                    processed_count += 1
                    if processed_count % 50 == 0:
                        print(f"[RECONCILE] Processadas {processed_count} transações...")
                
                # Commit da transação ACID
                self.db.connection.commit()
                print(f"[RECONCILE] Reconciliação concluída com sucesso!")
                
                return {
                    "status": "success",
                    "transactions_processed": processed_count,
                    "assets_created": created_assets,
                    "wallet_address": public_address,
                    "historical_transactions": len(transactions)
                }
                
            except Exception as e:
                # Rollback em caso de erro
                self.db.connection.rollback()
                print(f"[RECONCILE] Erro durante processamento, fazendo rollback: {e}")
                raise e
            finally:
                cursor.close()
                self.db.connection.autocommit = True
                
        except Exception as e:
            logger.error(f"Erro na reconciliação profunda: {e}")
            raise Exception(f"Falha na reconciliação on-chain: {str(e)}")
            
        finally:
            logger.info(f"[RECONCILE] Processo de reconciliação finalizado para {public_address}")