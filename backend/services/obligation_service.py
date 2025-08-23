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
            
            allowed_fields = ['description', 'amount', 'due_date', 'category', 'entity_name', 'notes', 'status']
            for field in allowed_fields:
                if field in obligation_data:
                    fields.append(f"{field} = %s")
                    values.append(obligation_data[field])
            
            if not fields:
                raise ValueError("No valid fields to update")
            
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
                raise ValueError("Obligation not found or not owned by user")
            
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
                raise ValueError("Cannot delete a settled obligation")
            
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
    
    def settle_obligation(self, user_id: int, obligation_id: int, account_id: int, settlement_date: date = None) -> dict:
        """
        FUNÇÃO CRÍTICA: Liquida uma obrigação criando transação correspondente
        Tudo dentro de transação ACID para garantir consistência
        """
        if settlement_date is None:
            settlement_date = date.today()
        
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
            
            # 2. Validar conta
            cursor.execute("""
                SELECT id, name FROM accounts 
                WHERE id = %s AND user_id = %s
            """, (account_id, user_id))
            
            account = cursor.fetchone()
            if not account:
                raise ValueError("Account not found or not owned by user")
            
            # 3. Criar transação correspondente
            transaction_data = {
                'description': f"Liquidação: {obligation['description']}",
                'amount': float(obligation['amount']),
                'transaction_date': settlement_date,
                'category': obligation.get('category'),
                'status': 'EFETIVADO'
            }
            
            # Definir tipo e contas baseado no tipo da obrigação
            if obligation['type'] == 'PAYABLE':
                # A Pagar = DESPESA (sai da conta)
                transaction_data['type'] = 'DESPESA'
                transaction_data['from_account_id'] = account_id
                transaction_data['to_account_id'] = None
            else:
                # A Receber = RECEITA (entra na conta)  
                transaction_data['type'] = 'RECEITA'
                transaction_data['from_account_id'] = None
                transaction_data['to_account_id'] = account_id
            
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
            
            # Retornar dados da liquidação
            return {
                'obligation': self.get_obligation_by_id(user_id, obligation_id),
                'transaction': new_transaction,
                'settlement_date': settlement_date.isoformat(),
                'account_used': account['name']
            }
            
        except Exception as e:
            # Rollback em caso de erro
            self.db_service.connection.rollback()
            raise Exception(f"Error settling obligation: {str(e)}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True
    
    # ==================== CRUD RECURRING RULES ====================
    
    def create_recurring_rule(self, user_id: int, rule_data: dict) -> dict:
        """
        Cria uma nova regra de recorrência
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Validações
            if rule_data.get('amount', 0) <= 0:
                raise ValueError("Amount must be greater than zero")
            
            if rule_data.get('frequency') not in ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']:
                raise ValueError("Invalid frequency")
            
            query = """
                INSERT INTO recurring_rules 
                (user_id, description, amount, type, category, entity_name, frequency, interval_value, start_date, end_date, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                rule_data.get('is_active', True)
            )
            
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
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
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
            fields = []
            values = []
            
            allowed_fields = ['description', 'amount', 'category', 'entity_name', 'frequency', 'interval_value', 'end_date', 'is_active']
            for field in allowed_fields:
                if field in rule_data:
                    fields.append(f"{field} = %s")
                    values.append(rule_data[field])
            
            if not fields:
                raise ValueError("No valid fields to update")
            
            values.extend([rule_id, user_id])
            query = f"""
                UPDATE recurring_rules 
                SET {', '.join(fields)}
                WHERE id = %s AND user_id = %s
            """
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise ValueError("Recurring rule not found or not owned by user")
            
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
        Retorna totais a pagar e a receber para os próximos 30 dias
        REFATORAÇÃO CIRÚRGICA: Query única com agregação condicional
        """
        print(f"get(/obligations/summary) ||||||||||| INÍCIO")
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # LOG DE VERIFICAÇÃO CRÍTICO
            print(f"OBLIGATION_SERVICE: Starting summary calculation for user_id={user_id}")
            
            # Query única atômica com agregação condicional - resolve problema de cursor state
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN amount ELSE 0 END), 0.00) as payable_total,
                    COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN amount ELSE 0 END), 0.00) as receivable_total
                FROM financial_obligations 
                WHERE user_id = %s 
                AND status IN ('PENDING', 'OVERDUE')
                AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            """, (user_id,))
            
            result = cursor.fetchone()
            
            # LOG DE VERIFICAÇÃO CRÍTICO  
            print(f"OBLIGATION_SERVICE: Raw database result: {result}")
            
            # Conversão segura com verificação de tipos
            payable_total = float(result['payable_total']) if result and result['payable_total'] is not None else 0.0
            receivable_total = float(result['receivable_total']) if result and result['receivable_total'] is not None else 0.0
            
            summary_data = {
                'payable_next_30d': payable_total,
                'receivable_next_30d': receivable_total
            }
            
            # LOG DE VERIFICAÇÃO CRÍTICO
            print(f"OBLIGATION_SERVICE: Final summary data: {summary_data}")
            
            return summary_data
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching 30d summary: {err}")
        finally:
            cursor.close()