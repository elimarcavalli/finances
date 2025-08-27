"""
Serviço de Sumarização Financeira
Responsável pelos cálculos de BI do dashboard financeiro
"""

from typing import Dict, List, Any, Optional
from decimal import Decimal
from datetime import datetime, date
from services.database_service import DatabaseService
from services.price_service import PriceService
from services.portfolio_service import PortfolioService
from services.account_service import AccountService
from services.obligation_service import ObligationService
import mysql.connector


class SummaryService:
    def __init__(self, database_service: DatabaseService):
        self.db = database_service
        self.price_service = PriceService()
        self.portfolio_service = PortfolioService(database_service, self.price_service)
        self.account_service = AccountService(database_service)
        # Importação circular resolvida: instanciar apenas quando necessário
        self.obligation_service = None

    def _get_obligation_service(self):
        """Lazy loading do obligation_service para evitar importação circular"""
        if self.obligation_service is None:
            from services.transaction_service import TransactionService
            transaction_service = TransactionService(self.db)
            self.obligation_service = ObligationService(self.db, transaction_service)
        return self.obligation_service

    def get_dashboard_summary(self, user_id: int) -> Dict[str, Any]:
        """
        Calcula todos os KPIs do dashboard em uma única operação
        """
        cursor = self.db.connection.cursor(dictionary=True)
        
        try:
            # 1. Calcular totalCash ("Pilas") - contas corrente, poupança, dinheiro vivo
            total_cash = self._calculate_total_cash(cursor, user_id)
            
            # 2. Calcular totalInvested - usando novo portfolio_service
            total_invested = self.portfolio_service.get_total_portfolio_value(user_id)
            
            # 3. Calcular totalLiabilities - dívidas (cartão de crédito, etc.)
            total_liabilities = self._calculate_total_liabilities(cursor, user_id)
            
            # 4. Calcular investmentCash - saldo em caixa de contas de investimento
            investment_cash = self._calculate_investment_cash(cursor, user_id)
            
            # 5. Calcular netWorth usando nova fórmula
            # netWorth = totalInvested + totalCash + investmentCash - totalLiabilities
            net_worth = total_invested + total_cash + investment_cash - total_liabilities
            
            # 6. Calcular assetAllocation
            asset_allocation = self._calculate_asset_allocation(cursor, user_id, total_invested)
            
            # 7. Buscar accountSummary
            account_summary = self._get_account_summary(cursor, user_id)
            
            # 8. Calcular cryptoPortfolio (Passo 24)
            crypto_portfolio = self._calculate_crypto_portfolio(cursor, user_id)
            
            # 9. Calcular obrigações + recurring rules (obligation_service já inclui tudo)
            obligations_service = self._get_obligation_service()
            obligations_summary = obligations_service.get_obligations_summary_30d(user_id)
            
            # CORREÇÃO: obligation_service já inclui recurring rules, não somar novamente
            upcoming_receivables = {
                "total": obligations_summary.get('receivable_next_30d', 0.0),
                "count": self._count_upcoming_obligations(cursor, user_id, 'RECEIVABLE') + self._count_active_recurring_rules(cursor, user_id, 'RECEIVABLE')
            }
            upcoming_payables = {
                "total": obligations_summary.get('payable_next_30d', 0.0), 
                "count": self._count_upcoming_obligations(cursor, user_id, 'PAYABLE') + self._count_active_recurring_rules(cursor, user_id, 'PAYABLE')
            }
            
            return {
                "netWorth": float(net_worth),
                "totalInvested": float(total_invested),
                "totalCash": float(total_cash),
                "totalLiabilities": float(total_liabilities),
                "investmentCash": float(investment_cash),
                "assetAllocation": asset_allocation,
                "accountSummary": account_summary,
                "cryptoPortfolio": crypto_portfolio,
                "upcomingReceivables": upcoming_receivables,
                "upcomingPayables": upcoming_payables
            }
            
        finally:
            cursor.close()

    def _calculate_total_cash(self, cursor, user_id: int) -> Decimal:
        """
        Calcula o total em caixa usando saldo dinâmico (CONTA_CORRENTE, POUPANCA, DINHEIRO_VIVO)
        """
        query = """
            SELECT 
                COALESCE(SUM(
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
                        AND t.status = 'EFETIVADO'), 
                        0.00
                    )
                ), 0) as total_cash
            FROM accounts a
            WHERE a.user_id = %s 
            AND a.type IN ('CONTA_CORRENTE', 'POUPANCA', 'DINHEIRO_VIVO')
        """
        cursor.execute(query, (user_id,))
        result = cursor.fetchone()
        return Decimal(str(result['total_cash'] or 0))


    def _calculate_asset_allocation(self, cursor, user_id: int, total_invested: Decimal) -> List[Dict[str, Any]]:
        """
        Calcula a alocação por classe de ativo usando o portfolio_service
        """
        if total_invested == 0:
            return []
        
        try:
            portfolio_summary = self.portfolio_service.get_portfolio_summary(user_id)
            
            if not portfolio_summary:
                return []
            
            # Agrupar por classe de ativo
            class_totals = {}
            
            for position in portfolio_summary:
                asset_class = position['asset_class']
                market_value = Decimal(str(position['market_value']))
                
                if asset_class not in class_totals:
                    class_totals[asset_class] = Decimal('0')
                class_totals[asset_class] += market_value
            
            # Converter para lista com percentuais
            allocation = []
            for asset_class, value in class_totals.items():
                if value > 0:
                    percentage = (value / total_invested * 100) if total_invested > 0 else 0
                    allocation.append({
                        "class": asset_class,
                        "value": float(value),
                        "percentage": round(float(percentage), 2)
                    })
            
            return allocation
            
        except Exception as e:
            print(f"Erro ao calcular asset allocation: {e}")
            return []

    def _get_account_summary(self, cursor, user_id: int) -> List[Dict[str, Any]]:
        """
        Busca resumo de todas as contas do usuário com saldo dinâmico
        """
        # Usar o account_service que já calcula saldo dinamicamente
        accounts = self.account_service.get_accounts_by_user(user_id)
        
        # Converter Decimal para float para serialização JSON
        for account in accounts:
            account['balance'] = float(account['balance']) if account['balance'] else 0.0
        
        return accounts

    def _calculate_total_liabilities(self, cursor, user_id: int) -> Decimal:
        """
        Calcula o total de passivos (dívidas) usando saldo dinâmico - CARTAO_CREDITO e outros tipos de dívidas
        """
        query = """
            SELECT 
                COALESCE(SUM(ABS(
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
                        AND t.status = 'EFETIVADO'), 
                        0.00
                    )
                )), 0) as total_liabilities
            FROM accounts a
            WHERE a.user_id = %s 
            AND a.type IN ('CARTAO_CREDITO')
        """
        cursor.execute(query, (user_id,))
        result = cursor.fetchone()
        return Decimal(str(result['total_liabilities'] or 0))

    def _calculate_investment_cash(self, cursor, user_id: int) -> Decimal:
        """
        Calcula o saldo em caixa de contas de investimento usando saldo dinâmico
        (CORRETORA_NACIONAL, CORRETORA_CRIPTO, CARTEIRA_CRIPTO)
        """
        query = """
            SELECT 
                COALESCE(SUM(
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
                        AND t.status = 'EFETIVADO'), 
                        0.00
                    )
                ), 0) as investment_cash
            FROM accounts a
            WHERE a.user_id = %s 
            AND a.type IN ('CORRETORA_NACIONAL', 'CORRETORA_CRIPTO', 'CARTEIRA_CRIPTO', 'CORRETORA_INTERNACIONAL')
        """
        cursor.execute(query, (user_id,))
        result = cursor.fetchone()
        return Decimal(str(result['investment_cash'] or 0))

    def get_cash_flow_chart_data(self, user_id: int, period: str = 'monthly') -> List[Dict[str, Any]]:
        """
        Calcula dados do gráfico de fluxo de caixa por período
        """
        cursor = self.db.connection.cursor(dictionary=True)
        
        try:
            # Determinar formato de data e período
            if period == "daily":
                date_format = "%Y-%m-%d"
                days_back = 30
            elif period == "weekly":
                date_format = "%Y-%u"  # Year-Week
                days_back = 90
            elif period == "monthly":
                date_format = "%Y-%m"
                days_back = 365
            else:
                date_format = "%Y-%m"
                days_back = 365
            
            # Query com agregação condicional
            query = f"""
                SELECT 
                    DATE_FORMAT(t.transaction_date, %s) as period_key,
                    SUM(IF(t.type = 'RECEITA', t.amount, 0)) as income,
                    SUM(IF(t.type = 'DESPESA', t.amount, 0)) as expense
                FROM transactions t
                WHERE t.user_id = %s 
                AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                AND t.type IN ('RECEITA', 'DESPESA')
                GROUP BY period_key
                ORDER BY period_key
            """
            
            cursor.execute(query, (date_format, user_id, days_back))
            results = cursor.fetchall()
            
            # Formatar dados para o gráfico
            chart_data = []
            for result in results:
                chart_data.append({
                    "date": result['period_key'],
                    "income": float(result['income'] or 0),
                    "expense": float(result['expense'] or 0)
                })
            
            return chart_data
            
        finally:
            cursor.close()

    def get_cash_flow_chart_data_by_period(self, user_id: int, start_date: date, end_date: date, period: str = 'monthly') -> List[Dict[str, Any]]:
        """
        Calcula dados do gráfico de fluxo de caixa por período específico
        """
        cursor = self.db.connection.cursor(dictionary=True)
        
        try:
            # Determinar formato de data
            if period == "daily":
                date_format = "%Y-%m-%d"
            elif period == "weekly":
                date_format = "%Y-%u"  # Year-Week
            elif period == "monthly":
                date_format = "%Y-%m"
            else:
                date_format = "%Y-%m"
            
            # Query com período específico
            query = f"""
                SELECT 
                    DATE_FORMAT(t.transaction_date, %s) as period_key,
                    SUM(IF(t.type = 'RECEITA', t.amount, 0)) as income,
                    SUM(IF(t.type = 'DESPESA', t.amount, 0)) as expense
                FROM transactions t
                WHERE t.user_id = %s 
                AND t.transaction_date BETWEEN %s AND %s
                AND t.type IN ('RECEITA', 'DESPESA')
                AND t.status = 'EFETIVADO'
                GROUP BY period_key
                ORDER BY period_key
            """
            
            cursor.execute(query, (date_format, user_id, start_date, end_date))
            results = cursor.fetchall()
            
            # Formatar dados para o gráfico
            chart_data = []
            for result in results:
                # Converter format de volta para algo mais legível
                period_key = result['period_key']
                if period == "monthly":
                    # Converter "2025-08" para "Ago/2025"
                    year, month = period_key.split('-')
                    month_names = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                                 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                    month_display = f"{month_names[int(month)]}/{year}"
                else:
                    month_display = period_key
                
                chart_data.append({
                    "month": month_display,
                    "period_key": period_key,
                    "income": float(result['income'] or 0),
                    "expense": float(result['expense'] or 0)
                })
            
            return chart_data
            
        finally:
            cursor.close()

    def _calculate_crypto_portfolio(self, cursor, user_id: int) -> Dict[str, Any]:
        """
        Calcula o portfólio cripto usando o novo portfolio_service
        """
        try:
            portfolio_summary = self.portfolio_service.get_portfolio_summary(user_id)
            
            # Filtrar apenas ativos de classe CRIPTO
            crypto_holdings = [
                position for position in portfolio_summary 
                if position['asset_class'] == 'CRIPTO'
            ]
            
            if not crypto_holdings:
                return {
                    "total_value": 0.0,
                    "top_holdings": []
                }
            
            # Calcular valor total e preparar top holdings
            total_value = sum(holding['market_value'] for holding in crypto_holdings)
            
            # Ordenar por valor de mercado e pegar top 5
            crypto_holdings.sort(key=lambda x: x['market_value'], reverse=True)
            top_holdings = []
            
            for holding in crypto_holdings[:5]:
                top_holdings.append({
                    "symbol": holding['symbol'],
                    "name": holding['name'],
                    "quantity": holding['quantity'],
                    "value": holding['market_value'],
                    "price": holding['current_price']
                })
            
            return {
                "total_value": float(total_value),
                "top_holdings": top_holdings
            }
            
        except Exception as e:
            print(f"Erro ao calcular portfólio cripto: {e}")
            return {
                "total_value": 0.0,
                "top_holdings": []
            }
    
    def create_daily_snapshot(self, user_id: int) -> Dict[str, Any]:
        """
        Cria um snapshot diário do patrimônio líquido do usuário
        """
        cursor = self.db.connection.cursor(dictionary=True)
        
        try:
            # Calcular saldo total de todas as contas
            total_cash = self._calculate_total_cash(cursor, user_id)
            investment_cash = self._calculate_investment_cash(cursor, user_id)
            total_liabilities = self._calculate_total_liabilities(cursor, user_id)
            
            # Calcular valor total do portfólio de ativos
            total_invested = self.portfolio_service.get_total_portfolio_value(user_id)
            
            # Calcular patrimônio líquido total
            total_net_worth = total_invested + total_cash + investment_cash - total_liabilities
            
            # Inserir ou atualizar snapshot na tabela
            cursor.execute("""
                INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_net_worth)
                VALUES (%s, CURDATE(), %s)
                ON DUPLICATE KEY UPDATE 
                total_net_worth = %s,
                created_at = CURRENT_TIMESTAMP
            """, (user_id, float(total_net_worth), float(total_net_worth)))
            
            self.db.connection.commit()
            
            return {
                "success": True,
                "user_id": user_id,
                "snapshot_date": datetime.now().strftime('%Y-%m-%d'),
                "total_net_worth": float(total_net_worth),
                "breakdown": {
                    "total_cash": float(total_cash),
                    "investment_cash": float(investment_cash),
                    "total_invested": float(total_invested),
                    "total_liabilities": float(total_liabilities)
                }
            }
            
        except mysql.connector.Error as err:
            self.db.connection.rollback()
            raise Exception(f"Erro ao criar snapshot diário: {err}")
        finally:
            cursor.close()
    
    def get_net_worth_history(self, user_id: int, days_limit: int = 365) -> List[Dict[str, Any]]:
        """
        Obtém o histórico de snapshots de patrimônio líquido
        """
        cursor = self.db.connection.cursor(dictionary=True)
        
        try:
            query = """
                SELECT 
                    snapshot_date,
                    total_net_worth,
                    created_at
                FROM net_worth_snapshots 
                WHERE user_id = %s 
                AND snapshot_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                ORDER BY snapshot_date ASC
            """
            
            cursor.execute(query, (user_id, days_limit))
            snapshots = cursor.fetchall()
            
            # Converter para formato apropriado para gráficos
            history = []
            for snapshot in snapshots:
                history.append({
                    "date": snapshot['snapshot_date'].strftime('%Y-%m-%d'),
                    "net_worth": float(snapshot['total_net_worth']),
                    "created_at": snapshot['created_at'].isoformat() if snapshot['created_at'] else None
                })
            
            return history
            
        except mysql.connector.Error as err:
            raise Exception(f"Erro ao buscar histórico de patrimônio: {err}")
        finally:
            cursor.close()

    def _count_upcoming_obligations(self, cursor, user_id: int, obligation_type: str) -> int:
        """
        Conta quantas obrigações existem nos próximos 30 dias por tipo
        """
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM financial_obligations 
                WHERE user_id = %s 
                AND type = %s
                AND status IN ('PENDING', 'OVERDUE')
                AND YEAR(due_date) = YEAR(CURDATE()) 
                AND MONTH(due_date) = MONTH(CURDATE())
            """, (user_id, obligation_type))
            
            result = cursor.fetchone()
            return result['count'] if result else 0
            
        except mysql.connector.Error as err:
            print(f"Error counting upcoming obligations: {err}")
            return 0

    def _calculate_pending_recurring_rules(self, cursor, user_id: int, rule_type: str) -> float:
        """
        Calcula o valor total das recurring rules ativas que ainda não foram liquidadas no mês atual
        Lógica: Se uma recurring rule não foi liquidada ainda este mês, ela deve aparecer no fluxo de caixa
        """
        try:
            # Buscar recurring rules ativas que ainda não foram liquidadas no mês atual
            cursor.execute("""
                SELECT rr.id, rr.amount
                FROM recurring_rules rr
                WHERE rr.user_id = %s 
                AND rr.type = %s
                AND rr.is_active = 1
                AND NOT EXISTS (
                    SELECT 1 
                    FROM financial_obligations fo
                    WHERE fo.recurring_rule_id = rr.id 
                    AND YEAR(fo.due_date) = YEAR(CURDATE())
                    AND MONTH(fo.due_date) = MONTH(CURDATE())
                    AND fo.status = 'PAID'
                )
            """, (user_id, rule_type))
            
            results = cursor.fetchall()
            total = sum(float(result['amount']) for result in results if result['amount'])
            
            return total
            
        except mysql.connector.Error as err:
            print(f"Error calculating pending recurring rules: {err}")
            return 0.0

    def _count_active_recurring_rules(self, cursor, user_id: int, rule_type: str) -> int:
        """
        Conta quantas recurring rules ativas ainda não foram liquidadas no mês atual
        """
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM recurring_rules rr
                WHERE rr.user_id = %s 
                AND rr.type = %s
                AND rr.is_active = 1
                AND NOT EXISTS (
                    SELECT 1 
                    FROM financial_obligations fo
                    WHERE fo.recurring_rule_id = rr.id 
                    AND YEAR(fo.due_date) = YEAR(CURDATE())
                    AND MONTH(fo.due_date) = MONTH(CURDATE())
                    AND fo.status = 'PAID'
                )
            """, (user_id, rule_type))
            
            result = cursor.fetchone()
            return result['count'] if result else 0
            
        except mysql.connector.Error as err:
            print(f"Error counting active recurring rules: {err}")
            return 0