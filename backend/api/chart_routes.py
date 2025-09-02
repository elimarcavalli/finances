# app/api/chart_routes.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any

from services.price_chart_service import PriceChartService
from services.auth_service import get_current_user

# Pydantic models para validação automática da requisição
class ChartConfigRequest(BaseModel):
    strategy_name: str = Field(..., example="RSI_MACD")
    strategy_params: Dict[str, Any] = Field(..., example={"rsi_period": 14, "macd_fast": 12})
    asset_symbol: str = Field(..., example="BTCUSDT")
    timeframe: str = Field(..., example="1d")
    theme: str = "light"

# Cria um "roteador" para organizar os endpoints relacionados a gráficos
router = APIRouter()

# Instancia nosso serviço. Em uma aplicação maior, usaríamos um sistema
# de injeção de dependências do FastAPI.
chart_service = PriceChartService()

@router.post(
    "/config",
    response_model=Dict[str, Any],
    summary="Gerar Configuração de Gráfico",
    description="Recebe os detalhes de uma estratégia e um ativo, e retorna a configuração completa para renderizar um gráfico da TradingView."
)
async def generate_chart_config(request: ChartConfigRequest, current_user: dict = Depends(get_current_user)):
    """
    Endpoint para gerar a configuração de um gráfico.
    Ele recebe os dados do frontend, valida através do modelo Pydantic
    e passa para o serviço de gráficos processar a lógica de negócio.
    """
    try:
        print(f"Gerando configuração de gráfico para {request.strategy_name} e {request.asset_symbol}")
        config = chart_service.get_chart_configuration(
            strategy_name=request.strategy_name,
            strategy_params=request.strategy_params,
            asset_symbol=request.asset_symbol,
            timeframe=request.timeframe,
            theme=request.theme
        )
        return config
    except Exception as e:
        # Tratamento de erro genérico
        raise HTTPException(
            status_code=500,
            detail=f"Ocorreu um erro interno ao gerar a configuração do gráfico: {e}"
        )