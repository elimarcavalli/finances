from .database_service import DatabaseService
import mysql.connector

class AccountService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
    
    def create_account(self, user_id: int, account_data: dict) -> dict:
        """Cria uma nova conta para o usuário"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                INSERT INTO accounts (user_id, name, type, institution, balance, credit_limit, invoice_due_day, public_address) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                user_id,
                account_data.get('name'),
                account_data.get('type'),
                account_data.get('institution'),
                account_data.get('balance', 0.00),
                account_data.get('credit_limit', 0.00),
                account_data.get('invoice_due_day'),
                account_data.get('public_address')
            )
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            account_id = cursor.lastrowid
            return self.get_account_by_id(user_id, account_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao criar conta: {err}")
        finally:
            cursor.close()
    
    def get_account_by_id(self, user_id: int, account_id: int) -> dict:
        """Busca uma conta específica do usuário"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = "SELECT * FROM accounts WHERE id = %s AND user_id = %s"
            cursor.execute(query, (account_id, user_id))
            return cursor.fetchone()
        finally:
            cursor.close()
    
    def get_accounts_by_user(self, user_id: int) -> list:
        """Lista todas as contas do usuário"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = "SELECT * FROM accounts WHERE user_id = %s ORDER BY created_at DESC"
            cursor.execute(query, (user_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
    
    def update_account(self, user_id: int, account_id: int, account_data: dict) -> dict:
        """Atualiza uma conta existente"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Construir query dinamicamente apenas com campos fornecidos
            fields = []
            values = []
            
            allowed_fields = ['name', 'type', 'institution', 'balance', 'credit_limit', 'invoice_due_day']
            for field in allowed_fields:
                if field in account_data:
                    fields.append(f"{field} = %s")
                    values.append(account_data[field])
            
            if not fields:
                raise Exception("Nenhum campo válido para atualizar")
            
            values.extend([account_id, user_id])
            query = f"UPDATE accounts SET {', '.join(fields)} WHERE id = %s AND user_id = %s"
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise Exception("Conta não encontrada ou não pertence ao usuário")
            
            return self.get_account_by_id(user_id, account_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar conta: {err}")
        finally:
            cursor.close()
    
    def delete_account(self, user_id: int, account_id: int) -> bool:
        """Deleta uma conta do usuário"""
        cursor = self.db_service.connection.cursor()
        try:
            query = "DELETE FROM accounts WHERE id = %s AND user_id = %s"
            cursor.execute(query, (account_id, user_id))
            self.db_service.connection.commit()
            
            return cursor.rowcount > 0
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao deletar conta: {err}")
        finally:
            cursor.close()