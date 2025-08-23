from .database_service import DatabaseService
from .price_service import PriceService
import mysql.connector
from decimal import Decimal, InvalidOperation
from datetime import datetime
from typing import List, Dict, Optional

class PortfolioService:
    def __init__(self, db_service: DatabaseService, price_service: PriceService):
        self.db_service = db_service
        self.price_service = price_service
    
    def add_asset_movement(self, user_id: int, movement_data: dict) -> dict:
        """Adiciona um novo movimento de ativo"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                INSERT INTO asset_movements 
                (user_id, account_id, asset_id, movement_type, movement_date, quantity, price_per_unit, fee, notes) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                user_id,
                movement_data.get('account_id'),
                movement_data.get('asset_id'),
                movement_data.get('movement_type'),
                movement_data.get('movement_date', datetime.now()),
                movement_data.get('quantity'),
                movement_data.get('price_per_unit'),
                movement_data.get('fee', 0.00),
                movement_data.get('notes')
            )
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            movement_id = cursor.lastrowid
            return {"id": movement_id, "message": "Movimento adicionado com sucesso"}
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao adicionar movimento: {err}")
        finally:
            cursor.close()
    
    def get_portfolio_summary(self, user_id: int) -> List[Dict]:
        """Obtém o resumo do portfólio com cálculo de custo médio e posições atuais"""
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"user_id inválido: {user_id}")
            
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Query principal que agrupa movimentos por ativo
            query = """
                SELECT 
                    am.asset_id,
                    a.symbol,
                    a.name as asset_name,
                    a.asset_class,
                    a.price_api_identifier,
                    SUM(CASE 
                        WHEN am.movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA', 'SINCRONIZACAO') 
                        THEN am.quantity 
                        ELSE 0 
                    END) as total_bought,
                    SUM(CASE 
                        WHEN am.movement_type IN ('VENDA', 'TRANSFERENCIA_SAIDA') 
                        THEN am.quantity 
                        ELSE 0 
                    END) as total_sold,
                    SUM(CASE 
                        WHEN am.movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA') AND am.price_per_unit IS NOT NULL
                        THEN am.quantity * am.price_per_unit 
                        ELSE 0 
                    END) as total_invested,
                    SUM(CASE 
                        WHEN am.movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA') AND am.price_per_unit IS NOT NULL
                        THEN am.quantity 
                        ELSE 0 
                    END) as weighted_quantity
                FROM asset_movements am
                JOIN assets a ON am.asset_id = a.id
                WHERE am.user_id = %s
                GROUP BY am.asset_id, a.symbol, a.name, a.asset_class, a.price_api_identifier
                HAVING (total_bought - total_sold) > 0
            """
            
            cursor.execute(query, (user_id,))
            positions = cursor.fetchall()
            
            if not positions:
                return []
            
            # Obter preços atuais dos ativos
            crypto_assets = [pos for pos in positions if pos['asset_class'] == 'CRIPTO' and pos['price_api_identifier']]
            current_prices = {}
            
            if crypto_assets:
                api_ids = [asset['price_api_identifier'] for asset in crypto_assets]
                
                # LOG DETALHADO: Lista de price_api_identifier sendo enviada
                print(f"[PORTFOLIO_SERVICE] Enviando para price_service: {api_ids}")
                
                try:
                    # Usar o price_service de forma assíncrona dentro do contexto
                    import asyncio
                    async def get_prices():
                        async with self.price_service as price_svc:
                            crypto_prices_usd = await price_svc.get_crypto_prices_in_usd(api_ids)
                            usd_to_brl_rate = await price_svc.get_usd_to_brl_rate()
                            return crypto_prices_usd, usd_to_brl_rate
                    
                    loop = asyncio.get_event_loop()
                    crypto_prices_usd, usd_to_brl_rate = loop.run_until_complete(get_prices())
                    
                    # LOG DETALHADO: Dicionário de preços retornado
                    print(f"[PORTFOLIO_SERVICE] Preços recebidos do price_service: {crypto_prices_usd}")
                    print(f"[PORTFOLIO_SERVICE] Taxa USD/BRL: {usd_to_brl_rate}")
                    
                    # Converter preços USD para BRL
                    for asset in crypto_assets:
                        api_id = asset['price_api_identifier']
                        print(f"[PORTFOLIO_SERVICE] Asset {asset['asset_id']} ({asset['symbol']}) - price_api_identifier: {api_id}")
                        if api_id in crypto_prices_usd:
                            price_usd = Decimal(str(crypto_prices_usd[api_id]))
                            current_prices[asset['asset_id']] = price_usd * Decimal(str(usd_to_brl_rate))
                            print(f"[PORTFOLIO_SERVICE] Preço encontrado: ${price_usd} USD = R$ {current_prices[asset['asset_id']]}")
                        else:
                            print(f"[PORTFOLIO_SERVICE] ATENÇÃO: Preço não encontrado para {api_id}")
                
                except Exception as e:
                    print(f"[PORTFOLIO_SERVICE] Erro ao obter preços: {e}")
            
            # Processar cada posição
            portfolio_summary = []
            for position in positions:
                current_quantity = Decimal(str(position['total_bought'])) - Decimal(str(position['total_sold']))
                
                # Calcular preço médio ponderado (apenas para compras com preço) - com proteção contra divisão por zero
                avg_price = Decimal('0.00')
                weighted_qty = position.get('weighted_quantity') or 0
                total_invested = position.get('total_invested') or 0
                
                if weighted_qty and weighted_qty > 0 and total_invested > 0:
                    try:
                        avg_price = Decimal(str(total_invested)) / Decimal(str(weighted_qty))
                    except (ZeroDivisionError, InvalidOperation) as e:
                        print(f"Erro no cálculo de preço médio para asset {position['asset_id']}: {e}")
                        avg_price = Decimal('0.00')
                
                # Preço atual e valor de mercado
                current_price = current_prices.get(position['asset_id'], Decimal('0.00'))
                market_value = current_quantity * current_price if current_price > 0 else Decimal('0.00')
                
                # LOG DETALHADO: Cálculo de valor por ativo
                print(f"[PORTFOLIO_SERVICE] Calculando asset {position['asset_id']} ({position['symbol']}):")
                print(f"  - price_api_identifier: {position['price_api_identifier']}")
                print(f"  - current_quantity: {current_quantity}")
                print(f"  - current_price: R$ {current_price}")
                print(f"  - market_value: R$ {market_value}")
                
                # Lucro/prejuízo não realizado - com proteção defensiva
                invested_value = Decimal('0.00')
                unrealized_pnl = Decimal('0.00')
                unrealized_pnl_percentage = 0.00
                
                try:
                    if current_quantity > 0 and avg_price > 0:
                        invested_value = current_quantity * avg_price
                        
                    if market_value > 0 and invested_value > 0:
                        unrealized_pnl = market_value - invested_value
                        unrealized_pnl_percentage = float((unrealized_pnl / invested_value * 100))
                        
                except (ZeroDivisionError, InvalidOperation, TypeError) as e:
                    print(f"Erro no cálculo de P&L para asset {position['asset_id']}: {e}")
                    unrealized_pnl = Decimal('0.00')
                    unrealized_pnl_percentage = 0.00
                
                # Garantir que os campos críticos estejam sempre presentes
                portfolio_summary.append({
                    'asset_id': position.get('asset_id', 0),
                    'symbol': position.get('symbol', 'UNKNOWN'),
                    'name': position.get('asset_name', 'Unknown Asset'),
                    'asset_class': position.get('asset_class', 'UNKNOWN'),
                    'quantity': float(current_quantity) if current_quantity else 0.00,
                    'average_price': float(avg_price) if avg_price else 0.00,
                    'current_price': float(current_price) if current_price else 0.00,
                    'market_value': float(market_value) if market_value else 0.00,
                    'market_value_brl': float(market_value) if market_value else 0.00,  # Campo explícito para BRL
                    'unrealized_pnl': float(unrealized_pnl) if unrealized_pnl else 0.00,
                    'unrealized_pnl_percentage': unrealized_pnl_percentage
                })
            
            return portfolio_summary
            
        except mysql.connector.Error as err:
            raise Exception(f"Erro ao obter resumo do portfólio: {err}")
        finally:
            cursor.close()
    
    def get_asset_movements_history(self, user_id: int, asset_id: int) -> List[Dict]:
        """Obtém o histórico de movimentos de um ativo específico"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    am.*,
                    a.symbol,
                    a.name as asset_name,
                    acc.name as account_name
                FROM asset_movements am
                JOIN assets a ON am.asset_id = a.id
                JOIN accounts acc ON am.account_id = acc.id
                WHERE am.user_id = %s AND am.asset_id = %s
                ORDER BY am.movement_date DESC, am.id DESC
            """
            
            cursor.execute(query, (user_id, asset_id))
            movements = cursor.fetchall()
            
            # Converter Decimal para float para JSON serialization
            for movement in movements:
                for key, value in movement.items():
                    if isinstance(value, Decimal):
                        movement[key] = float(value)
            
            return movements
            
        except mysql.connector.Error as err:
            raise Exception(f"Erro ao obter histórico de movimentos: {err}")
        finally:
            cursor.close()
    
    def get_total_portfolio_value(self, user_id: int) -> Decimal:
        """Calcula o valor total do portfólio em BRL"""
        try:
            portfolio = self.get_portfolio_summary(user_id)
            total_value = Decimal('0.00')
            
            for position in portfolio:
                total_value += Decimal(str(position['market_value']))
            
            return total_value
            
        except Exception as err:
            raise Exception(f"Erro ao calcular valor total do portfólio: {err}")