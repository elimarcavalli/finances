from .database_service import DatabaseService
import mysql.connector

class AccountService:
    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
        self._portfolio_service = None  # Lazy initialization para evitar import circular
    
    def _get_portfolio_service(self):
        """Lazy initialization do PortfolioService para evitar import circular"""
        if self._portfolio_service is None:
            from .portfolio_service import PortfolioService
            from .price_service import PriceService
            price_service = PriceService()
            self._portfolio_service = PortfolioService(self.db_service, price_service)
        return self._portfolio_service
    
    def create_account(self, user_id: int, account_data: dict) -> dict:
        """Cria uma nova conta para o usuário"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            query = """
                INSERT INTO accounts (user_id, name, type, institution, credit_limit, invoice_due_day, public_address) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                user_id,
                account_data.get('name'),
                account_data.get('type'),
                account_data.get('institution'),
                account_data.get('credit_limit', 0.00),
                account_data.get('invoice_due_day'),
                account_data.get('public_address')
            )
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            account_id = cursor.lastrowid
            return self.get_account_by_id(user_id, account_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao criar conta: {err}")
        finally:
            cursor.close()
    
    def get_account_by_id(self, user_id: int, account_id: int) -> dict:
        """Busca uma conta específica do usuário com saldo calculado dinamicamente"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Validação defensiva dos parâmetros de entrada
            if not isinstance(user_id, int) or user_id <= 0:
                raise ValueError(f"user_id inválido: {user_id}")
            if not isinstance(account_id, int) or account_id <= 0:
                raise ValueError(f"account_id inválido: {account_id}")
                
            # Primeiro buscar dados básicos da conta
            query = "SELECT * FROM accounts WHERE id = %s AND user_id = %s"
            cursor.execute(query, (account_id, user_id))
            result = cursor.fetchone()
            
            if not result:
                return None
            
            # Calcular saldo baseado no tipo da conta
            if result['type'] == 'CARTEIRA_CRIPTO':
                # Para carteiras cripto, saldo = soma dos valores de mercado dos ativos
                balance = self._calculate_crypto_wallet_balance(user_id, account_id)
            else:
                # Para contas tradicionais, saldo = soma das transações
                balance = self._calculate_traditional_account_balance(account_id)
            
            result['balance'] = balance
            return result
            
        except mysql.connector.Error as err:
            raise Exception(f"Erro na consulta de conta: {err}")
        finally:
            cursor.close()
    
    def _calculate_crypto_wallet_balance(self, user_id: int, account_id: int) -> float:
        """Calcula saldo de carteira cripto baseado no valor de mercado dos ativos"""
        try:
            cursor = self.db_service.connection.cursor(dictionary=True)
            
            # Buscar todos os asset_movements de SINCRONIZACAO desta conta
            cursor.execute("""
                SELECT 
                    am.asset_id,
                    SUM(am.quantity) as total_quantity,
                    a.price_api_identifier,
                    a.symbol
                FROM asset_movements am
                JOIN assets a ON am.asset_id = a.id
                WHERE am.user_id = %s AND am.account_id = %s 
                AND am.movement_type = 'SINCRONIZACAO'
                AND a.asset_class = 'CRIPTO'
                GROUP BY am.asset_id, a.price_api_identifier, a.symbol
                HAVING total_quantity > 0
            """, (user_id, account_id))
            
            crypto_holdings = cursor.fetchall()
            cursor.close()
            
            if not crypto_holdings:
                return 0.00
                
            # Usar o PortfolioService para obter preços atuais
            portfolio_service = self._get_portfolio_service()
            portfolio_data = portfolio_service.get_portfolio_summary(user_id)
            
            # Somar valores de mercado dos ativos desta conta específica
            total_balance = 0.00
            for holding in crypto_holdings:
                asset_id = holding['asset_id']
                
                # Encontrar este ativo no portfolio_data
                for portfolio_item in portfolio_data:
                    if portfolio_item['asset_id'] == asset_id:
                        # Adicionar ao saldo total desta carteira
                        market_value = portfolio_item.get('market_value_brl', 0.00)
                        total_balance += market_value
                        print(f"[ACCOUNT_SERVICE] Conta {account_id}: {holding['symbol']} = R$ {market_value}")
                        break
            
            print(f"[ACCOUNT_SERVICE] Total da carteira cripto {account_id}: R$ {total_balance}")
            return total_balance
            
        except Exception as e:
            print(f"[ACCOUNT_SERVICE] Erro ao calcular saldo cripto: {e}")
            return 0.00
    
    def _calculate_traditional_account_balance(self, account_id: int) -> float:
        """Calcula saldo de conta tradicional baseado nas transações"""
        try:
            cursor = self.db_service.connection.cursor()
            
            cursor.execute("""
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN t.to_account_id = %s THEN COALESCE(t.amount, 0.00)
                        WHEN t.from_account_id = %s THEN -COALESCE(t.amount, 0.00)
                        ELSE 0.00
                    END
                ), 0.00) as balance
                FROM transactions t 
                WHERE (t.to_account_id = %s OR t.from_account_id = %s)
                AND t.status = 'EFETIVADO'
            """, (account_id, account_id, account_id, account_id))
            
            result = cursor.fetchone()
            cursor.close()
            
            return float(result[0]) if result and result[0] is not None else 0.00
            
        except mysql.connector.Error as err:
            print(f"[ACCOUNT_SERVICE] Erro ao calcular saldo tradicional: {err}")
            return 0.00
    
    def get_accounts_by_user(self, user_id: int) -> list:
        """Lista todas as contas do usuário com saldo calculado dinamicamente"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Validação defensiva dos parâmetros de entrada
            if not isinstance(user_id, int) or user_id <= 0:
                raise ValueError(f"user_id inválido: {user_id}")
                
            # Buscar todas as contas sem cálculo de saldo
            query = "SELECT * FROM accounts WHERE user_id = %s ORDER BY created_at DESC"
            cursor.execute(query, (user_id,))
            results = cursor.fetchall()
            
            # Calcular saldo para cada conta baseado no tipo
            for result in results:
                if result['type'] == 'CARTEIRA_CRIPTO':
                    # Para carteiras cripto, saldo = soma dos valores de mercado dos ativos
                    result['balance'] = self._calculate_crypto_wallet_balance(user_id, result['id'])
                else:
                    # Para contas tradicionais, saldo = soma das transações
                    result['balance'] = self._calculate_traditional_account_balance(result['id'])
                    
            return results
            
        except mysql.connector.Error as err:
            raise Exception(f"Erro na consulta de contas: {err}")
        finally:
            cursor.close()
    
    def update_account(self, user_id: int, account_id: int, account_data: dict) -> dict:
        """Atualiza uma conta existente"""
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Construir query dinamicamente apenas com campos fornecidos
            fields = []
            values = []
            
            allowed_fields = ['name', 'type', 'institution', 'credit_limit', 'invoice_due_day']
            for field in allowed_fields:
                if field in account_data:
                    fields.append(f"{field} = %s")
                    values.append(account_data[field])
            
            if not fields:
                raise Exception("Nenhum campo válido para atualizar")
            
            values.extend([account_id, user_id])
            query = f"UPDATE accounts SET {', '.join(fields)} WHERE id = %s AND user_id = %s"
            
            cursor.execute(query, values)
            self.db_service.connection.commit()
            
            if cursor.rowcount == 0:
                raise Exception("Conta não encontrada ou não pertence ao usuário")
            
            return self.get_account_by_id(user_id, account_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar conta: {err}")
        finally:
            cursor.close()
    
    def delete_account(self, user_id: int, account_id: int) -> bool:
        """Deleta uma conta do usuário"""
        cursor = self.db_service.connection.cursor()
        try:
            query = "DELETE FROM accounts WHERE id = %s AND user_id = %s"
            cursor.execute(query, (account_id, user_id))
            self.db_service.connection.commit()
            
            return cursor.rowcount > 0
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao deletar conta: {err}")
        finally:
            cursor.close()