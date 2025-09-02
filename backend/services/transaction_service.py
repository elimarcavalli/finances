from .database_service import DatabaseService
import mysql.connector

class TransactionService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
    
    def create_transaction(self, user_id: int, transaction_data: dict, external_cursor=None) -> dict:
        """
        Cria uma nova transação. Pode operar de forma autônoma ou como parte de uma transação externa
        se um 'external_cursor' for fornecido.
        """

        # Usa o cursor externo se fornecido, senão cria um novo
        cursor = external_cursor or self.db_service.connection.cursor(dictionary=True)

        try:
            # Se for uma transação autônoma, gerencia o autocommit
            if not external_cursor:
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
                'EFETIVADO'
            )
            
            cursor.execute(insert_query, values)
            transaction_id = cursor.lastrowid
            
            # Se for uma transação autônoma, faz o commit
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
            
            # Se for uma transação autônoma, faz o commit
            if not external_cursor:
                self.db_service.connection.commit()
                # Retornar a transação criada
                return self.get_transaction_by_id(user_id, transaction_id)
            else:
                # Para transações externas, retorna apenas o transaction_id
                # pois o commit será feito pela transação externa
                return {'id': transaction_id}
            
        except Exception as err:
            # Se for uma transação autônoma, faz o rollback
            if not external_cursor:
                self.db_service.connection.rollback()
            raise Exception(f"Erro ao criar transação: {err}")
        finally:
            # Se for uma transação autônoma, fecha o cursor e restaura o autocommit
            if not external_cursor:
                cursor.close()
                self.db_service.connection.autocommit = True
    
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
        Atualiza uma transação existente de forma completa e segura.
        Permite atualização de todos os campos mantendo integridade dos dados.
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            self.db_service.connection.autocommit = False
            
            # 1. Verificar se a transação existe e pertence ao usuário
            cursor.execute("""
                SELECT * FROM transactions 
                WHERE id = %s AND user_id = %s
            """, (transaction_id, user_id))
            
            current_transaction = cursor.fetchone()
            if not current_transaction:
                raise Exception("Transação não encontrada ou não pertence ao usuário")
            
            # 2. Processar campos para atualização
            fields = []
            values = []
            
            # Campos permitidos para atualização
            allowed_fields = [
                'description', 'amount', 'transaction_date', 'type', 
                'category', 'from_account_id', 'to_account_id'
            ]
            
            
            for field in allowed_fields:
                if field in transaction_data:
                    value = transaction_data[field]
                    
                    # Tratamento especial para campos de conta (podem ser None/null)
                    if field in ['from_account_id', 'to_account_id']:
                        if value == '' or value == 'null' or value is None:
                            value = None
                        elif value:
                            try:
                                value = int(value)
                                # Validar se a conta existe e pertence ao usuário
                                cursor.execute("SELECT id FROM accounts WHERE id = %s AND user_id = %s", (value, user_id))
                                if not cursor.fetchone():
                                    field_label = "origem" if field == 'from_account_id' else "destino"
                                    raise Exception(f"Conta {field_label} não encontrada ou não pertence ao usuário")
                            except (ValueError, TypeError) as e:
                                if "não encontrada" not in str(e):
                                    raise Exception(f"Valor inválido para {field}: {value}")
                                raise e
                    
                    fields.append(f"{field} = %s")
                    values.append(value)
            
            if not fields:
                raise Exception("Nenhum campo válido fornecido para atualização")
            
            # 3. Validar regras de negócio baseadas no tipo (se o tipo está sendo atualizado)
            final_type = transaction_data.get('type', current_transaction['type'])
            final_from_account = transaction_data.get('from_account_id', current_transaction['from_account_id'])
            final_to_account = transaction_data.get('to_account_id', current_transaction['to_account_id'])
            
            # Converter None/null para validação
            if final_from_account == '' or final_from_account == 'null':
                final_from_account = None
            if final_to_account == '' or final_to_account == 'null':  
                final_to_account = None
                
            if final_type == 'RECEITA' and not final_to_account:
                raise Exception("Conta de destino é obrigatória para receitas")
            elif final_type == 'DESPESA' and not final_from_account:
                raise Exception("Conta de origem é obrigatória para despesas")  
            elif final_type == 'TRANSFERENCIA':
                if not final_from_account or not final_to_account:
                    raise Exception("Contas de origem e destino são obrigatórias para transferências")
                if final_from_account == final_to_account:
                    raise Exception("Conta de origem e destino devem ser diferentes")
            
            # 4. Executar a atualização
            values.extend([transaction_id, user_id])
            query = f"UPDATE transactions SET {', '.join(fields)} WHERE id = %s AND user_id = %s"
            cursor.execute(query, values)
            
            if cursor.rowcount == 0:
                raise Exception("Transação não foi atualizada - verifique se existe e pertence ao usuário")
            
            # 5. Commit e retornar transação atualizada
            self.db_service.connection.commit()
            return self.get_transaction_by_id(user_id, transaction_id)
            
        except Exception as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar transação: {err}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True
    
    def delete_transaction(self, user_id: int, transaction_id: int, external_cursor=None, skip_asset_check=False) -> bool:
        """
        PHASE 3: Deleta uma transação com integridade de bens físicos.
        Deleta uma transação e reverte obrigações vinculadas para PENDING.
        FUNÇÃO CRÍTICA: Garante integridade referencial com obrigações e bens físicos.
        """
        cursor = external_cursor or self.db_service.connection.cursor(dictionary=True)
        own_transaction = external_cursor is None
        
        try:
            # Iniciar transação ACID apenas se gerenciando própria conexão
            if own_transaction:
                self.db_service.connection.autocommit = False
            
            # 1. Verificar se a transação existe e pertence ao usuário
            cursor.execute("""
                SELECT id, description FROM transactions 
                WHERE id = %s AND user_id = %s
            """, (transaction_id, user_id))
            
            transaction = cursor.fetchone()
            if not transaction:
                if own_transaction:
                    self.db_service.connection.rollback()
                return False
                
            # PHASE 3: 2. Verificar se a transação está vinculada a um bem físico
            if not skip_asset_check:
                cursor.execute("""
                    SELECT id, description, status FROM physical_assets 
                    WHERE acquisition_transaction_id = %s OR liquidation_transaction_id = %s
                """, (transaction_id, transaction_id))
                
                linked_asset = cursor.fetchone()
                if linked_asset:
                    # Determinar o tipo de transação vinculada
                    cursor.execute("""
                        SELECT acquisition_transaction_id, liquidation_transaction_id FROM physical_assets 
                        WHERE id = %s
                    """, (linked_asset['id'],))
                    
                    asset_transactions = cursor.fetchone()
                    
                    if asset_transactions['acquisition_transaction_id'] == transaction_id:
                        # É uma transação de aquisição - IMPEDIR EXCLUSÃO
                        raise Exception(f"Esta transação está vinculada à aquisição do bem '{linked_asset['description']}'. Para removê-la, exclua o bem diretamente na tela de Patrimônio.")
                    
                    elif asset_transactions['liquidation_transaction_id'] == transaction_id:
                        # É uma transação de liquidação - REVERTER LIQUIDAÇÃO
                        from .physical_asset_service import PhysicalAssetService
                        physical_asset_service = PhysicalAssetService(self.db_service)
                        physical_asset_service.revert_liquidation(linked_asset['id'])
            
            # 2. Buscar obrigações vinculadas a esta transação
            cursor.execute("""
                SELECT id, description, status, recurring_rule_id FROM financial_obligations 
                WHERE user_id = %s AND linked_transaction_id = %s
            """, (user_id, transaction_id))
            
            linked_obligations = cursor.fetchall()
            
            # 3. Tratar obrigações vinculadas baseado no tipo
            if linked_obligations:
                for obligation in linked_obligations:
                    if obligation['recurring_rule_id']:
                        # Obrigação gerada por recurring rule - deletar
                        cursor.execute("""
                            DELETE FROM financial_obligations 
                            WHERE id = %s AND user_id = %s
                        """, (obligation['id'], user_id))
                        print(f"TRANSACTION_SERVICE: Recurring rule obligation {obligation['id']} ({obligation['description']}) deleted")
                    else:
                        # Obrigação normal - reverter para PENDING
                        cursor.execute("""
                            UPDATE financial_obligations 
                            SET status = 'PENDING', 
                                linked_transaction_id = NULL,
                                updated_at = NOW()
                            WHERE id = %s AND user_id = %s
                        """, (obligation['id'], user_id))
                        print(f"TRANSACTION_SERVICE: Normal obligation {obligation['id']} ({obligation['description']}) reverted to PENDING")
            
            # 3. Deletar a transação
            cursor.execute("""
                DELETE FROM transactions 
                WHERE id = %s AND user_id = %s
            """, (transaction_id, user_id))
            
            # 4. Commit da transação ACID apenas se gerenciando própria conexão
            if own_transaction:
                self.db_service.connection.commit()
            
            print(f"TRANSACTION_SERVICE: Transaction {transaction_id} deleted, {len(linked_obligations)} obligations reverted to PENDING")
            return cursor.rowcount > 0
            
        except Exception as err:
            if own_transaction:
                self.db_service.connection.rollback()
            raise Exception(f"Erro ao deletar transação e reverter obrigações: {err}")
        finally:
            if own_transaction:
                cursor.close()
                self.db_service.connection.autocommit = True