"""
Serviço de Gestão de Obrigações Financeiras
Responsável pelo CRUD de obrigações, regras de recorrência e liquidação inteligente
"""

import mysql.connector
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, List, Optional, Any
from .database_service import DatabaseService
from .transaction_service import TransactionService

def calculate_suggested_settlement_date(reference_date: date) -> date:
    """
    Calcula data sugerida de liquidação baseada numa data de referência.
    Para recurring rules: usa start_date como referência
    Para obligations: usa due_date como referência
    Retorna o mesmo dia no mês atual, ou último dia do mês se o dia não existir
    """
    from datetime import date, datetime
    import calendar
    
    today = date.today()
    target_year = today.year
    target_month = today.month
    target_day = reference_date.day
    
    # Verificar se o dia existe no mês atual
    max_day_in_month = calendar.monthrange(target_year, target_month)[1]
    if target_day > max_day_in_month:
        target_day = max_day_in_month
    
    return date(target_year, target_month, target_day)

class ObligationService:
    def __init__(self, db_service: DatabaseService, transaction_service: TransactionService):
        self.db_service = db_service
        self.transaction_service = transaction_service
    
    # ==================== CRUD FINANCIAL OBLIGATIONS ====================
    
    def create_obligation(self, user_id: int, obligation_data: dict) -> dict:
        """
        Cria uma nova obrigação financeira
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Validações de negócio
            if obligation_data.get('amount', 0) <= 0:
                raise ValueError("Amount must be greater than zero")
            
            if obligation_data.get('type') not in ['PAYABLE', 'RECEIVABLE']:
                raise ValueError("Type must be PAYABLE or RECEIVABLE")
            
            # Inserir obrigação
            query = """
                INSERT INTO financial_obligations 
                (user_id, description, amount, due_date, type, status, category, entity_name, notes, recurring_rule_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                user_id,
                obligation_data.get('description'),
                obligation_data.get('amount'),
                obligation_data.get('due_date'),
                obligation_data.get('type'),
                obligation_data.get('status', 'PENDING'),
                obligation_data.get('category'),
                obligation_data.get('entity_name'),
                obligation_data.get('notes'),
                obligation_data.get('recurring_rule_id')
            )
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            obligation_id = cursor.lastrowid
            return self.get_obligation_by_id(user_id, obligation_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Database error creating obligation: {err}")
        except Exception as e:
            self.db_service.connection.rollback()
            raise Exception(f"Error creating obligation: {str(e)}")
        finally:
            cursor.close()
    
    def get_obligation_by_id(self, user_id: int, obligation_id: int) -> dict:
        """
        Busca uma obrigação específica do usuário
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT fo.*, rr.description as recurring_description
                FROM financial_obligations fo
                LEFT JOIN recurring_rules rr ON fo.recurring_rule_id = rr.id
                WHERE fo.id = %s AND fo.user_id = %s
            """
            cursor.execute(query, (obligation_id, user_id))
            result = cursor.fetchone()
            
            if result:
                # Converter Decimal para float
                if result.get('amount'):
                    result['amount'] = float(result['amount'])
            
            return result
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching obligation: {err}")
        finally:
            cursor.close()
    
    def get_obligations_by_user(self, user_id: int, obligation_type: str = None, status: str = None, limit: int = None) -> List[dict]:
        """
        Lista obrigações do usuário com filtros opcionais
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Construir query dinamicamente
            where_conditions = ["fo.user_id = %s"]
            query_params = [user_id]
            
            if obligation_type:
                where_conditions.append("fo.type = %s")
                query_params.append(obligation_type)
            
            if status:
                where_conditions.append("fo.status = %s")
                query_params.append(status)
            
            query = """
                SELECT fo.*, rr.description as recurring_description
                FROM financial_obligations fo
                LEFT JOIN recurring_rules rr ON fo.recurring_rule_id = rr.id
                WHERE {}
                ORDER BY fo.due_date ASC, fo.created_at DESC
            """.format(" AND ".join(where_conditions))
            
            if limit:
                query += " LIMIT %s"
                query_params.append(limit)
            
            cursor.execute(query, query_params)
            results = cursor.fetchall()
            
            # Converter Decimal para float
            for result in results:
                if result.get('amount'):
                    result['amount'] = float(result['amount'])
            
            return results
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching obligations: {err}")
        finally:
            cursor.close()
    
    def update_obligation(self, user_id: int, obligation_id: int, obligation_data: dict) -> dict:
        """
        Atualiza uma obrigação existente
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Construir campos de atualização dinamicamente
            fields = []
            values = []
            
            allowed_fields = ['description', 'amount', 'due_date', 'category', 'entity_name', 'notes', 'status', 'linked_transaction_id', 'recurring_rule_id']
            for field in allowed_fields:
                if field in obligation_data:
                    fields.append(f"{field} = %s")
                    values.append(obligation_data[field])
            
            if not fields:
                raise ValueError("Nenhum campo válido para atualizar")
            
            # Adicionar updated_at
            fields.append("updated_at = NOW()")
            values.extend([obligation_id, user_id])
            
            query = f"""
                UPDATE financial_obligations 
                SET {', '.join(fields)}
                WHERE id = %s AND user_id = %s
            """
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise ValueError("Obrigação não encontrada ou não pertence ao usuário")
            
            return self.get_obligation_by_id(user_id, obligation_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Database error updating obligation: {err}")
        except Exception as e:
            self.db_service.connection.rollback()
            raise Exception(f"Error updating obligation: {str(e)}")
        finally:
            cursor.close()
    
    def delete_obligation(self, user_id: int, obligation_id: int) -> bool:
        """
        Deleta uma obrigação (apenas se não estiver liquidada)
        """
        cursor = self.db_service.connection.cursor()
        try:
            # Verificar se a obrigação pode ser deletada
            cursor.execute("""
                SELECT status, linked_transaction_id 
                FROM financial_obligations 
                WHERE id = %s AND user_id = %s
            """, (obligation_id, user_id))
            
            obligation = cursor.fetchone()
            if not obligation:
                raise ValueError("Obligation not found")
            
            if obligation[0] == 'PAID' and obligation[1]:
                raise ValueError("Não é permitido excluir uma obrigação Liquidada, primeiro cancele a Liquidação")
            
            # Deletar obrigação
            cursor.execute("""
                DELETE FROM financial_obligations 
                WHERE id = %s AND user_id = %s
            """, (obligation_id, user_id))
            
            self.db_service.connection.commit()
            return cursor.rowcount > 0
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Database error deleting obligation: {err}")
        except Exception as e:
            self.db_service.connection.rollback()
            raise Exception(f"Error deleting obligation: {str(e)}")
        finally:
            cursor.close()
    
    # ==================== LIQUIDAÇÃO INTELIGENTE ====================
    
    def settle_obligation(self, user_id: int, obligation_id: int, from_account_id: int, to_account_id: int, settlement_date: date = None) -> dict:
        """
        FUNÇÃO CRÍTICA: Liquida uma obrigação criando transação correspondente
        Tudo dentro de transação ACID para garantir consistência
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            # Iniciar transação ACID
            self.db_service.connection.autocommit = False
            
            # 1. Buscar dados da obrigação
            cursor.execute("""
                SELECT * FROM financial_obligations 
                WHERE id = %s AND user_id = %s AND status IN ('PENDING', 'OVERDUE')
            """, (obligation_id, user_id))
            
            obligation = cursor.fetchone()
            if not obligation:
                raise ValueError("Obligation not found or already settled")
            
            # 1.2. Calcular data de liquidação automática se não fornecida
            if settlement_date is None:
                due_date = obligation['due_date']
                if isinstance(due_date, str):
                    due_date = datetime.strptime(due_date, '%Y-%m-%d').date()
                settlement_date = calculate_suggested_settlement_date(due_date)
            
            # 2. Validar contas (apenas se foram fornecidas)
            if from_account_id:
                cursor.execute("""
                    SELECT id, name FROM accounts 
                    WHERE id = %s AND user_id = %s
                """, (from_account_id, user_id))
                
                account = cursor.fetchone()
                if not account:
                    raise ValueError("Conta origem inválida ou não pertence ao usuário")
            
            if to_account_id:
                cursor.execute("""
                    SELECT id, name FROM accounts 
                    WHERE id = %s AND user_id = %s
                """, (to_account_id, user_id))

                account = cursor.fetchone()
                if not account:
                    raise ValueError("Conta destino inválida ou não pertence ao usuário")
            

            # 3. Criar transação correspondente
            transaction_data = {
                'description': f"Liquidação: {obligation['description']}",
                'amount': float(obligation['amount']),
                'transaction_date': settlement_date,
                'category': obligation.get('category'),
                'status': 'EFETIVADO'
            }
            
            # Definir tipo e contas baseado no tipo da obrigação
            if from_account_id and to_account_id:
                transaction_data['type'] = 'TRANSFERENCIA'
            elif to_account_id:
                transaction_data['type'] = 'RECEITA'
            elif from_account_id:
                transaction_data['type'] = 'DESPESA'
            else:
                raise ValueError("Conta de origem ou destino obrigatórias para liquidar uma obrigação")

            transaction_data['from_account_id'] = from_account_id
            transaction_data['to_account_id'] = to_account_id
            
            # Criar transação usando o transaction_service
            new_transaction = self.transaction_service.create_transaction(user_id, transaction_data)
            
            # 4. Atualizar obrigação com liquidação
            cursor.execute("""
                UPDATE financial_obligations 
                SET status = 'PAID', 
                    linked_transaction_id = %s,
                    updated_at = NOW()
                WHERE id = %s AND user_id = %s
            """, (new_transaction['id'], obligation_id, user_id))
            
            # 5. Commit da transação ACID
            self.db_service.connection.commit()
            
            # Retornar dados da liquidação no formato esperado pelo SettlementResponse
            return {
                'message': f'Obrigação liquidada com sucesso usando conta: {account["name"]}',
                'obligation_id': obligation_id,
                'transaction_id': new_transaction['id']
            }
            
        except Exception as e:
            # Rollback em caso de erro
            self.db_service.connection.rollback()
            raise Exception(f"Error settling obligation: {str(e)}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True
    
    def cancel_settlement(self, user_id: int, obligation_id: int) -> dict:
        """
        FUNÇÃO CRÍTICA: Cancela a liquidação de uma obrigação PAID
        Remove a transação vinculada e reverte o status para PENDING
        Tudo dentro de transação ACID para garantir consistência
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            # Iniciar transação ACID
            self.db_service.connection.autocommit = False
            
            # 1. Buscar dados da obrigação e validar
            cursor.execute("""
                SELECT * FROM financial_obligations 
                WHERE id = %s AND user_id = %s AND status = 'PAID'
            """, (obligation_id, user_id))
            
            obligation = cursor.fetchone()
            if not obligation:
                raise ValueError("Obrigação não encontrada ou ainda não foi liquidada")
            
            # 2. Verificar se há transação vinculada para deletar
            linked_transaction_id = obligation.get('linked_transaction_id')
            if not linked_transaction_id:
                raise ValueError("Não existe transação vinculada para essa obrigação")
            
            # 3. Deletar a transação vinculada usando transaction_service
            try:
                delete_success = self.transaction_service.delete_transaction(user_id, linked_transaction_id)
                if not delete_success:
                    raise ValueError("Erro ao deletar transação vinculada")
            except Exception as e:
                raise ValueError(f"Erro ao deletar transação vinculada: {str(e)}")
             
            # 4. Reverter obrigação para status PENDING
            cursor.execute("""
                UPDATE financial_obligations 
                SET status = 'PENDING', 
                    linked_transaction_id = NULL,
                    updated_at = NOW()
                WHERE id = %s AND user_id = %s
            """, (obligation_id, user_id))
            
            # 5. Commit da transação ACID
            self.db_service.connection.commit()
            
            # Retornar dados da obrigação atualizada
            return {
                'obligation': self.get_obligation_by_id(user_id, obligation_id),
                'message': 'Liquidação cancelada com sucesso',
                'cancelled_transaction_id': linked_transaction_id
            }
            
        except Exception as e:
            # Rollback em caso de erro
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao cancelar liquidação: {str(e)}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True
    
    # ==================== CRUD RECURRING RULES ====================
    
    def _validate_account_exists(self, cursor, account_id: int, user_id: int, field_label: str) -> bool:
        """
        Valida se uma conta existe e pertence ao usuário
        """
        cursor.execute("SELECT id FROM accounts WHERE id = %s AND user_id = %s", (account_id, user_id))
        if not cursor.fetchone():
            raise ValueError(f"Conta {field_label} (ID: {account_id}) não encontrada ou não pertence ao usuário")
        return True
    
    def create_recurring_rule(self, user_id: int, rule_data: dict) -> dict:
        """
        Cria uma nova regra de recorrência
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Validações
            if rule_data.get('amount', 0) <= 0:
                raise ValueError("Amount must be greater than zero")
            
            if rule_data.get('type') not in ['PAYABLE', 'RECEIVABLE', 'TRANSFERENCIA']:
                raise ValueError("Type must be PAYABLE, RECEIVABLE or TRANSFERENCIA")
            
            if rule_data.get('frequency') not in ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']:
                raise ValueError("Invalid frequency")
            
            # Validar contas se fornecidas
            from_account_id = rule_data.get('from_account_id')
            to_account_id = rule_data.get('to_account_id')
            
            # Processar e validar campos de conta
            for field_name, field_value, field_label in [
                ('from_account_id', from_account_id, 'origem'), 
                ('to_account_id', to_account_id, 'destino')
            ]:
                if field_value == '' or field_value == 'null' or field_value is None:
                    if field_name == 'from_account_id':
                        from_account_id = None
                    else:
                        to_account_id = None
                elif field_value:
                    try:
                        account_id_int = int(field_value)
                        self._validate_account_exists(cursor, account_id_int, user_id, field_label)
                        if field_name == 'from_account_id':
                            from_account_id = account_id_int
                        else:
                            to_account_id = account_id_int
                    except (ValueError, TypeError) as e:
                        if "não encontrada" in str(e):
                            raise e
                        raise ValueError(f"Conta {field_label} com valor inválido: {field_value}")
            
            query = """
                INSERT INTO recurring_rules 
                (user_id, description, amount, type, category, entity_name, frequency, interval_value, start_date, end_date, is_active, from_account_id, to_account_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                user_id,
                rule_data.get('description'),
                rule_data.get('amount'),
                rule_data.get('type'),
                rule_data.get('category'),
                rule_data.get('entity_name'),
                rule_data.get('frequency'),
                rule_data.get('interval_value', 1),
                rule_data.get('start_date'),
                rule_data.get('end_date'),
                rule_data.get('is_active', True),
                from_account_id,
                to_account_id
            )
            
            # Debug logging
            print(f"CREATE_RECURRING_RULE: user_id={user_id}")
            print(f"CREATE_RECURRING_RULE: values={values}")
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            rule_id = cursor.lastrowid
            return self.get_recurring_rule_by_id(user_id, rule_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Database error creating recurring rule: {err}")
        except Exception as e:
            self.db_service.connection.rollback()
            raise Exception(f"Error creating recurring rule: {str(e)}")
        finally:
            cursor.close()
    
    def get_recurring_rule_by_id(self, user_id: int, rule_id: int) -> dict:
        """
        Busca uma regra de recorrência específica
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT * FROM recurring_rules 
                WHERE id = %s AND user_id = %s
            """, (rule_id, user_id))
            
            result = cursor.fetchone()
            if result and result.get('amount'):
                result['amount'] = float(result['amount'])
            
            return result
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching recurring rule: {err}")
        finally:
            cursor.close()
    
    def get_recurring_rules_by_user(self, user_id: int, is_active: bool = None) -> List[dict]:
        """
        Lista regras de recorrência do usuário
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = "SELECT * FROM recurring_rules WHERE user_id = %s"
            params = [user_id]
            
            if is_active is not None:
                query += " AND is_active = %s"
                params.append(is_active)
            
            query += " ORDER BY created_at DESC"
            
            # Debug logging
            print(f"GET_RECURRING_RULES: user_id={user_id}, query={query}, params={params}")
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            print(f"GET_RECURRING_RULES: found {len(results)} rules")
            
            # Converter Decimal para float
            for result in results:
                if result.get('amount'):
                    result['amount'] = float(result['amount'])
            
            return results
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching recurring rules: {err}")
        finally:
            cursor.close()
    
    def update_recurring_rule(self, user_id: int, rule_id: int, rule_data: dict) -> dict:
        """
        Atualiza uma regra de recorrência existente
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Validar contas se fornecidas (não-None) antes de atualizar
            for field_name in ['from_account_id', 'to_account_id']:
                if field_name in rule_data:
                    account_id = rule_data[field_name]
                    field_label = "origem" if field_name == 'from_account_id' else "destino"
                    print(f"UPDATE_RECURRING_RULE: Validating {field_name} = '{account_id}' (type: {type(account_id).__name__})")
                    
                    if account_id is not None and account_id != '' and str(account_id).lower() != 'null':
                        try:
                            account_id_int = int(account_id)
                            self._validate_account_exists(cursor, account_id_int, user_id, field_label)
                        except (ValueError, TypeError) as e:
                            if "não encontrada" in str(e):
                                raise e
                            raise ValueError(f"Conta {field_label} com valor inválido: {account_id}")
            
            fields = []
            values = []
            
            allowed_fields = ['description', 'amount', 'category', 'entity_name', 'frequency', 'interval_value', 'start_date', 'end_date', 'is_active', 'from_account_id', 'to_account_id']
            for field in allowed_fields:
                if field in rule_data:
                    fields.append(f"{field} = %s")
                    # Converter objetos date para string se necessário
                    value = rule_data[field]
                    if hasattr(value, 'isoformat'):  # É um objeto date/datetime
                        value = value.isoformat()
                    # Tratar campos de conta: converter para int ou None
                    elif field in ['from_account_id', 'to_account_id']:
                        print(f"UPDATE_RECURRING_RULE: Processing {field} = '{value}' (type: {type(value).__name__})")
                        if value is None or value == '' or str(value).lower() == 'null':
                            value = None
                            print(f"UPDATE_RECURRING_RULE: {field} set to None")
                        else:
                            try:
                                value = int(value)
                                print(f"UPDATE_RECURRING_RULE: {field} converted to {value}")
                            except (ValueError, TypeError):
                                print(f"UPDATE_RECURRING_RULE: {field} invalid value '{value}', setting to None")
                                value = None
                    values.append(value)
            
            if not fields:
                raise ValueError(f"No valid fields to update. Received data: {rule_data}")
            
            values.extend([rule_id, user_id])
            query = f"""
                UPDATE recurring_rules 
                SET {', '.join(fields)}
                WHERE id = %s AND user_id = %s
            """
            
            # Debug logging
            print(f"UPDATE_RECURRING_RULE: user_id={user_id}, rule_id={rule_id}")
            print(f"UPDATE_RECURRING_RULE: fields={fields}")
            print(f"UPDATE_RECURRING_RULE: values={values}")
            print(f"UPDATE_RECURRING_RULE: value types={[type(v).__name__ for v in values]}")
            print(f"UPDATE_RECURRING_RULE: query={query}")
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            print(f"UPDATE_RECURRING_RULE: rowcount={cursor.rowcount}")
            
            if cursor.rowcount == 0:
                # Verificar se a regra existe e dar diagnóstico mais detalhado
                cursor.execute("SELECT user_id, description, from_account_id, to_account_id FROM recurring_rules WHERE id = %s", (rule_id,))
                existing_rule = cursor.fetchone()
                if existing_rule:
                    if existing_rule['user_id'] == user_id:
                        print(f"UPDATE_RECURRING_RULE: Rule found but no rows updated.")
                        print(f"UPDATE_RECURRING_RULE: Current DB state - rule_id={rule_id}, user_id={user_id}")
                        print(f"UPDATE_RECURRING_RULE: Current DB accounts - from: {existing_rule['from_account_id']}, to: {existing_rule['to_account_id']}")
                        print(f"UPDATE_RECURRING_RULE: Update attempt - fields: {[f.split('=')[0].strip() for f in fields]}")
                        print(f"UPDATE_RECURRING_RULE: Update values: {values}")
                        print(f"UPDATE_RECURRING_RULE: Full query: {query}")
                        
                        # Tentar identificar o problema específico
                        if len(values) < 2:
                            raise ValueError("Insufficient parameters for update query")
                        elif not any('account' in field for field in fields):
                            raise ValueError("Account fields missing from update - this is the likely cause of the issue")
                        else:
                            raise ValueError(f"Update failed despite having {len(fields)} fields to update. Check data types and constraints.")
                    else:
                        raise ValueError(f"Recurring rule exists but belongs to user_id {existing_rule['user_id']}, not {user_id}")
                else:
                    raise ValueError("Recurring rule not found")
            
            return self.get_recurring_rule_by_id(user_id, rule_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Database error updating recurring rule: {err}")
        except Exception as e:
            self.db_service.connection.rollback()
            raise Exception(f"Error updating recurring rule: {str(e)}")
        finally:
            cursor.close()
    
    def delete_recurring_rule(self, user_id: int, rule_id: int) -> bool:
        """
        Deleta uma regra de recorrência
        """
        cursor = self.db_service.connection.cursor()
        try:
            cursor.execute("""
                DELETE FROM recurring_rules 
                WHERE id = %s AND user_id = %s
            """, (rule_id, user_id))
            
            self.db_service.connection.commit()
            return cursor.rowcount > 0
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Database error deleting recurring rule: {err}")
        finally:
            cursor.close()
    
    def get_last_liquidation_date(self, user_id: int, rule_id: int) -> dict:
        """
        Busca a data da última liquidação de uma recurring rule
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT MAX(t.transaction_date) as last_liquidation_date
                FROM financial_obligations fo 
                JOIN transactions t ON t.id = fo.linked_transaction_id
                WHERE fo.status = 'PAID' 
                AND fo.recurring_rule_id = %s
                AND fo.user_id = %s
            """, (rule_id, user_id))
            
            result = cursor.fetchone()
            last_date = result['last_liquidation_date'] if result else None
            
            # Verificar se a última liquidação foi no mês atual
            is_current_month = False
            if last_date:
                from datetime import date
                today = date.today()
                is_current_month = (last_date.year == today.year and last_date.month == today.month)
            
            return {
                'last_liquidation_date': last_date.isoformat() if last_date else None,
                'is_current_month': is_current_month,
                'can_reverse': is_current_month  # Pode estornar se foi liquidada no mês atual
            }
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching last liquidation: {err}")
        finally:
            cursor.close()
    
    def reverse_current_month_liquidation(self, user_id: int, rule_id: int) -> dict:
        """
        Estorna a liquidação de uma recurring rule do mês atual
        Remove APENAS as financial_obligations e transactions do mês atual relacionadas à rule
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Iniciar transação ACID
            self.db_service.connection.autocommit = False
            
            # 1. Buscar obligations do mês atual para esta recurring rule
            cursor.execute("""
                SELECT fo.id, fo.linked_transaction_id, t.transaction_date
                FROM financial_obligations fo
                JOIN transactions t ON t.id = fo.linked_transaction_id
                WHERE fo.recurring_rule_id = %s 
                AND fo.user_id = %s
                AND fo.status = 'PAID'
                AND YEAR(t.transaction_date) = YEAR(CURDATE())
                AND MONTH(t.transaction_date) = MONTH(CURDATE())
            """, (rule_id, user_id))
            
            current_month_obligations = cursor.fetchall()
            
            if not current_month_obligations:
                raise ValueError("Nenhuma liquidação encontrada no mês atual para esta recurring rule")
            
            reversed_count = 0
            
            # 2. Para cada obligation do mês atual, deletar a transaction e a obligation
            for obligation in current_month_obligations:
                # Deletar a transaction
                cursor.execute("""
                    DELETE FROM transactions 
                    WHERE id = %s AND user_id = %s
                """, (obligation['linked_transaction_id'], user_id))
                
                # Deletar a financial_obligation
                cursor.execute("""
                    DELETE FROM financial_obligations 
                    WHERE id = %s AND user_id = %s
                """, (obligation['id'], user_id))
                
                reversed_count += 1
            
            # 3. Commit da transação ACID
            self.db_service.connection.commit()
            
            return {
                'message': f'Estorno realizado com sucesso. {reversed_count} liquidação(ões) do mês atual removida(s).',
                'rule_id': rule_id,
                'reversed_count': reversed_count
            }
            
        except Exception as e:
            # Rollback em caso de erro
            self.db_service.connection.rollback()
            raise Exception(f"Error reversing current month liquidation: {str(e)}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True
    
    def liquidate_recurring_rule(self, user_id: int, rule_id: int, from_account_id: int = None, to_account_id: int = None, settlement_date: date = None) -> dict:
        """
        FUNÇÃO CRÍTICA: Liquida uma recurring rule criando transação correspondente
        Diferente das obrigações, não marca a recurring rule como "liquidada" - ela continua ativa para próximas ocorrências
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            # Iniciar transação ACID
            self.db_service.connection.autocommit = False
            
            # 1. Buscar dados da recurring rule
            cursor.execute("""
                SELECT * FROM recurring_rules 
                WHERE id = %s AND user_id = %s AND is_active = 1
            """, (rule_id, user_id))
            
            rule = cursor.fetchone()
            if not rule:
                raise ValueError("Recurring rule not found, not owned by user, or not active")
            
            # 1.2. Calcular data de liquidação automática se não fornecida
            if settlement_date is None:
                start_date = rule['start_date']
                if isinstance(start_date, str):
                    start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                settlement_date = calculate_suggested_settlement_date(start_date)
        
            # Debug logging
            print(f"LIQUIDATE_RECURRING_RULE: user_id={user_id}, rule_id={rule_id}, from_account_id={from_account_id}")
            print(f"LIQUIDATE_RECURRING_RULE: settlement_date={settlement_date}, type={type(settlement_date)}")
            print(f"LIQUIDATE_RECURRING_RULE: calculated from start_date={rule['start_date']}")
            
            # 1.5. Usar contas pré-definidas na recurring rule se não foram fornecidas
            if from_account_id is None:
                from_account_id = rule.get('from_account_id')
            if to_account_id is None:
                to_account_id = rule.get('to_account_id')
            
            # 2. Validar contas (apenas se foram fornecidas)
            if from_account_id:
                cursor.execute("""
                    SELECT id, name FROM accounts 
                    WHERE id = %s AND user_id = %s
                """, (from_account_id, user_id))
                
                account = cursor.fetchone()
                if not account:
                    raise ValueError("Conta origem não encontrada ou não pertence ao usuário")
            
            if to_account_id:
                cursor.execute("""
                    SELECT id, name FROM accounts 
                    WHERE id = %s AND user_id = %s
                """, (to_account_id, user_id))
                
                account = cursor.fetchone()
                if not account:
                    raise ValueError("Conta destino não encontrada ou não pertence ao usuário")
            
            # 3. Criar transação correspondente
            transaction_data = {
                'description': f"Liquidação recorrência: {rule['description']}",
                'amount': float(rule['amount']),
                'transaction_date': settlement_date,
                'category': rule.get('category'),
                'status': 'EFETIVADO'
            }
            
            # Definir tipo e contas baseado no tipo da obrigação
            if from_account_id and to_account_id:
                transaction_data['type'] = 'TRANSFERENCIA'
            elif to_account_id:
                transaction_data['type'] = 'RECEITA'
            elif from_account_id:
                transaction_data['type'] = 'DESPESA'
            else:
                raise ValueError("Conta de origem ou destino obrigatórias para liquidar uma obrigação")
            
            transaction_data['from_account_id'] = from_account_id
            transaction_data['to_account_id'] = to_account_id
            
            # Criar transação usando o transaction_service (passa cursor externo)
            new_transaction = self.transaction_service.create_transaction(user_id, transaction_data, cursor)
            
            # 4. Criar financial_obligation já liquidada para registrar que foi paga neste mês
            obligation_data = {
                'description': f"Liquidação: {rule['description']}",
                'amount': float(rule['amount']),
                'due_date': settlement_date,
                'type': rule['type'],
                'status': 'PAID',
                'category': rule.get('category'),
                'entity_name': rule.get('entity_name'),
                'recurring_rule_id': rule_id,
                'linked_transaction_id': new_transaction['id']
            }
            
            # Debug logging da obligation
            print(f"LIQUIDATE_RECURRING_RULE: obligation_data={obligation_data}")
            print(f"LIQUIDATE_RECURRING_RULE: due_date in obligation_data={obligation_data['due_date']}, type={type(obligation_data['due_date'])}")
            
            obligation_values = (
                user_id,
                obligation_data['description'],
                obligation_data['amount'],
                obligation_data['due_date'],
                obligation_data['type'],
                obligation_data['status'],
                obligation_data.get('category'),
                obligation_data.get('entity_name'),
                f"Gerada automaticamente pela liquidação da recurring rule {rule_id}",
                obligation_data['recurring_rule_id'],
                obligation_data['linked_transaction_id']
            )
            
            print(f"LIQUIDATE_RECURRING_RULE: obligation_values={obligation_values}")
            print(f"LIQUIDATE_RECURRING_RULE: due_date value={obligation_values[3]}, type={type(obligation_values[3])}")
            
            cursor.execute("""
                INSERT INTO financial_obligations 
                (user_id, description, amount, due_date, type, status, category, entity_name, notes, recurring_rule_id, linked_transaction_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, obligation_values)
            
            obligation_id = cursor.lastrowid
            
            # 5. A recurring rule continua ativa - não é marcada como liquidada
            # Isso permite liquidações futuras da mesma recorrência
            
            # 6. Commit da transação ACID
            self.db_service.connection.commit()
            
            # Retornar dados da liquidação
            return {
                'message': f'Recorrência liquidada com sucesso usando conta: {account["name"]}',
                'rule_id': rule_id,
                'transaction_id': new_transaction['id'],
                'obligation_id': obligation_id,
                'settlement_date': settlement_date.isoformat()
            }
            
        except Exception as e:
            # Rollback em caso de erro
            self.db_service.connection.rollback()
            raise Exception(f"Error liquidating recurring rule: {str(e)}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True
    
    # ==================== FUNCIONALIDADES ESPECIAIS ====================
    
    def get_upcoming_summary(self, user_id: int, days_ahead: int = 30) -> dict:
        """
        Retorna resumo das próximas obrigações para o dashboard
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Próximas a pagar
            cursor.execute("""
                SELECT * FROM financial_obligations 
                WHERE user_id = %s AND type = 'PAYABLE' AND status IN ('PENDING', 'OVERDUE')
                AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL %s DAY)
                ORDER BY due_date ASC
                LIMIT 5
            """, (user_id, days_ahead))
            
            upcoming_payables = cursor.fetchall()
            
            # Próximas a receber
            cursor.execute("""
                SELECT * FROM financial_obligations 
                WHERE user_id = %s AND type = 'RECEIVABLE' AND status IN ('PENDING', 'OVERDUE')
                AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL %s DAY)
                ORDER BY due_date ASC
                LIMIT 5
            """, (user_id, days_ahead))
            
            upcoming_receivables = cursor.fetchall()
            
            # Converter Decimal para float
            for items in [upcoming_payables, upcoming_receivables]:
                for item in items:
                    if item.get('amount'):
                        item['amount'] = float(item['amount'])
            
            return {
                'upcoming_payables': upcoming_payables,
                'upcoming_receivables': upcoming_receivables
            }
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching upcoming summary: {err}")
        finally:
            cursor.close()
    
    def update_overdue_status(self) -> int:
        """
        Atualiza status de obrigações vencidas para OVERDUE
        Retorna número de registros atualizados
        """
        cursor = self.db_service.connection.cursor()
        try:
            cursor.execute("""
                UPDATE financial_obligations 
                SET status = 'OVERDUE', updated_at = NOW()
                WHERE status = 'PENDING' AND due_date < CURDATE()
            """)
            
            self.db_service.connection.commit()
            return cursor.rowcount
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Database error updating overdue status: {err}")
        finally:
            cursor.close()
    
    def get_obligations_summary_30d(self, user_id: int) -> dict:
        """
        Retorna totais a pagar e a receber do mês atual (obrigações + recurring rules pendentes)
        NOVA LÓGICA: Considera apenas recurring rules que ainda não foram liquidadas no mês atual
        """
        print(f"get(/obligations/summary) ||||||||||| INÍCIO")
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # LOG DE VERIFICAÇÃO CRÍTICO
            # print(f"OBLIGATION_SERVICE: Starting summary calculation for user_id={user_id}")
            
            # 1. Obrigações do mês atual
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN amount ELSE 0 END), 0.00) as payable_total,
                    COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN amount ELSE 0 END), 0.00) as receivable_total
                FROM financial_obligations 
                WHERE user_id = %s 
                AND status IN ('PENDING', 'OVERDUE')
                AND YEAR(due_date) = YEAR(CURDATE()) 
                AND MONTH(due_date) = MONTH(CURDATE())
            """, (user_id,))
            
            obligations_result = cursor.fetchone()
            
            # 2. Recurring rules ativas que ainda não foram liquidadas no mês atual
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN amount ELSE 0 END), 0.00) as payable_recurring,
                    COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN amount ELSE 0 END), 0.00) as receivable_recurring
                FROM recurring_rules rr
                WHERE rr.user_id = %s 
                AND rr.is_active = 1
                AND NOT EXISTS (
                    SELECT 1 
                    FROM financial_obligations fo
                    WHERE fo.recurring_rule_id = rr.id 
                    AND YEAR(fo.due_date) = YEAR(CURDATE())
                    AND MONTH(fo.due_date) = MONTH(CURDATE())
                    AND fo.status = 'PAID'
                )
            """, (user_id,))
            
            recurring_result = cursor.fetchone()
            
            # LOG DE VERIFICAÇÃO CRÍTICO  
            # print(f"OBLIGATION_SERVICE: Obligations result: {obligations_result}")
            # print(f"OBLIGATION_SERVICE: Recurring result: {recurring_result}")
            
            # Conversão segura e soma dos totais
            obligations_payable = float(obligations_result['payable_total']) if obligations_result and obligations_result['payable_total'] else 0.0
            obligations_receivable = float(obligations_result['receivable_total']) if obligations_result and obligations_result['receivable_total'] else 0.0
            
            recurring_payable = float(recurring_result['payable_recurring']) if recurring_result and recurring_result['payable_recurring'] else 0.0
            recurring_receivable = float(recurring_result['receivable_recurring']) if recurring_result and recurring_result['receivable_recurring'] else 0.0
            
            # Totais finais (obrigações + recurring rules pendentes)
            total_payable = obligations_payable + recurring_payable
            total_receivable = obligations_receivable + recurring_receivable
            
            summary_data = {
                'payable_next_30d': total_payable,
                'receivable_next_30d': total_receivable
            }
            
            # LOG DE VERIFICAÇÃO CRÍTICO
            # print(f"OBLIGATION_SERVICE: Final summary data: {summary_data}")
            
            return summary_data
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching 30d summary: {err}")
        finally:
            cursor.close()