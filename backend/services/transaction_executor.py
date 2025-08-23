import time
from web3 import Web3

class TransactionExecutor:
    def __init__(self, w3: Web3, public_address: str, private_key: str):
        self.w3 = w3
        self.public_address = public_address
        self.private_key = private_key

        # Uniswap V3 SwapRouter na Polygon Mainnet
        self.uniswap_router_address = self.w3.to_checksum_address("0xE592427A0AEce92De3Edee1F18E0157C05861564")

        self.uniswap_router_abi = '[{"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct ISwapRouter.ExactInputSingleParams","name":"params","type":"tuple"}],"name":"exactInputSingle","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"}]'

        self.uniswap_contract = self.w3.eth.contract(address=self.uniswap_router_address, abi=self.uniswap_router_abi)

    def execute_swap(self, token_in_address: str, token_out_address: str, amount_in_wei: int):
        """Executa um swap de token_in para token_out."""
        print(f"  Iniciando swap de {amount_in_wei} Wei do token {token_in_address} para {token_out_address}...")

        try:
            params = {
                'tokenIn': self.w3.to_checksum_address(token_in_address),
                'tokenOut': self.w3.to_checksum_address(token_out_address),
                'fee': 3000,
                'recipient': self.public_address,
                'deadline': int(time.time()) + 600,
                'amountIn': amount_in_wei,
                'amountOutMinimum': 0,
                'sqrtPriceLimitX96': 0
            }

            tx = self.uniswap_contract.functions.exactInputSingle(params).build_transaction({
                'from': self.public_address,
                'nonce': self.w3.eth.get_transaction_count(self.public_address),
                'gas': 500000,
                'gasPrice': self.w3.eth.gas_price
            })

            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)

            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            print(f"    --> Transação de swap enviada! Hash: {tx_hash.hex()}")

            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            print(f"    --> Transação confirmada no bloco: {tx_receipt.blockNumber}")

            return {"success": True, "tx_hash": tx_hash.hex()}

        except Exception as e:
            print(f"    --> ERRO ao executar swap: {e}")
            return {"success": False, "error": str(e)}