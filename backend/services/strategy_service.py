import mysql.connector
import json
from typing import List, Dict, Optional
from services.database_service import DatabaseService

class StrategyService:
    def __init__(self):
        self.db_service = DatabaseService()
        
    def create_strategy(self, user_id: int, strategy_data: dict) -> dict:
        """
        Cria uma nova estratégia para o usuário
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Serializar parameters como JSON
            parameters_json = json.dumps(strategy_data.get('parameters', {}))
            
            query = """
                INSERT INTO strategies (user_id, name, description, parameters, created_at) 
                VALUES (%s, %s, %s, %s, NOW())
            """
            cursor.execute(query, (
                user_id,
                strategy_data['name'],
                strategy_data.get('description', ''),
                parameters_json
            ))
            self.db_service.connection.commit()
            strategy_id = cursor.lastrowid
            
            # Buscar e retornar a estratégia criada
            cursor.execute("SELECT * FROM strategies WHERE id = %s", (strategy_id,))
            strategy = cursor.fetchone()
            
            # Deserializar parameters de volta para dict
            if strategy and strategy['parameters']:
                strategy['parameters'] = json.loads(strategy['parameters'])
            
            return strategy
            
        except Exception as e:
            self.db_service.connection.rollback()
            raise e
        finally:
            cursor.close()
    
    def get_strategies_by_user(self, user_id: int) -> List[dict]:
        """
        Retorna todas as estratégias de um usuário
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT id, name, description, parameters, created_at 
                FROM strategies 
                WHERE user_id = %s 
                ORDER BY created_at DESC
            """
            cursor.execute(query, (user_id,))
            strategies = cursor.fetchall()
            
            # Deserializar parameters para cada estratégia
            for strategy in strategies:
                if strategy['parameters']:
                    strategy['parameters'] = json.loads(strategy['parameters'])
                else:
                    strategy['parameters'] = {}
            
            return strategies
            
        finally:
            cursor.close()
    
    def update_strategy(self, strategy_id: int, user_id: int, update_data: dict) -> dict:
        """
        Atualiza uma estratégia existente
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Verificar se a estratégia pertence ao usuário
            cursor.execute("SELECT id FROM strategies WHERE id = %s AND user_id = %s", (strategy_id, user_id))
            if not cursor.fetchone():
                raise ValueError("Strategy not found or does not belong to user")
            
            # Construir query de update dinamicamente
            update_fields = []
            values = []
            
            if 'name' in update_data:
                update_fields.append("name = %s")
                values.append(update_data['name'])
            
            if 'description' in update_data:
                update_fields.append("description = %s")
                values.append(update_data['description'])
                
            if 'parameters' in update_data:
                update_fields.append("parameters = %s")
                values.append(json.dumps(update_data['parameters']))
            
            if update_fields:
                values.append(strategy_id)
                
                query = f"UPDATE strategies SET {', '.join(update_fields)} WHERE id = %s"
                cursor.execute(query, values)
                self.db_service.connection.commit()
            
            # Buscar e retornar a estratégia atualizada
            cursor.execute("SELECT * FROM strategies WHERE id = %s", (strategy_id,))
            strategy = cursor.fetchone()
            
            if strategy and strategy['parameters']:
                strategy['parameters'] = json.loads(strategy['parameters'])
            
            return strategy
            
        except Exception as e:
            self.db_service.connection.rollback()
            raise e
        finally:
            cursor.close()
    
    def delete_strategy(self, strategy_id: int, user_id: int) -> bool:
        """
        Deleta uma estratégia
        """
        cursor = self.db_service.connection.cursor()
        try:
            # Verificar se a estratégia pertence ao usuário e deletar
            query = "DELETE FROM strategies WHERE id = %s AND user_id = %s"
            cursor.execute(query, (strategy_id, user_id))
            self.db_service.connection.commit()
            
            # Retornar True se alguma linha foi afetada
            return cursor.rowcount > 0
            
        except Exception as e:
            self.db_service.connection.rollback()
            raise e
        finally:
            cursor.close()
    
    def get_strategy_by_id(self, strategy_id: int, user_id: int) -> Optional[dict]:
        """
        Busca uma estratégia específica por ID
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = "SELECT * FROM strategies WHERE id = %s AND user_id = %s"
            cursor.execute(query, (strategy_id, user_id))
            strategy = cursor.fetchone()
            
            if strategy and strategy['parameters']:
                strategy['parameters'] = json.loads(strategy['parameters'])
            
            return strategy
            
        finally:
            cursor.close()