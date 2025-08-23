"""
Serviço de Sumarização Financeira
Responsável pelos cálculos de BI do dashboard financeiro
"""

from typing import Dict, List, Any, Optional
from decimal import Decimal
from services.database_service import DatabaseService
from services.price_service import PriceService


class SummaryService:
    def __init__(self, database_service: DatabaseService):
        self.db = database_service
        self.price_service = PriceService()

    def get_dashboard_summary(self, user_id: int) -> Dict[str, Any]:
        """
        Calcula todos os KPIs do dashboard em uma única operação
        """
        cursor = self.db.connection.cursor(dictionary=True)
        
        try:
            # 1. Calcular totalCash ("Pilas") - contas corrente, poupança, dinheiro vivo
            total_cash = self._calculate_total_cash(cursor, user_id)
            
            # 2. Calcular totalInvested - valor de mercado dos asset_holdings
            total_invested = self._calculate_total_invested(cursor, user_id)
            
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
            
            # 9. Placeholders para funcionalidades futuras
            upcoming_receivables = {"total": 0.00, "count": 0}
            upcoming_payables = {"total": 0.00, "count": 0}
            
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
        Calcula o total em caixa (CONTA_CORRENTE, POUPANCA, DINHEIRO_VIVO)
        """
        query = """
            SELECT COALESCE(SUM(balance), 0) as total_cash
            FROM accounts 
            WHERE user_id = %s 
            AND type IN ('CONTA_CORRENTE', 'POUPANCA', 'DINHEIRO_VIVO')
        """
        cursor.execute(query, (user_id,))
        result = cursor.fetchone()
        return Decimal(str(result['total_cash'] or 0))

    def _calculate_total_invested(self, cursor, user_id: int) -> Decimal:
        """
        Calcula o valor total investido baseado nos holdings e preços atuais
        """
        # Buscar todas as posições do usuário
        query = """
            SELECT 
                ah.quantity,
                a.price_api_identifier,
                a.symbol
            FROM asset_holdings ah
            JOIN accounts acc ON ah.account_id = acc.id
            JOIN assets a ON ah.asset_id = a.id
            WHERE acc.user_id = %s
        """
        cursor.execute(query, (user_id,))
        holdings = cursor.fetchall()
        
        if not holdings:
            return Decimal('0')
        
        total_value = Decimal('0')
        
        # Coletar identificadores únicos de API para buscar preços em lote
        api_identifiers = list(set([
            h['price_api_identifier'] 
            for h in holdings 
            if h['price_api_identifier']
        ]))
        
        # Buscar preços atuais
        prices = {}
        if api_identifiers:
            try:
                prices = self.price_service.get_multiple_prices(api_identifiers)
            except Exception as e:
                print(f"Erro ao buscar preços: {e}")
        
        # Calcular valor de mercado de cada posição
        for holding in holdings:
            api_id = holding.get('price_api_identifier')
            quantity = Decimal(str(holding['quantity']))
            
            if api_id and api_id in prices and prices[api_id]:
                current_price = Decimal(str(prices[api_id]['brl']))
                market_value = quantity * current_price
                total_value += market_value
        
        return total_value

    def _calculate_asset_allocation(self, cursor, user_id: int, total_invested: Decimal) -> List[Dict[str, Any]]:
        """
        Calcula a alocação por classe de ativo
        """
        if total_invested == 0:
            return []
        
        # Buscar holdings agrupados por classe
        query = """
            SELECT 
                a.asset_class,
                ah.quantity,
                a.price_api_identifier
            FROM asset_holdings ah
            JOIN accounts acc ON ah.account_id = acc.id
            JOIN assets a ON ah.asset_id = a.id
            WHERE acc.user_id = %s
        """
        cursor.execute(query, (user_id,))
        holdings = cursor.fetchall()
        
        if not holdings:
            return []
        
        # Agrupar por classe de ativo
        class_totals = {}
        
        # Coletar preços
        api_identifiers = list(set([
            h['price_api_identifier'] 
            for h in holdings 
            if h['price_api_identifier']
        ]))
        
        prices = {}
        if api_identifiers:
            try:
                prices = self.price_service.get_multiple_prices(api_identifiers)
            except Exception:
                pass
        
        # Calcular valor por classe
        for holding in holdings:
            asset_class = holding['asset_class']
            api_id = holding.get('price_api_identifier')
            quantity = Decimal(str(holding['quantity']))
            
            if api_id and api_id in prices and prices[api_id]:
                current_price = Decimal(str(prices[api_id]['brl']))
                value = quantity * current_price
                
                if asset_class not in class_totals:
                    class_totals[asset_class] = Decimal('0')
                class_totals[asset_class] += value
        
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

    def _get_account_summary(self, cursor, user_id: int) -> List[Dict[str, Any]]:
        """
        Busca resumo de todas as contas do usuário
        """
        query = """
            SELECT id, name, type, balance
            FROM accounts 
            WHERE user_id = %s
            ORDER BY name
        """
        cursor.execute(query, (user_id,))
        accounts = cursor.fetchall()
        
        # Converter Decimal para float para serialização JSON
        for account in accounts:
            account['balance'] = float(account['balance']) if account['balance'] else 0.0
        
        return accounts

    def _calculate_total_liabilities(self, cursor, user_id: int) -> Decimal:
        """
        Calcula o total de passivos (dívidas) - CARTAO_CREDITO e outros tipos de dívidas
        """
        query = """
            SELECT COALESCE(SUM(ABS(balance)), 0) as total_liabilities
            FROM accounts 
            WHERE user_id = %s 
            AND type IN ('CARTAO_CREDITO')
        """
        cursor.execute(query, (user_id,))
        result = cursor.fetchone()
        return Decimal(str(result['total_liabilities'] or 0))

    def _calculate_investment_cash(self, cursor, user_id: int) -> Decimal:
        """
        Calcula o saldo em caixa de contas de investimento
        (CORRETORA_NACIONAL, CORRETORA_CRIPTO, CARTEIRA_CRIPTO)
        """
        query = """
            SELECT COALESCE(SUM(balance), 0) as investment_cash
            FROM accounts 
            WHERE user_id = %s 
            AND type IN ('CORRETORA_NACIONAL', 'CORRETORA_CRIPTO', 'CARTEIRA_CRIPTO', 'CORRETORA_INTERNACIONAL')
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

    def _calculate_crypto_portfolio(self, cursor, user_id: int) -> Dict[str, Any]:
        """
        Calcula o portfólio cripto (valor total e principais holdings)
        baseado nos asset_holdings onde asset_class = 'CRIPTO'
        """
        query = """
            SELECT 
                a.symbol,
                a.name,
                ah.quantity,
                a.price_api_identifier
            FROM asset_holdings ah
            JOIN accounts acc ON ah.account_id = acc.id
            JOIN assets a ON ah.asset_id = a.id
            WHERE acc.user_id = %s 
            AND a.asset_class = 'CRIPTO'
            ORDER BY ah.quantity * 
                (SELECT COALESCE(price_brl, 0) 
                 FROM asset_prices 
                 WHERE price_api_identifier = a.price_api_identifier 
                 ORDER BY updated_at DESC LIMIT 1) DESC
        """
        
        cursor.execute(query, (user_id,))
        crypto_holdings = cursor.fetchall()
        
        if not crypto_holdings:
            return {
                "total_value": 0.0,
                "top_holdings": []
            }
        
        # Coletar identificadores únicos de API
        api_identifiers = list(set([h['price_api_identifier'] for h in crypto_holdings if h['price_api_identifier']]))
        
        total_value = Decimal('0')
        holdings_with_value = []
        
        if api_identifiers:
            # Buscar preços em lote
            prices = self.price_service.get_multiple_prices(api_identifiers)
            
            # Calcular valor para cada holding
            for holding in crypto_holdings:
                api_id = holding.get('price_api_identifier')
                if api_id and api_id in prices and prices[api_id]:
                    price_data = prices[api_id]
                    value = float(holding['quantity']) * price_data['brl']
                    total_value += Decimal(str(value))
                    
                    holdings_with_value.append({
                        "symbol": holding['symbol'],
                        "name": holding['name'],
                        "quantity": float(holding['quantity']),
                        "value": value,
                        "price": price_data['brl']
                    })
        
        # Ordenar por valor e pegar top 5
        holdings_with_value.sort(key=lambda x: x['value'], reverse=True)
        top_holdings = holdings_with_value[:5]
        
        return {
            "total_value": float(total_value),
            "top_holdings": top_holdings
        }