import { Title, Text, Stack } from '@mantine/core';

export function BacktestingPage() {
  return (
    <Stack>
      <Title order={2}>Backtesting e Simulações</Title>
      <Text>
        Seção para realizar testes históricos das estratégias desenvolvidas. Os usuários poderão executar simulações 
        com dados históricos usando saldo inicial em USDT, definir períodos específicos para análise e obter métricas 
        detalhadas de performance como win rate, risk/reward ratio, drawdown máximo, sharpe ratio e profit factor. 
        Os resultados incluirão gráficos de equity curve e relatórios detalhados de cada trade simulado.
      </Text>
    </Stack>
  );
}