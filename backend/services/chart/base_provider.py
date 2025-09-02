# app/services/chart/base_provider.py

from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseChartProvider(ABC):
    """
    Classe base abstrata para provedores de serviços de gráficos.
    Define a interface que todos os provedores concretos devem implementar, garantindo
    que a nossa aplicação possa suportar diferentes bibliotecas de gráficos no futuro
    com o mínimo de alterações no resto do sistema.
    """

    @abstractmethod
    def generate_chart_config(
        self,
        symbol: str,
        interval: str,
        studies: List[Dict[str, Any]],
        theme: str = 'light'
    ) -> Dict[str, Any]:
        """
        Gera a configuração completa do gráfico no formato específico do provedor.

        :param symbol: O símbolo do ativo (ex: 'BINANCE:BTCUSDT').
        :param interval: O timeframe do gráfico (ex: 'D' para diário, '240' para 4h).
        :param studies: Uma lista de dicionários, cada um descrevendo um indicador técnico.
        :param theme: O tema do gráfico ('light' ou 'dark').
        :return: Um dicionário com a configuração completa para o widget do gráfico.
        """
        pass