# app/services/chart/strategy_mapper.py

from typing import Dict, Any, List

class StrategyChartMapper:
    """
    Mapeia os parâmetros de uma estratégia de trading para uma lista de
    indicadores ('studies') que podem ser renderizados em um gráfico.
    Esta classe centraliza a lógica de visualização de cada estratégia.
    """

    def get_studies_for_strategy(
        self,
        strategy_name: str,
        parameters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Converte uma estratégia e seus parâmetros na lista de indicadores correspondentes.
        Utiliza um método dinâmico para chamar a função de mapeamento correta
        baseado no nome da estratégia.

        :param strategy_name: O nome da estratégia (ex: 'RSI_MACD').
        :param parameters: Dicionário com os parâmetros da estratégia.
        :return: Lista de indicadores prontos para o provedor de gráfico.
        """
        mapper_method_name = f"_map_{strategy_name.lower()}"
        mapper_method = getattr(self, mapper_method_name, self._map_default)
        return mapper_method(parameters)
    
    def _map_default(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Mapeamento padrão caso a estratégia não tenha visualização definida."""
        return []

    def _map_rsi_macd(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Mapeia a estratégia RSI + MACD para os indicadores da TradingView."""
        return [
            {
                "id": "RSI@tv-basicstudies",
                "inputs": { "length": int(params.get("rsi_period", 14)) }
            },
            {
                "id": "MACD@tv-basicstudies",
                "inputs": {
                    "fast_length": int(params.get("macd_fast", 12)),
                    "slow_length": int(params.get("macd_slow", 26)),
                    "source": "close",
                    "signal_length": int(params.get("macd_signal", 9))
                }
            }
        ]

    def _map_bollinger_rsi(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Mapeia a estratégia Bollinger Bands + RSI."""
        return [
            {
                "id": "BollingerBands@tv-basicstudies",
                "inputs": {
                    "length": int(params.get("bb_period", 20)),
                    "mult": float(params.get("bb_std", 2.0))
                }
            },
            {
                "id": "RSI@tv-basicstudies",
                "inputs": { "length": int(params.get("rsi_period", 14)) }
            }
        ]
        
    def _map_moving_average_crossover(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Mapeia a estratégia de Crossover de Médias Móveis."""
        ma_type = params.get("ma_type", "EMA").upper()
        # Garante que o tipo de MA seja um dos suportados pelo study_id da TradingView
        study_id = f"MovingAverage{ma_type}@tv-basicstudies" if ma_type != 'SMA' else "MASimple@tv-basicstudies"

        return [
            {
                "id": study_id,
                "inputs": { "length": int(params.get("ma_short", 10)) },
                "styles": { "plot_0": { "color": "#3366FF" } } # Azul para a curta
            },
            {
                "id": study_id,
                "inputs": { "length": int(params.get("ma_long", 50)) },
                "styles": { "plot_0": { "color": "#FF6633" } } # Laranja para a longa
            }
        ]

    def _map_momentum_breakout(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Mapeia a estratégia Momentum Breakout. Como não há um indicador único,
        representamos com canais (Donchian) e volume.
        """
        return [
            {
                "id": "DonchianChannels@tv-basicstudies",
                "inputs": { "length": int(params.get("lookback_period", 20)) }
            },
            {
                "id": "Volume@tv-basicstudies",
                "inputs": { "show ma": True, "ma length": 20 }
            }
        ]
        
    def _map_mean_reversion(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Mapeia a estratégia de Reversão à Média. Bandas de Bollinger são uma
        excelente representação visual para esta estratégia.
        """
        return [
            {
                "id": "BollingerBands@tv-basicstudies",
                "inputs": {
                    "length": int(params.get("lookback_period", 20)),
                    "mult": float(params.get("z_score_entry", 2.0))
                }
            }
        ]