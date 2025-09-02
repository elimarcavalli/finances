# api/__init__.py

"""
API routes package para o sistema de finanças.
Contém todas as rotas organizadas por domínio (otimização, dados históricos, gráficos, etc).
"""

from .optimization_routes import router as optimization_router
from .historical_data_routes import router as historical_data_router
from .chart_routes import router as chart_router

__all__ = [
    'optimization_router',
    'historical_data_router',
    'chart_router'
]