import { Title, Text, Stack } from '@mantine/core';

export function ChartsPage() {
  return (
    <Stack>
      <Title order={2}>Gráficos e Trading</Title>
      <Text>
        Esta área será dedicada à visualização de gráficos interativos, possivelmente com integração ao TradingView, 
        permitindo a execução de ordens diretamente pelo gráfico. Os traders poderão visualizar indicadores técnicos, 
        linhas de suporte e resistência, e executar trades em tempo real com análise avançada de mercado.
      </Text>
    </Stack>
  );
}