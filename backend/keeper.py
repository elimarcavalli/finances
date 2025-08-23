import time
import json
from web3 import Web3
import os
from dotenv import load_dotenv
from services.database_service import DatabaseService
from services.blockchain_service import BlockchainService

load_dotenv()

class StrategyKeeper:
    def __init__(self):
        print("Inicializando Strategy Keeper...")
        
        # Configurações do Keeper
        self.keeper_private_key = os.getenv("KEEPER_PRIVATE_KEY")
        if not self.keeper_private_key:
            raise ValueError("KEEPER_PRIVATE_KEY não encontrada no arquivo .env")
        
        # Inicializar serviços
        self.db_service = DatabaseService()
        self.blockchain_service = BlockchainService()
        
        # Criar conta do Keeper
        self.keeper_account = self.blockchain_service.w3.eth.account.from_key(self.keeper_private_key)
        print(f"Keeper Address: {self.keeper_account.address}")
        
        # Verificar saldo do Keeper
        balance = self.blockchain_service.w3.eth.get_balance(self.keeper_account.address)
        balance_matic = Web3.from_wei(balance, 'ether')
        print(f"💎 Keeper Balance: {balance_matic:.4f} MATIC")
        
        if balance_matic < 0.1:
            print("WARNING: Keeper tem pouco MATIC para gas fees!")
        
        # Carregar ABI do contrato (será atualizado quando o contrato for compilado)
        self.strategy_vault_abi = self._load_strategy_vault_abi()
        
    def _load_strategy_vault_abi(self):
        """Carrega o ABI do contrato StrategyVault"""
        try:
            # Caminho para o arquivo de artifacts do Hardhat
            abi_path = os.path.join(
                os.path.dirname(__file__),
                "..", "smart-contracts", "artifacts", "contracts", 
                "StrategyVault.sol", "StrategyVault.json"
            )
            
            if os.path.exists(abi_path):
                with open(abi_path, 'r') as f:
                    contract_json = json.load(f)
                    return contract_json['abi']
            else:
                print(f"WARNING: ABI não encontrado em: {abi_path}")
                # ABI mínima para funcionar
                return [
                    {
                        "inputs": [],
                        "name": "performStrategyCheck",
                        "outputs": [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                    },
                    {
                        "inputs": [],
                        "name": "getVaultInfo",
                        "outputs": [
                            {"internalType": "address", "name": "_tokenToSpend", "type": "address"},
                            {"internalType": "address", "name": "_tokenToBuy", "type": "address"},
                            {"internalType": "int256", "name": "_targetPrice", "type": "int256"},
                            {"internalType": "uint256", "name": "_amountToSpend", "type": "uint256"},
                            {"internalType": "bool", "name": "_strategyActive", "type": "bool"},
                            {"internalType": "uint256", "name": "_lastExecutionTime", "type": "uint256"},
                            {"internalType": "int256", "name": "_currentPrice", "type": "int256"}
                        ],
                        "stateMutability": "view",
                        "type": "function"
                    }
                ]
                
        except Exception as e:
            print(f"ERRO: Erro ao carregar ABI: {e}")
            return []

    def check_vault(self, vault_address: str) -> dict:
        """Verifica e executa a estratégia de um vault específico"""
        try:
            print(f"Verificando vault: {vault_address}")
            
            # Criar instância do contrato
            contract = self.blockchain_service.w3.eth.contract(
                address=Web3.to_checksum_address(vault_address),
                abi=self.strategy_vault_abi
            )
            
            # Obter informações do vault
            vault_info = contract.functions.getVaultInfo().call()
            
            token_to_spend = vault_info[0]
            token_to_buy = vault_info[1]
            target_price = vault_info[2]
            amount_to_spend = vault_info[3]
            strategy_active = vault_info[4]
            last_execution = vault_info[5]
            current_price = vault_info[6]
            
            print(f"  📊 Token to spend: {token_to_spend}")
            print(f"  📊 Token to buy: {token_to_buy}")
            print(f"  Target price: {target_price}")
            print(f"  Amount to spend: {amount_to_spend}")
            print(f"  Strategy active: {strategy_active}")
            print(f"  Current price: {current_price}")
            
            result = {
                "vault_address": vault_address,
                "strategy_active": strategy_active,
                "current_price": current_price,
                "target_price": target_price,
                "executed": False,
                "transaction_hash": None,
                "error": None
            }
            
            if not strategy_active:
                print(f"  ⏸️  Estratégia inativa")
                return result
            
            if current_price > target_price:
                print(f"  ⏳ Preço atual ({current_price}) > preço alvo ({target_price})")
                return result
            
            # Executar estratégia
            print(f"  Executando estratégia...")
            tx_hash = self._execute_strategy_check(contract)
            
            result["executed"] = True
            result["transaction_hash"] = tx_hash
            print(f"  Estratégia executada! TX: {tx_hash}")
            
            return result
            
        except Exception as e:
            print(f"  ERRO: Erro ao verificar vault {vault_address}: {e}")
            return {
                "vault_address": vault_address,
                "executed": False,
                "error": str(e)
            }

    def _execute_strategy_check(self, contract) -> str:
        """Executa a função performStrategyCheck no contrato"""
        try:
            # Estimar gas
            gas_estimate = contract.functions.performStrategyCheck().estimate_gas({
                'from': self.keeper_account.address
            })
            
            # Adicionar margem de segurança
            gas_limit = int(gas_estimate * 1.2)
            
            # Obter gas price atual
            gas_price = self.blockchain_service.w3.eth.gas_price
            
            # Construir transação
            transaction = contract.functions.performStrategyCheck().build_transaction({
                'from': self.keeper_account.address,
                'gas': gas_limit,
                'gasPrice': gas_price,
                'nonce': self.blockchain_service.w3.eth.get_transaction_count(self.keeper_account.address),
            })
            
            # Assinar transação
            signed_txn = self.blockchain_service.w3.eth.account.sign_transaction(
                transaction, 
                private_key=self.keeper_private_key
            )
            
            # Enviar transação
            tx_hash = self.blockchain_service.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Aguardar confirmação
            receipt = self.blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if receipt.status == 1:
                return receipt.transactionHash.hex()
            else:
                raise Exception("Transaction failed")
                
        except Exception as e:
            raise Exception(f"Failed to execute strategy check: {e}")

    def run_keeper_loop(self):
        """Loop principal do Keeper"""
        print("🔄 Iniciando loop do Keeper...")
        
        while True:
            try:
                print(f"\n--- 🤖 Novo ciclo do Keeper ---")
                
                # Buscar todos os vaults registrados
                vaults = self.db_service.get_all_vault_addresses()
                
                if not vaults:
                    print("📭 Nenhum vault registrado encontrado")
                else:
                    print(f"📊 Encontrados {len(vaults)} vaults para verificar")
                    
                    for vault in vaults:
                        contract_address = vault['contract_address']
                        vault_id = vault['id']
                        
                        result = self.check_vault(contract_address)
                        
                        if result.get('executed'):
                            print(f"Vault {vault_id} executado com sucesso!")
                        elif result.get('error'):
                            print(f"ERRO: Erro no vault {vault_id}: {result['error']}")
                
                # Verificar saldo do Keeper
                balance = self.blockchain_service.w3.eth.get_balance(self.keeper_account.address)
                balance_matic = Web3.from_wei(balance, 'ether')
                
                if balance_matic < 0.05:
                    print(f"WARNING: Keeper com pouco MATIC ({balance_matic:.4f})")
                
                print(f"💤 Aguardando 5 segundos para próximo ciclo...")
                time.sleep(5)
                
            except Exception as e:
                print(f"💥 Erro crítico no Keeper: {e}")
                print("⏱️  Tentando novamente em 30 segundos...")
                time.sleep(10)

def main():
    try:
        keeper = StrategyKeeper()
        keeper.run_keeper_loop()
    except KeyboardInterrupt:
        print("\n👋 Keeper interrompido pelo usuário")
    except Exception as e:
        print(f"Erro fatal: {e}")

if __name__ == "__main__":
    main()