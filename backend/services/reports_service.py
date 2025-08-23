"""
Serviço de Relatórios Gerenciais
Fornece relatórios financeiros com queries SQL complexas de agregação
"""

import mysql.connector
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, List, Optional, Any
from .database_service import DatabaseService

class ReportsService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
    
    def get_account_statement(self, user_id: int, account_id: int, start_date: date, end_date: date) -> List[dict]:
        """
        Gera extrato detalhado de uma conta com saldo corrente (running balance)
        
        Args:
            user_id: ID do usuário
            account_id: ID da conta específica
            start_date: Data de início do período
            end_date: Data de fim do período
            
        Returns:
            Lista de transações com saldo corrente calculado
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Validar se a conta pertence ao usuário
            cursor.execute("""
                SELECT id, name FROM accounts 
                WHERE id = %s AND user_id = %s
            """, (account_id, user_id))
            
            account = cursor.fetchone()
            if not account:
                raise ValueError("Account not found or not owned by user")
            
            # Buscar saldo inicial (antes do período)
            cursor.execute("""
                SELECT 
                    COALESCE(
                        SUM(
                            CASE 
                                WHEN to_account_id = %s THEN amount
                                WHEN from_account_id = %s THEN -amount
                                ELSE 0
                            END
                        ), 0
                    ) as initial_balance
                FROM transactions 
                WHERE (to_account_id = %s OR from_account_id = %s)
                AND user_id = %s
                AND transaction_date < %s
                AND status = 'EFETIVADO'
            """, (account_id, account_id, account_id, account_id, user_id, start_date))
            
            initial_result = cursor.fetchone()
            initial_balance = float(initial_result['initial_balance']) if initial_result['initial_balance'] else 0.0
            
            # Buscar transações do período ordenadas por data
            cursor.execute("""
                SELECT 
                    t.id,
                    t.description,
                    t.amount,
                    t.transaction_date,
                    t.type,
                    t.category,
                    t.status,
                    CASE 
                        WHEN t.to_account_id = %s THEN 'CREDIT'
                        WHEN t.from_account_id = %s THEN 'DEBIT'
                        ELSE 'UNKNOWN'
                    END as movement_type,
                    CASE 
                        WHEN t.to_account_id = %s THEN t.amount
                        WHEN t.from_account_id = %s THEN -t.amount
                        ELSE 0
                    END as impact_amount
                FROM transactions t
                WHERE (t.to_account_id = %s OR t.from_account_id = %s)
                AND t.user_id = %s
                AND t.transaction_date BETWEEN %s AND %s
                AND t.status = 'EFETIVADO'
                ORDER BY t.transaction_date ASC, t.id ASC
            """, (account_id, account_id, account_id, account_id, account_id, account_id, user_id, start_date, end_date))
            
            transactions = cursor.fetchall()
            
            # Calcular saldo corrente para cada transação
            running_balance = initial_balance
            statement = []
            
            for transaction in transactions:
                # Converter Decimal para float
                amount = float(transaction['amount'])
                impact_amount = float(transaction['impact_amount'])
                
                running_balance += impact_amount
                
                statement.append({
                    'id': transaction['id'],
                    'date': transaction['transaction_date'].isoformat(),
                    'description': transaction['description'],
                    'amount': amount,
                    'type': transaction['type'],
                    'movement_type': transaction['movement_type'],
                    'impact_amount': impact_amount,
                    'running_balance': running_balance,
                    'category': transaction['category'],
                    'status': transaction['status']
                })
            
            return {
                'account_info': {
                    'id': account['id'],
                    'name': account['name']
                },
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'initial_balance': initial_balance,
                'final_balance': running_balance,
                'transactions': statement
            }
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error generating account statement: {err}")
        finally:
            cursor.close()
    
    def get_expense_by_category(self, user_id: int, start_date: date, end_date: date) -> List[dict]:
        """
        Análise de despesas por categoria no período
        
        Args:
            user_id: ID do usuário
            start_date: Data de início
            end_date: Data de fim
            
        Returns:
            Lista com soma de despesas agrupadas por categoria
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT 
                    COALESCE(category, 'Sem Categoria') as category,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_amount,
                    AVG(amount) as average_amount,
                    MIN(amount) as min_amount,
                    MAX(amount) as max_amount
                FROM transactions
                WHERE user_id = %s
                AND type = 'DESPESA'
                AND status = 'EFETIVADO'
                AND transaction_date BETWEEN %s AND %s
                GROUP BY COALESCE(category, 'Sem Categoria')
                ORDER BY total_amount DESC
            """, (user_id, start_date, end_date))
            
            results = cursor.fetchall()
            
            # Converter Decimal para float
            for result in results:
                result['total_amount'] = float(result['total_amount'])
                result['average_amount'] = float(result['average_amount'])
                result['min_amount'] = float(result['min_amount'])
                result['max_amount'] = float(result['max_amount'])
            
            # Calcular total geral
            total_expenses = sum(r['total_amount'] for r in results)
            
            # Adicionar percentuais
            for result in results:
                result['percentage'] = (result['total_amount'] / total_expenses * 100) if total_expenses > 0 else 0
            
            return {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'total_expenses': total_expenses,
                'categories': results
            }
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error analyzing expenses by category: {err}")
        finally:
            cursor.close()
    
    def get_monthly_cash_flow(self, user_id: int, start_date: date, end_date: date) -> List[dict]:
        """
        Fluxo de caixa mensal (receitas vs despesas)
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Query simplificada
            cursor.execute("""
                SELECT 
                    YEAR(transaction_date) as year_val,
                    MONTH(transaction_date) as month_val,
                    type,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_amount
                FROM transactions
                WHERE user_id = %s
                AND type IN ('RECEITA', 'DESPESA')
                AND status = 'EFETIVADO'
                AND transaction_date BETWEEN %s AND %s
                GROUP BY YEAR(transaction_date), MONTH(transaction_date), type
                ORDER BY year_val ASC, month_val ASC, type ASC
            """, (user_id, start_date, end_date))
            
            results = cursor.fetchall()
            
            # Organizar dados por mês
            monthly_data = {}
            
            for result in results:
                year_val = result['year_val']
                month_val = result['month_val']
                year_month = f"{year_val}-{month_val:02d}"
                transaction_type = result['type']
                total_amount = float(result['total_amount'])
                
                if year_month not in monthly_data:
                    monthly_data[year_month] = {
                        'year': year_val,
                        'month': month_val,
                        'year_month': year_month,
                        'month_start': f"{year_val}-{month_val:02d}-01",
                        'receitas': 0.0,
                        'despesas': 0.0,
                        'receitas_count': 0,
                        'despesas_count': 0
                    }
                
                if transaction_type == 'RECEITA':
                    monthly_data[year_month]['receitas'] = total_amount
                    monthly_data[year_month]['receitas_count'] = result['transaction_count']
                elif transaction_type == 'DESPESA':
                    monthly_data[year_month]['despesas'] = total_amount
                    monthly_data[year_month]['despesas_count'] = result['transaction_count']
            
            # Calcular saldo líquido para cada mês
            cash_flow = []
            for year_month in sorted(monthly_data.keys()):
                month_data = monthly_data[year_month]
                net_flow = month_data['receitas'] - month_data['despesas']
                
                month_data['saldo_liquido'] = net_flow
                month_data['month_name'] = self._get_month_name(month_data['month'])
                
                cash_flow.append(month_data)
            
            return {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'monthly_cash_flow': cash_flow,
                'summary': {
                    'total_months': len(cash_flow),
                    'total_receitas': sum(m['receitas'] for m in cash_flow),
                    'total_despesas': sum(m['despesas'] for m in cash_flow),
                    'net_cash_flow': sum(m['saldo_liquido'] for m in cash_flow)
                }
            }
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error generating monthly cash flow: {err}")
        finally:
            cursor.close()
    
    def _get_month_name(self, month_number: int) -> str:
        """Converter número do mês para nome em português"""
        month_names = {
            1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
            5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
            9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
        }
        return month_names.get(month_number, f'Mês {month_number}')
    
    def get_user_accounts_summary(self, user_id: int) -> List[dict]:
        """
        Lista resumida das contas do usuário para seleção em relatórios
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT id, name, type, institution
                FROM accounts 
                WHERE user_id = %s
                ORDER BY name ASC
            """, (user_id,))
            
            return cursor.fetchall()
            
        except mysql.connector.Error as err:
            raise Exception(f"Database error fetching accounts summary: {err}")
        finally:
            cursor.close()