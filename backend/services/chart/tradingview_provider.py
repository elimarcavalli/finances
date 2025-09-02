# app/services/chart/tradingview_provider.py

from typing import Dict, Any, List
from .base_provider import BaseChartProvider

class TradingViewProvider(BaseChartProvider):
    """
    Implementação concreta do provedor de gráficos para a TradingView.
    Esta classe é responsável por construir o objeto de configuração JSON
    que o widget da TradingView espera receber no frontend.
    """
    def generate_chart_config(
        self,
        symbol: str,
        interval: str,
        studies: List[Dict[str, Any]],
        theme: str = 'light'
    ) -> Dict[str, Any]:
        """
        Gera a configuração do widget Advanced Chart da TradingView.
        O mapeamento de 'interval' para o formato da TradingView (ex: '1d' -> 'D')
        é feito aqui para manter o frontend agnóstico.
        """
        interval_map = {
            '1h': '60',
            '4h': '240',
            '1d': 'D',
            '1w': 'W'
        }

        return {
            "autosize": True,
            "symbol": symbol,
            "interval": interval_map.get(interval.lower(), 'D'),
            "timezone": "Etc/UTC",
            "theme": theme,
            "style": "1", # Candlestick
            "locale": "br",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": False,
            "withdateranges": True,
            "hide_side_toolbar": False,
            "allow_symbol_change": True,
            "details": True,
            "hotlist": True,
            "calendar": True,
            "studies": studies,
        }