from .database_service import DatabaseService
from datetime import date # Certifique-se que date está importado
from .transaction_service import TransactionService
import mysql.connector
import logging

# Configurar logger específico para account_service
logger = logging.getLogger('account_service')
logger.setLevel(logging.DEBUG)

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
        """
        Cria uma nova conta e, se houver saldo inicial, cria uma transação de 'Saldo Inicial'
        de forma ATÔMICA (ACID).
        """
        logger.debug(f"[CREATE_ACCOUNT] Iniciando criação de conta para user_id={user_id}")
        logger.debug(f"[CREATE_ACCOUNT] Dados recebidos: {account_data}")

        # Instanciar o TransactionService internamente
        transaction_service = TransactionService(self.db_service)

        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Garantir que autocommit está habilitado antes de iniciar transação
            self.db_service.connection.autocommit = True
            # Iniciar transação ACID
            self.db_service.connection.start_transaction()

            # 1. Criar a conta
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
            account_id = cursor.lastrowid

            # 2. Se balance > 0, criar transação de "Saldo Inicial"
            initial_balance = float(account_data.get('balance', 0.00))
            logger.debug(f"[CREATE_ACCOUNT] Saldo inicial extraído: {initial_balance}")
            
            if initial_balance > 0:
                logger.debug(f"[CREATE_ACCOUNT] Criando transação de saldo inicial de R$ {initial_balance} para conta {account_id}")
                print(f"[ACCOUNT_SERVICE] Criando saldo inicial de R$ {initial_balance} para conta {account_id}")

                transaction_data = {
                    'description': 'Saldo Inicial',
                    'amount': initial_balance,
                    'transaction_date': date.today(),
                    'type': 'RECEITA',
                    'category': 'Saldo Inicial',
                    'from_account_id': None,
                    'to_account_id': account_id,
                    'status': 'EFETIVADO'
                }

                # Chamar o transaction_service PASSANDO O CURSOR ATUAL
                transaction_service.create_transaction(user_id, transaction_data, external_cursor=cursor)
                print(f"[ACCOUNT_SERVICE] Transação de saldo inicial adicionada à operação.")

            # 3. Commit da transação ATÔMICA
            self.db_service.connection.commit()
            print(f"[ACCOUNT_SERVICE] Operação atômica concluída com sucesso para conta {account_id}.")

            # É seguro chamar a função get aqui, pois a transação foi commitada
            return self.get_account_by_id(user_id, account_id)

        except Exception as e:
            # Se qualquer coisa falhar, reverter TUDO
            self.db_service.connection.rollback()
            print(f"[ACCOUNT_SERVICE] ERRO: Operação atômica falhou. Rollback executado. Erro: {str(e)}")
            raise Exception(f"Erro atômico ao criar conta: {str(e)}")
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
        """
        Atualiza uma conta existente
        NOVA FUNCIONALIDADE: Se 'balance' for fornecido, executa ajuste inteligente de saldo
        """
        logger.debug(f"[UPDATE_ACCOUNT] Iniciando atualização para account_id={account_id}, user_id={user_id}")
        logger.debug(f"[UPDATE_ACCOUNT] Dados recebidos: {account_data}")
        
        # Lazy import para evitar dependência circular
        from .transaction_service import TransactionService
        
        # Reset connection state to avoid residual transaction states
        try:
            self.db_service.connection.rollback()
        except:
            pass  # Safe to ignore if there's no active transaction
            
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            # Garantir que autocommit está habilitado antes de iniciar transação
            self.db_service.connection.autocommit = True
            # Iniciar transação ACID
            self.db_service.connection.start_transaction()
            
            # NOVA LÓGICA: Processar ajuste de saldo se fornecido
            if 'balance' in account_data:
                target_balance = float(account_data['balance'])
                logger.debug(f"[UPDATE_ACCOUNT] Balance detectado nos dados: {target_balance}")
                print(f"[ACCOUNT_SERVICE] Processando ajuste de saldo para conta {account_id}: R$ {target_balance}")
                
                # 1. Calcular saldo atual - USAR O MESMO CURSOR DA TRANSAÇÃO
                logger.debug(f"[UPDATE_ACCOUNT] Obtendo saldo atual da conta {account_id}")
                
                # Buscar dados básicos da conta usando o cursor atual
                cursor.execute("SELECT * FROM accounts WHERE id = %s AND user_id = %s", (account_id, user_id))
                account_basic = cursor.fetchone()
                
                logger.debug(f"[UPDATE_ACCOUNT] Resultado da busca da conta: {account_basic}")
                
                if not account_basic:
                    logger.error(f"[UPDATE_ACCOUNT] Conta {account_id} não encontrada para user_id {user_id}")
                    raise Exception("Conta não encontrada ou não pertence ao usuário")
                
                # Calcular saldo baseado no tipo da conta usando o mesmo cursor
                if account_basic['type'] == 'CARTEIRA_CRIPTO':
                    # Para carteiras cripto, usar o portfolio service (não precisa da transação)
                    current_balance = self._calculate_crypto_wallet_balance(user_id, account_id)
                else:
                    # Para contas tradicionais, calcular baseado nas transações usando o mesmo cursor
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
                    
                    balance_result = cursor.fetchone()
                    current_balance = float(balance_result['balance']) if balance_result and balance_result['balance'] is not None else 0.00
                
                logger.debug(f"[UPDATE_ACCOUNT] Saldo atual calculado: R$ {current_balance}")
                
                current_balance = float(current_balance)
                delta = target_balance - current_balance
                
                logger.debug(f"[UPDATE_ACCOUNT] Saldo atual: R$ {current_balance}")
                logger.debug(f"[UPDATE_ACCOUNT] Meta: R$ {target_balance}")
                logger.debug(f"[UPDATE_ACCOUNT] Delta calculado: R$ {delta}")
                print(f"[ACCOUNT_SERVICE] Saldo atual: R$ {current_balance}, Meta: R$ {target_balance}, Delta: R$ {delta}")
                
                # 2. Se há diferença, criar transação de ajuste
                if abs(delta) > 0.01:  # Tolerância para evitar ajustes microscópicos
                    logger.debug(f"[UPDATE_ACCOUNT] Delta significativo detectado: {abs(delta)}")
                    transaction_service = TransactionService(self.db_service)
                    
                    if delta > 0:
                        # Aumento de saldo = RECEITA
                        logger.debug(f"[UPDATE_ACCOUNT] Criando RECEITA (suprimento)")
                        from datetime import datetime
                        transaction_data = {
                            'description': 'Ajuste de Saldo (Suprimento)',
                            'amount': delta,
                            'transaction_date': account_data.get('adjustment_date') or datetime.now().date(),
                            'type': 'RECEITA',
                            'category': 'Ajuste de Saldo',
                            'from_account_id': None,
                            'to_account_id': account_id,
                            'status': 'EFETIVADO'
                        }
                        print(f"[ACCOUNT_SERVICE] Criando RECEITA de ajuste: R$ {delta}")
                    else:
                        # Redução de saldo = DESPESA
                        logger.debug(f"[UPDATE_ACCOUNT] Criando DESPESA (sangria)")
                        from datetime import datetime
                        transaction_data = {
                            'description': 'Ajuste de Saldo (Sangria)',
                            'amount': abs(delta),
                            'transaction_date': account_data.get('adjustment_date') or datetime.now().date(),
                            'type': 'DESPESA',
                            'category': 'Ajuste de Saldo',
                            'from_account_id': account_id,
                            'to_account_id': None,
                            'status': 'EFETIVADO'
                        }
                        print(f"[ACCOUNT_SERVICE] Criando DESPESA de ajuste: R$ {abs(delta)}")
                    
                    logger.debug(f"[UPDATE_ACCOUNT] Dados da transação: {transaction_data}")
                    # Criar transação de ajuste usando o cursor da transação atômica
                    transaction_service.create_transaction(user_id, transaction_data, external_cursor=cursor)
                    logger.debug(f"[UPDATE_ACCOUNT] Transação de ajuste executada")
                    print(f"[ACCOUNT_SERVICE] Transação de ajuste criada com sucesso")

                else:
                    logger.debug(f"[UPDATE_ACCOUNT] Delta insignificante: {delta}")
                    print(f"[ACCOUNT_SERVICE] Delta insignificante (R$ {delta}), nenhum ajuste necessário")
                
                # Remover 'balance' do account_data para não afetar a atualização da conta
                # account_data = {k: v for k, v in account_data.items() if k != 'balance'}
            
            # Processar campos regulares da conta
            fields = []
            values = []
            
            allowed_fields = ['name', 'type', 'institution', 'credit_limit', 'invoice_due_day', 'balance']
            for field in allowed_fields:
                if field in account_data:
                    fields.append(f"{field} = %s")
                    values.append(account_data[field])
            
            # Se há campos para atualizar, executar UPDATE
            if fields:

                values.extend([account_id, user_id])
                query = f"UPDATE accounts SET {', '.join(fields)} WHERE id = %s AND user_id = %s"
                
                cursor.execute(query, values)
                
                if cursor.rowcount == 0:
                    raise Exception("Conta não encontrada ou não pertence ao usuário")
            else:
                # Se não há campos regulares para atualizar (só balance), 
                # ainda precisamos validar que a conta existe
                logger.debug(f"[UPDATE_ACCOUNT] Nenhum campo regular para atualizar, validando existência da conta")
                cursor.execute("SELECT id FROM accounts WHERE id = %s AND user_id = %s", (account_id, user_id))
                if not cursor.fetchone():
                    raise Exception("Conta não encontrada ou não pertence ao usuário")
            
            # Commit da transação ACID
            self.db_service.connection.commit()
            
            return self.get_account_by_id(user_id, account_id)
            
        except mysql.connector.Error as err:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao atualizar conta: {err}")
        except Exception as e:
            self.db_service.connection.rollback()
            raise Exception(f"Erro ao processar ajuste de saldo: {str(e)}")
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