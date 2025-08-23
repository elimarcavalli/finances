import time
from web3 import Web3
import os
from services.database_service import DatabaseService
from services.blockchain_service import BlockchainService
from services.transaction_executor import TransactionExecutor

def main():
    print("Iniciando o Worker do Bot de Trade... MODO DE EXECUÇÃO ATIVO.")
    db_service = DatabaseService()
    blockchain_service = BlockchainService()

    # Endereços para Polygon Mainnet
    WMATIC_ADDRESS = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"  # WMATIC na Mainnet
    USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"   # USDC.e na Mainnet

    while True:
        try:
            print("\n--- Novo ciclo de verificação ---")
            wallets = db_service.get_all_wallets()

            if not wallets:
                print("Nenhuma carteira encontrada para gerenciar. Adicione uma via API POST /wallets.")

            for wallet in wallets:
                print(f"Analisando carteira: {wallet['name']} (ID: {wallet['id']})")

                balance_data = blockchain_service.get_matic_balance(wallet['public_address'])
                current_balance = float(balance_data.get('balance_matic', 0))
                print(f"  Saldo atual: {current_balance:.4f} MATIC")

                if current_balance > 0.1:
                    print(f"  --> Decisão: VENDER 0.05 MATIC por USDC")

                    private_key = db_service.get_decrypted_private_key(wallet['id'])
                    if not private_key:
                        print(f"  --> Carteira '{wallet['name']}' é somente leitura. Ignorando trade.")
                        continue

                    executor = TransactionExecutor(
                        w3=blockchain_service.w3,
                        public_address=wallet['public_address'],
                        private_key=private_key
                    )

                    amount_to_swap_wei = Web3.to_wei(0.05, 'ether')

                    result = executor.execute_swap(WMATIC_ADDRESS, USDC_ADDRESS, amount_to_swap_wei)
                    print(f"  Resultado da execução: {result}")
                else:
                    print("  --> Decisão: AGUARDAR (saldo de MATIC baixo).")

        except Exception as e:
            print(f"Ocorreu um erro CRÍTICO no ciclo do worker: {e}")

        print("Aguardando 15 segundos para o próximo ciclo...")
        time.sleep(15)

if __name__ == "__main__":
    main()