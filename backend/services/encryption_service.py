import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

class EncryptionService:
    def __init__(self):
        key_str = os.getenv("MASTER_ENCRYPTION_KEY")
        if not key_str:
            raise ValueError("A chave de criptografia 'MASTER_ENCRYPTION_KEY' não foi encontrada no arquivo .env")

        self.key = key_str.encode('utf-8')
        self.fernet = Fernet(self.key)

    def encrypt(self, data: str) -> str:
        """Criptografa uma string e retorna a versão criptografada como string."""
        encrypted_data_bytes = self.fernet.encrypt(data.encode('utf-8'))
        return encrypted_data_bytes.decode('utf-8')

    def decrypt(self, encrypted_data: str) -> str:
        """Descriptografa uma string e retorna a versão original."""
        decrypted_data_bytes = self.fernet.decrypt(encrypted_data.encode('utf-8'))
        return decrypted_data_bytes.decode('utf-8')

def generate_key():
    """Função utilitária para gerar uma nova chave. Execute apenas uma vez."""
    return Fernet.generate_key().decode('utf-8')