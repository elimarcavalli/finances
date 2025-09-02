import React, { useState, useEffect } from 'react';
import {
  Title,
  Grid,
  Card,
  Text,
  Stack,
  Group,
  Loader,
  Table,
  Badge,
  NumberFormatter,
  Progress,
  Alert,
  SegmentedControl,
  UnstyledButton
} from '@mantine/core';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { IconTrendingUp, IconTrendingDown, IconWallet, IconCoins, IconCash, IconAlertCircle, IconPigMoney, IconReceiptTax, IconCalendarEvent, IconReceipt, IconCurrencyDollar, IconSortAscending, IconSortDescending, IconBuildingWarehouse } from '@tabler/icons-react';
import api from '../api';
import { handleApiError } from '../utils/errorHandler';
import { useSorting } from '../hooks/useSorting';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#87ceeb', '#ffb347'];

const ASSET_CLASS_LABELS = {
  'CRIPTO': 'Criptomoedas',
  'ACAO_BR': 'Ações BR',
  'ACAO_US': 'Ações US',
  'FII': 'FIIs',
  'FUNDO': 'Fundos',
  'RENDA_FIXA': 'Renda Fixa',
  'COMMODITIES': 'Commodities',
  'PATRIMONIO_FISICO': 'Patrimônio Físico',
  'OUTROS': 'Outros'
};

export function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [cashFlowChart, setCashFlowChart] = useState([]);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [upcomingObligations, setUpcomingObligations] = useState(null);
  const [cashFlowPeriod, setCashFlowPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [obligationsLoading, setObligationsLoading] = useState(false);
  
  // Hooks de ordenação para as tabelas
  const holdingsSorting = useSorting('value', 'desc');
  const accountsSorting = useSorting('balance', 'desc');

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const dashboardRes = await api.get('/summary/dashboard');
      setDashboardData(dashboardRes.data);
      await fetchCashFlowChart(cashFlowPeriod);
      // await fetchNetWorthHistory();
    } catch (error) {
      handleApiError(error, 'Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchCashFlowChart = async (period) => {
    setChartLoading(true);
    try {
      const chartRes = await api.get(`/summary/cash-flow-chart?period=${period}`);
      // Verificar se a resposta tem o novo formato {success: true, data: [...]}
      const chartData = chartRes.data?.data ? chartRes.data.data : chartRes.data;
      setCashFlowChart(chartData || []);
    } catch (error) {
      handleApiError(error, 'Erro ao carregar gráfico de fluxo de caixa');
    } finally {
      setChartLoading(false);
    }
  };

  // const fetchNetWorthHistory = async () => {
  //   setHistoryLoading(true);
  //   try {
  //     const historyRes = await api.get('/summary/net-worth-history');
  //     setNetWorthHistory(historyRes.data);
  //   } catch (error) {
  //     handleApiError(error, 'Erro ao carregar histórico de patrimônio');
  //   } finally {
  //     setHistoryLoading(false);
  //   }
  // };

  const fetchUpcomingObligations = async () => {
    setObligationsLoading(true);
    try {
      const response = await api.get('/obligations/upcoming-summary');
      setUpcomingObligations(response.data);
    } catch (error) {
      handleApiError(error, 'Erro ao carregar obrigações próximas');
    } finally {
      setObligationsLoading(false);
    }
  };

  const handlePeriodChange = async (period) => {
    setCashFlowPeriod(period);
    await fetchCashFlowChart(period);
  };

  useEffect(() => {
    fetchDashboardData();
    fetchUpcomingObligations();
  }, []);

  const getPieChartData = () => {
    if (!dashboardData?.assetAllocation) return [];
    return dashboardData.assetAllocation.map(item => ({
      name: ASSET_CLASS_LABELS[item.class] || item.class,
      value: item.value,
      percentage: item.percentage
    }));
  };

  const getFormattedChartData = () => {
    if (!cashFlowChart || cashFlowChart.length === 0) return [];
    return cashFlowChart.map(item => ({
      ...item,
      date: formatDateForChart(item.date),
      income: item.income || 0,
      expense: Math.abs(item.expense || 0)
    }));
  };

  const formatDateForChart = (dateStr) => {
    if (cashFlowPeriod === 'daily') {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } else if (cashFlowPeriod === 'weekly') {
      return `Sem ${dateStr.split('-')[1]}`;
    } else {
      const [year, month] = dateStr.split('-');
      return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    }
  };

  const getAccountTypeColor = (type) => {
    const colors = {
      'CONTA_CORRENTE': 'blue',
      'POUPANCA': 'green',
      'CORRETORA_NACIONAL': 'purple',
      'CORRETORA_CRIPTO': 'orange',
      'CARTEIRA_CRIPTO': 'orange',
      'CARTAO_CREDITO': 'red',
      'DINHEIRO_VIVO': 'gray'
    };
    return colors[type] || 'gray';
  };

  if (loading) {
    return (
      <Stack gap="md" align="center" mt="xl">
        <Loader size="lg" />
        <Text>Carregando dashboard...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Dashboard Financeiro</Title>

      {/* KPIs Grid */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder radius="md" p="lg" style={{ background: 'linear-gradient(45deg, #c67afdff 0%, #490092ff 100%)' }}>
            <Group justify="space-between">
              <div>
                <Text c="white" size="xs" fw={500}>Patrimônio Líquido</Text>
                <Text c="white" size="lg" fw={700}>
                  {formatCurrency(dashboardData?.netWorth)}
                </Text>
              </div>
              <IconWallet size={32} color="white" style={{ opacity: 0.8 }} />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder radius="md" p="lg" style={{ background: 'linear-gradient(45deg, #5272ffff 0%, #059669 100%)' }}>
            <Group justify="space-between">
              <div>
                <Text c="white" size="xs" fw={500}>Total Investido</Text>
                <Text c="white" size="lg" fw={700}>
                  {formatCurrency(dashboardData?.totalInvested)}
                </Text>
              </div>
              <IconCoins size={32} color="white" style={{ opacity: 0.8 }} />
            </Group>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder radius="md" p="lg" style={{ background: 'linear-gradient(45deg, #f59e0b 0%, #d97706 100%)' }}>
            <Group justify="space-between">
              <div>
                <Text c="white" size="xs" fw={500}>Total em Caixa</Text>
                <Text c="white" size="lg" fw={700}>
                  {formatCurrency(dashboardData?.totalCash)}
                </Text>
              </div>
              <IconCash size={32} color="white" style={{ opacity: 0.8 }} />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder radius="md" p="lg" style={{ background: 'linear-gradient(45deg, #8b5cf6 0%, #7c3aed 100%)' }}>
            <Group justify="space-between">
              <div>
                <Text c="white" size="xs" fw={500}>Bens Físicos</Text>
                <Text c="white" size="lg" fw={700}>
                  {formatCurrency(dashboardData?.totalPhysicalAssets || 0)}
                </Text>
              </div>
              <IconBuildingWarehouse size={32} color="white" style={{ opacity: 0.8 }} />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder radius="md" p="lg" style={{ background: 'linear-gradient(45deg, #10b981 0%, #059669 100%)' }}>
            <Group justify="space-between">
              <div>
                <Text c="white" size="xs" fw={500}>A Receber (MÊS ATUAL)</Text>
                <Text c="white" size="lg" fw={700}>
                  {formatCurrency(dashboardData?.upcomingReceivables?.total)}
                </Text>
              </div>
              <IconCurrencyDollar size={32} color="white" style={{ opacity: 0.8 }} />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder radius="md" p="lg" style={{ background: 'linear-gradient(45deg, #ef4444 0%, #dc2626 100%)' }}>
            <Group justify="space-between">
              <div>
                <Text c="white" size="xs" fw={500}>A Pagar (MÊS ATUAL)</Text>
                <Text c="white" size="lg" fw={700}>
                  {formatCurrency(dashboardData?.upcomingPayables?.total)}
                </Text>
              </div>
              <IconReceipt size={32} color="white" style={{ opacity: 0.8 }} />
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          {/* Widget Fluxo de Caixa Interativo */}
          <Card withBorder radius="md" h="100%">
            <Stack gap="md">
              <Group justify="space-between">
                <Group>
                  <IconCash size={24} />
                  <Title order={4}>Fluxo de Caixa</Title>
                </Group>
                <SegmentedControl
                  value={cashFlowPeriod}
                  onChange={handlePeriodChange}
                  data={[
                    { label: 'Diário', value: 'daily' },
                    { label: 'Semanal', value: 'weekly' },
                    { label: 'Mensal', value: 'monthly' }
                  ]}
                  size="sm"
                />
              </Group>
              
              {chartLoading ? (
                <Stack align="center" py="xl">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Carregando gráfico...</Text>
                </Stack>
              ) : getFormattedChartData().length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getFormattedChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" name="Receitas" />
                    <Bar dataKey="expense" fill="#ef4444" name="Despesas" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Alert icon={<IconAlertCircle size={16} />} color="blue">
                  Nenhuma transação encontrada para o período selecionado
                </Alert>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {/* Widget Alocação de Ativos */}
          <Card withBorder radius="md" h="100%">
            <Stack gap="md">
              <Group>
                <IconCoins size={24} />
                <Title order={4}>Alocação de Portfólio</Title>
              </Group>
              
              {dashboardData?.assetAllocation?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={getPieChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percentage }) => `${percentage.toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getPieChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <Stack gap="xs">
                    {getPieChartData().map((item, index) => (
                      <Group key={item.name} justify="space-between">
                        <Group gap="xs">
                          <div 
                            style={{ 
                              width: 12, 
                              height: 12, 
                              backgroundColor: COLORS[index % COLORS.length],
                              borderRadius: 2
                            }} 
                          />
                          <Text size="sm">{item.name}</Text>
                        </Group>
                        <Text size="sm" fw={500}>
                          {item.percentage.toFixed(1)}%
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </>
              ) : (
                <Alert icon={<IconAlertCircle size={16} />} color="blue">
                  Nenhum investimento encontrado
                </Alert>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Widget Portfólio Cripto */}
      <Card withBorder radius="md">
        <Stack gap="md">
          <Group>
            <IconCoins size={24} />
            <Title order={4}>Portfólio Cripto</Title>
          </Group>
          
          {dashboardData?.cryptoPortfolio?.total_value > 0 ? (
            <Grid>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Card withBorder p="md" style={{ background: 'linear-gradient(45deg, #f59e0b 0%, #d97706 100%)' }}>
                  <Stack gap="xs" align="center">
                    <Text c="white" size="xs" fw={500}>Valor Total em Cripto</Text>
                    <Text c="white" size="xl" fw={700}>
                      {formatCurrency(dashboardData.cryptoPortfolio.total_value)}
                    </Text>
                  </Stack>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 8 }}>
                <Stack gap="xs">
                  <Text fw={500} size="sm">Principais Holdings</Text>
                  {dashboardData.cryptoPortfolio.top_holdings?.length > 0 ? (
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>
                            <UnstyledButton onClick={() => holdingsSorting.handleSort('symbol')}>
                              <Group gap="xs">
                                <Text fw={500} size="sm">Ativo</Text>
                                {holdingsSorting.sortField === 'symbol' && (
                                  holdingsSorting.sortDirection === 'asc' ? 
                                  <IconSortAscending size={12} /> : 
                                  <IconSortDescending size={12} />
                                )}
                              </Group>
                            </UnstyledButton>
                          </Table.Th>
                          <Table.Th ta="right">
                            <UnstyledButton onClick={() => holdingsSorting.handleSort('quantity')}>
                              <Group gap="xs" justify="flex-end">
                                <Text fw={500} size="sm">Quantidade</Text>
                                {holdingsSorting.sortField === 'quantity' && (
                                  holdingsSorting.sortDirection === 'asc' ? 
                                  <IconSortAscending size={12} /> : 
                                  <IconSortDescending size={12} />
                                )}
                              </Group>
                            </UnstyledButton>
                          </Table.Th>
                          <Table.Th ta="right">
                            <UnstyledButton onClick={() => holdingsSorting.handleSort('value')}>
                              <Group gap="xs" justify="flex-end">
                                <Text fw={500} size="sm">Valor</Text>
                                {holdingsSorting.sortField === 'value' && (
                                  holdingsSorting.sortDirection === 'asc' ? 
                                  <IconSortAscending size={12} /> : 
                                  <IconSortDescending size={12} />
                                )}
                              </Group>
                            </UnstyledButton>
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {holdingsSorting.sortData(dashboardData.cryptoPortfolio.top_holdings || []).slice(0, 5).map((holding) => (
                          <Table.Tr key={holding.symbol}>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text fw={500} size="sm">{holding.symbol}</Text>
                                <Text size="xs" c="dimmed">{holding.name}</Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text size="sm">
                                {new Intl.NumberFormat('pt-BR', { 
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 8
                                }).format(holding.quantity)}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={500} size="sm" c="green">
                                {formatCurrency(holding.value)}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text size="sm" c="dimmed">Nenhuma posição encontrada</Text>
                  )}
                </Stack>
              </Grid.Col>
            </Grid>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              Nenhuma criptomoeda encontrada no portfólio
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Widget Evolução do Patrimônio */}
      <Card withBorder radius="md">
        <Stack gap="md">
          <Group>
            <IconTrendingUp size={24} />
            <Title order={4}>Evolução do Patrimônio Líquido</Title>
          </Group>
          
          {historyLoading ? (
            <Stack align="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Carregando histórico...</Text>
            </Stack>
          ) : netWorthHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={netWorthHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip 
                  formatter={(value) => [formatCurrency(value), 'Patrimônio Líquido']}
                  labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                />
                <Line 
                  type="monotone" 
                  dataKey="net_worth" 
                  stroke="#667eea" 
                  strokeWidth={3}
                  dot={{ fill: '#667eea', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#667eea', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              Nenhum snapshot de patrimônio encontrado. Execute o worker de snapshots para gerar dados históricos.
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Widget Previsão de Fluxo de Caixa */}
      <Card withBorder radius="md">
        <Stack gap="md">
          <Group>
            <IconCalendarEvent size={24} />
            <Title order={4}>Previsão de Fluxo de Caixa</Title>
          </Group>
          
          {obligationsLoading ? (
            <Stack align="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Carregando previsões...</Text>
            </Stack>
          ) : upcomingObligations ? (
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                {/* Próximas Entradas */}
                <Card withBorder>
                  <Stack gap="sm">
                    <Group>
                      <IconTrendingUp size={20} color="green" />
                      <Text fw={500} c="green">Próximas Entradas</Text>
                    </Group>
                    
                    {upcomingObligations.upcoming_receivables?.length > 0 ? (
                      upcomingObligations.upcoming_receivables.map((obligation) => (
                        <Group key={obligation.id} justify="space-between">
                          <div>
                            <Text size="sm" fw={500}>{obligation.description}</Text>
                            <Text size="xs" c="dimmed">
                              {new Date(obligation.due_date).toLocaleDateString('pt-BR')}
                              {obligation.entity_name && ` • ${obligation.entity_name}`}
                            </Text>
                          </div>
                          <Text size="sm" fw={500} c="green">
                            {formatCurrency(obligation.amount)}
                          </Text>
                        </Group>
                      ))
                    ) : (
                      <Text size="sm" c="dimmed" ta="center" py="md">
                        Nenhuma entrada prevista
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, md: 6 }}>
                {/* Próximas Saídas */}
                <Card withBorder>
                  <Stack gap="sm">
                    <Group>
                      <IconTrendingDown size={20} color="red" />
                      <Text fw={500} c="red">Próximas Saídas</Text>
                    </Group>
                    
                    {upcomingObligations.upcoming_payables?.length > 0 ? (
                      upcomingObligations.upcoming_payables.map((obligation) => (
                        <Group key={obligation.id} justify="space-between">
                          <div>
                            <Text size="sm" fw={500}>{obligation.description}</Text>
                            <Text size="xs" c="dimmed">
                              {new Date(obligation.due_date).toLocaleDateString('pt-BR')}
                              {obligation.entity_name && ` • ${obligation.entity_name}`}
                            </Text>
                          </div>
                          <Text size="sm" fw={500} c="red">
                            {formatCurrency(obligation.amount)}
                          </Text>
                        </Group>
                      ))
                    ) : (
                      <Text size="sm" c="dimmed" ta="center" py="md">
                        Nenhuma saída prevista
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              Nenhuma obrigação próxima encontrada
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Widget Resumo de Contas */}
      <Card withBorder radius="md">
        <Stack gap="md">
          <Title order={4}>Resumo de Contas</Title>
          
          {dashboardData?.accountSummary?.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <UnstyledButton onClick={() => accountsSorting.handleSort('name')}>
                      <Group gap="xs">
                        <Text fw={500} size="sm">Conta</Text>
                        {accountsSorting.sortField === 'name' && (
                          accountsSorting.sortDirection === 'asc' ? 
                          <IconSortAscending size={12} /> : 
                          <IconSortDescending size={12} />
                        )}
                      </Group>
                    </UnstyledButton>
                  </Table.Th>
                  <Table.Th>
                    <UnstyledButton onClick={() => accountsSorting.handleSort('type')}>
                      <Group gap="xs">
                        <Text fw={500} size="sm">Tipo</Text>
                        {accountsSorting.sortField === 'type' && (
                          accountsSorting.sortDirection === 'asc' ? 
                          <IconSortAscending size={12} /> : 
                          <IconSortDescending size={12} />
                        )}
                      </Group>
                    </UnstyledButton>
                  </Table.Th>
                  <Table.Th ta="right">
                    <UnstyledButton onClick={() => accountsSorting.handleSort('balance')}>
                      <Group gap="xs" justify="flex-end">
                        <Text fw={500} size="sm">Saldo</Text>
                        {accountsSorting.sortField === 'balance' && (
                          accountsSorting.sortDirection === 'asc' ? 
                          <IconSortAscending size={12} /> : 
                          <IconSortDescending size={12} />
                        )}
                      </Group>
                    </UnstyledButton>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accountsSorting.sortData(dashboardData.accountSummary || []).map((account) => (
                  <Table.Tr key={account.id}>
                    <Table.Td>
                      <Text fw={500}>{account.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getAccountTypeColor(account.type)} variant="light">
                        {account.type.replace('_', ' ')}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text 
                        fw={500} 
                        c={account.balance >= 0 ? 'green' : 'red'}
                      >
                        {formatCurrency(account.balance)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              Nenhuma conta cadastrada
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}