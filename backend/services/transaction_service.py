from .database_service import DatabaseService
import mysql.connector

class TransactionService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
    
    def create_transaction(self, user_id: int, transaction_data: dict) -> dict:
        """
        Cria uma nova transação com lógica atômica para atualização de saldos.
        Garante que ou tudo funciona, ou nada funciona (ACID).
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            # Inicia transação no banco de dados  
            self.db_service.connection.autocommit = False
            
            # 1. Inserir o novo registro na tabela transactions
            insert_query = """
                INSERT INTO transactions (user_id, description, amount, transaction_date, type, category, from_account_id, to_account_id, status) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                user_id,
                transaction_data.get('description'),
                transaction_data.get('amount'),
                transaction_data.get('transaction_date'),
                transaction_data.get('type'),
                transaction_data.get('category'),
                transaction_data.get('from_account_id'),
                transaction_data.get('to_account_id'),
                'EFETIVADO'  # Transações são efetivadas automaticamente
            )
            
            cursor.execute(insert_query, values)
            transaction_id = cursor.lastrowid
            
            # 2. Validar dados de negócio conforme o tipo de transação
            transaction_type = transaction_data.get('type')
            
            if transaction_type == 'RECEITA':
                # RECEITA: Validar conta de destino
                to_account_id = transaction_data.get('to_account_id')
                if not to_account_id:
                    raise Exception("Conta de destino é obrigatória para receitas")
                
            elif transaction_type == 'DESPESA':
                # DESPESA: Validar conta de origem  
                from_account_id = transaction_data.get('from_account_id')
                if not from_account_id:
                    raise Exception("Conta de origem é obrigatória para despesas")
                
            elif transaction_type == 'TRANSFERENCIA':
                # TRANSFERÊNCIA: Validar contas de origem e destino
                from_account_id = transaction_data.get('from_account_id')
                to_account_id = transaction_data.get('to_account_id')
                
                if not from_account_id or not to_account_id:
                    raise Exception("Contas de origem e destino são obrigatórias para transferências")
                
                if from_account_id == to_account_id:
                    raise Exception("Conta de origem e destino devem ser diferentes")
            
            else:
                raise Exception(f"Tipo de transação inválido: {transaction_type}")
            
            # NOTA: Saldos são calculados dinamicamente no account_service.py
            # Não há mais campo 'balance' físico na tabela accounts
            
            # Se chegou até aqui, tudo deu certo - fazer commit
            self.db_service.connection.commit()
            
            # Retornar a transação criada
            return self.get_transaction_by_id(user_id, transaction_id)
            
        except Exception as err:
            # Se algo deu errado, fazer rollback para desfazer todas as alterações
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao criar transação: {err}")
        finally:
            cursor.close()
    
    def get_transaction_by_id(self, user_id: int, transaction_id: int) -> dict:
        """Busca uma transação específica do usuário com informações detalhadas"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    t.*,
                    acc_from.name as from_account_name,
                    acc_to.name as to_account_name
                FROM transactions t
                LEFT JOIN accounts acc_from ON t.from_account_id = acc_from.id
                LEFT JOIN accounts acc_to ON t.to_account_id = acc_to.id
                WHERE t.id = %s AND t.user_id = %s
            """
            cursor.execute(query, (transaction_id, user_id))
            return cursor.fetchone()
        finally:
            cursor.close()
    
    def get_transactions_by_user(self, user_id: int, account_id: int = None) -> list:
        """
        Retorna todas as transações do usuário.
        Se account_id for fornecido, filtra apenas transações relacionadas àquela conta.
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            if account_id:
                # Filtrar por conta específica
                query = """
                    SELECT 
                        t.*,
                        acc_from.name as from_account_name,
                        acc_to.name as to_account_name
                    FROM transactions t
                    LEFT JOIN accounts acc_from ON t.from_account_id = acc_from.id
                    LEFT JOIN accounts acc_to ON t.to_account_id = acc_to.id
                    WHERE t.user_id = %s AND (t.from_account_id = %s OR t.to_account_id = %s)
                    ORDER BY t.transaction_date DESC, t.id DESC
                """
                cursor.execute(query, (user_id, account_id, account_id))
            else:
                # Todas as transações do usuário
                query = """
                    SELECT 
                        t.*,
                        acc_from.name as from_account_name,
                        acc_to.name as to_account_name
                    FROM transactions t
                    LEFT JOIN accounts acc_from ON t.from_account_id = acc_from.id
                    LEFT JOIN accounts acc_to ON t.to_account_id = acc_to.id
                    WHERE t.user_id = %s
                    ORDER BY t.transaction_date DESC, t.id DESC
                """
                cursor.execute(query, (user_id,))
            
            return cursor.fetchall()
        finally:
            cursor.close()
    
    def update_transaction(self, user_id: int, transaction_id: int, transaction_data: dict) -> dict:
        """
        Atualiza uma transação existente.
        AVISO: Esta operação é complexa pois precisa reverter o efeito da transação original
        e aplicar o efeito da nova transação nos saldos das contas.
        Para o MVP, recomenda-se focar apenas em criar e listar.
        """
        # Implementação complexa - reverter efeito original + aplicar novo efeito
        # Por ora, implementação simples sem atualização de saldos
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            fields = []
            values = []
            
            # Campos permitidos para atualização simples (sem mudança de valores/contas)
            simple_fields = ['description', 'category']
            for field in simple_fields:
                if field in transaction_data:
                    fields.append(f"{field} = %s")
                    values.append(transaction_data[field])
            
            if not fields:
                raise Exception("Apenas descrição e categoria podem ser atualizadas no MVP")
            
            values.extend([transaction_id, user_id])
            query = f"UPDATE transactions SET {', '.join(fields)} WHERE id = %s AND user_id = %s"
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise Exception("Transação não encontrada ou não pertence ao usuário")
            
            return self.get_transaction_by_id(user_id, transaction_id)
            
        except Exception as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar transação: {err}")
        finally:
            cursor.close()
    
    def delete_transaction(self, user_id: int, transaction_id: int) -> bool:
        """
        Deleta uma transação.
        AVISO: Esta operação é complexa pois precisa reverter o efeito da transação nos saldos.
        Para o MVP, recomenda-se focar apenas em criar e listar.
        """
        # Implementação complexa - reverter efeito nos saldos antes de deletar
        # Por ora, implementação simples sem reversão de saldos
        cursor = self.db_service.connection.cursor()
        try:
            query = "DELETE FROM transactions WHERE id = %s AND user_id = %s"
            cursor.execute(query, (transaction_id, user_id))
            self.db_service.connection.commit()
            
            return cursor.rowcount > 0
            
        except Exception as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao deletar transação: {err}")
        finally:
            cursor.close()