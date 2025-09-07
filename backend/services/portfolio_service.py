from .database_service import DatabaseService
from .price_service import PriceService
import mysql.connector
from decimal import Decimal, InvalidOperation
from datetime import datetime
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

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

    def add_swap_movement(self, user_id: int, swap_data: dict) -> dict:
        """
        Adiciona uma operação de SWAP atômica entre dois criptoativos.
        
        Args:
            user_id: ID do usuário
            swap_data: Dict contendo dados do SWAP:
                - from_asset_id: ID do ativo vendido
                - to_asset_id: ID do ativo comprado  
                - from_quantity: Quantidade vendida
                - to_quantity: Quantidade comprada
                - movement_date: Data/hora da operação
                - account_id: ID da conta
                - fee: Taxa da operação (opcional)
                - notes: Observações (opcional)
                
        Returns:
            Dict com IDs dos movimentos criados
        """
        logger.info(f"Iniciando operação de SWAP para usuário {user_id}")
        
        # Validações de entrada
        required_fields = ['from_asset_id', 'to_asset_id', 'from_quantity', 'to_quantity', 'movement_date', 'account_id']
        for field in required_fields:
            if field not in swap_data or swap_data[field] is None:
                raise ValueError(f"Campo obrigatório ausente: {field}")
        
        if swap_data['from_asset_id'] == swap_data['to_asset_id']:
            raise ValueError("Não é possível fazer SWAP do mesmo ativo")
        
        if Decimal(str(swap_data['from_quantity'])) <= 0 or Decimal(str(swap_data['to_quantity'])) <= 0:
            raise ValueError("Quantidades devem ser positivas")
        
        # Garantir conexão ativa para transação ACID
        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            # INÍCIO DA TRANSAÇÃO ATÔMICA
            # Verificar se já existe uma transação ativa
            if not self.db_service.connection.in_transaction:
                self.db_service.connection.start_transaction()
            
            # 1. Buscar dados dos ativos para validação e cálculo de preços históricos
            cursor.execute("""
                SELECT id, symbol, name, asset_class, price_api_identifier 
                FROM assets 
                WHERE id IN (%s, %s)
            """, (swap_data['from_asset_id'], swap_data['to_asset_id']))
            
            assets = cursor.fetchall()
            if len(assets) != 2:
                raise ValueError("Um ou ambos os ativos não foram encontrados")
            
            # Organizar assets por ID para facilitar acesso
            assets_dict = {asset['id']: asset for asset in assets}
            from_asset = assets_dict[swap_data['from_asset_id']]
            to_asset = assets_dict[swap_data['to_asset_id']]
            
            # Validar que ambos são criptoativos
            if from_asset['asset_class'] != 'CRIPTO' or to_asset['asset_class'] != 'CRIPTO':
                raise ValueError("SWAP só é permitido entre criptoativos")
            
            logger.info(f"SWAP: {from_asset['symbol']} -> {to_asset['symbol']} em {swap_data['movement_date']}")
            
            # 2. Buscar preço histórico do ativo vendido (FROM) em BRL para calcular cost_basis_brl
            # Tratar diferentes formatos de data que podem vir do frontend
            movement_date_input = swap_data['movement_date']
            logger.info(f"[movement_date] Recebido: {movement_date_input} (tipo: {type(movement_date_input)})")
            
            try:
                # Se já for um objeto datetime, usar diretamente
                if isinstance(movement_date_input, datetime):
                    movement_datetime = movement_date_input
                    logger.info(f"[movement_datetime] Já é datetime: {movement_datetime}")
                else:
                    # Converter string para datetime
                    movement_date_str = str(movement_date_input)
                    
                    # Se for ISO string com Z, remover e converter
                    if movement_date_str.endswith('Z'):
                        movement_datetime = datetime.fromisoformat(movement_date_str.replace('Z', '+00:00'))
                    # Se for ISO string sem timezone, tratar como UTC
                    elif 'T' in movement_date_str and '+' not in movement_date_str:
                        movement_datetime = datetime.fromisoformat(movement_date_str)
                    # Se for apenas data (YYYY-MM-DD), adicionar hora
                    elif len(movement_date_str) == 10:
                        movement_datetime = datetime.fromisoformat(movement_date_str + ' 00:00:00')
                    else:
                        movement_datetime = datetime.fromisoformat(movement_date_str)
                        
                    logger.info(f"[movement_datetime] Convertido de string: {movement_datetime}")
                    
            except (ValueError, TypeError) as ve:
                logger.error(f"Erro ao converter data: {movement_date_input} - {ve}")
                raise ValueError(f"Formato de data inválido: {movement_date_input}")  
            
            from_api_id = from_asset['price_api_identifier']
            if not from_api_id:
                raise ValueError(f"price_api_identifier não configurado para {from_asset['symbol']}")
            
            logger.info(f"Buscando preço histórico para {from_api_id} em {movement_datetime}")
            from_price_brl = self.price_service.get_historical_crypto_price_in_brl(from_api_id, movement_datetime)
            logger.info(f"Preço obtido: {from_price_brl}")
            
            if from_price_brl is None:
                raise ValueError(f"Não foi possível obter preço histórico para {from_asset['symbol']} em {movement_datetime}")
            
            logger.info(f"Preço histórico do {from_asset['symbol']}: R$ {from_price_brl}")
            
            # 3. Calcular valores da operação
            from_quantity = Decimal(str(swap_data['from_quantity']))
            to_quantity = Decimal(str(swap_data['to_quantity']))
            fee = Decimal(str(swap_data.get('fee', 0)))
            
            # Valor total da operação em BRL (baseado no ativo vendido)
            total_operation_value_brl = from_quantity * from_price_brl
            
            # Preço unitário do ativo comprado em BRL (custo de aquisição)
            to_price_per_unit_brl = total_operation_value_brl / to_quantity
            
            logger.info(f"Valor total da operação: R$ {total_operation_value_brl}")
            logger.info(f"Preço de aquisição do {to_asset['symbol']}: R$ {to_price_per_unit_brl}")
            
            # 4. Inserir movimento SWAP_OUT (ativo vendido)
            swap_out_query = """
                INSERT INTO asset_movements 
                (user_id, account_id, asset_id, movement_type, movement_date, quantity, 
                 price_per_unit, fee, cost_basis_brl, notes) 
                VALUES (%s, %s, %s, 'SWAP_OUT', %s, %s, %s, %s, %s, %s)
            """
            
            swap_out_values = (
                user_id,
                swap_data['account_id'],
                swap_data['from_asset_id'],
                movement_datetime.strftime('%Y-%m-%d %H:%M:%S'),  # Formato MySQL DATETIME
                from_quantity,
                from_price_brl,
                fee / 2,  # Dividir taxa entre os dois movimentos
                total_operation_value_brl,
                f"SWAP OUT: {from_asset['symbol']} -> {to_asset['symbol']}. {swap_data.get('notes', '')}"
            )
            
            cursor.execute(swap_out_query, swap_out_values)
            swap_out_id = cursor.lastrowid
            
            logger.info(f"Movimento SWAP_OUT criado com ID: {swap_out_id}")
            
            # 5. Inserir movimento SWAP_IN (ativo comprado)
            swap_in_query = """
                INSERT INTO asset_movements 
                (user_id, account_id, asset_id, movement_type, movement_date, quantity, 
                 price_per_unit, fee, cost_basis_brl, notes) 
                VALUES (%s, %s, %s, 'SWAP_IN', %s, %s, %s, %s, %s, %s)
            """
            
            swap_in_values = (
                user_id,
                swap_data['account_id'],
                swap_data['to_asset_id'],
                movement_datetime.strftime('%Y-%m-%d %H:%M:%S'),  # Formato MySQL DATETIME
                to_quantity,
                to_price_per_unit_brl,
                fee / 2,  # Dividir taxa entre os dois movimentos
                total_operation_value_brl,
                f"SWAP IN: {from_asset['symbol']} -> {to_asset['symbol']}. {swap_data.get('notes', '')}"
            )
            
            cursor.execute(swap_in_query, swap_in_values)
            swap_in_id = cursor.lastrowid
            
            logger.info(f"Movimento SWAP_IN criado com ID: {swap_in_id}")
            
            # 6. Vincular os movimentos através de linked_movement_id
            update_links_query = """
                UPDATE asset_movements 
                SET linked_movement_id = %s 
                WHERE id = %s
            """
            
            # SWAP_OUT aponta para SWAP_IN
            cursor.execute(update_links_query, (swap_in_id, swap_out_id))
            
            # SWAP_IN aponta para SWAP_OUT
            cursor.execute(update_links_query, (swap_out_id, swap_in_id))
            
            logger.info("Movimentos vinculados com sucesso")
            
            # 7. COMMIT da transação atômica
            self.db_service.connection.commit()
            
            logger.info(f"SWAP concluído com sucesso: OUT_ID={swap_out_id}, IN_ID={swap_in_id}")
            
            return {
                "success": True,
                "message": "Operação de SWAP realizada com sucesso",
                "swap_out_id": swap_out_id,
                "swap_in_id": swap_in_id,
                "total_value_brl": float(total_operation_value_brl),
                "from_asset": {
                    "id": from_asset['id'],
                    "symbol": from_asset['symbol'],
                    "quantity": float(from_quantity),
                    "price_brl": float(from_price_brl)
                },
                "to_asset": {
                    "id": to_asset['id'],
                    "symbol": to_asset['symbol'],
                    "quantity": float(to_quantity),
                    "price_brl": float(to_price_per_unit_brl)
                }
            }
            
        except Exception as e:
            # ROLLBACK em caso de qualquer erro
            self.db_service.connection.rollback()
            logger.error(f"Erro na operação de SWAP: {str(e)}")
            raise Exception(f"Erro ao executar SWAP: {str(e)}")
        
        finally:
            cursor.close()
    
    def get_portfolio_summary(self, user_id: int, account_id: Optional[int] = None) -> List[Dict]:
        """Obtém o resumo do portfólio com cálculo de custo médio e posições atuais"""
        # Validação defensiva
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"user_id inválido: {user_id}")
        
        # Garantir conexão ativa antes de consultas críticas
        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Nova query que inclui preços persistidos da tabela assets
            # Agora com filtro opcional por account_id
            where_conditions = ["am.user_id = %s"]
            query_params = [user_id]
            
            if account_id is not None:
                where_conditions.append("am.account_id = %s")
                query_params.append(account_id)
            
            query = f"""
                SELECT 
                    am.asset_id,
                    a.symbol,
                    a.name as asset_name,
                    a.asset_class,
                    a.price_api_identifier,
                    a.icon_url,
                    a.last_price_usdt,
                    a.last_price_brl,
                    a.last_price_updated_at,
                    SUM(CASE 
                        WHEN am.movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA', 'SINCRONIZACAO', 'SWAP_IN') 
                        THEN am.quantity 
                        ELSE 0 
                    END) as total_bought,
                    SUM(CASE 
                        WHEN am.movement_type IN ('VENDA', 'TRANSFERENCIA_SAIDA', 'SWAP_OUT') 
                        THEN am.quantity 
                        ELSE 0 
                    END) as total_sold,
                    SUM(CASE 
                        WHEN am.movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA', 'SINCRONIZACAO', 'SWAP_IN') 
                             AND am.cost_basis_brl IS NOT NULL
                        THEN am.cost_basis_brl 
                        WHEN am.movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA', 'SINCRONIZACAO') 
                             AND am.cost_basis_brl IS NULL AND am.price_per_unit IS NOT NULL
                        THEN am.quantity * am.price_per_unit
                        ELSE 0 
                    END) as total_invested,
                    SUM(CASE 
                        WHEN am.movement_type IN ('COMPRA', 'TRANSFERENCIA_ENTRADA', 'SINCRONIZACAO', 'SWAP_IN') 
                        THEN am.quantity 
                        ELSE 0 
                    END) as weighted_quantity
                FROM asset_movements am
                JOIN assets a ON am.asset_id = a.id
                WHERE {' AND '.join(where_conditions)}
                GROUP BY am.asset_id, a.symbol, a.name, a.asset_class, a.price_api_identifier, a.icon_url,
                         a.last_price_usdt, a.last_price_brl, a.last_price_updated_at
                HAVING (total_bought - total_sold) > 0
            """
            
            cursor.execute(query, query_params)
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
                # print(f"[PORTFOLIO_SERVICE] Calculando asset {position['asset_id']} ({position['symbol']}):")
                # print(f"  - current_quantity: {current_quantity}")
                # print(f"  - current_price_usdt: ${current_price_usdt}")
                # print(f"  - current_price_brl: R$ {current_price_brl}")
                # print(f"  - market_value_usdt: ${market_value_usdt}")
                # print(f"  - market_value_brl: R$ {market_value_brl}")
                
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
                    'icon_url': position.get('icon_url'),
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
                    acc.name as account_name,
                    linked_am.movement_type as linked_movement_type,
                    linked_a.symbol as linked_asset_symbol
                FROM asset_movements am
                JOIN assets a ON am.asset_id = a.id
                JOIN accounts acc ON am.account_id = acc.id
                LEFT JOIN asset_movements linked_am ON am.linked_movement_id = linked_am.id
                LEFT JOIN assets linked_a ON linked_am.asset_id = linked_a.id
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

    def get_movements_by_account(self, user_id: int, account_id: int) -> List[Dict]:
        """Obtém todas as movimentações de uma conta específica, ordenadas por data"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    am.*,
                    a.symbol,
                    a.name as asset_name,
                    a.asset_class,
                    a.icon_url,
                    acc.name as account_name,
                    linked_am.movement_type as linked_movement_type,
                    linked_a.symbol as linked_asset_symbol
                FROM asset_movements am
                JOIN assets a ON am.asset_id = a.id
                JOIN accounts acc ON am.account_id = acc.id
                LEFT JOIN asset_movements linked_am ON am.linked_movement_id = linked_am.id
                LEFT JOIN assets linked_a ON linked_am.asset_id = linked_a.id
                WHERE am.user_id = %s AND am.account_id = %s
                ORDER BY am.movement_date DESC, am.id DESC
            """
            
            cursor.execute(query, (user_id, account_id))
            movements = cursor.fetchall()
            
            # Converter Decimal para float para JSON serialization
            for movement in movements:
                for key, value in movement.items():
                    if isinstance(value, Decimal):
                        movement[key] = float(value)
            
            return movements
            
        except mysql.connector.Error as err:
            raise Exception(f"Erro ao obter movimentos da conta: {err}")
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
    
    def update_asset_movement(self, user_id: int, movement_id: int, movement_data: dict) -> dict:
        """Atualiza um movimento de ativo existente"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Verificar se o movimento pertence ao usuário
            cursor.execute("SELECT * FROM asset_movements WHERE id = %s AND user_id = %s", (movement_id, user_id))
            existing_movement = cursor.fetchone()
            
            if not existing_movement:
                raise Exception("Movimento não encontrado ou não pertence ao usuário")
            
            # Construir query dinamicamente apenas com campos fornecidos
            fields = []
            values = []
            
            allowed_fields = ['account_id', 'asset_id', 'movement_type', 'movement_date', 'quantity', 'price_per_unit', 'fee', 'notes']
            for field in allowed_fields:
                if field in movement_data and movement_data[field] is not None:
                    fields.append(f"{field} = %s")
                    values.append(movement_data[field])
            
            if not fields:
                raise Exception("Nenhum campo válido para atualizar")
            
            values.extend([movement_id, user_id])
            query = f"UPDATE asset_movements SET {', '.join(fields)} WHERE id = %s AND user_id = %s"
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise Exception("Falha ao atualizar movimento")
            
            return {"id": movement_id, "message": "Movimento atualizado com sucesso"}
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar movimento: {err}")
        finally:
            cursor.close()
    
    def delete_asset_movement(self, user_id: int, movement_id: int) -> dict:
        """
        Deleta um movimento de ativo.
        Para movimentos SWAP (SWAP_IN/SWAP_OUT), deleta automaticamente o movimento vinculado.
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Verificar se o movimento pertence ao usuário
            cursor.execute("""
                SELECT id, movement_type, linked_movement_id, asset_id, quantity
                FROM asset_movements 
                WHERE id = %s AND user_id = %s
            """, (movement_id, user_id))
            existing_movement = cursor.fetchone()
            
            if not existing_movement:
                raise Exception("Movimento não encontrado ou não pertence ao usuário")
            
            movement_type = existing_movement['movement_type']
            linked_movement_id = existing_movement['linked_movement_id']
            
            movements_to_delete = []
            linked_movement = None
            
            # Se for um movimento SWAP, precisamos deletar ambas as pernas
            if movement_type in ('SWAP_IN', 'SWAP_OUT'):
                movements_to_delete.append({
                    'id': existing_movement['id'],
                    'type': movement_type,
                    'asset_id': existing_movement['asset_id'],
                    'quantity': existing_movement['quantity']
                })
                
                # Buscar o movimento vinculado
                if linked_movement_id:
                    cursor.execute("""
                        SELECT id, movement_type, asset_id, quantity
                        FROM asset_movements 
                        WHERE id = %s AND user_id = %s
                    """, (linked_movement_id, user_id))
                    linked_movement = cursor.fetchone()
                    
                    if linked_movement:
                        movements_to_delete.append({
                            'id': linked_movement['id'],
                            'type': linked_movement['movement_type'],
                            'asset_id': linked_movement['asset_id'],
                            'quantity': linked_movement['quantity']
                        })
                        logger.info(f"SWAP detectado: deletando movimento {movement_id} ({movement_type}) e movimento vinculado {linked_movement_id} ({linked_movement['movement_type']})")
                    else:
                        logger.warning(f"Movimento SWAP {movement_id} tem linked_movement_id {linked_movement_id} mas movimento vinculado não foi encontrado")
                else:
                    logger.warning(f"Movimento SWAP {movement_id} não possui linked_movement_id")
            else:
                # Movimento normal, deletar apenas ele
                movements_to_delete.append({
                    'id': existing_movement['id'],
                    'type': movement_type,
                    'asset_id': existing_movement['asset_id'],
                    'quantity': existing_movement['quantity']
                })
                logger.info(f"Deletando movimento normal {movement_id} ({movement_type})")
            
            # Executar deleções em uma transação atômica
            deleted_ids = []
            for movement in movements_to_delete:
                cursor.execute("DELETE FROM asset_movements WHERE id = %s AND user_id = %s", (movement['id'], user_id))
                if cursor.rowcount > 0:
                    deleted_ids.append(movement['id'])
                    logger.info(f"Movimento {movement['id']} ({movement['type']}) deletado com sucesso")
                else:
                    logger.error(f"Falha ao deletar movimento {movement['id']}")
            
            if not deleted_ids:
                raise Exception("Falha ao deletar movimento(s)")
            
            self.db_service.connection.commit()
            
            # Preparar resposta
            if len(deleted_ids) > 1:
                message = f"SWAP deletado com sucesso (movimentos {', '.join(map(str, deleted_ids))})"
            else:
                message = "Movimento deletado com sucesso"
            
            return {
                "message": message,
                "deleted_movements": deleted_ids,
                "is_swap": movement_type in ('SWAP_IN', 'SWAP_OUT')
            }
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            logger.error(f"Erro ao deletar movimento {movement_id}: {err}")
            raise Exception(f"Erro ao deletar movimento: {err}")
        finally:
            cursor.close()