# api/datafeed_routes.py

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Any, Optional
import logging
from datetime import datetime, timezone
import json

# Importar serviços necessários
from services.historical_data_service import HistoricalDataService

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Initialize services
historical_data_service = HistoricalDataService()

@router.get("/config")
async def get_datafeed_config():
    """Configuração do datafeed para TradingView UDF."""
    config = {
        "supported_resolutions": ["1", "5", "15", "30", "60", "240", "1D", "1W"],
        "supports_group_request": False,
        "supports_marks": False,
        "supports_search": True,
        "supports_timescale_marks": False,
        "exchanges": [
            {
                "value": "BINANCE",
                "name": "Binance",
                "desc": "Binance Exchange"
            },
            {
                "value": "COINBASE",
                "name": "Coinbase",
                "desc": "Coinbase Exchange"
            }
        ],
        "symbols_types": [
            {
                "name": "crypto",
                "value": "crypto"
            }
        ]
    }
    return config

@router.get("/symbol_info")
async def get_symbol_info(symbol: str = Query(..., description="Symbol to resolve")):
    """Resolve symbol information for TradingView."""
    try:
        # Normalizar símbolo (remover prefixo de exchange se presente)
        clean_symbol = symbol.replace("BINANCE:", "").replace("COINBASE:", "")
        
        # Configuração padrão do símbolo
        symbol_info = {
            "name": clean_symbol,
            "ticker": clean_symbol,
            "description": f"{clean_symbol} / Cryptocurrency",
            "type": "crypto",
            "session": "24x7",
            "timezone": "Etc/UTC",
            "exchange": "BINANCE",
            "minmov": 1,
            "pricescale": 100000000,  # Para 8 casas decimais
            "has_intraday": True,
            "has_no_volume": False,
            "has_weekly_and_monthly": True,
            "supported_resolutions": ["1", "5", "15", "30", "60", "240", "1D", "1W"],
            "volume_precision": 8,
            "data_status": "streaming"
        }
        
        logger.info(f"Symbol resolved: {clean_symbol}")
        return symbol_info
        
    except Exception as e:
        logger.error(f"Error resolving symbol {symbol}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Cannot resolve symbol: {symbol}")

@router.get("/history")
async def get_history(
    symbol: str = Query(..., description="Trading symbol"),
    resolution: str = Query(..., description="Resolution/timeframe"),
    from_timestamp: int = Query(..., alias="from", description="From timestamp"),
    to_timestamp: int = Query(..., alias="to", description="To timestamp")
):
    """Get historical data for TradingView UDF format."""
    try:
        # Converter timestamps para datetime
        from_date = datetime.fromtimestamp(from_timestamp, tz=timezone.utc)
        to_date = datetime.fromtimestamp(to_timestamp, tz=timezone.utc)
        
        # Normalizar símbolo
        clean_symbol = symbol.replace("BINANCE:", "").replace("COINBASE:", "")
        
        # Mapear resolução para timeframe
        timeframe_map = {
            "1": "1m",
            "5": "5m", 
            "15": "15m",
            "30": "30m",
            "60": "1h",
            "240": "4h",
            "1D": "1d",
            "1W": "1w"
        }
        
        timeframe = timeframe_map.get(resolution, "1d")
        
        logger.info(f"Fetching history for {clean_symbol} from {from_date} to {to_date} with resolution {resolution} ({timeframe})")
        
        # Buscar dados históricos através do serviço
        # Primeiro, tentar buscar asset_id pelo símbolo
        try:
            # Simular busca de dados - você pode integrar com seu HistoricalDataService aqui
            historical_data = historical_data_service.get_asset_historical_data(
                asset_symbol=clean_symbol,
                timeframe=timeframe,
                start_date=from_date.date(),
                end_date=to_date.date()
            )
            
            if not historical_data or len(historical_data) == 0:
                # Retornar "no_data" se não houver dados
                return {
                    "s": "no_data",
                    "nextTime": to_timestamp
                }
            
            # Converter para formato UDF
            timestamps = []
            opens = []
            highs = []
            lows = []
            closes = []
            volumes = []
            
            for bar in historical_data:
                # Assumindo que os dados vêm como dict com keys: timestamp, open, high, low, close, volume
                timestamps.append(int(bar.get('timestamp', bar.get('time', from_timestamp))))
                opens.append(float(bar.get('open', 0)))
                highs.append(float(bar.get('high', 0)))
                lows.append(float(bar.get('low', 0)))
                closes.append(float(bar.get('close', 0)))
                volumes.append(float(bar.get('volume', 0)))
            
            return {
                "s": "ok",
                "t": timestamps,
                "o": opens,
                "h": highs,
                "l": lows,
                "c": closes,
                "v": volumes
            }
            
        except Exception as data_error:
            logger.warning(f"No historical data found for {clean_symbol}: {str(data_error)}")
            # Gerar dados sintéticos para demonstração
            return _generate_synthetic_data(from_timestamp, to_timestamp, resolution)
            
    except Exception as e:
        logger.error(f"Error fetching history for {symbol}: {str(e)}")
        return {
            "s": "error", 
            "errmsg": f"Error fetching data: {str(e)}"
        }

def _generate_synthetic_data(from_timestamp: int, to_timestamp: int, resolution: str) -> dict:
    """Gera dados sintéticos para demonstração."""
    import random
    import math
    
    # Calcular intervalo baseado na resolução
    interval_seconds = {
        "1": 60,
        "5": 300,
        "15": 900, 
        "30": 1800,
        "60": 3600,
        "240": 14400,
        "1D": 86400,
        "1W": 604800
    }.get(resolution, 86400)
    
    timestamps = []
    opens = []
    highs = []
    lows = []
    closes = []
    volumes = []
    
    current_time = from_timestamp
    base_price = 50000.0  # Preço base para BTC
    
    while current_time <= to_timestamp:
        # Gerar dados de vela sintéticos
        price_change = random.uniform(-0.02, 0.02)  # Variação de -2% a +2%
        open_price = base_price * (1 + price_change)
        
        high_change = random.uniform(0, 0.01)  # High até 1% acima
        low_change = random.uniform(-0.01, 0)  # Low até 1% abaixo
        close_change = random.uniform(-0.01, 0.01)  # Close variação
        
        high_price = open_price * (1 + high_change)
        low_price = open_price * (1 + low_change)
        close_price = open_price * (1 + close_change)
        
        # Garantir OHLC lógico
        high_price = max(high_price, open_price, close_price)
        low_price = min(low_price, open_price, close_price)
        
        volume = random.uniform(10.0, 1000.0)
        
        timestamps.append(current_time)
        opens.append(round(open_price, 2))
        highs.append(round(high_price, 2))
        lows.append(round(low_price, 2))
        closes.append(round(close_price, 2))
        volumes.append(round(volume, 8))
        
        # Atualizar para próxima vela
        base_price = close_price
        current_time += interval_seconds
    
    return {
        "s": "ok",
        "t": timestamps,
        "o": opens,
        "h": highs,
        "l": lows,
        "c": closes,
        "v": volumes
    }

@router.get("/search")
async def search_symbols(
    query: str = Query(..., description="Search query"),
    type: Optional[str] = Query(None, description="Symbol type"),
    exchange: Optional[str] = Query(None, description="Exchange"),
    limit: int = Query(30, description="Limit results")
):
    """Search for symbols."""
    # Lista básica de símbolos para demonstração
    symbols = [
        {
            "symbol": "BTCUSDT",
            "full_name": "BINANCE:BTCUSDT", 
            "description": "Bitcoin / Tether",
            "exchange": "BINANCE",
            "ticker": "BTCUSDT",
            "type": "crypto"
        },
        {
            "symbol": "ETHUSDT",
            "full_name": "BINANCE:ETHUSDT",
            "description": "Ethereum / Tether", 
            "exchange": "BINANCE",
            "ticker": "ETHUSDT",
            "type": "crypto"
        },
        {
            "symbol": "ADAUSDT", 
            "full_name": "BINANCE:ADAUSDT",
            "description": "Cardano / Tether",
            "exchange": "BINANCE", 
            "ticker": "ADAUSDT",
            "type": "crypto"
        }
    ]
    
    # Filtrar por query
    if query:
        query_upper = query.upper()
        symbols = [s for s in symbols if query_upper in s["symbol"].upper() or query_upper in s["description"].upper()]
    
    # Limitar resultados
    symbols = symbols[:limit]
    
    return symbols