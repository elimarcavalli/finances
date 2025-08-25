import React, { useState, useEffect } from 'react';
import {
  Title,
  Text,
  Stack,
  Table,
  Button,
  Group,
  Badge,
  Card,
  Breadcrumbs,
  Anchor,
  Loader,
  Alert,
  Grid,
  Paper,
  Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconRefresh, IconWallet, IconTrendingUp } from '@tabler/icons-react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

export function CryptoAccountDetailsPage() {
  const { accountId } = useParams();
  const [account, setAccount] = useState(null);
  const [portfolioSummary, setPortfolioSummary] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const fetchAccount = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/accounts/${accountId}`);
      setAccount(response.data);
    } catch (error) {
      console.error('Erro ao buscar conta cripto:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar os dados da conta cripto',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolioSummary = async () => {
    setPortfolioLoading(true);
    try {
      // Tentar o novo endpoint primeiro
      const response = await api.get(`/portfolio/summary/${accountId}`);
      setPortfolioSummary(response.data.portfolio || []);
    } catch (error) {
      console.error('Erro ao buscar resumo do portfólio cripto:', error);
      
      // Fallback para o endpoint antigo de holdings se o novo falhar
      try {
        console.log('Tentando fallback para /holdings...');
        const fallbackResponse = await api.get(`/holdings?account_id=${accountId}`);
        const holdings = fallbackResponse.data.holdings || [];
        
        // Converter holdings para formato de portfolio summary
        const convertedPortfolio = holdings.map(holding => ({
          asset_id: holding.asset_id,
          symbol: holding.symbol,
          name: holding.asset_name,
          asset_class: holding.asset_class,
          quantity: holding.quantity,
          average_price_brl: holding.average_buy_price,
          current_price_brl: holding.current_price_brl,
          market_value_brl: holding.current_market_value_brl,
          unrealized_pnl_brl: 0, // Não disponível no formato antigo
          unrealized_pnl_percentage_brl: 0
        }));
        
        setPortfolioSummary(convertedPortfolio);
        console.log('Fallback successful para portfólio cripto:', convertedPortfolio);
      } catch (fallbackError) {
        console.error('Erro no fallback também:', fallbackError);
        notifications.show({
          title: 'Erro',
          message: 'Não foi possível carregar o resumo do portfólio cripto',
          color: 'red'
        });
      }
    } finally {
      setPortfolioLoading(false);
    }
  };

  const fetchMovements = async () => {
    setMovementsLoading(true);
    try {
      // Tentar o novo endpoint primeiro
      const response = await api.get(`/portfolio/movements/${accountId}`);
      setMovements(response.data.movements || []);
    } catch (error) {
      console.error('Erro ao buscar movimentações cripto:', error);
      // Se o novo endpoint falhar, apenas mostramos uma lista vazia
      setMovements([]);
      console.log('Sem movimentações cripto disponíveis para esta conta');
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchAccount();
      fetchPortfolioSummary();
      fetchMovements();
    }
  }, [accountId]);

  const handleRefresh = () => {
    fetchAccount();
    fetchPortfolioSummary();
    fetchMovements();
  };

  const formatCurrency = (value, currency = 'BRL') => {
    if (value === null || value === undefined || value === 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const calculatePortfolioPercentage = (marketValue) => {
    if (!marketValue || portfolioSummary.length === 0) return 0;
    const totalPortfolioValue = portfolioSummary.reduce((sum, position) => {
      return sum + (position.market_value_brl || 0);
    }, 0);
    return totalPortfolioValue > 0 ? ((marketValue / totalPortfolioValue) * 100) : 0;
  };

  const formatMovementType = (type) => {
    const types = {
      'COMPRA': 'Compra',
      'VENDA': 'Venda', 
      'TRANSFERENCIA_ENTRADA': 'Transferência (Entrada)',
      'TRANSFERENCIA_SAIDA': 'Transferência (Saída)',
      'SINCRONIZACAO': 'Sincronização Blockchain'
    };
    return types[type] || type;
  };

  const getMovementTypeColor = (type) => {
    const colors = {
      'COMPRA': 'green',
      'VENDA': 'red',
      'TRANSFERENCIA_ENTRADA': 'blue',
      'TRANSFERENCIA_SAIDA': 'orange',
      'SINCRONIZACAO': 'purple'
    };
    return colors[type] || 'gray';
  };

  const getAssetClassColor = (assetClass) => {
    const colors = {
      'CRIPTO': 'orange',
      'ACAO_BR': 'green',
      'ACAO_US': 'blue',
      'FII': 'purple',
      'FUNDO': 'cyan',
      'RENDA_FIXA': 'gray',
      'COMMODITIES': 'yellow',
      'OUTROS': 'dark'
    };
    return colors[assetClass] || 'gray';
  };

  // LÓGICA ESPECIAL PARA CONTAS CRIPTO
  const calculateCryptoBalances = () => {
    // Separar posições de BRL + USDT (saldo em caixa) vs outras cryptos (valor investido)
    const cashPositions = portfolioSummary.filter(position => 
      position.symbol === 'BRL' || position.symbol === 'USDT'
    );
    
    const investmentPositions = portfolioSummary.filter(position => 
      position.symbol !== 'BRL' && position.symbol !== 'USDT'
    );

    // Calcular saldo em caixa APENAS das posições de BRL + USDT (convertido para BRL)
    const cashBalance = cashPositions.reduce((sum, position) => {
      return sum + (position.market_value_brl || 0);
    }, 0);

    // Calcular valor investido (todas as outras cryptos)
    const investmentValue = investmentPositions.reduce((sum, position) => {
      return sum + (position.market_value_brl || 0);
    }, 0);

    return {
      cashBalance,
      investmentValue,
      totalValue: cashBalance + investmentValue,
      cashPositions,
      investmentPositions,
      totalCryptos: investmentPositions.length
    };
  };

  if (loading) {
    return (
      <Stack gap="md" align="center" mt="xl">
        <Loader size="lg" />
        <Text>Carregando dados da conta cripto...</Text>
      </Stack>
    );
  }

  if (!account) {
    return (
      <Alert color="red" title="Erro">
        Conta cripto não encontrada
      </Alert>
    );
  }

  // Verificar se realmente é uma conta cripto
  if (!['CARTEIRA_CRIPTO', 'CORRETORA_CRIPTO'].includes(account.type)) {
    return (
      <Alert color="orange" title="Aviso">
        Esta conta não é uma conta cripto. Use a página padrão de detalhes da conta.
      </Alert>
    );
  }

  const cryptoBalances = calculateCryptoBalances();

  const portfolioRows = cryptoBalances.investmentPositions.map((position, index) => (
    <Table.Tr key={`${position.asset_id}-${index}`}>
      <Table.Td>
        <Group gap="sm">
          <Badge color="orange" variant="light" size="sm">
            {position.symbol}
          </Badge>
          <Text size="sm">{position.name}</Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text ta="right">{Number(position.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 8 })}</Text>
      </Table.Td>
      <Table.Td>
        <Text ta="right">{formatCurrency(position.average_price_brl)}</Text>
      </Table.Td>
      <Table.Td>
        <Stack gap="xs">
          <Text ta="right" fw={500}>
            {formatCurrency(position.market_value_brl)}
          </Text>
          {position.current_price_brl && (
            <Text size="xs" c="dimmed" ta="right">
              {formatCurrency(position.current_price_brl)} / unidade
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <Text ta="right" fw={500}>
          {calculatePortfolioPercentage(position.market_value_brl).toFixed(2)}%
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" justify="center">
          <Text size="xs" c={position.unrealized_pnl_brl >= 0 ? 'green' : 'red'}>
            {position.unrealized_pnl_brl ? (
              <>
                {position.unrealized_pnl_brl >= 0 ? '+' : ''}{formatCurrency(position.unrealized_pnl_brl)}
                ({position.unrealized_pnl_percentage_brl >= 0 ? '+' : ''}{position.unrealized_pnl_percentage_brl?.toFixed(2) || 0}%)
              </>
            ) : (
              <Text size="xs" c="dimmed">N/A</Text>
            )}
          </Text>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  const movementRows = movements.slice(0, 15).map((movement, index) => (
    <Table.Tr key={`${movement.id}-${index}`}>
      <Table.Td>
        <Text size="sm">{new Date(movement.movement_date).toLocaleDateString('pt-BR')}</Text>
      </Table.Td>
      <Table.Td>
        <Badge color={getMovementTypeColor(movement.movement_type)} variant="light" size="sm">
          {formatMovementType(movement.movement_type)}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="sm">
          <Badge color="orange" variant="outline" size="sm">
            {movement.symbol}
          </Badge>
          <Text size="sm">{movement.asset_name}</Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text ta="right">{Number(movement.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 8 })}</Text>
      </Table.Td>
      <Table.Td>
        <Text ta="right">
          {movement.price_per_unit ? formatCurrency(movement.price_per_unit) : '-'}
        </Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Breadcrumbs>
        <Anchor component={Link} to="/accounts">
          Contas
        </Anchor>
        <Text>{account.name}</Text>
      </Breadcrumbs>

      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Group gap="sm">
                <IconWallet size={24} color="orange" />
                <div>
                  <Title order={2}>{account.name}</Title>
                  <Text c="dimmed">{account.institution} • Conta Cripto</Text>
                </div>
              </Group>
            </div>
            <Button leftSection={<IconArrowLeft size={16} />} variant="light" component={Link} to="/accounts">
              Voltar
            </Button>
          </Group>

          <div>
            <Text size="sm" c="dimmed">Tipo de Conta Cripto</Text>
            <Badge variant="light" color="orange">{account.type}</Badge>
          </div>
        </Stack>
      </Card>

      {/* KPIs ESPECIAIS PARA CRIPTO */}
      <Group gap="sm" align="center">
        <IconTrendingUp size={20} color="blue" />
        <Title order={4}>Dashboard Cripto</Title>
      </Group>
      
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Saldo em Caixa Cripto</Text>
              <Text size="xl" fw={700} c="green">
                {formatCurrency(cryptoBalances.cashBalance)}
              </Text>
              <Text size="xs" c="dimmed">
                BRL + USDT disponível
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Valor em Criptos</Text>
              <Text size="xl" fw={700} c="orange">
                {formatCurrency(cryptoBalances.investmentValue)}
              </Text>
              <Text size="xs" c="dimmed">
                Posições em criptomoedas
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Total da Carteira</Text>
              <Text size="xl" fw={700} c="green">
                {formatCurrency(cryptoBalances.totalValue)}
              </Text>
              <Text size="xs" c="dimmed">
                Caixa + Criptos
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Criptomoedas</Text>
              <Text size="xl" fw={700} c="purple">
                {cryptoBalances.totalCryptos}
              </Text>
              <Text size="xs" c="dimmed">
                Diferentes tokens
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Group justify="space-between">
        <div>
          <Title order={3}>Portfólio de Criptomoedas</Title>
          <Text c="dimmed">Posições consolidadas de tokens e criptomoedas</Text>
        </div>
        <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={handleRefresh}>
          Atualizar Preços
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Criptomoeda</Table.Th>
            <Table.Th ta="right">Quantidade</Table.Th>
            <Table.Th ta="right">Preço Médio</Table.Th>
            <Table.Th ta="right">Valor de Mercado</Table.Th>
            <Table.Th ta="right">% do Portfólio</Table.Th>
            <Table.Th ta="center">P&L Não Realizado</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {portfolioLoading ? (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                <Loader size="sm" />
              </Table.Td>
            </Table.Tr>
          ) : portfolioRows.length > 0 ? (
            portfolioRows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                Nenhuma criptomoeda encontrada nesta conta
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {movements.length > 0 && (
        <>
          <Divider my="xl" />
          
          <Title order={3} mb="md">Histórico de Transações Cripto</Title>
          
          <Paper withBorder>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Cripto</Table.Th>
                  <Table.Th ta="right">Quantidade</Table.Th>
                  <Table.Th ta="right">Preço Unitário</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {movementsLoading ? (
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                      <Loader size="sm" />
                    </Table.Td>
                  </Table.Tr>
                ) : movementRows.length > 0 ? (
                  movementRows
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                      <Text c="dimmed">Nenhuma transação cripto encontrada nesta conta</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
            {movements.length > 15 && (
              <Group justify="center" p="md">
                <Text size="sm" c="dimmed">
                  Mostrando as 15 transações mais recentes de {movements.length} no total
                </Text>
              </Group>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}