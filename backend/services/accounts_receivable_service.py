from .database_service import DatabaseService
import mysql.connector

class AccountsReceivableService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
    
    def create_receivable(self, user_id: int, receivable_data: dict) -> dict:
        """Cria uma nova conta a receber para o usuário"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                INSERT INTO accounts_receivable (user_id, description, debtor_name, total_amount, due_date, status, expected_account_id) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                user_id,
                receivable_data.get('description'),
                receivable_data.get('debtor_name'),
                receivable_data.get('total_amount'),
                receivable_data.get('due_date'),
                receivable_data.get('status', 'PENDENTE'),
                receivable_data.get('expected_account_id')
            )
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            receivable_id = cursor.lastrowid
            return self.get_receivable_by_id(user_id, receivable_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao criar conta a receber: {err}")
        finally:
            cursor.close()
    
    def get_receivable_by_id(self, user_id: int, receivable_id: int) -> dict:
        """Busca uma conta a receber específica do usuário com informações detalhadas"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    ar.*,
                    acc.name as expected_account_name,
                    t.description as linked_transaction_description
                FROM accounts_receivable ar
                LEFT JOIN accounts acc ON ar.expected_account_id = acc.id
                LEFT JOIN transactions t ON ar.linked_transaction_id = t.id
                WHERE ar.id = %s AND ar.user_id = %s
            """
            cursor.execute(query, (receivable_id, user_id))
            return cursor.fetchone()
        finally:
            cursor.close()
    
    def get_receivables_by_user(self, user_id: int, status: str = None) -> list:
        """Lista contas a receber do usuário, opcionalmente filtradas por status"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            if status:
                query = """
                    SELECT 
                        ar.*,
                        acc.name as expected_account_name,
                        t.description as linked_transaction_description
                    FROM accounts_receivable ar
                    LEFT JOIN accounts acc ON ar.expected_account_id = acc.id
                    LEFT JOIN transactions t ON ar.linked_transaction_id = t.id
                    WHERE ar.user_id = %s AND ar.status = %s
                    ORDER BY ar.due_date ASC, ar.id DESC
                """
                cursor.execute(query, (user_id, status))
            else:
                query = """
                    SELECT 
                        ar.*,
                        acc.name as expected_account_name,
                        t.description as linked_transaction_description
                    FROM accounts_receivable ar
                    LEFT JOIN accounts acc ON ar.expected_account_id = acc.id
                    LEFT JOIN transactions t ON ar.linked_transaction_id = t.id
                    WHERE ar.user_id = %s
                    ORDER BY ar.due_date ASC, ar.id DESC
                """
                cursor.execute(query, (user_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
    
    def get_overdue_receivables(self, user_id: int) -> list:
        """Lista contas a receber em atraso"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    ar.*,
                    acc.name as expected_account_name,
                    DATEDIFF(CURDATE(), ar.due_date) as days_overdue
                FROM accounts_receivable ar
                LEFT JOIN accounts acc ON ar.expected_account_id = acc.id
                WHERE ar.user_id = %s 
                    AND ar.status = 'PENDENTE' 
                    AND ar.due_date < CURDATE()
                ORDER BY ar.due_date ASC
            """
            cursor.execute(query, (user_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
    
    def get_receivables_summary(self, user_id: int) -> dict:
        """Resumo das contas a receber por status"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(total_amount) as total_amount
                FROM accounts_receivable
                WHERE user_id = %s
                GROUP BY status
            """
            cursor.execute(query, (user_id,))
            results = cursor.fetchall()
            
            # Converter para formato mais fácil de usar
            summary = {
                'PENDENTE': {'count': 0, 'total_amount': 0},
                'PAGO': {'count': 0, 'total_amount': 0},
                'ATRASADO': {'count': 0, 'total_amount': 0}
            }
            
            for result in results:
                summary[result['status']] = {
                    'count': result['count'],
                    'total_amount': float(result['total_amount'])
                }
            
            return summary
        finally:
            cursor.close()
    
    def mark_as_paid(self, user_id: int, receivable_id: int, transaction_id: int = None) -> dict:
        """Marca uma conta a receber como paga e opcionalmente vincula a uma transação"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                UPDATE accounts_receivable 
                SET status = 'PAGO', linked_transaction_id = %s 
                WHERE id = %s AND user_id = %s
            """
            cursor.execute(query, (transaction_id, receivable_id, user_id))
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise Exception("Conta a receber não encontrada ou não pertence ao usuário")
            
            return self.get_receivable_by_id(user_id, receivable_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao marcar como pago: {err}")
        finally:
            cursor.close()
    
    def update_receivable(self, user_id: int, receivable_id: int, receivable_data: dict) -> dict:
        """Atualiza uma conta a receber existente"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Construir query dinamicamente apenas com campos fornecidos
            fields = []
            values = []
            
            allowed_fields = ['description', 'debtor_name', 'total_amount', 'due_date', 'status', 'expected_account_id', 'linked_transaction_id']
            for field in allowed_fields:
                if field in receivable_data:
                    fields.append(f"{field} = %s")
                    values.append(receivable_data[field])
            
            if not fields:
                raise Exception("Nenhum campo válido para atualizar")
            
            values.extend([receivable_id, user_id])
            query = f"UPDATE accounts_receivable SET {', '.join(fields)} WHERE id = %s AND user_id = %s"
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise Exception("Conta a receber não encontrada ou não pertence ao usuário")
            
            return self.get_receivable_by_id(user_id, receivable_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar conta a receber: {err}")
        finally:
            cursor.close()
    
    def delete_receivable(self, user_id: int, receivable_id: int) -> bool:
        """Deleta uma conta a receber do usuário"""
        cursor = self.db_service.connection.cursor()
        try:
            query = "DELETE FROM accounts_receivable WHERE id = %s AND user_id = %s"
            cursor.execute(query, (receivable_id, user_id))
            self.db_service.connection.commit()
            
            return cursor.rowcount > 0
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao deletar conta a receber: {err}")
        finally:
            cursor.close()