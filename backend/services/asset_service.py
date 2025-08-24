from .database_service import DatabaseService
from .price_service import PriceService
import mysql.connector
import asyncio
from datetime import datetime
from typing import List

class AssetService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
    
    def create_asset(self, asset_data: dict) -> dict:
        """Cria um novo ativo (global, não por usuário)"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                INSERT INTO assets (symbol, name, asset_class, price_api_identifier) 
                VALUES (%s, %s, %s, %s)
            """
            values = (
                asset_data.get('symbol'),
                asset_data.get('name'),
                asset_data.get('asset_class'),
                asset_data.get('price_api_identifier')
            )
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            asset_id = cursor.lastrowid
            return self.get_asset_by_id(asset_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao criar ativo: {err}")
        finally:
            cursor.close()
    
    def get_asset_by_id(self, asset_id: int) -> dict:
        """Busca um ativo específico"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = "SELECT * FROM assets WHERE id = %s"
            cursor.execute(query, (asset_id,))
            return cursor.fetchone()
        finally:
            cursor.close()
    
    def get_asset_by_symbol(self, symbol: str) -> dict:
        """Busca um ativo pelo símbolo"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = "SELECT * FROM assets WHERE symbol = %s"
            cursor.execute(query, (symbol,))
            return cursor.fetchone()
        finally:
            cursor.close()
    
    def get_all_assets(self, asset_class: str = None) -> list:
        """Lista todos os ativos, opcionalmente filtrados por classe"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            if asset_class:
                query = "SELECT * FROM assets WHERE asset_class = %s ORDER BY symbol"
                cursor.execute(query, (asset_class,))
            else:
                query = "SELECT * FROM assets ORDER BY asset_class, symbol"
                cursor.execute(query)
            return cursor.fetchall()
        finally:
            cursor.close()
    
    def update_asset(self, asset_id: int, asset_data: dict) -> dict:
        """Atualiza um ativo existente"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Construir query dinamicamente apenas com campos fornecidos
            fields = []
            values = []
            
            allowed_fields = ['symbol', 'name', 'asset_class', 'price_api_identifier']
            for field in allowed_fields:
                if field in asset_data:
                    fields.append(f"{field} = %s")
                    values.append(asset_data[field])
            
            if not fields:
                raise Exception("Nenhum campo válido para atualizar")
            
            values.append(asset_id)
            query = f"UPDATE assets SET {', '.join(fields)} WHERE id = %s"
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise Exception("Ativo não encontrado")
            
            return self.get_asset_by_id(asset_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar ativo: {err}")
        finally:
            cursor.close()
    
    def delete_asset(self, asset_id: int) -> bool:
        """Deleta um ativo"""
        cursor = self.db_service.connection.cursor()
        try:
            query = "DELETE FROM assets WHERE id = %s"
            cursor.execute(query, (asset_id,))
            self.db_service.connection.commit()
            
            return cursor.rowcount > 0
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao deletar ativo: {err}")
        finally:
            cursor.close()
    
    async def update_asset_prices(self, asset_ids: List[int]) -> dict:
        """
        Atualiza os preços dos ativos especificados buscando dados da API
        
        Args:
            asset_ids: Lista de IDs dos ativos para atualizar
            
        Returns:
            dict com resultado da operacao: {'success': bool, 'updated_count': int, 'errors': list}
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        price_service = PriceService()
        
        try:
            # 1. Buscar os ativos e seus price_api_identifier
            if not asset_ids:
                return {'success': False, 'updated_count': 0, 'errors': ['Nenhum asset_id fornecido']}
                
            placeholders = ', '.join(['%s'] * len(asset_ids))
            query = f"""
                SELECT id, symbol, price_api_identifier 
                FROM assets 
                WHERE id IN ({placeholders}) 
                AND asset_class = 'CRIPTO' 
                AND price_api_identifier IS NOT NULL
            """
            cursor.execute(query, asset_ids)
            assets = cursor.fetchall()
            
            if not assets:
                return {'success': False, 'updated_count': 0, 'errors': ['Nenhum ativo cripto válido encontrado']}
            
            # 2. Extrair price_api_identifiers únicos
            api_identifiers = []
            asset_map = {}  # Mapear api_identifier -> asset info
            
            for asset in assets:
                api_id = asset['price_api_identifier']
                if api_id and api_id not in asset_map:
                    api_identifiers.append(api_id)
                    asset_map[api_id] = asset
            
            # 3. Buscar preços em USD
            usd_prices = await price_service.get_crypto_prices_in_usd(api_identifiers)
            if not usd_prices:
                return {'success': False, 'updated_count': 0, 'errors': ['Falha ao obter preços da API']}
            
            # 4. Buscar taxa de conversão USD -> BRL
            usd_to_brl_rate = await price_service.get_usd_to_brl_rate()
            if usd_to_brl_rate == 0.0:
                return {'success': False, 'updated_count': 0, 'errors': ['Falha ao obter taxa USD/BRL']}
            
            # 5. Atualizar preços no banco de dados
            updated_count = 0
            errors = []
            current_time = datetime.now()
            
            for api_id, asset in asset_map.items():
                if api_id in usd_prices:
                    usd_price = usd_prices[api_id]
                    brl_price = usd_price * usd_to_brl_rate
                    
                    update_query = """
                        UPDATE assets 
                        SET last_price_usdt = %s, 
                            last_price_brl = %s, 
                            last_price_updated_at = %s 
                        WHERE id = %s
                    """
                    cursor.execute(update_query, (usd_price, brl_price, current_time, asset['id']))
                    
                    if cursor.rowcount > 0:
                        updated_count += 1
                    else:
                        errors.append(f"Falha ao atualizar ativo {asset['symbol']} (ID: {asset['id']})")
                else:
                    errors.append(f"Preço não encontrado para {asset['symbol']} ({api_id})")
            
            # 6. Commit das alterações
            self.db_service.connection.commit()
            
            return {
                'success': updated_count > 0,
                'updated_count': updated_count,
                'errors': errors
            }
            
        except Exception as e:
            self.db_service.connection.rollback()
            return {'success': False, 'updated_count': 0, 'errors': [f"Erro interno: {str(e)}"]}
        finally:
            cursor.close()
            await price_service.close()
    
    def get_crypto_assets(self) -> list:
        """Retorna todos os ativos do tipo CRIPTO com price_api_identifier válido"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT * FROM assets 
                WHERE asset_class = 'CRIPTO' 
                AND price_api_identifier IS NOT NULL 
                ORDER BY symbol
            """
            cursor.execute(query)
            return cursor.fetchall()
        finally:
            cursor.close()
    
    async def update_all_crypto_prices(self) -> dict:
        """
        Atualiza os preços de todos os ativos cripto do sistema
        
        Returns:
            dict com resultado da operacao
        """
        try:
            crypto_assets = self.get_crypto_assets()
            if not crypto_assets:
                return {'success': False, 'updated_count': 0, 'errors': ['Nenhum ativo cripto encontrado']}
            
            asset_ids = [asset['id'] for asset in crypto_assets]
            return await self.update_asset_prices(asset_ids)
            
        except Exception as e:
            return {'success': False, 'updated_count': 0, 'errors': [f"Erro ao atualizar todos os ativos cripto: {str(e)}"]}