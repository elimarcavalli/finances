from .database_service import DatabaseService
from .price_service import PriceService
import mysql.connector

class AssetHoldingService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
    
    def create_holding(self, user_id: int, holding_data: dict) -> dict:
        """Cria uma nova posição de ativo para o usuário"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                INSERT INTO asset_holdings (user_id, account_id, asset_id, quantity, average_buy_price, acquisition_date) 
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            values = (
                user_id,
                holding_data.get('account_id'),
                holding_data.get('asset_id'),
                holding_data.get('quantity'),
                holding_data.get('average_buy_price'),
                holding_data.get('acquisition_date')
            )
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            holding_id = cursor.lastrowid
            return self.get_holding_by_id(user_id, holding_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao criar posição: {err}")
        finally:
            cursor.close()
    
    def get_holding_by_id(self, user_id: int, holding_id: int) -> dict:
        """Busca uma posição específica do usuário com informações detalhadas"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    ah.*,
                    a.symbol,
                    a.name as asset_name,
                    a.asset_class,
                    acc.name as account_name,
                    acc.type as account_type
                FROM asset_holdings ah
                JOIN assets a ON ah.asset_id = a.id
                JOIN accounts acc ON ah.account_id = acc.id
                WHERE ah.id = %s AND ah.user_id = %s
            """
            cursor.execute(query, (holding_id, user_id))
            return cursor.fetchone()
        finally:
            cursor.close()
    
    def get_holdings_by_user(self, user_id: int, account_id: int = None) -> list:
        """Lista todas as posições do usuário, opcionalmente filtradas por conta"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            if account_id:
                query = """
                    SELECT 
                        ah.*,
                        a.symbol,
                        a.name as asset_name,
                        a.asset_class,
                        a.price_api_identifier,
                        acc.name as account_name,
                        acc.type as account_type
                    FROM asset_holdings ah
                    JOIN assets a ON ah.asset_id = a.id
                    JOIN accounts acc ON ah.account_id = acc.id
                    WHERE ah.user_id = %s AND ah.account_id = %s
                    ORDER BY a.symbol
                """
                cursor.execute(query, (user_id, account_id))
            else:
                query = """
                    SELECT 
                        ah.*,
                        a.symbol,
                        a.name as asset_name,
                        a.asset_class,
                        a.price_api_identifier,
                        acc.name as account_name,
                        acc.type as account_type
                    FROM asset_holdings ah
                    JOIN assets a ON ah.asset_id = a.id
                    JOIN accounts acc ON ah.account_id = acc.id
                    WHERE ah.user_id = %s
                    ORDER BY acc.name, a.symbol
                """
                cursor.execute(query, (user_id,))
            
            holdings = cursor.fetchall()
            
            # Enriquecer com dados de preço
            if holdings:
                # Coletar todos os identificadores únicos de API de preço
                api_identifiers = list(set([h['price_api_identifier'] for h in holdings if h['price_api_identifier']]))
                
                # Buscar preços em lote para eficiência
                prices = PriceService.get_multiple_prices(api_identifiers)
                
                # Adicionar informações de preço a cada posição
                for holding in holdings:
                    api_id = holding.get('price_api_identifier')
                    if api_id and api_id in prices and prices[api_id]:
                        price_data = prices[api_id]
                        holding['current_price_usd'] = price_data['usd']
                        holding['current_price_brl'] = price_data['brl']
                        holding['current_market_value_usd'] = float(holding['quantity']) * price_data['usd']
                        holding['current_market_value_brl'] = float(holding['quantity']) * price_data['brl']
                        holding['price_cached'] = price_data.get('cached', False)
                    else:
                        holding['current_price_usd'] = None
                        holding['current_price_brl'] = None
                        holding['current_market_value_usd'] = None
                        holding['current_market_value_brl'] = None
                        holding['price_cached'] = False
            
            return holdings
        finally:
            cursor.close()
    
    def get_holdings_summary_by_user(self, user_id: int) -> list:
        """Resumo das posições agrupadas por ativo (soma de todas as contas)"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    a.id as asset_id,
                    a.symbol,
                    a.name as asset_name,
                    a.asset_class,
                    SUM(ah.quantity) as total_quantity,
                    AVG(ah.average_buy_price) as avg_buy_price,
                    COUNT(ah.id) as positions_count
                FROM asset_holdings ah
                JOIN assets a ON ah.asset_id = a.id
                WHERE ah.user_id = %s
                GROUP BY a.id, a.symbol, a.name, a.asset_class
                ORDER BY a.asset_class, a.symbol
            """
            cursor.execute(query, (user_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
    
    def update_holding(self, user_id: int, holding_id: int, holding_data: dict) -> dict:
        """Atualiza uma posição existente"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Construir query dinamicamente apenas com campos fornecidos
            fields = []
            values = []
            
            allowed_fields = ['account_id', 'asset_id', 'quantity', 'average_buy_price', 'acquisition_date']
            for field in allowed_fields:
                if field in holding_data:
                    fields.append(f"{field} = %s")
                    values.append(holding_data[field])
            
            if not fields:
                raise Exception("Nenhum campo válido para atualizar")
            
            values.extend([holding_id, user_id])
            query = f"UPDATE asset_holdings SET {', '.join(fields)} WHERE id = %s AND user_id = %s"
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise Exception("Posição não encontrada ou não pertence ao usuário")
            
            return self.get_holding_by_id(user_id, holding_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar posição: {err}")
        finally:
            cursor.close()
    
    def delete_holding(self, user_id: int, holding_id: int) -> bool:
        """Deleta uma posição do usuário"""
        cursor = self.db_service.connection.cursor()
        try:
            query = "DELETE FROM asset_holdings WHERE id = %s AND user_id = %s"
            cursor.execute(query, (holding_id, user_id))
            self.db_service.connection.commit()
            
            return cursor.rowcount > 0
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao deletar posição: {err}")
        finally:
            cursor.close()