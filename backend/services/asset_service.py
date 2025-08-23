from .database_service import DatabaseService
import mysql.connector

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