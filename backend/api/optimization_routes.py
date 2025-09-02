# api/optimization_routes.py

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import logging
import threading

from services.optimization_service import OptimizationService
from services.historical_data_service import HistoricalDataService
from services.auth_service import get_current_user
from services.database_service import DatabaseService

from datetime import date, datetime

logger = logging.getLogger(__name__)

# Pydantic models para validação
class OptimizationJobRequest(BaseModel):
    base_strategy_name: str = Field(..., example="RSI_MACD")
    asset_id: int = Field(..., example=1)
    timeframe: str = Field(..., example="1d")
    start_date: date = Field(..., example="2024-01-01")
    end_date: date = Field(..., example="2024-12-31")
    parameter_ranges: Dict[str, Any] = Field(..., example={
        "rsi_period": {"type": "int", "min": 10, "max": 20}
    })

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
    parameter_ranges: Dict[str, Any]
    status: str
    progress: Optional[float] = 0.0
    created_at: datetime
    completed_at: Optional[datetime] = None

class OptimizationJobsListResponse(BaseModel):
    jobs: List[OptimizationJobResponse]
    total_count: int

class OptimizationResult(BaseModel):
    id: int
    job_id: int
    parameters: Dict[str, Any]
    total_trades: int
    win_rate_percent: float
    net_profit_percent: float
    max_drawdown_percent: float
    sharpe_ratio: float
    fitness_score: float

class OptimizationResultsResponse(BaseModel):
    results: List[OptimizationResult]
    job: OptimizationJobResponse

class BestParametersResponse(BaseModel):
    parameters: Dict[str, Any]
    performance_metrics: Dict[str, Any]

class HistoricalDataStatsResponse(BaseModel):
    general: Dict[str, Any]
    by_asset: List[Dict[str, Any]]

# Create router
router = APIRouter()

# Initialize services
optimization_service = OptimizationService()
historical_data_service = HistoricalDataService()

@router.post(
    "/jobs",
    response_model=OptimizationJobResponse,
    summary="Criar Job de Otimização",
    description="Cria um novo job de otimização de estratégia usando algoritmo genético."
)
async def create_optimization_job(
    request: OptimizationJobRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Cria um novo job de otimização."""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        
        job_data = {
            'base_strategy_name': request.base_strategy_name,
            'asset_id': request.asset_id,
            'timeframe': request.timeframe,
            'start_date': request.start_date,
            'end_date': request.end_date,
            'parameter_ranges': request.parameter_ranges
        }
        
        job = optimization_service.create_optimization_job(user_id, job_data)
        
        # Iniciar otimização em background usando thread (mais confiável que BackgroundTasks)
        def run_optimization():
            try:
                optimization_service.run_genetic_optimization(job['id'])
            except Exception as e:
                logger.error(f"Error in background optimization: {str(e)}")
                # Marcar job como FAILED
                optimization_service.update_job_status(job['id'], 'FAILED')
        
        optimization_thread = threading.Thread(target=run_optimization)
        optimization_thread.daemon = True
        optimization_thread.start()
        
        return OptimizationJobResponse(**job)
        
    except ValueError as ve:
        logger.error(f"Validation error creating optimization job: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error creating optimization job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.get(
    "/jobs",
    response_model=OptimizationJobsListResponse,
    summary="Listar Jobs de Otimização",
    description="Lista todos os jobs de otimização do usuário."
)
async def list_optimization_jobs(current_user: dict = Depends(get_current_user)):
    """Lista todos os jobs de otimização do usuário."""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        jobs = optimization_service.get_optimization_jobs_by_user(user_id)
        
        return OptimizationJobsListResponse(
            jobs=[OptimizationJobResponse(**job) for job in jobs],
            total_count=len(jobs)
        )
        
    except Exception as e:
        logger.error(f"Error listing optimization jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar jobs: {str(e)}")

@router.get(
    "/jobs/{job_id}",
    response_model=OptimizationJobResponse,
    summary="Obter Job de Otimização",
    description="Obtém detalhes de um job específico."
)
async def get_optimization_job(job_id: int, current_user: dict = Depends(get_current_user)):
    """Obtém um job de otimização específico."""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        job = optimization_service.get_optimization_job_by_id(job_id, user_id)
        
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} não encontrado")
        
        return OptimizationJobResponse(**job)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching optimization job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar job: {str(e)}")

@router.get(
    "/jobs/{job_id}/status",
    summary="Status do Job",
    description="Obtém apenas o status e progresso de um job (endpoint otimizado para polling)."
)
async def get_job_status(job_id: int, current_user: dict = Depends(get_current_user)):
    """Endpoint otimizado para polling de status."""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        job = optimization_service.get_optimization_job_by_id(job_id, user_id)
        
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} não encontrado")
        
        return {
            "id": job['id'],
            "status": job['status'],
            "progress": job.get('progress', 0.0),
            "created_at": job['created_at'],
            "completed_at": job.get('completed_at')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job status {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar status: {str(e)}")

@router.post(
    "/jobs/{job_id}/run",
    summary="Executar Otimização",
    description="Inicia a execução de um job de otimização."
)
async def run_optimization_job(job_id: int, current_user: dict = Depends(get_current_user)):
    """Executa um job de otimização."""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        job = optimization_service.get_optimization_job_by_id(job_id, user_id)
        
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} não encontrado")
        
        if job['status'] != 'PENDING':
            raise HTTPException(
                status_code=400, 
                detail=f"Job está em status {job['status']} e não pode ser executado"
            )
        
        # Executar em background thread
        def run_optimization():
            try:
                optimization_service.run_genetic_optimization(job_id)
            except Exception as e:
                logger.error(f"Error in background optimization: {str(e)}")
                optimization_service.update_job_status(job_id, 'FAILED')
        
        optimization_thread = threading.Thread(target=run_optimization)
        optimization_thread.daemon = True
        optimization_thread.start()
        
        return {"message": f"Otimização do job {job_id} iniciada", "status": "RUNNING"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running optimization job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao executar job: {str(e)}")

@router.get(
    "/jobs/{job_id}/results",
    response_model=OptimizationResultsResponse,
    summary="Resultados da Otimização",
    description="Obtém os resultados da otimização ordenados por fitness score."
)
async def get_optimization_results(
    job_id: int,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Obtém os resultados da otimização."""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        
        # Verificar se o job existe
        job = optimization_service.get_optimization_job_by_id(job_id, user_id)
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} não encontrado")
        
        # Buscar resultados
        results = optimization_service.get_optimization_results(job_id, user_id, limit)
        
        return OptimizationResultsResponse(
            results=[OptimizationResult(**result) for result in results],
            job=OptimizationJobResponse(**job)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching optimization results {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar resultados: {str(e)}")

@router.get(
    "/jobs/{job_id}/best-parameters",
    response_model=BestParametersResponse,
    summary="Melhores Parâmetros",
    description="Obtém os melhores parâmetros encontrados na otimização."
)
async def get_best_parameters(job_id: int, current_user: dict = Depends(get_current_user)):
    """Obtém os melhores parâmetros da otimização."""
    try:
        database_service = DatabaseService()
        user_id = database_service.get_user_id_by_username(current_user['username'])
        best_params = optimization_service.get_best_parameters(job_id, user_id)
        
        if not best_params:
            raise HTTPException(
                status_code=404, 
                detail=f"Nenhum resultado encontrado para o job {job_id}"
            )
        
        return BestParametersResponse(**best_params)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching best parameters {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar melhores parâmetros: {str(e)}")

# Endpoint adicional para stats dos dados históricos
@router.get(
    "/historical-data/stats",
    response_model=HistoricalDataStatsResponse,
    summary="Estatísticas dos Dados Históricos",
    description="Obtém estatísticas do cache de dados históricos."
)
async def get_historical_data_stats(current_user: dict = Depends(get_current_user)):
    """Obtém estatísticas do cache de dados históricos."""
    try:
        stats = historical_data_service.get_cache_stats()
        return HistoricalDataStatsResponse(**stats)
        
    except Exception as e:
        logger.error(f"Error fetching historical data stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar estatísticas: {str(e)}")

@router.delete(
    "/historical-data/cache",
    summary="Limpar Cache",
    description="Limpa o cache de dados históricos."
)
async def clear_historical_data_cache(
    asset_symbol: Optional[str] = None,
    timeframe: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Limpa o cache de dados históricos."""
    try:
        historical_data_service.clear_cache(asset_symbol, timeframe)
        
        message = "Cache completo limpo"
        if asset_symbol and timeframe:
            message = f"Cache limpo para {asset_symbol} {timeframe}"
        elif asset_symbol:
            message = f"Cache limpo para {asset_symbol}"
        
        return {"message": message}
        
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao limpar cache: {str(e)}")