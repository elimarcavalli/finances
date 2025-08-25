import mysql.connector
import os
from dotenv import load_dotenv
from services.encryption_service import EncryptionService
from typing import Optional

load_dotenv()

class DatabaseService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.encryption_service = EncryptionService()
        self.connection = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            autocommit=False  # Controle manual de transações
        )
        
        # Configurar isolation level para eliminar cache de dados antigos
        cursor = self.connection.cursor()
        cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED")
        cursor.close()
        self.connection.commit()
        
        self._initialized = True

    def ensure_connection(self):
        """Garante que a conexão está ativa, reconectando se necessário"""
        try:
            if not self.connection.is_connected():
                self.connection.reconnect(attempts=3, delay=1)
        except Exception as e:
            print(f"Erro ao reconectar: {e}")
            # Recriar conexão se reconnect falhar
            self.connection = mysql.connector.connect(
                host=os.getenv("DB_HOST"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
                database=os.getenv("DB_NAME"),
                autocommit=False
            )

    def add_wallet(self, name: str, public_address: str, private_key: Optional[str]):
        """Criptografa a chave privada (se fornecida) e a salva no banco de dados."""
        encrypted_pk = self.encryption_service.encrypt(private_key) if private_key else None
        cursor = self.connection.cursor()
        query = "INSERT INTO wallets (name, public_address, private_key_encrypted) VALUES (%s, %s, %s)"
        cursor.execute(query, (name, public_address, encrypted_pk))
        self.connection.commit()
        wallet_id = cursor.lastrowid
        cursor.close()
        return {"id": wallet_id, "name": name, "public_address": public_address}

    def get_all_wallets(self):
        """Busca todas as carteiras, retornando apenas dados seguros (sem a chave privada)."""
        cursor = self.connection.cursor(dictionary=True)
        query = "SELECT id, public_address, created_at FROM wallets"
        cursor.execute(query)
        wallets = cursor.fetchall()
        cursor.close()
        return wallets

    def get_decrypted_private_key(self, wallet_id: int) -> str | None:
        """Busca uma carteira pelo ID e retorna sua chave privada descriptografada."""
        cursor = self.connection.cursor(dictionary=True)
        query = "SELECT private_key_encrypted FROM wallets WHERE id = %s"
        cursor.execute(query, (wallet_id,))
        result = cursor.fetchone()
        cursor.close()

        if result and result['private_key_encrypted']:
            decrypted_pk = self.encryption_service.decrypt(result['private_key_encrypted'])
            return decrypted_pk
        return None

    # === NOVOS MÉTODOS PARA INTEGRAÇÃO WEB3 ===

    def upsert_wallet(self, public_address: str, private_key: Optional[str] = None) -> int:
        """Busca ou cria uma carteira pelo endereço público. Retorna o wallet_id."""
        cursor = self.connection.cursor(dictionary=True)
        
        # Primeiro, tenta buscar a carteira existente
        query = "SELECT id FROM wallets WHERE public_address = %s"
        cursor.execute(query, (public_address,))
        result = cursor.fetchone()
        
        if result:
            # Carteira já existe, retorna o ID
            wallet_id = result['id']
        else:
            # Carteira não existe, cria uma nova
            encrypted_pk = self.encryption_service.encrypt(private_key) if private_key else None
            query = "INSERT INTO wallets (public_address, private_key_encrypted) VALUES (%s, %s)"
            cursor.execute(query, (public_address, encrypted_pk))
            self.connection.commit()
            wallet_id = cursor.lastrowid
        
        cursor.close()
        return wallet_id

    def associate_wallet_to_user(self, user_id: int, wallet_id: int, wallet_name: str) -> dict:
        """Cria uma associação entre usuário e carteira."""
        cursor = self.connection.cursor()
        try:
            query = "INSERT INTO user_wallets (user_id, wallet_id, wallet_name) VALUES (%s, %s, %s)"
            cursor.execute(query, (user_id, wallet_id, wallet_name))
            self.connection.commit()
            association_id = cursor.lastrowid
            return {"id": association_id, "user_id": user_id, "wallet_id": wallet_id, "wallet_name": wallet_name}
        except mysql.connector.IntegrityError:
            # Associação já existe
            raise ValueError("Wallet already associated with this user")
        finally:
            cursor.close()

    def get_user_wallets(self, user_id: int) -> list:
        """Retorna todas as carteiras associadas a um usuário."""
        cursor = self.connection.cursor(dictionary=True)
        query = """
            SELECT uw.id as association_id, uw.wallet_name, w.public_address, w.id as wallet_id, uw.created_at
            FROM user_wallets uw
            JOIN wallets w ON uw.wallet_id = w.id
            WHERE uw.user_id = %s
            ORDER BY uw.created_at DESC
        """
        cursor.execute(query, (user_id,))
        wallets = cursor.fetchall()
        cursor.close()
        return wallets

    def remove_wallet_association(self, association_id: int, user_id: int) -> bool:
        """Remove a associação entre usuário e carteira."""
        cursor = self.connection.cursor()
        query = "DELETE FROM user_wallets WHERE id = %s AND user_id = %s"
        cursor.execute(query, (association_id, user_id))
        self.connection.commit()
        affected_rows = cursor.rowcount
        cursor.close()
        return affected_rows > 0

    def get_user_id_by_username(self, username: str) -> Optional[int]:
        """Busca o ID do usuário pelo username."""
        cursor = self.connection.cursor(dictionary=True)
        query = "SELECT id FROM users WHERE user_name = %s"
        cursor.execute(query, (username,))
        result = cursor.fetchone()
        cursor.close()
        return result['id'] if result else None

    # === MÉTODOS PARA STRATEGY VAULTS ===

    def create_vault(self, user_wallet_id: int, contract_address: str, strategy_name: str) -> int:
        """Cria um novo vault associado a uma user_wallet."""
        cursor = self.connection.cursor()
        try:
            # Verifica se o user_wallet_id existe
            check_query = "SELECT id FROM user_wallets WHERE id = %s"
            cursor.execute(check_query, (user_wallet_id,))
            if not cursor.fetchone():
                raise ValueError("Invalid user_wallet_id")
            
            query = """INSERT INTO strategy_vaults (user_wallet_id, contract_address, strategy_name) 
                       VALUES (%s, %s, %s)"""
            cursor.execute(query, (user_wallet_id, contract_address, strategy_name))
            self.connection.commit()
            vault_id = cursor.lastrowid
            return vault_id
        except mysql.connector.IntegrityError as e:
            if "Duplicate entry" in str(e):
                raise ValueError("Contract address already registered")
            raise e
        finally:
            cursor.close()

    def get_user_vaults_list(self, user_id: int) -> list:
        """Retorna todos os vaults de um usuário com informações da carteira."""
        cursor = self.connection.cursor(dictionary=True)
        query = """
            SELECT sv.id, sv.contract_address, sv.strategy_name, sv.created_at,
                   uw.wallet_name, w.public_address
            FROM strategy_vaults sv
            JOIN user_wallets uw ON sv.user_wallet_id = uw.id
            JOIN wallets w ON uw.wallet_id = w.id
            WHERE uw.user_id = %s
            ORDER BY sv.created_at DESC
        """
        cursor.execute(query, (user_id,))
        vaults = cursor.fetchall()
        cursor.close()
        return vaults

    def get_vault_by_id(self, vault_id: int, user_id: int) -> Optional[dict]:
        """Retorna detalhes de um vault específico se pertencer ao usuário."""
        cursor = self.connection.cursor(dictionary=True)
        query = """
            SELECT sv.id, sv.contract_address, sv.strategy_name, sv.created_at,
                   uw.wallet_name, w.public_address, uw.user_id
            FROM strategy_vaults sv
            JOIN user_wallets uw ON sv.user_wallet_id = uw.id
            JOIN wallets w ON uw.wallet_id = w.id
            WHERE sv.id = %s AND uw.user_id = %s
        """
        cursor.execute(query, (vault_id, user_id))
        vault = cursor.fetchone()
        cursor.close()
        return vault

    def delete_vault(self, vault_id: int, user_id: int) -> bool:
        """Remove um vault se pertencer ao usuário."""
        cursor = self.connection.cursor()
        query = """
            DELETE sv FROM strategy_vaults sv
            JOIN user_wallets uw ON sv.user_wallet_id = uw.id
            WHERE sv.id = %s AND uw.user_id = %s
        """
        cursor.execute(query, (vault_id, user_id))
        self.connection.commit()
        affected_rows = cursor.rowcount
        cursor.close()
        return affected_rows > 0

    def get_all_vault_addresses(self) -> list:
        """Retorna todos os endereços de contratos de vaults para o Keeper."""
        cursor = self.connection.cursor(dictionary=True)
        query = "SELECT id, contract_address FROM strategy_vaults ORDER BY created_at ASC"
        cursor.execute(query)
        vaults = cursor.fetchall()
        cursor.close()
        return vaults