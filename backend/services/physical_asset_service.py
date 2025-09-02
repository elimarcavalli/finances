# services/physical_asset_service.py

from decimal import Decimal
from typing import Dict, List, Optional
import mysql.connector
from .database_service import DatabaseService

class PhysicalAssetService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service

    def create_physical_asset(self, user_id: int, asset_data: Dict) -> Dict:
        """
        Cria um novo bem físico e registra a transação de aquisição de forma atômica.
        PHASE 3: Agora armazena o transaction_id na coluna acquisition_transaction_id.
        Esta operação inclui:
        1. Criação da transação de DESPESA para registrar a saída de caixa
        2. Inserção do bem físico na tabela physical_assets com referência à transação
        Ambas as operações são executadas atomicamente (ACID).
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Iniciar transação ACID
            self.db_service.connection.autocommit = False
            
            # 1. Criar transação de DESPESA para registrar a aquisição
            from .transaction_service import TransactionService
            transaction_service = TransactionService(self.db_service)
            
            transaction_data = {
                'description': f"Aquisição de: {asset_data.get('description')}",
                'amount': asset_data.get('acquisition_cost'),
                'transaction_date': asset_data.get('acquisition_date'),
                'type': 'DESPESA',
                'category': 'Aquisição de Patrimônio',  # PHASE 3: Categoria específica
                'from_account_id': asset_data.get('source_account_id'),
                'to_account_id': None
            }
            
            # Criar transação usando cursor externo (parte da mesma transação ACID)
            transaction_result = transaction_service.create_transaction(
                user_id, transaction_data, external_cursor=cursor
            )
            
            transaction_id = transaction_result.get('id')
            
            # 2. Inserir o bem físico com referência à transação de aquisição
            query = """
                INSERT INTO physical_assets 
                (user_id, asset_id, description, acquisition_date, acquisition_cost, current_value, last_valuation_date, notes, status, acquisition_transaction_id) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'ATIVO', %s)
            """
            values = (
                user_id,
                asset_data.get('asset_id'),
                asset_data.get('description'),
                asset_data.get('acquisition_date'),
                asset_data.get('acquisition_cost'),
                asset_data.get('current_value'),
                asset_data.get('last_valuation_date'),
                asset_data.get('notes'),
                transaction_id
            )
            cursor.execute(query, values)
            new_id = cursor.lastrowid
            
            # 3. Commit da transação completa
            self.db_service.connection.commit()
            
            return self.get_physical_asset_by_id(user_id, new_id)
            
        except Exception as err:
            # Rollback completo em caso de erro
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao criar ativo físico e registrar transação: {err}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True

    def get_physical_asset_by_id(self, user_id: int, physical_asset_id: int) -> Optional[Dict]:
        """PHASE 3: Busca um bem físico específico pelo ID com novos campos."""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT pa.*, a.name as asset_class_name, a.icon_url as asset_icon_url
                FROM physical_assets pa
                JOIN assets a ON pa.asset_id = a.id
                WHERE pa.id = %s AND pa.user_id = %s
            """
            cursor.execute(query, (physical_asset_id, user_id))
            return cursor.fetchone()
        finally:
            cursor.close()

    def get_physical_assets_by_user(self, user_id: int, status_filter: str = None) -> List[Dict]:
        """
        PHASE 3: Lista todos os bens físicos de um usuário.
        Permite filtrar por status (ATIVO, VENDIDO).
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # A query agora inclui os novos campos e permite filtrar por status
            base_query = """
                SELECT pa.*, a.name as asset_class_name, a.icon_url as asset_icon_url
                FROM physical_assets pa
                JOIN assets a ON pa.asset_id = a.id
                WHERE pa.user_id = %s
            """
            
            params = [user_id]
            
            if status_filter:
                base_query += " AND pa.status = %s"
                params.append(status_filter)
                
            base_query += " ORDER BY pa.created_at DESC"
            
            cursor.execute(base_query, params)
            return cursor.fetchall()
        except mysql.connector.Error as err:
            raise Exception(f"Erro de banco de dados ao buscar ativos físicos: {err}")
        finally:
            cursor.close()

    def update_physical_asset(self, user_id: int, physical_asset_id: int, asset_data: Dict) -> Dict:
        """Atualiza um bem físico existente."""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                UPDATE physical_assets SET 
                asset_id = %s, description = %s, acquisition_date = %s, 
                acquisition_cost = %s, current_value = %s, last_valuation_date = %s, notes = %s 
                WHERE id = %s AND user_id = %s
            """
            values = (
                asset_data.get('asset_id'),
                asset_data.get('description'),
                asset_data.get('acquisition_date'),
                asset_data.get('acquisition_cost'),
                asset_data.get('current_value'),
                asset_data.get('last_valuation_date'),
                asset_data.get('notes'),
                physical_asset_id,
                user_id
            )
            cursor.execute(query, values)
            
            if cursor.rowcount == 0:
                raise ValueError("Ativo físico não encontrado ou não pertence ao usuário.")

            self.db_service.connection.commit()
            return self.get_physical_asset_by_id(user_id, physical_asset_id)
            
        except (mysql.connector.Error, ValueError) as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar ativo físico: {err}")
        finally:
            cursor.close()

    def delete_physical_asset(self, user_id: int, physical_asset_id: int) -> bool:
        """
        PHASE 3: Exclusão permanente do bem físico.
        Esta operação é destrutiva e remove:
        1. As transações associadas (aquisição e liquidação se existir)
        2. O registro do bem físico
        Tudo executado atomicamente (ACID).
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Iniciar transação ACID
            self.db_service.connection.autocommit = False
            
            # 1. Buscar o bem e suas transações associadas
            asset = self.get_physical_asset_by_id(user_id, physical_asset_id)
            if not asset:
                raise ValueError("Ativo físico não encontrado ou não pertence ao usuário.")
            
            acquisition_tx_id = asset.get('acquisition_transaction_id')
            liquidation_tx_id = asset.get('liquidation_transaction_id')
            
            # 2. Deletar transações associadas usando o TransactionService
            from .transaction_service import TransactionService
            transaction_service = TransactionService(self.db_service)
            
            if acquisition_tx_id:
                # Deletar transação de aquisição
                transaction_service.delete_transaction(user_id, acquisition_tx_id, external_cursor=cursor, skip_asset_check=True)
                
            if liquidation_tx_id:
                # Deletar transação de liquidação
                transaction_service.delete_transaction(user_id, liquidation_tx_id, external_cursor=cursor, skip_asset_check=True)
            
            # 3. Finalmente deletar o registro do bem físico
            delete_query = "DELETE FROM physical_assets WHERE id = %s AND user_id = %s"
            cursor.execute(delete_query, (physical_asset_id, user_id))
            
            if cursor.rowcount == 0:
                raise ValueError("Ativo físico não encontrado ou não pertence ao usuário.")
            
            # 4. Commit da transação completa
            self.db_service.connection.commit()
            return True
            
        except (mysql.connector.Error, ValueError) as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao deletar ativo físico permanentemente: {err}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True

    def revert_liquidation(self, physical_asset_id: int) -> bool:
        """
        PHASE 3: Reverte a liquidação de um bem físico.
        Chamado quando uma transação de venda é deletada.
        Altera o status de volta para 'ATIVO' e remove a referência à transação de liquidação.
        """
        cursor = self.db_service.connection.cursor()
        try:
            query = """
                UPDATE physical_assets 
                SET status = 'ATIVO', liquidation_transaction_id = NULL 
                WHERE id = %s AND status = 'VENDIDO'
            """
            cursor.execute(query, (physical_asset_id,))
            
            if cursor.rowcount == 0:
                raise ValueError("Bem físico não encontrado ou não estava vendido.")
                
            self.db_service.connection.commit()
            return True
            
        except (mysql.connector.Error, ValueError) as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao reverter liquidação do ativo físico: {err}")
        finally:
            cursor.close()

    def get_total_value(self, user_id: int) -> Decimal:
        """
        PHASE 3: Calcula o valor total (current_value) de todos os bens físicos ATIVOS de um usuário.
        Apenas bens com status='ATIVO' são incluídos no patrimônio atual.
        """
        cursor = self.db_service.connection.cursor()
        try:
            query = "SELECT COALESCE(SUM(current_value), 0) FROM physical_assets WHERE user_id = %s AND status = 'ATIVO'"
            cursor.execute(query, (user_id,))
            result = cursor.fetchone()
            return result[0] if result else Decimal(0)
        except mysql.connector.Error as err:
            raise Exception(f"Erro ao calcular valor total de ativos físicos: {err}")
        finally:
            cursor.close()

    def liquidate_physical_asset(self, user_id: int, physical_asset_id: int, liquidation_data: Dict) -> Dict:
        """
        PHASE 3: Liquida (vende) um bem físico sem deletá-lo do banco.
        Em vez de deletar, muda o status para 'VENDIDO' e armazena a transaction_id da liquidação.
        Esta operação inclui:
        1. Criação da transação de RECEITA para registrar a entrada de caixa
        2. Atualização do bem físico (status='VENDIDO', liquidation_transaction_id)
        Ambas as operações são executadas atomicamente (ACID).
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Iniciar transação ACID
            self.db_service.connection.autocommit = False
            
            # 1. Verificar se o bem existe e está ATIVO
            asset = self.get_physical_asset_by_id(user_id, physical_asset_id)
            if not asset:
                raise Exception("Bem físico não encontrado ou não pertence ao usuário")
            
            if asset.get('status') == 'VENDIDO':
                raise Exception("Este bem já foi vendido anteriormente")
            
            # 2. Criar transação de RECEITA para registrar a venda
            from .transaction_service import TransactionService
            transaction_service = TransactionService(self.db_service)
            
            transaction_data = {
                'description': f"Venda de: {asset.get('description')}",
                'amount': liquidation_data.get('sale_value'),
                'transaction_date': liquidation_data.get('sale_date'),
                'type': 'RECEITA',
                'category': 'Venda de Patrimônio',  # PHASE 3: Categoria específica
                'from_account_id': None,
                'to_account_id': liquidation_data.get('destination_account_id')
            }
            
            # Criar transação usando cursor externo (parte da mesma transação ACID)
            transaction_result = transaction_service.create_transaction(
                user_id, transaction_data, external_cursor=cursor
            )
            
            transaction_id = transaction_result.get('id')
            
            # 3. PHASE 3: Atualizar o bem físico em vez de deletar
            update_query = """
                UPDATE physical_assets 
                SET status = 'VENDIDO', liquidation_transaction_id = %s 
                WHERE id = %s AND user_id = %s AND status = 'ATIVO'
            """
            cursor.execute(update_query, (transaction_id, physical_asset_id, user_id))
            
            if cursor.rowcount == 0:
                raise Exception("Bem físico não encontrado, não pertence ao usuário ou já foi vendido")
            
            # 4. Commit da transação completa
            self.db_service.connection.commit()
            
            # Obter o bem atualizado
            updated_asset = self.get_physical_asset_by_id(user_id, physical_asset_id)
            
            return {
                'message': 'Bem físico liquidado com sucesso',
                'transaction_id': transaction_id,
                'liquidated_asset': updated_asset,
                'sale_value': float(liquidation_data.get('sale_value'))
            }
            
        except Exception as err:
            # Rollback completo em caso de erro
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao liquidar ativo físico e registrar transação: {err}")
        finally:
            cursor.close()
            self.db_service.connection.autocommit = True

