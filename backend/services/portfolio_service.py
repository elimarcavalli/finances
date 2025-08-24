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
            # Nova query que inclui preços persistidos da tabela assets
            query = """
                SELECT 
                    am.asset_id,
                    a.symbol,
                    a.name as asset_name,
                    a.asset_class,
                    a.price_api_identifier,
                    a.last_price_usdt,
                    a.last_price_brl,
                    a.last_price_updated_at,
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
                GROUP BY am.asset_id, a.symbol, a.name, a.asset_class, a.price_api_identifier, 
                         a.last_price_usdt, a.last_price_brl, a.last_price_updated_at
                HAVING (total_bought - total_sold) > 0
            """
            
            cursor.execute(query, (user_id,))
            positions = cursor.fetchall()
            
            if not positions:
                return []
            
            print(f"[PORTFOLIO_SERVICE] Processando {len(positions)} posições usando preços persistidos")
            
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
                
                # Preços atuais dos preços persistidos na tabela assets
                current_price_usdt = Decimal(str(position['last_price_usdt'] or 0))
                current_price_brl = Decimal(str(position['last_price_brl'] or 0))
                
                # Valores de mercado em ambas as moedas
                market_value_usdt = current_quantity * current_price_usdt if current_price_usdt > 0 else Decimal('0.00')
                market_value_brl = current_quantity * current_price_brl if current_price_brl > 0 else Decimal('0.00')
                
                # LOG DETALHADO: Cálculo de valor por ativo
                print(f"[PORTFOLIO_SERVICE] Calculando asset {position['asset_id']} ({position['symbol']}):")
                print(f"  - current_quantity: {current_quantity}")
                print(f"  - current_price_usdt: ${current_price_usdt}")
                print(f"  - current_price_brl: R$ {current_price_brl}")
                print(f"  - market_value_usdt: ${market_value_usdt}")
                print(f"  - market_value_brl: R$ {market_value_brl}")
                
                # Lucro/prejuízo não realizado em ambas as moedas - com proteção defensiva
                invested_value = Decimal('0.00')
                unrealized_pnl_usdt = Decimal('0.00')
                unrealized_pnl_brl = Decimal('0.00')
                unrealized_pnl_percentage_usdt = 0.00
                unrealized_pnl_percentage_brl = 0.00
                
                try:
                    if current_quantity > 0 and avg_price > 0:
                        invested_value = current_quantity * avg_price
                        
                    # P&L em BRL (usando valor investido como base)
                    if market_value_brl > 0 and invested_value > 0:
                        unrealized_pnl_brl = market_value_brl - invested_value
                        unrealized_pnl_percentage_brl = float((unrealized_pnl_brl / invested_value * 100))
                    
                    # P&L em USDT (aproximado usando preço atual)
                    if market_value_usdt > 0 and invested_value > 0 and current_price_usdt > 0:
                        # Converter valor investido para USDT usando preço atual (aproximação)
                        invested_value_usdt = invested_value / current_price_brl * current_price_usdt if current_price_brl > 0 else Decimal('0.00')
                        if invested_value_usdt > 0:
                            unrealized_pnl_usdt = market_value_usdt - invested_value_usdt
                            unrealized_pnl_percentage_usdt = float((unrealized_pnl_usdt / invested_value_usdt * 100))
                        
                except (ZeroDivisionError, InvalidOperation, TypeError) as e:
                    print(f"Erro no cálculo de P&L para asset {position['asset_id']}: {e}")
                    unrealized_pnl_usdt = Decimal('0.00')
                    unrealized_pnl_brl = Decimal('0.00')
                    unrealized_pnl_percentage_usdt = 0.00
                    unrealized_pnl_percentage_brl = 0.00
                
                # Nova estrutura enriquecida conforme claude.md especificação
                portfolio_summary.append({
                    'asset_id': position.get('asset_id', 0),
                    'symbol': position.get('symbol', 'UNKNOWN'),
                    'name': position.get('asset_name', 'Unknown Asset'),
                    'asset_class': position.get('asset_class', 'UNKNOWN'),
                    'quantity': float(current_quantity) if current_quantity else 0.00,
                    
                    # Preços médios de aquisição
                    'average_price_brl': float(avg_price) if avg_price else 0.00,
                    'average_price_usdt': float(avg_price / current_price_brl * current_price_usdt) if avg_price and current_price_brl and current_price_usdt else 0.00,
                    
                    # Preços atuais de mercado
                    'current_price_brl': float(current_price_brl) if current_price_brl else 0.00,
                    'current_price_usdt': float(current_price_usdt) if current_price_usdt else 0.00,
                    'last_price_updated_at': position.get('last_price_updated_at'),
                    
                    # Valores de mercado em ambas as moedas
                    'market_value_brl': float(market_value_brl) if market_value_brl else 0.00,
                    'market_value_usdt': float(market_value_usdt) if market_value_usdt else 0.00,
                    
                    # P&L não realizado em ambas as moedas
                    'unrealized_pnl_brl': float(unrealized_pnl_brl) if unrealized_pnl_brl else 0.00,
                    'unrealized_pnl_usdt': float(unrealized_pnl_usdt) if unrealized_pnl_usdt else 0.00,
                    'unrealized_pnl_percentage_brl': unrealized_pnl_percentage_brl,
                    'unrealized_pnl_percentage_usdt': unrealized_pnl_percentage_usdt,
                    
                    # Campos legados para compatibilidade
                    'current_price': float(current_price_brl) if current_price_brl else 0.00,  # Default para BRL
                    'market_value': float(market_value_brl) if market_value_brl else 0.00,     # Default para BRL
                    'unrealized_pnl': float(unrealized_pnl_brl) if unrealized_pnl_brl else 0.00,
                    'unrealized_pnl_percentage': unrealized_pnl_percentage_brl
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