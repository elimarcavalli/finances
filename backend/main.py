from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from services.blockchain_service import BlockchainService
from services.database_service import DatabaseService
from services.auth_service import create_access_token, get_current_user, get_password_hash, verify_password
from services.strategy_service import StrategyService
from services.account_service import AccountService
from services.asset_service import AssetService
from services.asset_holding_service import AssetHoldingService
from services.transaction_service import TransactionService
from services.accounts_receivable_service import AccountsReceivableService
from services.summary_service import SummaryService
from services.wallet_sync_service import WalletSyncService
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import json
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

# Middleware de debug para CORS
@app.middleware("http")
async def debug_cors(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    response = await call_next(request)
    
    logger.info(f"Response status: {response.status_code}")
    logger.info(f"Response headers: {dict(response.headers)}")
    
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174", 
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Accept-Language", "Content-Language", "Content-Type", "Authorization"],
    expose_headers=["*"]
)

blockchain_service = BlockchainService()
database_service = DatabaseService()
strategy_service = StrategyService()

# Inicializar novos serviços financeiros
account_service = AccountService(database_service)
asset_service = AssetService(database_service)
asset_holding_service = AssetHoldingService(database_service)
transaction_service = TransactionService(database_service)
accounts_receivable_service = AccountsReceivableService(database_service)
summary_service = SummaryService(database_service)
wallet_sync_service = WalletSyncService(database_service)

class WalletCreate(BaseModel):
    name: str
    public_address: str
    private_key: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    user_level: Optional[int] = 1  # 1=user, 2=admin

class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parameters: dict  # JSON parameters for the strategy

class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[dict] = None

class BacktestCreate(BaseModel):
    strategy_id: int
    start_date: str  # ISO format datetime string
    end_date: str    # ISO format datetime string
    initial_balance_usdt: float

class WalletAssociate(BaseModel):
    public_address: str
    wallet_name: str

class VaultCreate(BaseModel):
    contract_address: str
    strategy_name: str
    user_wallet_id: int

# === NOVOS MODELOS PARA FUNDAÇÃO FINANCEIRA ===

class AccountCreate(BaseModel):
    name: str
    type: str  # ENUM values
    institution: Optional[str] = None
    balance: Optional[float] = 0.00
    credit_limit: Optional[float] = 0.00
    invoice_due_day: Optional[int] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    institution: Optional[str] = None
    balance: Optional[float] = None
    credit_limit: Optional[float] = None
    invoice_due_day: Optional[int] = None

class AssetCreate(BaseModel):
    symbol: str
    name: str
    asset_class: str  # ENUM values
    price_api_identifier: Optional[str] = None

class AssetUpdate(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    asset_class: Optional[str] = None
    price_api_identifier: Optional[str] = None

class AssetHoldingCreate(BaseModel):
    account_id: int
    asset_id: int
    quantity: float
    average_buy_price: Optional[float] = None
    acquisition_date: Optional[date] = None

class AssetHoldingUpdate(BaseModel):
    account_id: Optional[int] = None
    asset_id: Optional[int] = None
    quantity: Optional[float] = None
    average_buy_price: Optional[float] = None
    acquisition_date: Optional[date] = None

class TransactionCreate(BaseModel):
    description: str
    amount: float
    transaction_date: date
    type: str  # ENUM: RECEITA, DESPESA, TRANSFERENCIA
    category: Optional[str] = None
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    status: str = "PENDENTE"  # ENUM: EFETIVADO, PENDENTE

class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    transaction_date: Optional[date] = None
    type: Optional[str] = None
    category: Optional[str] = None
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    status: Optional[str] = None

class AccountsReceivableCreate(BaseModel):
    description: str
    debtor_name: Optional[str] = None
    total_amount: float
    due_date: Optional[date] = None
    status: str = "PENDENTE"  # ENUM: PENDENTE, PAGO, ATRASADO
    expected_account_id: Optional[int] = None

class AccountsReceivableUpdate(BaseModel):
    description: Optional[str] = None
    debtor_name: Optional[str] = None
    total_amount: Optional[float] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    expected_account_id: Optional[int] = None

class WalletAccountCreate(BaseModel):
    public_address: str
    wallet_name: str

@app.get("/")
async def root():
    return {"message": "Crypto Bot Backend is running"}

@app.get("/wallet/{wallet_address}/balance")
async def get_balance(wallet_address: str, current_user: dict = Depends(get_current_user)):
    return blockchain_service.get_matic_balance(wallet_address)

@app.get("/wallet/{wallet_address}/transactions")
async def get_transactions(wallet_address: str, current_user: dict = Depends(get_current_user)):
    return blockchain_service.get_transaction_history(wallet_address)

# === ENDPOINTS PARA ASSOCIAÇÃO DE CARTEIRAS WEB3 ===

@app.post("/user-wallets/associate")
async def associate_wallet(wallet_data: WalletAssociate, current_user: dict = Depends(get_current_user)):
    """Associa uma carteira ao usuário autenticado"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Upsert wallet (busca ou cria)
        wallet_id = database_service.upsert_wallet(wallet_data.public_address)
        
        # Cria associação
        association = database_service.associate_wallet_to_user(
            user_id=user_id,
            wallet_id=wallet_id,
            wallet_name=wallet_data.wallet_name
        )
        
        return {"message": "Wallet associated successfully", "association": association}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/user-wallets")
async def get_user_wallets(current_user: dict = Depends(get_current_user)):
    """Retorna todas as carteiras associadas ao usuário autenticado"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    wallets = database_service.get_user_wallets(user_id)
    return {"wallets": wallets}

@app.delete("/user-wallets/{association_id}")
async def remove_wallet_association(association_id: int, current_user: dict = Depends(get_current_user)):
    """Remove a associação entre usuário e carteira"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    success = database_service.remove_wallet_association(association_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Association not found or not owned by user")
    
    return {"message": "Wallet association removed successfully"}

@app.post("/users/register")
async def register_user(user: UserCreate):
    hashed_password = get_password_hash(user.password)
    cursor = database_service.connection.cursor()
    try:
        query = """INSERT INTO users (user_name, password_hash, email, user_level, created_at, updated_at) 
                   VALUES (%s, %s, %s, %s, NOW(), NOW())"""
        cursor.execute(query, (user.username, hashed_password, user.email, user.user_level))
        database_service.connection.commit()
    except Exception as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
    return {"username": user.username, "email": user.email, "user_level": user.user_level}

@app.options("/login")
async def options_login():
    return {"message": "OK"}

@app.post("/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        logger.info(f"Login attempt for user: {form_data.username}")
        
        # Usar uma nova instância do database service para evitar conflitos
        temp_db = DatabaseService()
        cursor = temp_db.connection.cursor(dictionary=True)
        
        try:
            cursor.execute("SELECT * FROM users WHERE user_name = %s", (form_data.username,))
            user = cursor.fetchone()
            logger.info(f"User found: {bool(user)}")
            
            if not user or not verify_password(form_data.password, user['password_hash']):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect username or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Atualizar last_login
            cursor.execute("UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = %s", (user['id'],))
            temp_db.connection.commit()
            
            access_token = create_access_token(data={"sub": user['user_name']})
            return {"access_token": access_token, "token_type": "bearer"}
        finally:
            cursor.close()
            temp_db.connection.close()
            
    except HTTPException:
        # Re-raise HTTPException para manter o status code correto
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/logout")
async def logout_user(current_user: dict = Depends(get_current_user)):
    cursor = database_service.connection.cursor()
    cursor.execute("UPDATE users SET last_logout = NOW(), updated_at = NOW() WHERE user_name = %s", (current_user['username'],))
    database_service.connection.commit()
    cursor.close()
    return {"message": "Logout successful"}

# DEPRECATED: Este endpoint será removido após migração completa para Web3
@app.get("/wallets")
async def list_wallets_deprecated(current_user: dict = Depends(get_current_user)):
    """DEPRECATED: Use /user-wallets instead"""
    return database_service.get_all_wallets()

# === ENDPOINTS PARA ESTRATÉGIAS ===

@app.post("/strategies")
async def create_strategy(strategy: StrategyCreate, current_user: dict = Depends(get_current_user)):
    """Criar uma nova estratégia de trading"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_strategy = strategy_service.create_strategy(user_id, strategy.dict())
        return new_strategy
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/strategies")
async def list_strategies(current_user: dict = Depends(get_current_user)):
    """Listar todas as estratégias do usuário"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        strategies = strategy_service.get_strategies_by_user(user_id)
        return {"strategies": strategies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/strategies/{strategy_id}")
async def get_strategy(strategy_id: int, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de uma estratégia específica"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        strategy = strategy_service.get_strategy_by_id(strategy_id, user_id)
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        
        return strategy
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.put("/strategies/{strategy_id}")
async def update_strategy(strategy_id: int, strategy: StrategyUpdate, current_user: dict = Depends(get_current_user)):
    """Atualizar uma estratégia existente"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Filtrar apenas campos não-None para atualização
        update_data = {k: v for k, v in strategy.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        updated_strategy = strategy_service.update_strategy(strategy_id, user_id, update_data)
        return updated_strategy
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar uma estratégia"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        deleted = strategy_service.delete_strategy(strategy_id, user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Strategy not found or not owned by user")
        
        return {"message": "Strategy deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# === ENDPOINTS PARA STRATEGY VAULTS ===

@app.post("/vaults")
async def create_vault(vault: VaultCreate, current_user: dict = Depends(get_current_user)):
    """Registra um novo Strategy Vault para o usuário"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        vault_id = database_service.create_vault(
            user_wallet_id=vault.user_wallet_id,
            contract_address=vault.contract_address,
            strategy_name=vault.strategy_name
        )
        
        return {"message": "Vault registered successfully", "vault_id": vault_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/vaults")
async def get_user_vaults(current_user: dict = Depends(get_current_user)):
    """Lista todos os vaults do usuário logado"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    vaults = database_service.get_user_vaults_list(user_id)
    return {"vaults": vaults}

@app.get("/vaults/{vault_id}")
async def get_vault_details(vault_id: int, current_user: dict = Depends(get_current_user)):
    """Obtém detalhes de um vault específico"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    vault = database_service.get_vault_by_id(vault_id, user_id)
    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found")
    
    return vault

@app.delete("/vaults/{vault_id}")
async def delete_vault(vault_id: int, current_user: dict = Depends(get_current_user)):
    """Remove um vault do usuário"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    success = database_service.delete_vault(vault_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Vault not found or not owned by user")
    
    return {"message": "Vault deleted successfully"}

# === ENDPOINTS PARA BACKTESTING ===

@app.post("/backtests")
async def create_backtest(backtest: BacktestCreate, current_user: dict = Depends(get_current_user)):
    """Iniciar um novo backtest para uma estratégia"""
    return {"message": "Backtest started successfully"}

@app.get("/backtests")
async def list_backtests(current_user: dict = Depends(get_current_user)):
    """Listar todos os backtests do usuário"""
    return {"message": "List of all backtests"}

@app.get("/backtests/{backtest_id}")
async def get_backtest(backtest_id: int, current_user: dict = Depends(get_current_user)):
    """Obter status e resultados de um backtest específico"""
    return {"message": f"Status and results for backtest {backtest_id}"}

# === ENDPOINTS DA FUNDAÇÃO FINANCEIRA ===

# === ACCOUNTS ENDPOINTS ===
@app.post("/accounts")
async def create_account(account: AccountCreate, current_user: dict = Depends(get_current_user)):
    """Criar uma nova conta"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        account_data = account.model_dump()
        new_account = account_service.create_account(user_id, account_data)
        return new_account
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/accounts")
async def list_accounts(current_user: dict = Depends(get_current_user)):
    """Listar todas as contas do usuário"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    accounts = account_service.get_accounts_by_user(user_id)
    return {"accounts": accounts}

@app.get("/accounts/{account_id}")
async def get_account(account_id: int, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de uma conta específica"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    account = account_service.get_account_by_id(user_id, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return account

@app.put("/accounts/{account_id}")
async def update_account(account_id: int, account: AccountUpdate, current_user: dict = Depends(get_current_user)):
    """Atualizar uma conta existente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        account_data = {k: v for k, v in account.model_dump().items() if v is not None}
        updated_account = account_service.update_account(user_id, account_id, account_data)
        return updated_account
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/accounts/{account_id}")
async def delete_account(account_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar uma conta"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        success = account_service.delete_account(user_id, account_id)
        if not success:
            raise HTTPException(status_code=404, detail="Account not found")
        return {"message": "Account deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === WALLET CRYPTO ENDPOINTS (Passo 24) ===
@app.post("/accounts/from-wallet")
async def create_account_from_wallet(wallet_data: WalletAccountCreate, current_user: dict = Depends(get_current_user)):
    """
    Cria automaticamente uma conta CARTEIRA_CRIPTO após conectar uma carteira
    e sincroniza suas posições de ativos on-chain
    """
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # 1. Criar nova conta do tipo CARTEIRA_CRIPTO
        account_data = {
            "name": wallet_data.wallet_name,
            "type": "CARTEIRA_CRIPTO",
            "institution": "Blockchain",
            "balance": 0.00,
            "public_address": wallet_data.public_address
        }
        
        new_account = account_service.create_account(user_id, account_data)
        account_id = new_account["id"]
        
        # 2. Sincronizar posições on-chain imediatamente
        sync_result = wallet_sync_service.sync_wallet_holdings(
            user_id=user_id,
            account_id=account_id,
            public_address=wallet_data.public_address
        )
        
        # 3. Buscar a conta atualizada com as posições sincronizadas
        updated_account = account_service.get_account_by_id(user_id, account_id)
        
        return {
            "account": updated_account,
            "sync_result": sync_result,
            "message": "Wallet account created and synchronized successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating wallet account: {str(e)}")

@app.post("/accounts/{account_id}/sync")
async def sync_wallet_account(account_id: int, current_user: dict = Depends(get_current_user)):
    """
    Ressincroniza uma conta de carteira cripto com a blockchain
    """
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # 1. Buscar a conta e verificar se é do tipo CARTEIRA_CRIPTO
        account = account_service.get_account_by_id(user_id, account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        if account["type"] != "CARTEIRA_CRIPTO":
            raise HTTPException(status_code=400, detail="Account is not a crypto wallet")
        
        public_address = account.get("public_address")
        if not public_address:
            raise HTTPException(status_code=400, detail="Account does not have a public address")
        
        # 2. Executar sincronização
        sync_result = wallet_sync_service.sync_wallet_holdings(
            user_id=user_id,
            account_id=account_id,
            public_address=public_address
        )
        
        # 3. Buscar a conta atualizada
        updated_account = account_service.get_account_by_id(user_id, account_id)
        
        return {
            "account": updated_account,
            "sync_result": sync_result,
            "message": "Wallet synchronized successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing wallet: {str(e)}")

# === ASSETS ENDPOINTS ===
@app.post("/assets")
async def create_asset(asset: AssetCreate, current_user: dict = Depends(get_current_user)):
    """Criar um novo ativo"""
    try:
        asset_data = asset.model_dump()
        new_asset = asset_service.create_asset(asset_data)
        return new_asset
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/assets")
async def list_assets(asset_class: Optional[str] = None):
    """Listar todos os ativos, opcionalmente filtrados por classe"""
    assets = asset_service.get_all_assets(asset_class)
    return {"assets": assets}

@app.get("/assets/{asset_id}")
async def get_asset(asset_id: int):
    """Obter detalhes de um ativo específico"""
    asset = asset_service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return asset

@app.put("/assets/{asset_id}")
async def update_asset(asset_id: int, asset: AssetUpdate, current_user: dict = Depends(get_current_user)):
    """Atualizar um ativo existente"""
    try:
        asset_data = {k: v for k, v in asset.model_dump().items() if v is not None}
        updated_asset = asset_service.update_asset(asset_id, asset_data)
        return updated_asset
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/assets/{asset_id}")
async def delete_asset(asset_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar um ativo"""
    try:
        success = asset_service.delete_asset(asset_id)
        if not success:
            raise HTTPException(status_code=404, detail="Asset not found")
        return {"message": "Asset deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === ASSET HOLDINGS ENDPOINTS ===
@app.post("/holdings")
async def create_holding(holding: AssetHoldingCreate, current_user: dict = Depends(get_current_user)):
    """Criar uma nova posição de ativo"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        holding_data = holding.model_dump()
        new_holding = asset_holding_service.create_holding(user_id, holding_data)
        return new_holding
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/holdings")
async def list_holdings(account_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """Listar todas as posições do usuário"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    holdings = asset_holding_service.get_holdings_by_user(user_id, account_id)
    return {"holdings": holdings}


@app.get("/holdings/summary")
async def get_holdings_summary(current_user: dict = Depends(get_current_user)):
    """Obter resumo das posições agrupadas por ativo"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    summary = asset_holding_service.get_holdings_summary_by_user(user_id)
    return {"summary": summary}

@app.get("/holdings/{holding_id}")
async def get_holding(holding_id: int, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de uma posição específica"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    holding = asset_holding_service.get_holding_by_id(user_id, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    return holding

@app.put("/holdings/{holding_id}")
async def update_holding(holding_id: int, holding: AssetHoldingUpdate, current_user: dict = Depends(get_current_user)):
    """Atualizar uma posição existente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        holding_data = {k: v for k, v in holding.model_dump().items() if v is not None}
        updated_holding = asset_holding_service.update_holding(user_id, holding_id, holding_data)
        return updated_holding
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/holdings/{holding_id}")
async def delete_holding(holding_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar uma posição"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        success = asset_holding_service.delete_holding(user_id, holding_id)
        if not success:
            raise HTTPException(status_code=404, detail="Holding not found")
        return {"message": "Holding deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === TRANSACTIONS ENDPOINTS ===
@app.post("/transactions")
async def create_transaction(transaction: TransactionCreate, current_user: dict = Depends(get_current_user)):
    """Criar uma nova transação"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        transaction_data = transaction.model_dump()
        new_transaction = transaction_service.create_transaction(user_id, transaction_data)
        return new_transaction
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/transactions")
async def list_transactions(
    account_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar transações do usuário com filtro opcional por conta"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    transactions = transaction_service.get_transactions_by_user(user_id, account_id)
    return {"transactions": transactions}

@app.get("/transactions/summary")
async def get_transactions_summary(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obter resumo das transações por categoria e tipo"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    summary = transaction_service.get_transactions_summary(user_id, start_date, end_date)
    return {"summary": summary}

@app.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: int, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de uma transação específica"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    transaction = transaction_service.get_transaction_by_id(user_id, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return transaction

@app.put("/transactions/{transaction_id}")
async def update_transaction(transaction_id: int, transaction: TransactionUpdate, current_user: dict = Depends(get_current_user)):
    """Atualizar uma transação existente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        transaction_data = {k: v for k, v in transaction.model_dump().items() if v is not None}
        updated_transaction = transaction_service.update_transaction(user_id, transaction_id, transaction_data)
        return updated_transaction
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar uma transação"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        success = transaction_service.delete_transaction(user_id, transaction_id)
        if not success:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return {"message": "Transaction deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === SUMMARY ENDPOINTS FOR DASHBOARD ===
@app.get("/summary/net-worth")
async def get_net_worth(current_user: dict = Depends(get_current_user)):
    """Calcular o Patrimônio Líquido total do usuário"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    cursor = database_service.connection.cursor(dictionary=True)
    try:
        # Soma dos saldos de contas (excluindo cartões de crédito)
        accounts_query = """
            SELECT SUM(balance) as total_accounts
            FROM accounts 
            WHERE user_id = %s AND type != 'CARTAO_CREDITO'
        """
        cursor.execute(accounts_query, (user_id,))
        accounts_result = cursor.fetchone()
        total_accounts = accounts_result['total_accounts'] or 0
        
        # Soma do valor de mercado das posições de ativos
        holdings_query = """
            SELECT 
                ah.quantity,
                a.price_api_identifier
            FROM asset_holdings ah
            JOIN assets a ON ah.asset_id = a.id
            WHERE ah.user_id = %s
        """
        cursor.execute(holdings_query, (user_id,))
        holdings = cursor.fetchall()
        
        total_holdings_value = 0
        if holdings:
            # Coletar identificadores únicos de API
            api_identifiers = list(set([h['price_api_identifier'] for h in holdings if h['price_api_identifier']]))
            
            # Buscar preços em lote
            if api_identifiers:
                from services.price_service import PriceService
                prices = PriceService.get_multiple_prices(api_identifiers)
                
                # Calcular valor total das posições
                for holding in holdings:
                    api_id = holding.get('price_api_identifier')
                    if api_id and api_id in prices and prices[api_id]:
                        price_data = prices[api_id]
                        total_holdings_value += float(holding['quantity']) * price_data['brl']
        
        # TODO: Implementar liabilities (dívidas) quando necessário
        total_liabilities = 0
        
        net_worth = total_accounts + total_holdings_value - total_liabilities
        
        return {
            "net_worth": net_worth,
            "accounts_total": total_accounts,
            "holdings_total": total_holdings_value,
            "liabilities_total": total_liabilities
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating net worth: {str(e)}")
    finally:
        cursor.close()

@app.get("/summary/asset-allocation")
async def get_asset_allocation(current_user: dict = Depends(get_current_user)):
    """Agrupar posições por classe de ativo"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    cursor = database_service.connection.cursor(dictionary=True)
    try:
        query = """
            SELECT 
                a.asset_class,
                ah.quantity,
                a.price_api_identifier
            FROM asset_holdings ah
            JOIN assets a ON ah.asset_id = a.id
            WHERE ah.user_id = %s
        """
        cursor.execute(query, (user_id,))
        holdings = cursor.fetchall()
        
        if not holdings:
            return {"allocation": []}
        
        # Agrupar por classe de ativo
        class_totals = {}
        
        # Coletar identificadores únicos de API
        api_identifiers = list(set([h['price_api_identifier'] for h in holdings if h['price_api_identifier']]))
        
        prices = {}
        if api_identifiers:
            from services.price_service import PriceService
            prices = PriceService.get_multiple_prices(api_identifiers)
        
        # Calcular valor por classe
        for holding in holdings:
            asset_class = holding['asset_class']
            api_id = holding.get('price_api_identifier')
            
            if api_id and api_id in prices and prices[api_id]:
                price_data = prices[api_id]
                value = float(holding['quantity']) * price_data['brl']
                
                if asset_class not in class_totals:
                    class_totals[asset_class] = 0
                class_totals[asset_class] += value
        
        # Calcular total e percentuais
        total_value = sum(class_totals.values())
        allocation = []
        
        for asset_class, value in class_totals.items():
            percentage = (value / total_value * 100) if total_value > 0 else 0
            allocation.append({
                "asset_class": asset_class,
                "total_value": value,
                "percentage": percentage
            })
        
        return {"allocation": allocation, "total_portfolio_value": total_value}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating asset allocation: {str(e)}")
    finally:
        cursor.close()

@app.get("/summary/cash-flow")
async def get_cash_flow(current_user: dict = Depends(get_current_user)):
    """Resumo de fluxo de caixa dos últimos 30 dias"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    cursor = database_service.connection.cursor(dictionary=True)
    try:
        query = """
            SELECT 
                type,
                SUM(amount) as total
            FROM transactions 
            WHERE user_id = %s 
                AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                AND type IN ('RECEITA', 'DESPESA')
            GROUP BY type
        """
        cursor.execute(query, (user_id,))
        results = cursor.fetchall()
        
        cash_flow = {
            "total_income": 0,
            "total_expenses": 0,
            "net_cash_flow": 0
        }
        
        for result in results:
            if result['type'] == 'RECEITA':
                cash_flow['total_income'] = result['total'] or 0
            elif result['type'] == 'DESPESA':
                cash_flow['total_expenses'] = result['total'] or 0
        
        cash_flow['net_cash_flow'] = cash_flow['total_income'] - cash_flow['total_expenses']
        
        return cash_flow
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating cash flow: {str(e)}")
    finally:
        cursor.close()

@app.get("/summary/dashboard")
async def get_dashboard_summary(current_user: dict = Depends(get_current_user)):
    """Endpoint consolidado do dashboard com todos os KPIs"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        dashboard_data = summary_service.get_dashboard_summary(user_id)
        return dashboard_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting dashboard summary: {str(e)}")

@app.get("/summary/cash-flow-chart")
async def get_cash_flow_chart(period: str = "monthly", current_user: dict = Depends(get_current_user)):
    """Endpoint para dados do gráfico de fluxo de caixa"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        chart_data = summary_service.get_cash_flow_chart_data(user_id, period)
        return chart_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting cash flow chart data: {str(e)}")

# === ACCOUNTS RECEIVABLE ENDPOINTS ===
@app.post("/accounts-receivable")
async def create_receivable(receivable: AccountsReceivableCreate, current_user: dict = Depends(get_current_user)):
    """Criar uma nova conta a receber"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        receivable_data = receivable.model_dump()
        new_receivable = accounts_receivable_service.create_receivable(user_id, receivable_data)
        return new_receivable
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/accounts-receivable")
async def list_receivables(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Listar contas a receber do usuário"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    receivables = accounts_receivable_service.get_receivables_by_user(user_id, status)
    return {"receivables": receivables}

@app.get("/accounts-receivable/overdue")
async def get_overdue_receivables(current_user: dict = Depends(get_current_user)):
    """Listar contas a receber em atraso"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    overdue = accounts_receivable_service.get_overdue_receivables(user_id)
    return {"overdue": overdue}

@app.get("/accounts-receivable/summary")
async def get_receivables_summary(current_user: dict = Depends(get_current_user)):
    """Obter resumo das contas a receber por status"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    summary = accounts_receivable_service.get_receivables_summary(user_id)
    return {"summary": summary}

@app.get("/accounts-receivable/{receivable_id}")
async def get_receivable(receivable_id: int, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de uma conta a receber específica"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    receivable = accounts_receivable_service.get_receivable_by_id(user_id, receivable_id)
    if not receivable:
        raise HTTPException(status_code=404, detail="Receivable not found")
    
    return receivable

@app.put("/accounts-receivable/{receivable_id}")
async def update_receivable(receivable_id: int, receivable: AccountsReceivableUpdate, current_user: dict = Depends(get_current_user)):
    """Atualizar uma conta a receber existente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        receivable_data = {k: v for k, v in receivable.model_dump().items() if v is not None}
        updated_receivable = accounts_receivable_service.update_receivable(user_id, receivable_id, receivable_data)
        return updated_receivable
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/accounts-receivable/{receivable_id}/mark-paid")
async def mark_receivable_as_paid(receivable_id: int, transaction_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """Marcar uma conta a receber como paga"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        updated_receivable = accounts_receivable_service.mark_as_paid(user_id, receivable_id, transaction_id)
        return updated_receivable
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/accounts-receivable/{receivable_id}")
async def delete_receivable(receivable_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar uma conta a receber"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        success = accounts_receivable_service.delete_receivable(user_id, receivable_id)
        if not success:
            raise HTTPException(status_code=404, detail="Receivable not found")
        return {"message": "Receivable deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === ENDPOINT TEMPORÁRIO PARA DEMONSTRAÇÃO ===
@app.get("/demo/dashboard")
async def get_dashboard_demo():
    """Endpoint temporário para demonstrar dashboard com dados reais"""
    try:
        user_id = 10  # Usuário test com dados cadastrados
        dashboard_data = summary_service.get_dashboard_summary(user_id)
        return dashboard_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting dashboard summary: {str(e)}")

@app.get("/demo/cash-flow-chart")
async def get_cash_flow_chart_demo(period: str = "monthly"):
    """Endpoint temporário para demonstrar cash flow chart com dados reais"""
    try:
        user_id = 10  # Usuário test com dados cadastrados
        chart_data = summary_service.get_cash_flow_chart_data(user_id, period)
        return chart_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting cash flow chart data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8002)