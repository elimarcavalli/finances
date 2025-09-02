# app/services/price_chart_service.py

from typing import Dict, Any
from .chart.tradingview_provider import TradingViewProvider
from .chart.strategy_mapper import StrategyChartMapper

class PriceChartService:
    """
    Serviço orquestrador responsável por gerar configurações para gráficos de preços.
    Ele desacopla a API da lógica específica de mapeamento e de provedores de gráficos.
    """
    def __init__(self, chart_provider=TradingViewProvider(), strategy_mapper=StrategyChartMapper()):
        """
        Inicializa o serviço. As dependências (provider, mapper) são injetadas
        para facilitar a testabilidade e a substituição futura.
        """
        self.chart_provider = chart_provider
        self.strategy_mapper = strategy_mapper

    def get_chart_configuration(
        self,
        strategy_name: str,
        strategy_params: Dict[str, Any],
        asset_symbol: str,
        timeframe: str,
        theme: str = 'light'
    ) -> Dict[str, Any]:
        """
        Cria uma configuração de gráfico completa e pronta para ser enviada ao frontend.

        1. Traduz a estratégia e seus parâmetros em uma lista de indicadores visuais.
        2. Usa o provedor de gráfico para montar a configuração final com base nesses indicadores.
        """
        # Etapa 1: Mapear a estratégia para os indicadores visuais
        studies = self.strategy_mapper.get_studies_for_strategy(strategy_name, strategy_params)

        # Etapa 2: Gerar a configuração do gráfico usando o provedor
        # O ideal é que o frontend envie o símbolo já no formato da TradingView,
        # ex: BINANCE:BTCUSDT, mas podemos adicionar uma lógica de fallback aqui.
        tv_symbol = asset_symbol if ':' in asset_symbol else f"BINANCE:{asset_symbol.upper()}"

        chart_config = self.chart_provider.generate_chart_config(
            symbol=tv_symbol,
            interval=timeframe,
            studies=studies,
            theme=theme
        )
        return chart_config