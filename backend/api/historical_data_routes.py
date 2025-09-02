# api/historical_data_routes.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import logging

from services.historical_data_service import HistoricalDataService
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)

# Pydantic models
class HistoricalDataStatsResponse(BaseModel):
    general: Dict[str, Any]
    by_asset: List[Dict[str, Any]]

class ClearCacheResponse(BaseModel):
    message: str
    cleared_records: int

# Create router
router = APIRouter()

# Initialize service
historical_data_service = HistoricalDataService()

@router.get(
    "/stats",
    response_model=HistoricalDataStatsResponse,
    summary="Estatísticas dos Dados Históricos",
    description="Obtém estatísticas completas do cache de dados históricos."
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
    "/cache",
    response_model=ClearCacheResponse,
    summary="Limpar Cache",
    description="Limpa o cache de dados históricos opcionalmente por ativo e/ou timeframe."
)
async def clear_historical_data_cache(
    asset_symbol: Optional[str] = None,
    timeframe: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Limpa o cache de dados históricos."""
    try:
        # Contar registros antes de limpar
        stats_before = historical_data_service.get_cache_stats()
        total_before = stats_before.get('general', {}).get('total_records', 0)
        
        # Limpar cache
        historical_data_service.clear_cache(asset_symbol, timeframe)
        
        # Contar registros depois de limpar
        stats_after = historical_data_service.get_cache_stats()
        total_after = stats_after.get('general', {}).get('total_records', 0)
        
        cleared_records = total_before - total_after
        
        # Construir mensagem
        message = "Cache completo limpo"
        if asset_symbol and timeframe:
            message = f"Cache limpo para {asset_symbol} {timeframe}"
        elif asset_symbol:
            message = f"Cache limpo para {asset_symbol}"
        
        return ClearCacheResponse(
            message=message,
            cleared_records=cleared_records
        )
        
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao limpar cache: {str(e)}")

@router.post(
    "/preload",
    summary="Pré-carregar Dados",
    description="Pré-carrega dados históricos para um ativo específico."
)
async def preload_historical_data(
    asset_symbol: str,
    timeframe: str,
    start_date: str,
    end_date: str,
    current_user: dict = Depends(get_current_user)
):
    """Pré-carrega dados históricos para otimizar performance de backtests futuros."""
    try:
        from datetime import datetime
        
        # Converter strings para dates
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Buscar dados (isso irá popular o cache)
        data = historical_data_service.get_historical_data(
            asset_symbol=asset_symbol,
            timeframe=timeframe,
            start_date=start,
            end_date=end
        )
        
        if data is None or data.empty:
            return {
                "message": f"Nenhum dado disponível para {asset_symbol} {timeframe} no período {start_date} - {end_date}",
                "records_loaded": 0
            }
        
        return {
            "message": f"Dados carregados com sucesso para {asset_symbol} {timeframe}",
            "records_loaded": len(data),
            "date_range": {
                "start": data.index.min().strftime('%Y-%m-%d'),
                "end": data.index.max().strftime('%Y-%m-%d')
            }
        }
        
    except ValueError as ve:
        logger.error(f"Invalid date format: {str(ve)}")
        raise HTTPException(status_code=400, detail=f"Formato de data inválido: {str(ve)}")
    except Exception as e:
        logger.error(f"Error preloading historical data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao pré-carregar dados: {str(e)}")