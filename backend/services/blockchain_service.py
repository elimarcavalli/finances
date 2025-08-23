import os
import requests
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

class BlockchainService:
    def __init__(self):
        self.alchemy_url = os.getenv("ALCHEMY_POLYGON_URL")
        self.polygonscan_api_key = os.getenv("POLYGONSCAN_API_KEY")

        if not self.alchemy_url or not self.polygonscan_api_key:
            raise ValueError("Variáveis de ambiente para Alchemy e PolygonScan não configuradas.")

        self.w3 = Web3(Web3.HTTPProvider(self.alchemy_url))
        self.polygonscan_api_url = "https://api.polygonscan.com/api"

    def get_matic_balance(self, wallet_address: str):
        """Busca o saldo de MATIC de uma carteira e converte de Wei para Ether."""
        if not self.w3.is_address(wallet_address):
            return {"error": "Endereço de carteira inválido."}

        checksum_address = self.w3.to_checksum_address(wallet_address)
        balance_wei = self.w3.eth.get_balance(checksum_address)
        balance_ether = self.w3.from_wei(balance_wei, 'ether')
        return {"address": wallet_address, "balance_matic": f"{balance_ether:.6f}"}

    def get_transaction_history(self, wallet_address: str):
        """Busca o histórico de transações de uma carteira usando a API do PolygonScan."""
        params = {
            "module": "account",
            "action": "txlist",
            "address": wallet_address,
            "startblock": 0,
            "endblock": 99999999,
            "sort": "desc",
            "apikey": self.polygonscan_api_key
        }
        try:
            response = requests.get(self.polygonscan_api_url, params=params)
            response.raise_for_status()
            data = response.json()
            if data["status"] == "1":
                return {"address": wallet_address, "transactions": data["result"]}
            else:
                return {"address": wallet_address, "transactions": [], "message": data["message"]}
        except requests.exceptions.RequestException as e:
            return {"error": f"Falha ao contatar a API do PolygonScan: {e}"}