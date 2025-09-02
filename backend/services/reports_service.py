"""
Serviço de Relatórios Gerenciais
Fornece relatórios financeiros com queries SQL complexas de agregação
E gera snapshots diários para análise histórica de Business Intelligence
"""

import mysql.connector
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from .database_service import DatabaseService
from .portfolio_service import PortfolioService
from .price_service import PriceService
from .summary_service import SummaryService
import json
import logging

logger = logging.getLogger(__name__)

class ReportsService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
        self.portfolio_service = PortfolioService(db_service, PriceService(db_service))
        self.summary_service = SummaryService(db_service)
    
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
    
    def generate_daily_snapshot(self, user_id: int, snapshot_date: date = None) -> dict:
        """
        Gera um snapshot financeiro completo para um usuário em uma data específica.
        
        Args:
            user_id: ID do usuário
            snapshot_date: Data do snapshot (default: hoje)
            
        Returns:
            Dict com resultado da operação
        """
        if snapshot_date is None:
            snapshot_date = date.today()
        
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            return {"success": False, "error": f"user_id inválido: {user_id}"}
        
        # Garantir conexão ativa
        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            logger.info(f"[REPORTS_SERVICE] Gerando snapshot para usuário {user_id} em {snapshot_date}")
            
            # USAR SUMMARY_SERVICE PARA GARANTIR CONSISTÊNCIA TOTAL
            # Obter dados do dashboard que são exatamente os mesmos da tela principal
            dashboard_data = self.summary_service.get_dashboard_summary(user_id)
            
            # 1. EXTRAIR MÉTRICAS PRINCIPAIS DO DASHBOARD
            total_cash = Decimal(str(dashboard_data.get('totalCash', 0)))
            total_invested = Decimal(str(dashboard_data.get('totalInvested', 0)))
            total_liabilities = Decimal(str(dashboard_data.get('totalLiabilities', 0)))
            investment_cash = Decimal(str(dashboard_data.get('investmentCash', 0)))
            total_physical_assets = Decimal(str(dashboard_data.get('totalPhysicalAssets', 0)))
            net_worth = Decimal(str(dashboard_data.get('netWorth', 0)))
            
            # Total de ativos = investido + cash + investment_cash + patrimônio físico
            total_assets = total_invested + total_cash + investment_cash + total_physical_assets
            
            # 2. CALCULAR ALOCAÇÃO DE ATIVOS USANDO PORTFOLIO_SERVICE (fallback se dashboard estiver vazio)
            asset_allocation = dashboard_data.get('assetAllocation', [])
            asset_class_distribution = {}
            
            crypto_portfolio_value = Decimal('0')
            stock_portfolio_value = Decimal('0')
            fixed_income_value = Decimal('0')
            real_estate_funds_value = Decimal('0')
            other_investments_value = Decimal('0')
            
            if asset_allocation:
                # Usar alocação do dashboard se disponível
                for allocation in asset_allocation:
                    asset_class = allocation.get('asset_class', 'OUTROS')
                    value_brl = Decimal(str(allocation.get('total_value_brl', 0)))
                    
                    asset_class_distribution[asset_class] = float(value_brl)
                    
                    # Categorizar para campos específicos
                    if asset_class == 'CRIPTO':
                        crypto_portfolio_value += value_brl
                    elif asset_class in ['ACAO_BR', 'ACAO_US']:
                        stock_portfolio_value += value_brl
                    elif asset_class in ['RENDA_FIXA', 'TESOURO']:
                        fixed_income_value += value_brl
                    elif asset_class == 'FII':
                        real_estate_funds_value += value_brl
                    else:
                        other_investments_value += value_brl
                        
            # Adicionar patrimônio físico à distribuição se houver
            if total_physical_assets > 0:
                asset_class_distribution['PATRIMONIO_FISICO'] = float(total_physical_assets)
            else:
                # Fallback: calcular alocação diretamente do portfólio
                portfolio = self.portfolio_service.get_portfolio_summary(user_id)
                
                for position in portfolio:
                    asset_class = position.get('asset_class', 'OUTROS')
                    value_brl = Decimal(str(position.get('market_value_brl', 0)))
                    
                    # Acumular por classe
                    if asset_class not in asset_class_distribution:
                        asset_class_distribution[asset_class] = 0
                    asset_class_distribution[asset_class] += float(value_brl)
                    
                    # Categorizar para campos específicos
                    if asset_class == 'CRIPTO':
                        crypto_portfolio_value += value_brl
                    elif asset_class in ['ACAO_BR', 'ACAO_US']:
                        stock_portfolio_value += value_brl
                    elif asset_class in ['RENDA_FIXA', 'TESOURO']:
                        fixed_income_value += value_brl
                    elif asset_class == 'FII':
                        real_estate_funds_value += value_brl
                    else:
                        other_investments_value += value_brl
            
            # 3. CÁLCULO DE FLUXO (ROLLING 30 DIAS)
            date_30_days_ago = snapshot_date - timedelta(days=30)
            
            # 3.1. Receitas nos últimos 30 dias
            cursor.execute("""
                SELECT COALESCE(SUM(amount), 0) as income_30_days
                FROM transactions 
                WHERE user_id = %s 
                AND type = 'RECEITA'
                AND transaction_date BETWEEN %s AND %s
                AND status = 'EFETIVADO'
            """, (user_id, date_30_days_ago, snapshot_date))
            income_result = cursor.fetchone()
            income_last_30_days = Decimal(str(income_result.get('income_30_days', 0)))
            
            # 3.2. Despesas nos últimos 30 dias
            cursor.execute("""
                SELECT COALESCE(SUM(amount), 0) as expenses_30_days
                FROM transactions 
                WHERE user_id = %s 
                AND type = 'DESPESA'
                AND transaction_date BETWEEN %s AND %s
                AND status = 'EFETIVADO'
            """, (user_id, date_30_days_ago, snapshot_date))
            expenses_result = cursor.fetchone()
            expenses_last_30_days = Decimal(str(expenses_result.get('expenses_30_days', 0)))
            
            # 3.3. Investimentos (compras) nos últimos 30 dias
            cursor.execute("""
                SELECT COALESCE(SUM(quantity * COALESCE(price_per_unit, 0)), 0) as investments_30_days
                FROM asset_movements 
                WHERE user_id = %s 
                AND movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA')
                AND movement_date BETWEEN %s AND %s
            """, (user_id, date_30_days_ago, snapshot_date))
            investments_result = cursor.fetchone()
            investments_last_30_days = Decimal(str(investments_result.get('investments_30_days', 0)))
            
            # 3.4. Desinvestimentos (vendas) nos últimos 30 dias
            cursor.execute("""
                SELECT COALESCE(SUM(quantity * COALESCE(price_per_unit, 0)), 0) as disinvestments_30_days
                FROM asset_movements 
                WHERE user_id = %s 
                AND movement_type IN ('VENDA', 'TRANSFERENCIA_SAIDA')
                AND movement_date BETWEEN %s AND %s
            """, (user_id, date_30_days_ago, snapshot_date))
            disinvestments_result = cursor.fetchone()
            disinvestments_last_30_days = Decimal(str(disinvestments_result.get('disinvestments_30_days', 0)))
            
            # 3.5. Quebra de despesas por categoria
            cursor.execute("""
                SELECT 
                    COALESCE(category, 'Sem Categoria') as category,
                    SUM(amount) as total_amount
                FROM transactions 
                WHERE user_id = %s 
                AND type = 'DESPESA'
                AND transaction_date BETWEEN %s AND %s
                AND status = 'EFETIVADO'
                GROUP BY category
            """, (user_id, date_30_days_ago, snapshot_date))
            expense_categories = cursor.fetchall()
            
            expense_category_distribution = {}
            for expense in expense_categories:
                category = expense.get('category', 'Sem Categoria')
                amount = float(expense.get('total_amount', 0))
                expense_category_distribution[category] = amount
            
            # 4. INSERÇÃO/ATUALIZAÇÃO DO SNAPSHOT (UPSERT)
            
            upsert_query = """
                INSERT INTO daily_financial_snapshots (
                    user_id, snapshot_date, total_net_worth_brl, total_assets_brl, 
                    total_liabilities_brl, liquid_assets_brl, invested_assets_brl,
                    crypto_portfolio_value_brl, stock_portfolio_value_brl, 
                    fixed_income_value_brl, real_estate_funds_value_brl, other_investments_value_brl,
                    total_physical_assets_brl,
                    income_last_30_days_brl, expenses_last_30_days_brl, 
                    investments_last_30_days_brl, disinvestments_last_30_days_brl,
                    asset_class_distribution_json, expense_category_distribution_json
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) ON DUPLICATE KEY UPDATE
                    total_net_worth_brl = VALUES(total_net_worth_brl),
                    total_assets_brl = VALUES(total_assets_brl),
                    total_liabilities_brl = VALUES(total_liabilities_brl),
                    liquid_assets_brl = VALUES(liquid_assets_brl),
                    invested_assets_brl = VALUES(invested_assets_brl),
                    crypto_portfolio_value_brl = VALUES(crypto_portfolio_value_brl),
                    stock_portfolio_value_brl = VALUES(stock_portfolio_value_brl),
                    fixed_income_value_brl = VALUES(fixed_income_value_brl),
                    real_estate_funds_value_brl = VALUES(real_estate_funds_value_brl),
                    other_investments_value_brl = VALUES(other_investments_value_brl),
                    total_physical_assets_brl = VALUES(total_physical_assets_brl),
                    income_last_30_days_brl = VALUES(income_last_30_days_brl),
                    expenses_last_30_days_brl = VALUES(expenses_last_30_days_brl),
                    investments_last_30_days_brl = VALUES(investments_last_30_days_brl),
                    disinvestments_last_30_days_brl = VALUES(disinvestments_last_30_days_brl),
                    asset_class_distribution_json = VALUES(asset_class_distribution_json),
                    expense_category_distribution_json = VALUES(expense_category_distribution_json)
            """
            
            cursor.execute(upsert_query, (
                user_id, snapshot_date, float(net_worth), float(total_assets),
                float(total_liabilities), float(total_cash + investment_cash), float(total_invested),
                float(crypto_portfolio_value), float(stock_portfolio_value),
                float(fixed_income_value), float(real_estate_funds_value), float(other_investments_value),
                float(total_physical_assets),
                float(income_last_30_days), float(expenses_last_30_days),
                float(investments_last_30_days), float(disinvestments_last_30_days),
                json.dumps(asset_class_distribution), json.dumps(expense_category_distribution)
            ))
            
            self.db_service.connection.commit()
            
            logger.info(f"[REPORTS_SERVICE] Snapshot gerado com sucesso para usuário {user_id}")
            
            return {
                "success": True,
                "user_id": user_id,
                "snapshot_date": snapshot_date.isoformat(),
                "metrics": {
                    "total_net_worth_brl": float(net_worth),
                    "total_assets_brl": float(total_assets),
                    "total_liabilities_brl": float(total_liabilities),
                    "liquid_assets_brl": float(total_cash + investment_cash),
                    "invested_assets_brl": float(total_invested),
                    "crypto_portfolio_value_brl": float(crypto_portfolio_value),
                    "stock_portfolio_value_brl": float(stock_portfolio_value)
                }
            }
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            logger.error(f"[REPORTS_SERVICE] Erro MySQL ao gerar snapshot: {err}")
            return {"success": False, "error": f"Erro de banco de dados: {err}"}
        except Exception as e:
            self.db_service.connection.rollback()
            logger.error(f"[REPORTS_SERVICE] Erro inesperado ao gerar snapshot: {e}")
            return {"success": False, "error": f"Erro interno: {str(e)}"}
        finally:
            cursor.close()
    
    def get_snapshots_history(self, user_id: int, start_date: date = None, end_date: date = None) -> List[Dict]:
        """
        Busca o histórico de snapshots de um usuário em um período.
        
        Args:
            user_id: ID do usuário
            start_date: Data inicial (opcional)
            end_date: Data final (opcional)
            
        Returns:
            Lista de snapshots ordenados por data
        """
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"user_id inválido: {user_id}")
        
        # Defaults para período
        if end_date is None:
            end_date = date.today()
        if start_date is None:
            start_date = end_date - timedelta(days=365)  # Último ano por padrão
        
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT * FROM daily_financial_snapshots
                WHERE user_id = %s
                AND snapshot_date BETWEEN %s AND %s
                ORDER BY snapshot_date ASC
            """
            
            cursor.execute(query, (user_id, start_date, end_date))
            snapshots = cursor.fetchall()
            
            # Converter Decimal para float para JSON serialization
            for snapshot in snapshots:
                for key, value in snapshot.items():
                    if isinstance(value, Decimal):
                        snapshot[key] = float(value)
                    elif isinstance(value, date):
                        snapshot[key] = value.isoformat()
                    elif isinstance(value, datetime):
                        snapshot[key] = value.isoformat()
            
            return snapshots
            
        except mysql.connector.Error as err:
            logger.error(f"[REPORTS_SERVICE] Erro ao buscar histórico de snapshots: {err}")
            raise Exception(f"Erro de banco de dados: {err}")
        finally:
            cursor.close()
    
    def get_expense_analysis(self, user_id: int) -> dict:
        """
        Retorna análise de despesas baseada no snapshot mais recente.
        
        Args:
            user_id: ID do usuário
            
        Returns:
            Dict com análise de despesas
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Buscar snapshot mais recente
            query = """
                SELECT expense_category_distribution_json, expenses_last_30_days_brl, snapshot_date
                FROM daily_financial_snapshots
                WHERE user_id = %s
                ORDER BY snapshot_date DESC
                LIMIT 1
            """
            
            cursor.execute(query, (user_id,))
            snapshot = cursor.fetchone()
            
            if not snapshot:
                return {"success": False, "error": "Nenhum snapshot encontrado"}
            
            expense_distribution = snapshot.get('expense_category_distribution_json', {})
            if isinstance(expense_distribution, str):
                expense_distribution = json.loads(expense_distribution)
            
            total_expenses = float(snapshot.get('expenses_last_30_days_brl', 0))
            snapshot_date = snapshot.get('snapshot_date')
            
            return {
                "success": True,
                "snapshot_date": snapshot_date.isoformat() if snapshot_date else None,
                "total_expenses_last_30_days": total_expenses,
                "expense_categories": expense_distribution
            }
            
        except mysql.connector.Error as err:
            logger.error(f"[REPORTS_SERVICE] Erro ao buscar análise de despesas: {err}")
            return {"success": False, "error": f"Erro de banco de dados: {err}"}
        except Exception as e:
            logger.error(f"[REPORTS_SERVICE] Erro inesperado na análise de despesas: {e}")
            return {"success": False, "error": f"Erro interno: {str(e)}"}
        finally:
            cursor.close()
    
    def get_historical_allocation(self, user_id: int, start_date: date = None, end_date: date = None) -> List[Dict]:
        """
        Busca a alocação histórica de ativos por classe para gráfico de área empilhada.
        
        Args:
            user_id: ID do usuário
            start_date: Data inicial (opcional)  
            end_date: Data final (opcional)
            
        Returns:
            Lista de objetos formatados para gráfico: [{"date": "2025-08-25", "CRIPTO": 15000, "ACAO_BR": 50000}, ...]
        """
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"user_id inválido: {user_id}")
        
        # Defaults para período
        if end_date is None:
            end_date = date.today()
        if start_date is None:
            start_date = end_date - timedelta(days=180)  # 6 meses por padrão
        
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    snapshot_date,
                    asset_class_distribution_json
                FROM daily_financial_snapshots
                WHERE user_id = %s
                AND snapshot_date BETWEEN %s AND %s
                AND asset_class_distribution_json IS NOT NULL
                ORDER BY snapshot_date ASC
            """
            
            cursor.execute(query, (user_id, start_date, end_date))
            snapshots = cursor.fetchall()
            
            historical_allocation = []
            
            for snapshot in snapshots:
                snapshot_date = snapshot['snapshot_date']
                allocation_json = snapshot['asset_class_distribution_json']
                
                # Parse do JSON
                if isinstance(allocation_json, str):
                    allocation_data = json.loads(allocation_json)
                else:
                    allocation_data = allocation_json or {}
                
                # Formato para o gráfico
                chart_data = {
                    "date": snapshot_date.isoformat() if hasattr(snapshot_date, 'isoformat') else str(snapshot_date)
                }
                
                # Adicionar cada classe de ativo como campo separado
                for asset_class, value in allocation_data.items():
                    chart_data[asset_class] = float(value)
                
                historical_allocation.append(chart_data)
            
            return historical_allocation
            
        except mysql.connector.Error as err:
            logger.error(f"[REPORTS_SERVICE] Erro ao buscar alocação histórica: {err}")
            raise Exception(f"Erro de banco de dados: {err}")
        except json.JSONDecodeError as err:
            logger.error(f"[REPORTS_SERVICE] Erro ao decodificar JSON de alocação: {err}")
            raise Exception(f"Erro ao processar dados de alocação: {err}")
        finally:
            cursor.close()
    
    def get_snapshot_details(self, user_id: int, snapshot_date: date) -> Dict:
        """
        Recalcula o estado do patrimônio para uma data específica (drill-down).
        Reutiliza a lógica do summary_service e portfolio_service para garantir precisão.
        
        Args:
            user_id: ID do usuário
            snapshot_date: Data específica para recálculo
            
        Returns:
            Dict com account_details e holding_details para aquela data
        """
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"user_id inválido: {user_id}")
        
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # 1. ACCOUNT DETAILS - Saldos das contas na data específica
            # Precisamos recalcular considerando apenas transações até a data
            cursor.execute("""
                SELECT 
                    a.id,
                    a.name,
                    a.type,
                    a.institution,
                    COALESCE(
                        (SELECT SUM(
                            CASE 
                                WHEN t.to_account_id = a.id THEN t.amount
                                WHEN t.from_account_id = a.id THEN -t.amount
                                ELSE 0
                            END
                        )
                        FROM transactions t
                        WHERE (t.to_account_id = a.id OR t.from_account_id = a.id)
                        AND t.transaction_date <= %s
                        AND t.status = 'EFETIVADO'), 
                        0
                    ) as calculated_balance
                FROM accounts a
                WHERE a.user_id = %s
                ORDER BY a.name ASC
            """, (snapshot_date, user_id))
            
            account_details = cursor.fetchall()
            
            # Converter para formato esperado
            account_list = []
            for account in account_details:
                account_list.append({
                    'account_id': account['id'],
                    'account_name': account['name'],
                    'account_type': account['type'],
                    'institution': account.get('institution', ''),
                    'balance': float(account['calculated_balance'])
                })
            
            # 2. HOLDING DETAILS - Posições de ativos na data específica  
            # Recalcular posições considerando apenas movimentos até a data
            cursor.execute("""
                SELECT 
                    ast.id,
                    ast.symbol,
                    ast.name,
                    ast.asset_class,
                    COALESCE(SUM(
                        CASE 
                            WHEN am.movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA') THEN am.quantity
                            WHEN am.movement_type IN ('VENDA', 'TRANSFERENCIA_SAIDA') THEN -am.quantity
                            ELSE 0
                        END
                    ), 0) as total_quantity,
                    ast.last_price_brl,
                    ast.last_price_usdt
                FROM assets ast
                LEFT JOIN asset_movements am ON ast.id = am.asset_id
                WHERE am.user_id = %s
                AND (am.movement_date IS NULL OR am.movement_date <= %s)
                GROUP BY ast.id, ast.symbol, ast.name, ast.asset_class, ast.last_price_brl, ast.last_price_usdt
                HAVING total_quantity > 0.0001
                ORDER BY ast.symbol ASC
            """, (user_id, snapshot_date))
            
            holding_details = cursor.fetchall()
            
            # Converter para formato esperado  
            holding_list = []
            for holding in holding_details:
                quantity = float(holding['total_quantity'])
                price_brl = float(holding.get('last_price_brl', 0))
                market_value = quantity * price_brl
                
                holding_list.append({
                    'asset_id': holding['id'],
                    'symbol': holding['symbol'],
                    'name': holding.get('name', ''),
                    'asset_class': holding.get('asset_class', 'OUTROS'),
                    'quantity': quantity,
                    'price_brl': price_brl,
                    'market_value_brl': market_value
                })
            
            return {
                "success": True,
                "snapshot_date": snapshot_date.isoformat(),
                "account_details": account_list,
                "holding_details": holding_list,
                "summary": {
                    "total_accounts": len(account_list),
                    "total_holdings": len(holding_list),
                    "total_account_balance": sum(acc['balance'] for acc in account_list),
                    "total_holding_value": sum(hold['market_value_brl'] for hold in holding_list)
                }
            }
            
        except mysql.connector.Error as err:
            logger.error(f"[REPORTS_SERVICE] Erro ao buscar detalhes do snapshot: {err}")
            raise Exception(f"Erro de banco de dados: {err}")
        finally:
            cursor.close()
    
    def get_kpi_variation(self, user_id: int, period_days: int = 30) -> Dict:
        """
        Calcula a variação percentual dos KPIs entre o primeiro e último snapshot no período.
        
        Args:
            user_id: ID do usuário
            period_days: Número de dias para análise (default: 30)
            
        Returns:
            Dict com variações percentuais dos principais KPIs
        """
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"user_id inválido: {user_id}")
        
        end_date = date.today()
        start_date = end_date - timedelta(days=period_days)
        
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Buscar primeiro e último snapshot no período
            cursor.execute("""
                SELECT 
                    total_net_worth_brl,
                    invested_assets_brl,
                    crypto_portfolio_value_brl,
                    stock_portfolio_value_brl,
                    snapshot_date
                FROM daily_financial_snapshots
                WHERE user_id = %s
                AND snapshot_date BETWEEN %s AND %s
                ORDER BY snapshot_date ASC
                LIMIT 1
            """, (user_id, start_date, end_date))
            
            first_snapshot = cursor.fetchone()
            
            cursor.execute("""
                SELECT 
                    total_net_worth_brl,
                    invested_assets_brl,
                    crypto_portfolio_value_brl,
                    stock_portfolio_value_brl,
                    snapshot_date
                FROM daily_financial_snapshots
                WHERE user_id = %s
                AND snapshot_date BETWEEN %s AND %s
                ORDER BY snapshot_date DESC
                LIMIT 1
            """, (user_id, start_date, end_date))
            
            last_snapshot = cursor.fetchone()
            
            if not first_snapshot or not last_snapshot:
                return {
                    "success": False,
                    "error": "Snapshots insuficientes para cálculo de variação"
                }
            
            # Calcular variações percentuais
            def calculate_variation(old_value, new_value):
                if old_value == 0:
                    return 100.0 if new_value > 0 else 0.0
                return ((new_value - old_value) / old_value) * 100
            
            variations = {
                "net_worth": {
                    "variation_percent": calculate_variation(
                        float(first_snapshot['total_net_worth_brl']),
                        float(last_snapshot['total_net_worth_brl'])
                    ),
                    "old_value": float(first_snapshot['total_net_worth_brl']),
                    "new_value": float(last_snapshot['total_net_worth_brl'])
                },
                "invested_assets": {
                    "variation_percent": calculate_variation(
                        float(first_snapshot['invested_assets_brl']),
                        float(last_snapshot['invested_assets_brl'])
                    ),
                    "old_value": float(first_snapshot['invested_assets_brl']),
                    "new_value": float(last_snapshot['invested_assets_brl'])
                },
                "crypto_portfolio": {
                    "variation_percent": calculate_variation(
                        float(first_snapshot['crypto_portfolio_value_brl']),
                        float(last_snapshot['crypto_portfolio_value_brl'])
                    ),
                    "old_value": float(first_snapshot['crypto_portfolio_value_brl']),
                    "new_value": float(last_snapshot['crypto_portfolio_value_brl'])
                },
                "stock_portfolio": {
                    "variation_percent": calculate_variation(
                        float(first_snapshot['stock_portfolio_value_brl']),
                        float(last_snapshot['stock_portfolio_value_brl'])
                    ),
                    "old_value": float(first_snapshot['stock_portfolio_value_brl']),
                    "new_value": float(last_snapshot['stock_portfolio_value_brl'])
                }
            }
            
            return {
                "success": True,
                "period_days": period_days,
                "first_date": first_snapshot['snapshot_date'].isoformat(),
                "last_date": last_snapshot['snapshot_date'].isoformat(),
                "variations": variations
            }
            
        except mysql.connector.Error as err:
            logger.error(f"[REPORTS_SERVICE] Erro ao calcular variação de KPIs: {err}")
            return {"success": False, "error": f"Erro de banco de dados: {err}"}
        finally:
            cursor.close()
    
    def get_top_expenses(self, user_id: int, start_date: date, end_date: date) -> Dict:
        """
        Busca as 10 maiores transações de despesa no período especificado.
        
        Args:
            user_id: ID do usuário
            start_date: Data inicial do período
            end_date: Data final do período
            
        Returns:
            Dict com lista das maiores despesas
        """
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"user_id inválido: {user_id}")
        
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    t.id,
                    t.transaction_date,
                    t.description,
                    t.category,
                    t.amount,
                    t.status,
                    a_from.name as from_account_name,
                    a_to.name as to_account_name
                FROM transactions t
                LEFT JOIN accounts a_from ON t.from_account_id = a_from.id
                LEFT JOIN accounts a_to ON t.to_account_id = a_to.id
                WHERE t.user_id = %s
                AND t.type = 'DESPESA'
                AND t.transaction_date BETWEEN %s AND %s
                AND t.status = 'EFETIVADO'
                ORDER BY t.amount DESC
                LIMIT 10
            """
            
            cursor.execute(query, (user_id, start_date, end_date))
            expenses = cursor.fetchall()
            
            # Formatar dados para retorno
            expense_list = []
            for expense in expenses:
                expense_list.append({
                    'transaction_id': expense['id'],
                    'date': expense['transaction_date'].isoformat(),
                    'description': expense['description'],
                    'category': expense.get('category', 'Sem Categoria'),
                    'amount': float(expense['amount']),
                    'from_account': expense.get('from_account_name', ''),
                    'to_account': expense.get('to_account_name', ''),
                    'status': expense['status']
                })
            
            total_amount = sum(exp['amount'] for exp in expense_list)
            
            return {
                "success": True,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "total_expenses_found": len(expense_list),
                "total_amount": total_amount,
                "top_expenses": expense_list
            }
            
        except mysql.connector.Error as err:
            logger.error(f"[REPORTS_SERVICE] Erro ao buscar maiores despesas: {err}")
            return {"success": False, "error": f"Erro de banco de dados: {err}"}
        except Exception as e:
            logger.error(f"[REPORTS_SERVICE] Erro inesperado ao buscar maiores despesas: {e}")
            return {"success": False, "error": f"Erro interno: {str(e)}"}
        finally:
            cursor.close()
    
    def get_cash_flow_kpis(self, user_id: int, start_date: date, end_date: date) -> Dict:
        """
        Calcula os KPIs de fluxo de caixa para um período específico.
        Esta é a FONTE DA VERDADE para receitas, despesas e saldo.
        
        Args:
            user_id: ID do usuário
            start_date: Data inicial do período
            end_date: Data final do período
            
        Returns:
            Dict com KPIs calculados diretamente da tabela transactions
        """
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"user_id inválido: {user_id}")
        
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Query que é a fonte da verdade - soma diretamente da tabela transactions
            query = """
                SELECT 
                    SUM(IF(t.type = 'RECEITA', t.amount, 0)) as total_income,
                    SUM(IF(t.type = 'DESPESA', t.amount, 0)) as total_expense,
                    COUNT(IF(t.type = 'RECEITA', 1, NULL)) as income_count,
                    COUNT(IF(t.type = 'DESPESA', 1, NULL)) as expense_count
                FROM transactions t
                WHERE t.user_id = %s
                AND t.transaction_date BETWEEN %s AND %s
                AND t.type IN ('RECEITA', 'DESPESA')
                AND t.status = 'EFETIVADO'
            """
            
            cursor.execute(query, (user_id, start_date, end_date))
            result = cursor.fetchone()
            
            if not result:
                return {
                    "success": False,
                    "error": "Nenhuma transação encontrada"
                }
            
            # Extrair e converter valores
            total_income = float(result.get('total_income', 0) or 0)
            total_expense = float(result.get('total_expense', 0) or 0)
            balance = total_income - total_expense
            
            income_count = result.get('income_count', 0) or 0
            expense_count = result.get('expense_count', 0) or 0
            
            return {
                "success": True,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "total_income": total_income,
                "total_expense": total_expense,
                "balance": balance,
                "income_count": income_count,
                "expense_count": expense_count,
                "summary": {
                    "period_days": (end_date - start_date).days + 1,
                    "avg_daily_income": total_income / ((end_date - start_date).days + 1) if (end_date - start_date).days + 1 > 0 else 0,
                    "avg_daily_expense": total_expense / ((end_date - start_date).days + 1) if (end_date - start_date).days + 1 > 0 else 0
                }
            }
            
        except mysql.connector.Error as err:
            logger.error(f"[REPORTS_SERVICE] Erro ao calcular KPIs de fluxo de caixa: {err}")
            return {"success": False, "error": f"Erro de banco de dados: {err}"}
        except Exception as e:
            logger.error(f"[REPORTS_SERVICE] Erro inesperado ao calcular KPIs: {e}")
            return {"success": False, "error": f"Erro interno: {str(e)}"}
        finally:
            cursor.close()