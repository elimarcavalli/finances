from fastapi import FastAPI, Depends, HTTPException, status, Request, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.exceptions import RequestValidationError
from api.chart_routes import router as chart_router
from api.optimization_routes import router as optimization_router
from api.historical_data_routes import router as historical_data_router
from api.datafeed_routes import router as datafeed_router
from middleware.error_handler import ErrorHandlerMiddleware
from services.blockchain_service import BlockchainService
from services.database_service import DatabaseService
from services.auth_service import create_access_token, get_current_user, get_password_hash, verify_password, ACCESS_TOKEN_EXPIRE_MINUTES
from services.strategy_service import StrategyService
from services.account_service import AccountService
from services.asset_service import AssetService
from services.transaction_service import TransactionService
from services.accounts_receivable_service import AccountsReceivableService
from services.summary_service import SummaryService
from services.wallet_sync_service import WalletSyncService
from services.portfolio_service import PortfolioService
from services.obligation_service import ObligationService
from services.reports_service import ReportsService
from services.optimization_service import OptimizationService
from services.physical_asset_service import PhysicalAssetService
from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional, List
from datetime import date, datetime
import json
import logging
import traceback
import time

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Cria a instância principal da aplicação
app = FastAPI(
    title="Trading System API",
    description="API para gerenciar backtesting, estratégias e visualização de gráficos.",
    version="1.0.0"
)

# Inclui o roteador de gráficos na aplicação principal
# Todas as rotas definidas em chart_routes terão o prefixo /charts
app.include_router(chart_router, prefix="/charts", tags=["Charts"])

# Inclui o roteador de otimização
# Todas as rotas definidas em optimization_routes terão o prefixo /optimization
app.include_router(optimization_router, prefix="/strategy-optimization", tags=["Optimization"])

# Inclui o roteador de dados históricos
# Todas as rotas definidas em historical_data_routes terão o prefixo /historical-data
app.include_router(historical_data_router, prefix="/historical-data", tags=["Historical Data"])

# Inclui o roteador de datafeed para TradingView
# Todas as rotas definidas em datafeed_routes terão o prefixo /datafeed
app.include_router(datafeed_router, prefix="/datafeed", tags=["TradingView Datafeed"])

@app.get("/", tags=["Root"])
async def read_root():
    """Endpoint inicial para verificar se a API está no ar."""
    return {"message": "Finances.mine Online!"}

# Global Exception Handler - Melhorado com mais detalhes
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log detalhado do erro
    logger.error("=" * 80)
    logger.error(f"GLOBAL EXCEPTION HANDLER TRIGGERED")
    logger.error(f"Exception Type: {type(exc).__name__}")
    logger.error(f"Exception Message: {str(exc)}")
    logger.error(f"Request Method: {request.method}")
    logger.error(f"Request URL: {request.url}")
    logger.error(f"Request Path: {request.url.path}")
    
    # Log headers e body se disponível
    try:
        headers = dict(request.headers)
        logger.error(f"Request Headers: {headers}")
    except:
        logger.error("Could not log request headers")
    
    # Log stack trace completo
    logger.error(f"Full Stack Trace:")
    logger.error(traceback.format_exc())
    logger.error("=" * 80)
    
    # Resposta mais amigável baseada no tipo de erro
    if "ValidationError" in str(type(exc).__name__):
        status_code = 400
        detail = "Dados de entrada inválidos"
    elif "IntegrityError" in str(type(exc).__name__) or "mysql.connector" in str(type(exc)):
        status_code = 500
        detail = "Erro interno no banco de dados"
    elif "ValueError" in str(type(exc).__name__):
        status_code = 400
        detail = f"Valor inválido: {str(exc)}"
    else:
        status_code = 500
        detail = "Erro interno do servidor"
    
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "detail": detail,
            "error_type": type(exc).__name__,
            "path": str(request.url.path),
            "timestamp": traceback.format_exc().split('\n')[-2] if traceback.format_exc() else None
        },
        headers={"Access-Control-Allow-Origin": "*"}
    )

# Global HTTP Exception Handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    logger.warning(f"Request: {request.method} {request.url}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log detalhado para o desenvolvedor
    logger.error("=" * 80)
    logger.error(f"REQUEST VALIDATION ERROR (422) TRIGGERED")
    logger.error(f"Request Method: {request.method}")
    logger.error(f"Request URL: {request.url}")
    logger.error(f"Request Path: {request.url.path}")
    logger.error(f"Validation Errors: {exc.errors()}")
    logger.error(f"Request Body: {exc.body}")
    logger.error("=" * 80)
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Erro de validação: Verifique os dados enviados.",
            "errors": exc.errors(),
            "path": str(request.url.path)
        },
    )

# Add error handling middleware first (executes last in chain)
app.add_middleware(ErrorHandlerMiddleware)

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
transaction_service = TransactionService(database_service)
asset_service = AssetService(database_service)
accounts_receivable_service = AccountsReceivableService(database_service)
summary_service = SummaryService(database_service)
wallet_sync_service = WalletSyncService(database_service)

# Importar price_service para o portfolio_service
from services.price_service import PriceService
price_service = PriceService(database_service)
physical_asset_service = PhysicalAssetService(database_service)
portfolio_service = PortfolioService(database_service, price_service)
obligation_service = ObligationService(database_service, transaction_service)
reports_service = ReportsService(database_service)

# ==================== PYDANTIC MODELS FOR OBLIGATIONS ====================

class FinancialObligationCreate(BaseModel):
    description: str
    amount: float
    due_date: date
    type: str  # PAYABLE, RECEIVABLE, TRANSFERENCIA
    category: Optional[str] = None
    entity_name: Optional[str] = None
    notes: Optional[str] = None
    recurring_rule_id: Optional[int] = None

class FinancialObligationUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[date] = None
    category: Optional[str] = None
    entity_name: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class RecurringRuleCreate(BaseModel):
    description: str
    amount: float
    type: str  # PAYABLE, RECEIVABLE, TRANSFERENCIA
    category: Optional[str] = None
    entity_name: Optional[str] = None
    frequency: str  # DAILY, WEEKLY, MONTHLY, YEARLY
    interval_value: int = 1
    start_date: date
    end_date: Optional[date] = None
    is_active: bool = True
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None

class RecurringRuleUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    entity_name: Optional[str] = None
    frequency: Optional[str] = None
    interval_value: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None

class SettleObligationRequest(BaseModel):
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    settlement_date: Optional[date] = None

class ObligationsSummaryResponse(BaseModel):
    payable_next_30d: float
    receivable_next_30d: float

class FinancialObligationResponse(BaseModel):
    id: int
    user_id: int
    description: str
    amount: float
    due_date: date
    type: str
    status: str
    category: Optional[str] = None
    entity_name: Optional[str] = None
    notes: Optional[str] = None
    linked_transaction_id: Optional[int] = None
    recurring_rule_id: Optional[int] = None
    recurring_description: Optional[str] = None

class ObligationsListResponse(BaseModel):
    obligations: List[FinancialObligationResponse]

class RecurringRuleResponse(BaseModel):
    id: int
    user_id: int  
    description: str
    amount: float
    type: str
    category: Optional[str] = None
    entity_name: Optional[str] = None
    frequency: str
    interval_value: int
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None

class PhysicalAssetCreate(BaseModel):
    asset_id: int
    description: str
    acquisition_date: date
    acquisition_cost: Decimal = Field(..., max_digits=20, decimal_places=2)
    current_value: Decimal = Field(..., max_digits=20, decimal_places=2)
    last_valuation_date: date
    notes: Optional[str] = None
    source_account_id: int  # ID da conta de onde o dinheiro saiu

class PhysicalAssetUpdate(PhysicalAssetCreate):
    pass

class PhysicalAssetResponse(BaseModel):
    id: int
    user_id: int
    asset_id: int
    description: str
    acquisition_date: date
    acquisition_cost: Decimal = Field(..., max_digits=20, decimal_places=2)
    current_value: Decimal = Field(..., max_digits=20, decimal_places=2)
    last_valuation_date: date
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    asset_class_name: str
    # PHASE 3: Novos campos
    status: str
    acquisition_transaction_id: Optional[int] = None
    liquidation_transaction_id: Optional[int] = None
    asset_icon_url: Optional[str] = None

class LiquidatePhysicalAssetRequest(BaseModel):
    sale_value: Decimal = Field(..., max_digits=20, decimal_places=2)
    destination_account_id: int
    sale_date: date

class RecurringRulesListResponse(BaseModel):
    rules: List[RecurringRuleResponse]

class SettlementResponse(BaseModel):
    message: str
    obligation_id: int
    transaction_id: int

class AccountsSummaryResponse(BaseModel):
    accounts: List[dict]

# Reports Response Models - usando dict para flexibilidade dos relatórios
class AccountStatementResponse(BaseModel):
    account_info: dict
    period: dict 
    initial_balance: float
    final_balance: float
    transactions: List[dict]

class ExpenseAnalysisResponse(BaseModel):
    period: dict
    total_expenses: float
    categories: List[dict]

class MonthlyChashFlowResponse(BaseModel):
    period: dict
    monthly_cash_flow: List[dict]
    summary: dict

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
    credit_limit: Optional[float] = 0.00
    invoice_due_day: Optional[int] = None
    balance: Optional[float] = 0.00  # Saldo inicial da conta
    public_address: Optional[str] = None
    icon_url: Optional[str] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    institution: Optional[str] = None
    credit_limit: Optional[float] = None
    invoice_due_day: Optional[int] = None
    balance: Optional[float] = None  # Para ajuste de saldo
    public_address: Optional[str] = None  # Permitir campo público
    icon_url: Optional[str] = None
    
    class Config:
        extra = "ignore"  # Ignorar campos extras enviados pelo frontend

class AssetCreate(BaseModel):
    symbol: str
    name: str
    asset_class: str  # ENUM values
    price_api_identifier: Optional[str] = None
    last_price_usdt: Optional[float] = None
    last_price_brl: Optional[float] = None

class AssetUpdate(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    asset_class: Optional[str] = None
    price_api_identifier: Optional[str] = None
    last_price_usdt: Optional[float] = None
    last_price_brl: Optional[float] = None
    icon_url: Optional[str] = None

class AssetPriceUpdate(BaseModel):
    asset_ids: List[int]

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

class AssetMovementCreate(BaseModel):
    account_id: int
    asset_id: int
    movement_type: str  # 'COMPRA', 'VENDA', 'TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SAIDA'
    movement_date: date
    quantity: float
    price_per_unit: Optional[float] = None
    fee: Optional[float] = 0.00
    notes: Optional[str] = None

class AssetMovementUpdate(BaseModel):
    account_id: Optional[int] = None
    asset_id: Optional[int] = None
    movement_type: Optional[str] = None
    movement_date: Optional[date] = None
    quantity: Optional[float] = None
    price_per_unit: Optional[float] = None
    fee: Optional[float] = None
    notes: Optional[str] = None

class WalletAccountCreate(BaseModel):
    public_address: str
    wallet_name: str

# === OPTIMIZATION PYDANTIC MODELS ===

class OptimizationJobCreate(BaseModel):
    base_strategy_name: str
    asset_id: int
    timeframe: str  # '1d', '4h', '1h', etc.
    start_date: date
    end_date: date
    parameter_ranges: dict  # JSON with parameter ranges for optimization

class OptimizationJobResponse(BaseModel):
    id: int
    user_id: int
    base_strategy_name: str
    asset_id: int
    asset_symbol: Optional[str] = None
    asset_name: Optional[str] = None
    timeframe: str
    start_date: date
    end_date: date
    parameter_ranges: dict
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

class OptimizationJobsListResponse(BaseModel):
    jobs: List[OptimizationJobResponse]

class OptimizationResult(BaseModel):
    id: int
    job_id: int
    parameters: dict
    total_trades: int
    win_rate_percent: float
    net_profit_percent: float
    max_drawdown_percent: float
    sharpe_ratio: float
    fitness_score: float
    created_at: datetime

class OptimizationResultsResponse(BaseModel):
    results: List[OptimizationResult]

class BestParametersResponse(BaseModel):
    parameters: dict
    performance_metrics: dict

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
        
        # Usar a instância global do database service (agora é singleton)
        cursor = database_service.connection.cursor(dictionary=True)
        
        try:
            # Primera query: buscar usuário
            cursor.execute("SELECT * FROM users WHERE user_name = %s", (form_data.username,))
            user = cursor.fetchone()
            logger.info(f"User found: {bool(user)}")
            
            if not user or not verify_password(form_data.password, user['password_hash']):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect username or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Consumir todos os resultados restantes e fechar cursor
            cursor.fetchall()  # Garante que não há resultados não lidos
            cursor.close()
            
            # Criar novo cursor para a segunda query
            cursor = database_service.connection.cursor()
            
            # Segunda query: atualizar last_login
            cursor.execute("UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = %s", (user['id'],))
            database_service.connection.commit()
            
            from datetime import timedelta
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": user['user_name']}, 
                expires_delta=access_token_expires
            )
            return {"access_token": access_token, "token_type": "bearer"}
        finally:
            cursor.close()
            # Não fechar a conexão global (singleton)
            
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

@app.get("/accounts/by-address/{public_address}")
async def get_account_by_address(public_address: str, current_user: dict = Depends(get_current_user)):
    """
    Verifica se já existe uma conta do usuário com o endereço público fornecido
    Endpoint para prevenir duplicação de contas de carteira
    """
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Buscar conta por public_address
        cursor = database_service.connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT * FROM accounts 
            WHERE user_id = %s AND public_address = %s
        """, (user_id, public_address))
        
        account = cursor.fetchone()
        cursor.fetchall()  # Garante que não há resultados não lidos
        cursor.close()
        
        if not account:
            raise HTTPException(status_code=404, detail="Account not found for this address")
        
        # Calcular saldo dinâmico usando account_service
        account_with_balance = account_service.get_account_by_id(user_id, account['id'])
        
        return account_with_balance
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking account by address: {str(e)}")

@app.put("/accounts/{account_id}")
async def update_account(account_id: int, account: AccountUpdate, current_user: dict = Depends(get_current_user)):
    """Atualizar uma conta existente"""
    # logger.info(account_id, account, current_user)
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
        sync_result = await wallet_sync_service.sync_wallet_holdings(
            user_id=user_id,
            account_id=account_id,
            public_address=wallet_data.public_address
        )
        
        # 3. Buscar a conta atualizada com as posições sincronizadas
        updated_account = account_service.get_account_by_id(user_id, account_id)
        
        return {
            "account": updated_account,
            "sync_result": sync_result,
            "message": "Carteira criada e sincronizada com sucesso"
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
        
        if account["type"] == "CARTEIRA_CRIPTO":
            # Para CARTEIRA_CRIPTO: Sincronização tradicional com blockchain
            public_address = account.get("public_address")
            if not public_address:
                raise HTTPException(status_code=400, detail="Account does not have a public address")
            
            # 2. Executar sincronização com blockchain
            sync_result = await wallet_sync_service.sync_wallet_holdings(
                user_id=user_id,
                account_id=account_id,
                public_address=public_address
            )
            
        elif account["type"] == "CORRETORA_CRIPTO":
            # Para CORRETORA_CRIPTO: Atualizar preços dos assets relacionados à conta
            # 1. Buscar assets cripto relacionados a esta conta
            cursor = database_service.connection.cursor(dictionary=True)
            cursor.execute("""
                SELECT DISTINCT a.id, a.symbol, a.last_price_update_at
                FROM assets a
                INNER JOIN asset_movements am ON a.id = am.asset_id
                WHERE am.account_id = %s AND a.asset_class = 'CRIPTO'
                AND (a.last_price_update_at IS NULL OR a.last_price_update_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE))
            """, (account_id,))
            assets_to_update = cursor.fetchall()
            cursor.close()
            
            # 2. Atualizar preços dos assets que precisam de atualização
            updated_assets = 0
            if assets_to_update:
                asset_ids = [asset['id'] for asset in assets_to_update]
                update_result = await asset_service.update_asset_prices(asset_ids)
                updated_assets = update_result.get('updated_count', 0)
            
            # 3. Criar resultado similar ao da sincronização de carteira
            sync_result = {
                "assets_updated": updated_assets,
                "assets_found": len(assets_to_update),
                "tokens_synced": updated_assets,  # Para compatibilidade com frontend
                "message": f"{updated_assets} preços de ativos atualizados"
            }
            
        else:
            raise HTTPException(status_code=400, detail="Account is not a crypto account (CARTEIRA_CRIPTO or CORRETORA_CRIPTO)")
        
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

@app.get("/assets/icon/{asset_identifier}")
async def get_asset_icon(asset_identifier: str):
    """Obtém o ícone de um ativo da API da CoinGecko"""
    from services.icon_service import IconService
    
    icon_service = IconService()
    try:
        result = icon_service.get_coingecko_icon(asset_identifier)
        return result
    finally:
        icon_service.close()

@app.post("/assets/icons/update-all")
async def update_all_crypto_icons(current_user: dict = Depends(get_current_user)):
    """Atualiza os ícones de todos os ativos cripto"""
    try:
        result = await asset_service.update_crypto_icons()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/assets/update-prices")
async def update_asset_prices(
    price_update: AssetPriceUpdate, 
    current_user: dict = Depends(get_current_user)
):
    """Atualizar preços de ativos específicos"""
    try:
        result = await asset_service.update_asset_prices(price_update.asset_ids)
        if not result['success'] and result['updated_count'] == 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Falha ao atualizar preços: {'; '.join(result['errors'])}"
            )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.post("/assets/update-all-crypto-prices")
async def update_all_crypto_prices(current_user: dict = Depends(get_current_user)):
    """Atualizar preços de todos os ativos cripto"""
    try:
        result = await asset_service.update_all_crypto_prices()
        if not result['success'] and result['updated_count'] == 0:
            raise HTTPException(
                status_code=400,
                detail=f"Falha ao atualizar preços: {'; '.join(result['errors'])}"
            )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.get("/assets/{asset_id}/price")
async def get_asset_current_price(asset_id: int, current_user: dict = Depends(get_current_user)):
    """Buscar preço atual de um ativo específico em tempo real"""
    try:
        # Buscar informações do ativo
        cursor = database_service.connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
        asset = cursor.fetchone()
        cursor.close()
        
        if not asset:
            raise HTTPException(status_code=404, detail="Ativo não encontrado")
        
        # Só buscar preço para criptomoedas com price_api_identifier
        if asset['asset_class'] != 'CRIPTO' or not asset['price_api_identifier']:
            return {
                "asset_id": asset_id,
                "symbol": asset['symbol'],
                "name": asset['name'],
                "asset_class": asset['asset_class'],
                "price_available": False,
                "message": "Preço em tempo real não disponível para este ativo"
            }
        
        # Usar instâncias globais dos serviços
        try:
            # Usar método assíncrono para buscar preços
            usd_prices = await price_service.get_crypto_prices_in_usd([asset['price_api_identifier']])
            usd_to_brl_rate = await price_service.get_usd_to_brl_rate()
            
            if usd_prices.get(asset['price_api_identifier'], 0) > 0 and usd_to_brl_rate > 0:
                price_usd = usd_prices[asset['price_api_identifier']]
                price_brl = price_usd * usd_to_brl_rate
                
                # MELHORIA: Atualizar preço no banco de dados automaticamente
                try:
                    logger.info(f"Atualizando preço persistido para {asset['symbol']} (ID: {asset_id})")
                    update_result = await asset_service.update_asset_prices([asset_id])
                    logger.info(f"Resultado da atualização: {update_result}")
                    price_updated_in_db = update_result.get('success', False)
                except Exception as e:
                    logger.warning(f"Erro ao atualizar preço no banco para {asset['symbol']}: {e}")
                    price_updated_in_db = False
                
                return {
                    "asset_id": asset_id,
                    "symbol": asset['symbol'],
                    "name": asset['name'],
                    "asset_class": asset['asset_class'],
                    "price_api_identifier": asset['price_api_identifier'],
                    "price_available": True,
                    "current_price_usd": price_usd,
                    "current_price_brl": price_brl,
                    "usd_to_brl_rate": usd_to_brl_rate,
                    "price_updated_in_db": price_updated_in_db,  # Novo campo
                    "icon_url": f"https://cryptoicons.org/api/icon/{asset['symbol'].lower()}/32" if asset['symbol'] else None,
                    "fetched_at": datetime.now().isoformat() + "Z"
                }
            else:
                return {
                    "asset_id": asset_id,
                    "symbol": asset['symbol'],
                    "name": asset['name'],
                    "asset_class": asset['asset_class'],
                    "price_available": False,
                    "message": "Preço não encontrado na API"
                }
                
        finally:
            # Não fechar o price_service global
            pass
            
    except Exception as e:
        logger.error(f"Erro ao buscar preço do ativo {asset_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar preço: {str(e)}")

# === ASSET HOLDINGS ENDPOINTS ===
@app.post("/holdings")
async def create_holding(holding: AssetHoldingCreate, current_user: dict = Depends(get_current_user)):
    """DEPRECATED: Use /portfolio/movements instead. This endpoint creates asset movements."""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Converter holding para movement
        movement_data = {
            "account_id": holding.account_id,
            "asset_id": holding.asset_id,
            "movement_type": "COMPRA",
            "quantity": holding.quantity,
            "price_per_unit": holding.average_buy_price,
            "movement_date": holding.acquisition_date or datetime.now().date(),
            "notes": "Migração de holding legado"
        }
        
        result = portfolio_service.add_asset_movement(user_id, movement_data)
        return {"message": "Movement created successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/holdings")
async def list_holdings(account_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """Listar todas as posições do usuário - DEPRECATED: Use /portfolio/summary"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Usar portfolio_service para consistência com asset_movements
        portfolio = portfolio_service.get_portfolio_summary(user_id, account_id)
        
        # Converter formato para compatibilidade com frontend legado
        holdings = []
        for position in portfolio:
            holdings.append({
                "id": position['asset_id'],
                "user_id": user_id,
                "account_id": account_id,
                "asset_id": position['asset_id'],
                "symbol": position['symbol'],
                "asset_name": position['name'],
                "asset_class": position['asset_class'],
                "quantity": position['quantity'],
                "average_buy_price": position['average_price_brl'],
                "current_price_brl": position['current_price_brl'],
                "current_market_value_brl": position['market_value_brl']
            })
        
        return {"holdings": holdings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching holdings: {str(e)}")


@app.get("/holdings/summary")
async def get_holdings_summary(current_user: dict = Depends(get_current_user)):
    """Obter resumo das posições agrupadas por ativo - DEPRECATED: Use /portfolio/summary"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Usar portfolio_service para consistência
        portfolio = portfolio_service.get_portfolio_summary(user_id)
        return {"summary": portfolio}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching holdings summary: {str(e)}")

@app.get("/holdings/{holding_id}")
async def get_holding(holding_id: int, current_user: dict = Depends(get_current_user)):
    """DEPRECATED: Use /portfolio/summary to get aggregated positions"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Retornar portfólio completo já que holdings individuais não fazem mais sentido
    try:
        portfolio = portfolio_service.get_portfolio_summary(user_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="No positions found")
        return {"deprecated": True, "message": "Use /portfolio/summary", "portfolio": portfolio}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/holdings/{holding_id}")
async def update_holding(holding_id: int, holding: AssetHoldingUpdate, current_user: dict = Depends(get_current_user)):
    """DEPRECATED: Use /portfolio/movements to add corrective movements"""
    raise HTTPException(
        status_code=410, 
        detail="Endpoint deprecated. Use /portfolio/movements to add corrective asset movements instead of updating holdings directly."
    )

@app.delete("/holdings/{holding_id}")
async def delete_holding(holding_id: int, current_user: dict = Depends(get_current_user)):
    """DEPRECATED: Use /portfolio/movements to add sell movements"""
    raise HTTPException(
        status_code=410,
        detail="Endpoint deprecated. Use /portfolio/movements with VENDA movement type to close positions instead."
    )

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

# === PHYSICAL ASSETS ENDPOINTS ===
@app.post("/physical-assets", response_model=PhysicalAssetResponse)
async def create_physical_asset(asset_data: PhysicalAssetCreate, current_user: dict = Depends(get_current_user)):
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        new_asset = physical_asset_service.create_physical_asset(user_id, asset_data.model_dump())
        return new_asset
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/physical-assets", response_model=List[PhysicalAssetResponse])
async def list_physical_assets(status: Optional[str] = Query(None, description="Filter by status: ATIVO or VENDIDO"), current_user: dict = Depends(get_current_user)):
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        assets = physical_asset_service.get_physical_assets_by_user(user_id, status_filter=status)
        return assets
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/physical-assets/{physical_asset_id}", response_model=PhysicalAssetResponse)
async def update_physical_asset(physical_asset_id: int, asset_data: PhysicalAssetUpdate, current_user: dict = Depends(get_current_user)):
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        updated_asset = physical_asset_service.update_physical_asset(user_id, physical_asset_id, asset_data.model_dump())
        return updated_asset
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/physical-assets/{physical_asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_physical_asset(physical_asset_id: int, current_user: dict = Depends(get_current_user)):
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        physical_asset_service.delete_physical_asset(user_id, physical_asset_id)
        return
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/physical-assets/{physical_asset_id}/liquidate")
async def liquidate_physical_asset(physical_asset_id: int, liquidation_data: LiquidatePhysicalAssetRequest, current_user: dict = Depends(get_current_user)):
    """Liquidar (vender) um bem físico registrando a receita correspondente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        result = physical_asset_service.liquidate_physical_asset(user_id, physical_asset_id, liquidation_data.model_dump())
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === REPORTS ENDPOINTS ===
@app.get("/reports/physical-assets-summary")
async def get_physical_assets_summary_for_reports(current_user: dict = Depends(get_current_user)):
    """PHASE 4: Endpoint para análise detalhada de patrimônio físico nos relatórios"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        summary_data = physical_asset_service.get_active_physical_assets_for_report(user_id)
        return summary_data
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
        total_accounts = float(accounts_result['total_accounts'] or 0)
        
        # Usar portfolio_service para calcular valor total das posições via asset_movements
        total_holdings_value = 0.0
        try:
            portfolio = portfolio_service.get_portfolio_summary(user_id)
            for position in portfolio:
                total_holdings_value += float(position.get('market_value_brl', 0))
        except Exception as e:
            print(f"Erro ao calcular valor do portfólio: {e}")
            total_holdings_value = 0.0
        
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
        # Usar portfolio_service para obter posições via asset_movements
        try:
            portfolio = portfolio_service.get_portfolio_summary(user_id)
            
            if not portfolio:
                return {"allocation": []}
            
            # Agrupar por classe de ativo
            class_totals = {}
            
            # Calcular valor por classe usando dados do portfolio_service
            for position in portfolio:
                asset_class = position.get('asset_class', 'UNKNOWN')
                market_value = position.get('market_value_brl', 0)
                
                if asset_class not in class_totals:
                    class_totals[asset_class] = 0
                class_totals[asset_class] += market_value
        
        except Exception as e:
            print(f"Erro ao calcular alocação de ativos: {e}")
            return {"allocation": []}
        
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
async def get_cash_flow_chart(
    period: str = "monthly", 
    start_date: str = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """Endpoint para dados do gráfico de fluxo de caixa"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Se datas forem fornecidas, usar a nova função com período customizado
        if start_date and end_date:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            chart_data = summary_service.get_cash_flow_chart_data_by_period(user_id, start_date_obj, end_date_obj, period)
        else:
            # Usar função original
            chart_data = summary_service.get_cash_flow_chart_data(user_id, period)
        
        return {"success": True, "data": chart_data}
    except Exception as e:
        return {"success": False, "error": str(e)}

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

# === PORTFOLIO ENDPOINTS ===

@app.get("/portfolio/summary")
async def get_portfolio_summary(current_user: dict = Depends(get_current_user)):
    """Obter resumo do portfólio com cálculo de custo médio e P&L"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        portfolio = portfolio_service.get_portfolio_summary(user_id)
        return portfolio
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting portfolio summary: {str(e)}")

@app.get("/portfolio/summary/{account_id}")
async def get_portfolio_summary_by_account(account_id: int, current_user: dict = Depends(get_current_user)):
    """Obtém resumo do portfólio filtrado por conta específica"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        summary = portfolio_service.get_portfolio_summary(user_id, account_id)
        
        return {
            "status": "success",
            "portfolio": summary,
            "account_id": account_id,
            "total_positions": len(summary),
            "total_value_brl": sum(position['market_value_brl'] for position in summary),
            "total_value_usdt": sum(position['market_value_usdt'] for position in summary)
        }
    except Exception as e:
        print(f"Erro ao obter resumo do portfólio da conta {account_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/portfolio/movements/{account_id}")
async def get_movements_by_account(account_id: int, current_user: dict = Depends(get_current_user)):
    """Obtém todas as movimentações de ativos de uma conta específica"""
    try:
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        movements = portfolio_service.get_movements_by_account(user_id, account_id)
        
        return {
            "status": "success",
            "movements": movements,
            "account_id": account_id,
            "total_movements": len(movements)
        }
    except Exception as e:
        print(f"Erro ao obter movimentações da conta {account_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/portfolio/movements")
async def add_asset_movement(movement: AssetMovementCreate, current_user: dict = Depends(get_current_user)):
    """Adicionar novo movimento de ativo"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        movement_data = movement.dict()
        result = portfolio_service.add_asset_movement(user_id, movement_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/portfolio/assets/{asset_id}/movements")
async def get_asset_movements_history(asset_id: int, current_user: dict = Depends(get_current_user)):
    """Obter histórico de movimentos de um ativo específico"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        movements = portfolio_service.get_asset_movements_history(user_id, asset_id)
        return movements
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting asset movements history: {str(e)}")

@app.put("/portfolio/movements/{movement_id}")
async def update_asset_movement(movement_id: int, movement: AssetMovementUpdate, current_user: dict = Depends(get_current_user)):
    """Atualizar movimento de ativo existente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Converter apenas campos que não são None
        movement_data = {}
        for field, value in movement.dict().items():
            if value is not None:
                movement_data[field] = value
        
        result = portfolio_service.update_asset_movement(user_id, movement_id, movement_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/portfolio/movements/{movement_id}")
async def delete_asset_movement(movement_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar movimento de ativo"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        result = portfolio_service.delete_asset_movement(user_id, movement_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# @app.get("/summary/net-worth-history")
# async def get_net_worth_history(current_user: dict = Depends(get_current_user), days_limit: int = 365):
#     """Obter histórico de snapshots de patrimônio líquido"""
#     user_id = database_service.get_user_id_by_username(current_user['username'])
#     if not user_id:
#         raise HTTPException(status_code=404, detail="User not found")
    
#     try:
#         history = summary_service.get_net_worth_history(user_id, days_limit)
#         return history
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error getting net worth history: {str(e)}")

@app.post("/portfolio/accounts/{account_id}/reconcile")
async def reconcile_wallet_history(account_id: int, current_user: dict = Depends(get_current_user)):
    """
    NOVA FUNCIONALIDADE: Reconciliação profunda com histórico on-chain
    Reconstrói completamente o histórico da carteira usando dados da blockchain
    """
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Verificar se a conta existe e é uma carteira cripto
        account = account_service.get_account_by_id(user_id, account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        if account['type'] != 'CARTEIRA_CRIPTO':
            raise HTTPException(status_code=400, detail="Only crypto wallets can be reconciled")
            
        if not account['public_address']:
            raise HTTPException(status_code=400, detail="Wallet must have a public address to be reconciled")
        
        # Executar reconciliação profunda
        result = wallet_sync_service.reconcile_wallet_history(
            user_id=user_id,
            account_id=account_id,
            public_address=account['public_address']
        )
        
        return {
            "success": True,
            "message": "Wallet reconciliation completed successfully",
            "reconciliation_result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during wallet reconciliation: {str(e)}")

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

# ==================== OBLIGATIONS & RECURRING RULES ENDPOINTS ====================

# --- Financial Obligations ---

# ROTA CORRIGIDA: movida para ANTES da rota dinâmica /{obligation_id}
@app.get("/obligations/summary", response_model=ObligationsSummaryResponse)
async def get_obligations_summary(current_user: dict = Depends(get_current_user)):
    """Total a pagar e a receber nos próximos 30 dias"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        summary = obligation_service.get_obligations_summary_30d(user_id)
        # LOG DE VERIFICAÇÃO CRÍTICO
        print(f"MAIN.PY ENDPOINT: Returning summary data: {summary}")
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ROTA CORRIGIDA: movida para ANTES da rota dinâmica /{obligation_id}
@app.get("/obligations/upcoming-summary")
async def get_upcoming_obligations_summary(current_user: dict = Depends(get_current_user)):
    """Resumo das próximas obrigações para o dashboard"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        summary = obligation_service.get_upcoming_summary(user_id)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/obligations", response_model=FinancialObligationResponse)
async def create_obligation(obligation: FinancialObligationCreate, current_user: dict = Depends(get_current_user)):
    """Criar uma nova obrigação financeira"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        obligation_data = obligation.model_dump()
        new_obligation = obligation_service.create_obligation(user_id, obligation_data)
        return new_obligation
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/obligations", response_model=ObligationsListResponse)
async def list_obligations(
    type: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar obrigações do usuário com filtros opcionais"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        obligations = obligation_service.get_obligations_by_user(user_id, type, status, limit)
        return {"obligations": obligations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ROTA DINÂMICA: Mantida por último, como dita a boa prática.
@app.get("/obligations/{obligation_id}", response_model=FinancialObligationResponse)
async def get_obligation(obligation_id: int, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de uma obrigação específica"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        obligation = obligation_service.get_obligation_by_id(user_id, obligation_id)
        if not obligation:
            raise HTTPException(status_code=404, detail="Obligation not found")
        return obligation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/obligations/{obligation_id}", response_model=FinancialObligationResponse)
async def update_obligation(
    obligation_id: int, 
    obligation: FinancialObligationUpdate, 
    current_user: dict = Depends(get_current_user)
):
    """Atualizar uma obrigação existente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        obligation_data = {k: v for k, v in obligation.model_dump().items() if v is not None}
        updated_obligation = obligation_service.update_obligation(user_id, obligation_id, obligation_data)
        return updated_obligation
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/obligations/{obligation_id}")
async def delete_obligation(obligation_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar uma obrigação"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        success = obligation_service.delete_obligation(user_id, obligation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Obligation not found")
        return {"message": "Obligation deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/obligations/{obligation_id}/settle", response_model=SettlementResponse)
async def settle_obligation(
    obligation_id: int,
    settle_data: SettleObligationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Liquidar uma obrigação (função crítica)"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        settlement_result = obligation_service.settle_obligation(
            user_id=user_id,
            obligation_id=obligation_id,
            from_account_id=settle_data.from_account_id,
            to_account_id=settle_data.to_account_id,
            settlement_date=settle_data.settlement_date
        )
        return settlement_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/obligations/{obligation_id}/cancel-settlement")
async def cancel_settlement(
    obligation_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Cancelar liquidação de uma obrigação PAID (função crítica)"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        cancellation_result = obligation_service.cancel_settlement(
            user_id=user_id,
            obligation_id=obligation_id
        )
        return cancellation_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === ENDPOINTS PARA REGRAS DE RECORRÊNCIA ===

@app.post("/recurring-rules", response_model=RecurringRuleResponse)
async def create_recurring_rule(rule: RecurringRuleCreate, current_user: dict = Depends(get_current_user)):
    """Criar uma nova regra de recorrência"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        rule_data = rule.model_dump()
        new_rule = obligation_service.create_recurring_rule(user_id, rule_data)
        return new_rule
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/recurring-rules", response_model=RecurringRulesListResponse)
async def list_recurring_rules(is_active: Optional[bool] = None, current_user: dict = Depends(get_current_user)):
    """Listar regras de recorrência do usuário"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        rules = obligation_service.get_recurring_rules_by_user(user_id, is_active)
        return {"rules": rules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recurring-rules/{rule_id}", response_model=RecurringRuleResponse)
async def get_recurring_rule(rule_id: int, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de uma regra de recorrência específica"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        rule = obligation_service.get_recurring_rule_by_id(user_id, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Recurring rule not found")
        return rule
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/recurring-rules/{rule_id}", response_model=RecurringRuleResponse)
async def update_recurring_rule(
    rule_id: int, 
    rule: RecurringRuleUpdate, 
    current_user: dict = Depends(get_current_user)
):
    """Atualizar uma regra de recorrência existente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        raw_data = rule.model_dump()
        # Filtrar apenas valores None, mas manter strings vazias, zeros e campos de conta (que podem ser None para limpar)
        rule_data = {}
        for k, v in raw_data.items():
            # Para campos de conta, permitir None (para limpar) e incluir no update
            if k in ['from_account_id', 'to_account_id']:
                rule_data[k] = v
            # Para outros campos, filtrar apenas se não for None
            elif v is not None:
                rule_data[k] = v
        
        # Debug logging
        print(f"UPDATE_RECURRING_RULE_ENDPOINT: rule_id={rule_id}, user_id={user_id}")
        print(f"UPDATE_RECURRING_RULE_ENDPOINT: raw_rule={raw_data}")
        print(f"UPDATE_RECURRING_RULE_ENDPOINT: filtered_rule_data={rule_data}")
        print(f"UPDATE_RECURRING_RULE_ENDPOINT: filtered_keys={list(rule_data.keys())}")
        updated_rule = obligation_service.update_recurring_rule(user_id, rule_id, rule_data)
        return updated_rule
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/recurring-rules/{rule_id}")
async def delete_recurring_rule(rule_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar uma regra de recorrência"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        success = obligation_service.delete_recurring_rule(user_id, rule_id)
        if not success:
            raise HTTPException(status_code=404, detail="Recurring rule not found")
        return {"message": "Recurring rule deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/recurring-rules/{rule_id}/liquidate")
async def liquidate_recurring_rule(
    rule_id: int,
    liquidation_data: SettleObligationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Liquidar uma recurring rule criando transação correspondente"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Debug logging
        print(f"LIQUIDATE_RECURRING_RULE_ENDPOINT: rule_id={rule_id}")
        print(f"LIQUIDATE_RECURRING_RULE_ENDPOINT: liquidation_data={liquidation_data}")
        print(f"LIQUIDATE_RECURRING_RULE_ENDPOINT: settlement_date={liquidation_data.settlement_date}, type={type(liquidation_data.settlement_date)}")
        
        liquidation_result = obligation_service.liquidate_recurring_rule(
            user_id=user_id,
            rule_id=rule_id,
            from_account_id=liquidation_data.from_account_id,
            to_account_id=liquidation_data.to_account_id,
            settlement_date=liquidation_data.settlement_date
        )
        return liquidation_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/recurring-rules/{rule_id}/last-liquidation")
async def get_last_liquidation_date(rule_id: int, current_user: dict = Depends(get_current_user)):
    """Buscar data da última liquidação de uma recurring rule"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        liquidation_info = obligation_service.get_last_liquidation_date(user_id, rule_id)
        return liquidation_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/recurring-rules/{rule_id}/reverse")
async def reverse_recurring_rule_current_month(rule_id: int, current_user: dict = Depends(get_current_user)):
    """Estornar liquidação do mês atual de uma recurring rule"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        reverse_result = obligation_service.reverse_current_month_liquidation(user_id, rule_id)
        return reverse_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== REPORTS ENDPOINTS ====================

@app.get("/reports/account-statement", response_model=AccountStatementResponse)
async def get_account_statement(
    account_id: int,
    start_date: date,
    end_date: date,
    current_user: dict = Depends(get_current_user)
):
    """Extrato detalhado de uma conta específica"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        statement = reports_service.get_account_statement(user_id, account_id, start_date, end_date)
        return statement
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports/expense-by-category", response_model=ExpenseAnalysisResponse)
async def get_expense_by_category(
    start_date: date,
    end_date: date,
    current_user: dict = Depends(get_current_user)
):
    """Análise de despesas por categoria"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        analysis = reports_service.get_expense_by_category(user_id, start_date, end_date)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports/monthly-cash-flow", response_model=MonthlyChashFlowResponse)
async def get_monthly_cash_flow(
    start_date: date,
    end_date: date,
    current_user: dict = Depends(get_current_user)
):
    """Fluxo de caixa mensal (receitas vs despesas)"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        cash_flow = reports_service.get_monthly_cash_flow(user_id, start_date, end_date)
        return cash_flow
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports/accounts-summary", response_model=AccountsSummaryResponse)
async def get_accounts_summary_for_reports(current_user: dict = Depends(get_current_user)):
    """Lista de contas do usuário para seleção em relatórios"""
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        accounts = reports_service.get_user_accounts_summary(user_id)
        return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== STOCK PRICES ENDPOINTS ====================

@app.post("/assets/{asset_id}/update-price")
async def update_stock_price(asset_id: int, current_user: dict = Depends(get_current_user)):
    """Atualizar preço de uma ação específica (BR ou US) via Alpha Vantage API"""
    try:
        result = price_service.update_stock_price(asset_id)

        if result["success"]:
            return {
                "message": f"Preço atualizado com sucesso para {result['symbol']}",
                "symbol": result["symbol"],
                "price_brl": result["price_brl"],
                "updated_at": result["updated_at"],
                "asset": result["asset"],
                "success": 1
            }
        else:
            error_detail = result["error"]
            # Lógica de erro aprimorada
            if "API Rate Limit" in error_detail:
                raise HTTPException(status_code=429, detail=error_detail)
            else:
                raise HTTPException(status_code=400, detail=error_detail)

    except HTTPException:
        # Re-lança as exceções HTTP que criamos acima
        raise
    except Exception as e:
        logger.error(f"Error updating stock price in endpoint for asset {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno do servidor ao processar a atualização de preço.")

@app.post("/assets/update-prices/{asset_class}")
async def update_stock_prices_bulk(asset_class: str, current_user: dict = Depends(get_current_user)):
    """Atualizar preços em massa para ações (ACAO_BR ou ACAO_US)"""
    if asset_class not in ['ACAO_BR', 'ACAO_US']:
        raise HTTPException(status_code=400, detail="asset_class deve ser ACAO_BR ou ACAO_US")
    
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Buscar todos os ativos da classe que o usuário possui
        user_assets = price_service.get_assets_by_class(asset_class)
        
        if not user_assets:
            return {
                "message": f"Nenhum ativo da classe {asset_class} encontrado",
                "updated_count": 0,
                "errors": []
            }
        
        updated_count = 0
        errors = []
        
        for asset in user_assets:
            try:
                result = price_service.update_stock_price(asset['id'])
                
                if result["success"]:
                    updated_count += 1
                    logger.info(f"Preço atualizado: {asset['symbol']} = R$ {result['price_brl']}")
                else:
                    errors.append({
                        "symbol": asset['symbol'],
                        "error": result["error"]
                    })
                    
                # Rate limiting - 15 segundos entre chamadas para Alpha Vantage
                if len(user_assets) > 1:  # Só aplicar se houver múltiplos ativos
                    time.sleep(15)
                    
            except Exception as e:
                errors.append({
                    "symbol": asset['symbol'],
                    "error": str(e)
                })
                logger.error(f"Erro ao atualizar {asset['symbol']}: {e}")
        
        return {
            "message": f"Atualização em massa concluída para {asset_class}",
            "total_assets": len(user_assets),
            "updated_count": updated_count,
            "error_count": len(errors),
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in bulk stock price update: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na atualização em massa: {str(e)}")

# =============================================================================
# ENDPOINTS DE RELATÓRIOS E SNAPSHOTS - BUSINESS INTELLIGENCE
# =============================================================================

@app.post("/reports/snapshots/generate")
async def generate_daily_snapshot(current_user = Depends(get_current_user)):
    """
    Gera um snapshot financeiro diário para o usuário autenticado.
    Este endpoint aciona a geração de um snapshot completo que será usado
    para análises históricas e relatórios de Business Intelligence.
    """
    try:
        db_service = DatabaseService()
        reports_service = ReportsService(db_service)
        
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        result = reports_service.generate_daily_snapshot(user_id)
        
        if result["success"]:
            return {
                "success": True,
                "message": "Snapshot gerado com sucesso",
                "data": result
            }
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error generating daily snapshot: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar snapshot: {str(e)}")

@app.get("/reports/snapshots/history")
async def get_snapshots_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Busca o histórico de snapshots financeiros do usuário em um período específico.
    
    Args:
        start_date: Data inicial no formato YYYY-MM-DD (opcional)
        end_date: Data final no formato YYYY-MM-DD (opcional)
    
    Returns:
        Lista de snapshots ordenados por data para análise histórica
    """
    try:
        from datetime import datetime, date
        
        # Converter strings para objetos date se fornecidas
        parsed_start_date = None
        parsed_end_date = None
        
        if start_date:
            try:
                parsed_start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato de start_date inválido. Use YYYY-MM-DD")
        
        if end_date:
            try:
                parsed_end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato de end_date inválido. Use YYYY-MM-DD")
        
        db_service = DatabaseService()
        reports_service = ReportsService(db_service)
        
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        snapshots = reports_service.get_snapshots_history(
            user_id,
            parsed_start_date,
            parsed_end_date
        )
        
        return {
            "success": True,
            "count": len(snapshots),
            "snapshots": snapshots
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching snapshots history: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar histórico de snapshots: {str(e)}")

@app.get("/reports/expense-analysis")
async def get_expense_analysis(current_user = Depends(get_current_user)):
    """
    Análise detalhada de despesas baseada no snapshot mais recente.
    Retorna a quebra de despesas por categoria dos últimos 30 dias.
    """
    try:
        db_service = DatabaseService()
        reports_service = ReportsService(db_service)
        
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        analysis = reports_service.get_expense_analysis(user_id)
        
        if analysis["success"]:
            return analysis
        else:
            raise HTTPException(status_code=404, detail=analysis["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching expense analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar análise de despesas: {str(e)}")

@app.get("/reports/snapshots/historical-allocation")
async def get_historical_allocation(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Busca a alocação histórica de ativos por classe para gráfico de área empilhada.
    
    Args:
        start_date: Data inicial no formato YYYY-MM-DD (opcional)
        end_date: Data final no formato YYYY-MM-DD (opcional)
    """
    try:
        db_service = DatabaseService()
        reports_service = ReportsService(db_service)
        
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Parse das datas se fornecidas
        parsed_start_date = None
        parsed_end_date = None
        
        if start_date:
            try:
                parsed_start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato de start_date inválido. Use YYYY-MM-DD")
        
        if end_date:
            try:
                parsed_end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato de end_date inválido. Use YYYY-MM-DD")
        
        historical_data = reports_service.get_historical_allocation(
            user_id, 
            parsed_start_date, 
            parsed_end_date
        )
        
        return {
            "success": True,
            "count": len(historical_data),
            "data": historical_data
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching historical allocation: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar alocação histórica: {str(e)}")

@app.get("/reports/snapshots/details/{snapshot_date}")
async def get_snapshot_details(
    snapshot_date: str,
    current_user = Depends(get_current_user)
):
    """
    Recalcula o estado do patrimônio para uma data específica (drill-down).
    
    Args:
        snapshot_date: Data no formato YYYY-MM-DD
    """
    try:
        db_service = DatabaseService()
        reports_service = ReportsService(db_service)
        
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Parse da data
        try:
            parsed_date = datetime.strptime(snapshot_date, '%Y-%m-%d').date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
        
        details = reports_service.get_snapshot_details(user_id, parsed_date)
        
        return details
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching snapshot details: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar detalhes do snapshot: {str(e)}")

@app.get("/reports/snapshots/kpi-variation")
async def get_kpi_variation(
    period: str = "30d",
    current_user = Depends(get_current_user)
):
    """
    Calcula a variação percentual dos KPIs entre o primeiro e último snapshot no período.
    
    Args:
        period: Período de análise (30d, 60d, 90d, etc.)
    """
    try:
        db_service = DatabaseService()
        reports_service = ReportsService(db_service)
        
        user_id = database_service.get_user_id_by_username(current_user['username'])
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Parse do período
        if period.endswith('d'):
            try:
                period_days = int(period[:-1])
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato de período inválido. Use formato como '30d'")
        else:
            raise HTTPException(status_code=400, detail="Formato de período inválido. Use formato como '30d'")
        
        variations = reports_service.get_kpi_variation(user_id, period_days)
        
        return variations
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error calculating KPI variations: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao calcular variações de KPIs: {str(e)}")

@app.get("/reports/top-expenses")
async def get_top_expenses(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Busca as 10 maiores despesas do período especificado.
    """
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Converter strings para objetos date
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Validar período
        if start_date_obj > end_date_obj:
            raise HTTPException(status_code=400, detail="Start date must be before end date")
        
        # Buscar maiores despesas
        result = reports_service.get_top_expenses(user_id, start_date_obj, end_date_obj)
        
        if not result.get('success', False):
            raise HTTPException(status_code=500, detail=result.get('error', 'Erro desconhecido'))
        
        return result
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(ve)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching top expenses: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar maiores despesas: {str(e)}")

@app.get("/reports/cash-flow-kpis")
async def get_cash_flow_kpis(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Busca os KPIs de fluxo de caixa para o período especificado.
    Calcula receitas, despesas e saldo diretamente da tabela transactions.
    """
    user_id = database_service.get_user_id_by_username(current_user['username'])
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Converter strings para objetos date
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Validar período
        if start_date_obj > end_date_obj:
            raise HTTPException(status_code=400, detail="Start date must be before end date")
        
        # Buscar KPIs de fluxo de caixa
        result = reports_service.get_cash_flow_kpis(user_id, start_date_obj, end_date_obj)
        
        if not result.get('success', False):
            raise HTTPException(status_code=500, detail=result.get('error', 'Erro desconhecido'))
        
        return result
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(ve)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching cash flow KPIs: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar KPIs de fluxo de caixa: {str(e)}")

# === ENDPOINTS PARA STRATEGY OPTIMIZATION ===

@app.post("/strategy-optimization/jobs", response_model=OptimizationJobResponse)
async def create_optimization_job(
    job_data: OptimizationJobCreate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Criar um novo job de otimização de estratégia"""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        optimization_service = OptimizationService()
        job = optimization_service.create_optimization_job(
            user_id=user_id, 
            job_data=job_data.dict()
        )
        
        # Iniciar otimização em background
        background_tasks.add_task(
            optimization_service.run_genetic_optimization,
            job_id=job['id']
        )
        
        return OptimizationJobResponse(**job)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating optimization job: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar job de otimização: {str(e)}")

@app.get("/strategy-optimization/jobs", response_model=OptimizationJobsListResponse)
async def list_optimization_jobs(current_user: dict = Depends(get_current_user)):
    """Listar todos os jobs de otimização do usuário"""
    try:
        print(f"[/strategy-optimization/jobs] INICIO")

        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        
        print(f"[/strategy-optimization/jobs] user_id: {user_id}")

        
        optimization_service = OptimizationService()
        jobs = optimization_service.get_optimization_jobs_by_user(user_id)
        
        print(f"[/strategy-optimization/jobs] FIM")
        
        job_responses = []
        for job in jobs:
            job_responses.append(OptimizationJobResponse(**job))
        
        return OptimizationJobsListResponse(jobs=job_responses)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing optimization jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar jobs de otimização: {str(e)}")

@app.get("/strategy-optimization/jobs/{job_id}", response_model=OptimizationJobResponse)
async def get_optimization_job(job_id: int, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de um job de otimização específico"""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        optimization_service = OptimizationService()
        job = optimization_service.get_optimization_job_by_id(job_id, user_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job de otimização não encontrado")
        
        return OptimizationJobResponse(**job)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching optimization job: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar job de otimização: {str(e)}")


@app.get("/strategy-optimization/jobs/{job_id}/results", response_model=OptimizationResultsResponse)
async def get_optimization_results(
    job_id: int, 
    limit: int = Query(default=100, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """Obter resultados de um job de otimização ordenados por fitness"""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        optimization_service = OptimizationService()
        results = optimization_service.get_optimization_results(job_id, user_id, limit)
        
        result_responses = []
        for result in results:
            result_responses.append(OptimizationResult(**result))
        
        return OptimizationResultsResponse(results=result_responses)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching optimization results: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar resultados de otimização: {str(e)}")

@app.get("/strategy-optimization/jobs/{job_id}/best-parameters", response_model=BestParametersResponse)
async def get_best_parameters(job_id: int, current_user: dict = Depends(get_current_user)):
    """Obter os melhores parâmetros encontrados para um job de otimização"""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        optimization_service = OptimizationService()
        best_params = optimization_service.get_best_parameters(job_id, user_id)
        
        if not best_params:
            raise HTTPException(status_code=404, detail="Nenhum resultado encontrado para este job")
        
        return BestParametersResponse(**best_params)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching best parameters: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar melhores parâmetros: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)