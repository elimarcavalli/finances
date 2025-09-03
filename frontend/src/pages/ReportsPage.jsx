import React, { useState, useEffect } from 'react';
import {
  Title,
  Text,
  Stack,
  Grid,
  Card,
  Paper,
  Group,
  Button,
  SegmentedControl,
  Center,
  Loader,
  Alert,
  Container,
  Modal,
  Table,
  Progress
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { 
  IconChartLine, 
  IconCash, 
  IconTrendingUp, 
  IconTrendingDown,
  IconScale,
  IconCalendar, 
  IconRefresh, 
  IconArrowUpRight, 
  IconArrowDownRight,
  IconBuildingWarehouse,
  IconHome,
  IconCar,
  IconDeviceDesktop
} from '@tabler/icons-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Treemap
} from 'recharts';
import api from '../api';
import { AdvancedTable } from '../components/AdvancedTable';

export function ReportsPage() {
  // PHASE 4: Removido activeTab - agora é um dashboard unificado
  const [periodFilter, setPeriodFilter] = useState('6m');
  const [snapshotsData, setSnapshotsData] = useState([]);
  const [expenseAnalysis, setExpenseAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatingSnapshot, setGeneratingSnapshot] = useState(false);
  
  // Estados para os novos dados
  const [historicalAllocation, setHistoricalAllocation] = useState([]);
  const [kpiVariations, setKpiVariations] = useState(null);
  const [loadingAllocation, setLoadingAllocation] = useState(false);
  const [loadingKpis, setLoadingKpis] = useState(false);
  
  // Estados para drill-down modal
  const [drillDownModal, setDrillDownModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [snapshotDetails, setSnapshotDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Estados para novos widgets de fluxo de caixa
  const [cashFlowData, setCashFlowData] = useState([]);
  const [topExpenses, setTopExpenses] = useState([]);
  const [loadingCashFlow, setLoadingCashFlow] = useState(false);
  const [loadingTopExpenses, setLoadingTopExpenses] = useState(false);
  
  // PHASE 4: Estados para widget de Patrimônio Físico
  const [physicalAssetsData, setPhysicalAssetsData] = useState(null);
  const [loadingPhysicalAssets, setLoadingPhysicalAssets] = useState(false);
  
  // Estado para KPIs corretos (fonte da verdade do backend)
  const [cashFlowKPIs, setCashFlowKPIs] = useState({ 
    totalRevenue: 0, 
    totalExpenses: 0, 
    balance: 0 
  });
  const [loadingKPIs, setLoadingKPIs] = useState(false);

  // Função para calcular datas baseadas no filtro de período
  const getPeriodDates = (period) => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1m':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(endDate.getFullYear() - 10);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 6);
    }
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  };

  // Buscar dados de snapshots
  const fetchSnapshotsData = async (period = periodFilter) => {
    setLoading(true);
    try {
      const { start_date, end_date } = getPeriodDates(period);
      const response = await api.get(`/reports/snapshots/history?start_date=${start_date}&end_date=${end_date}`);
      
      if (response.data.success) {
        setSnapshotsData(response.data.snapshots);
      } else {
        throw new Error('Falha ao buscar dados de snapshots');
      }
    } catch (error) {
      console.error('Erro ao buscar snapshots:', error);
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Não foi possível carregar os dados dos snapshots',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Buscar análise de despesas
  const fetchExpenseAnalysis = async () => {
    try {
      const response = await api.get('/reports/expense-analysis');
      
      if (response.data.success) {
        setExpenseAnalysis(response.data);
      } else {
        setExpenseAnalysis(null);
      }
    } catch (error) {
      console.error('Erro ao buscar análise de despesas:', error);
      setExpenseAnalysis(null);
    }
  };

  // Gerar snapshot manual
  const generateSnapshot = async () => {
    setGeneratingSnapshot(true);
    try {
      const response = await api.post('/reports/snapshots/generate');
      
      if (response.data.success) {
        notifications.show({
          title: 'Sucesso!',
          message: 'Snapshot financeiro gerado com sucesso',
          color: 'green'
        });
        
        // Recarregar dados após gerar snapshot
        fetchSnapshotsData();
        fetchExpenseAnalysis();
      } else {
        throw new Error('Falha ao gerar snapshot');
      }
    } catch (error) {
      console.error('Erro ao gerar snapshot:', error);
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Não foi possível gerar o snapshot',
        color: 'red'
      });
    } finally {
      setGeneratingSnapshot(false);
    }
  };

  // Efeito para carregar dados iniciais
  useEffect(() => {
    fetchSnapshotsData();
    fetchExpenseAnalysis();
    fetchHistoricalAllocation();
    fetchKpiVariations();
    fetchCashFlowData();
    fetchTopExpenses();
    fetchCashFlowKPIs();
    fetchPhysicalAssetsData(); // PHASE 4: Dados de patrimônio físico
  }, []);

  // Efeito para recarregar quando o período muda
  useEffect(() => {
    fetchSnapshotsData(periodFilter);
    fetchHistoricalAllocation(periodFilter);
    fetchCashFlowData(periodFilter);
    fetchTopExpenses(periodFilter);
    fetchCashFlowKPIs(periodFilter);
  }, [periodFilter]);

  // Buscar alocação histórica
  const fetchHistoricalAllocation = async (period = periodFilter) => {
    setLoadingAllocation(true);
    try {
      const { start_date, end_date } = getPeriodDates(period);
      const response = await api.get(`/reports/snapshots/historical-allocation?start_date=${start_date}&end_date=${end_date}`);
      
      if (response.data.success) {
        setHistoricalAllocation(response.data.data);
      } else {
        setHistoricalAllocation([]);
      }
    } catch (error) {
      console.error('Erro ao buscar alocação histórica:', error);
      setHistoricalAllocation([]);
    } finally {
      setLoadingAllocation(false);
    }
  };

  // Buscar variações de KPIs
  const fetchKpiVariations = async () => {
    setLoadingKpis(true);
    try {
      const response = await api.get('/reports/snapshots/kpi-variation?period=30d');
      
      if (response.data.success) {
        setKpiVariations(response.data);
      } else {
        setKpiVariations(null);
      }
    } catch (error) {
      console.error('Erro ao buscar variações de KPIs:', error);
      setKpiVariations(null);
    } finally {
      setLoadingKpis(false);
    }
  };

  // Buscar detalhes de um snapshot específico (drill-down)
  const fetchSnapshotDetails = async (date) => {
    setLoadingDetails(true);
    try {
      const response = await api.get(`/reports/snapshots/details/${date}`);
      
      if (response.data.success) {
        setSnapshotDetails(response.data);
      } else {
        setSnapshotDetails(null);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do snapshot:', error);
      setSnapshotDetails(null);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar os detalhes para esta data',
        color: 'red'
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Buscar dados de fluxo de caixa mensal
  const fetchCashFlowData = async (period = periodFilter) => {
    setLoadingCashFlow(true);
    try {
      const { start_date, end_date } = getPeriodDates(period);
      const response = await api.get(`/summary/cash-flow-chart?start_date=${start_date}&end_date=${end_date}`);
      
      if (response.data && response.data.data) {
        setCashFlowData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar fluxo de caixa:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar dados de fluxo de caixa',
        color: 'red'
      });
    } finally {
      setLoadingCashFlow(false);
    }
  };

  // Buscar maiores despesas
  const fetchTopExpenses = async (period = periodFilter) => {
    setLoadingTopExpenses(true);
    try {
      const { start_date, end_date } = getPeriodDates(period);
      const response = await api.get(`/reports/top-expenses?start_date=${start_date}&end_date=${end_date}`);
      
      if (response.data && response.data.success) {
        setTopExpenses(response.data.top_expenses || []);
      }
    } catch (error) {
      console.error('Erro ao buscar maiores despesas:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar maiores despesas',
        color: 'red'
      });
    } finally {
      setLoadingTopExpenses(false);
    }
  };

  // Buscar KPIs de fluxo de caixa (FONTE DA VERDADE)
  const fetchCashFlowKPIs = async (period = periodFilter) => {
    setLoadingKPIs(true);
    try {
      const { start_date, end_date } = getPeriodDates(period);
      const response = await api.get(`/reports/cash-flow-kpis?start_date=${start_date}&end_date=${end_date}`);
      
      if (response.data && response.data.success) {
        setCashFlowKPIs({
          totalRevenue: response.data.total_income || 0,
          totalExpenses: response.data.total_expense || 0,
          balance: response.data.balance || 0
        });
      } else {
        setCashFlowKPIs({ totalRevenue: 0, totalExpenses: 0, balance: 0 });
      }
    } catch (error) {
      console.error('Erro ao buscar KPIs de fluxo de caixa:', error);
      setCashFlowKPIs({ totalRevenue: 0, totalExpenses: 0, balance: 0 });
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar KPIs de fluxo de caixa',
        color: 'red'
      });
    } finally {
      setLoadingKPIs(false);
    }
  };

  // PHASE 4: Buscar dados de patrimônio físico para relatórios
  const fetchPhysicalAssetsData = async () => {
    setLoadingPhysicalAssets(true);
    try {
      const response = await api.get('/reports/physical-assets-summary');
      setPhysicalAssetsData(response.data);
    } catch (error) {
      console.error('Erro ao buscar dados de patrimônio físico:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar dados de patrimônio físico',
        color: 'red'
      });
      setPhysicalAssetsData(null);
    } finally {
      setLoadingPhysicalAssets(false);
    }
  };

  // Formatador para valores monetários
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };


  // Preparar dados para o gráfico
  const chartData = snapshotsData.map(snapshot => ({
    date: snapshot.snapshot_date,
    patrimonio_liquido: snapshot.total_net_worth_brl,
    total_ativos: snapshot.total_assets_brl,
    total_passivos: snapshot.total_liabilities_brl,
    investido: snapshot.invested_assets_brl,
    liquido: snapshot.liquid_assets_brl,
    cripto: snapshot.crypto_portfolio_value_brl,
    acoes: snapshot.stock_portfolio_value_brl
  }));

  // Componente do gráfico principal
  const NetWorthChart = () => {
    if (!chartData.length) {
      return (
        <Center h={400}>
          <Stack align="center">
            <IconChartLine size={48} color="gray" />
            <Text c="dimmed">Nenhum dado disponível para o período selecionado</Text>
            <Button variant="light" onClick={generateSnapshot} loading={generatingSnapshot}>
              Gerar Primeiro Snapshot
            </Button>
          </Stack>
        </Center>
      );
    }

    // Função para lidar com clique no gráfico
    const handleChartClick = (data) => {
      if (data && data.activePayload && data.activePayload.length > 0) {
        const clickedData = data.activePayload[0].payload;
        setSelectedDate(clickedData.date);
        setDrillDownModal(true);
        fetchSnapshotDetails(clickedData.date);
      }
    };

    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} onClick={handleChartClick}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
          />
          <YAxis 
            tickFormatter={(value) => 
              new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(value)
            }
          />
          <Tooltip 
            formatter={(value, name) => [
              formatCurrency(value),
              {
                patrimonio_liquido: 'Patrimônio Líquido',
                total_ativos: 'Total de Ativos',
                total_passivos: 'Total de Passivos',
                investido: 'Valor Investido',
                liquido: 'Valor Líquido'
              }[name] || name
            ]}
            labelFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="patrimonio_liquido" 
            stroke="#2563eb" 
            strokeWidth={3}
            name="patrimonio_liquido"
          />
          <Line 
            type="monotone" 
            dataKey="total_ativos" 
            stroke="#16a34a" 
            strokeWidth={2}
            name="total_ativos"
          />
          <Line 
            type="monotone" 
            dataKey="total_passivos" 
            stroke="#dc2626" 
            strokeWidth={2}
            name="total_passivos"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Relatórios Financeiros</Title>
          <Text c="dimmed">Análises históricas e Business Intelligence do seu patrimônio</Text>
        </div>
        <Group>
          <Button 
            variant="light" 
            leftSection={<IconRefresh size={16} />}
            onClick={generateSnapshot}
            loading={generatingSnapshot}
          >
            Gerar Snapshot
          </Button>
          <Button 
            variant="light" 
            color="blue"
            leftSection={<IconCalendar size={16} />}
            onClick={() => fetchSnapshotsData()}
            loading={loading}
          >
            Atualizar Dados
          </Button>
        </Group>
      </Group>

      {/* Filtro de Período Global */}
      <Card withBorder padding="md">
        <Group justify="center" gap="md">
          <Text fw={500} size="sm">Período de Análise:</Text>
          <SegmentedControl
            value={periodFilter}
            onChange={setPeriodFilter}
            data={[
              { label: '1M', value: '1m' },
              { label: '3M', value: '3m' },
              { label: '6M', value: '6m' },
              { label: '1A', value: '1y' },
              { label: 'Tudo', value: 'all' }
            ]}
          />
        </Group>
      </Card>

      {/* PHASE 4: Dashboard Unificado - Widget de Evolução do Patrimônio */}
      <Card withBorder padding="md">
        <Stack gap="md">
          <Group>
            <IconChartLine size={24} />
            <Title order={3}>Evolução do Patrimônio</Title>
          </Group>
          
          {/* KPIs Resumidos */}
            {chartData.length > 0 && (
              <Grid>
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <Card withBorder padding="md" h="100%">
                    <Stack gap="xs">
                      <Text size="sm" c="dimmed">Patrimônio Líquido</Text>
                      <Text size="xl" fw={700} c="green">
                        {formatCurrency(chartData[chartData.length - 1]?.patrimonio_liquido)}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <Card withBorder padding="md" h="100%">
                    <Stack gap="xs">
                      <Text size="sm" c="dimmed">Total Investido</Text>
                      <Text size="xl" fw={700} c="blue">
                        {formatCurrency(chartData[chartData.length - 1]?.investido)}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <Card withBorder padding="md" h="100%">
                    <Stack gap="xs">
                      <Text size="sm" c="dimmed">Total em Caixa</Text>
                      <Text size="xl" fw={700} c={chartData[chartData.length - 1]?.liquido >= 0 ? 'green' : 'red'}>
                        {formatCurrency(chartData[chartData.length - 1]?.liquido)}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <Card withBorder padding="md" h="100%">
                    <Stack gap="xs">
                      <Text size="sm" c="dimmed">Total de Passivos</Text>
                      <Text size="xl" fw={700} c="red">
                        {formatCurrency(chartData[chartData.length - 1]?.total_passivos)}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>
            )}

            {/* Gráfico Principal */}
            <Card withBorder padding="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={500} size="lg">Evolução do Patrimônio Líquido</Text>
                  {loading && <Loader size="sm" />}
                </Group>
                <NetWorthChart />
              </Stack>
            </Card>

            {/* Gráficos de análise profunda */}
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder padding="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text fw={500} size="lg">Alocação Histórica de Ativos</Text>
                      {loadingAllocation && <Loader size="sm" />}
                    </Group>
                    
                    {historicalAllocation.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={historicalAllocation}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
                          />
                          <YAxis 
                            tickFormatter={(value) => 
                              new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              }).format(value)
                            }
                          />
                          <Tooltip 
                            formatter={(value, name) => [formatCurrency(value), name]}
                            labelFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
                          />
                          <Legend />
                          
                          {/* Áreas para cada classe de ativo com cores distintas */}
                          <Area
                            type="monotone"
                            dataKey="CRIPTO"
                            stackId="1"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.8}
                          />
                          <Area
                            type="monotone"
                            dataKey="ACAO_BR"
                            stackId="1"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.8}
                          />
                          <Area
                            type="monotone"
                            dataKey="ACAO_US"
                            stackId="1"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.8}
                          />
                          <Area
                            type="monotone"
                            dataKey="RENDA_FIXA"
                            stackId="1"
                            stroke="#8b5cf6"
                            fill="#8b5cf6"
                            fillOpacity={0.8}
                          />
                          <Area
                            type="monotone"
                            dataKey="TESOURO"
                            stackId="1"
                            stroke="#06b6d4"
                            fill="#06b6d4"
                            fillOpacity={0.8}
                          />
                          <Area
                            type="monotone"
                            dataKey="OUTROS"
                            stackId="1"
                            stroke="#6b7280"
                            fill="#6b7280"
                            fillOpacity={0.8}
                          />
                          <Area
                            type="monotone"
                            dataKey="PATRIMONIO_FISICO"
                            stackId="1"
                            stroke="#9333ea"
                            fill="#9333ea"
                            fillOpacity={0.8}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <Center h={300}>
                        <Stack align="center">
                          <IconChartLine size={48} color="gray" />
                          <Text c="dimmed">Nenhum dado de alocação disponível para o período</Text>
                        </Stack>
                      </Center>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder padding="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text fw={500} size="lg">KPIs de Variação (30 dias)</Text>
                      {loadingKpis && <Loader size="sm" />}
                    </Group>
                    
                    {kpiVariations && kpiVariations.success ? (
                      <Stack gap="sm">
                        <Grid gutter="sm">
                          <Grid.Col span={6}>
                            <Paper withBorder padding="md" h={80}>
                              <Stack justify="center" align="center" h="100%" gap="xs">
                                <Text size="xs" c="dimmed" tt="uppercase" fw={500} ta="center">
                                  Patrimônio Líquido
                                </Text>
                                <Group gap="xs" align="center">
                                  <Text 
                                    fw={700} 
                                    size="xl" 
                                    c={kpiVariations.variations.net_worth.variation_percent >= 0 ? 'green' : 'red'}
                                  >
                                    {kpiVariations.variations.net_worth.variation_percent >= 0 ? '+' : ''}
                                    {kpiVariations.variations.net_worth.variation_percent.toFixed(2)}%
                                  </Text>
                                  {kpiVariations.variations.net_worth.variation_percent >= 0 ? 
                                    <IconArrowUpRight size={20} color="green" /> : 
                                    <IconArrowDownRight size={20} color="red" />
                                  }
                                </Group>
                              </Stack>
                            </Paper>
                          </Grid.Col>
                          
                          <Grid.Col span={6}>
                            <Paper withBorder padding="md" h={80}>
                              <Stack justify="center" align="center" h="100%" gap="xs">
                                <Text size="xs" c="dimmed" tt="uppercase" fw={500} ta="center">
                                  Ativos Investidos
                                </Text>
                                <Group gap="xs" align="center">
                                  <Text 
                                    fw={700} 
                                    size="xl" 
                                    c={kpiVariations.variations.invested_assets.variation_percent >= 0 ? 'green' : 'red'}
                                  >
                                    {kpiVariations.variations.invested_assets.variation_percent >= 0 ? '+' : ''}
                                    {kpiVariations.variations.invested_assets.variation_percent.toFixed(2)}%
                                  </Text>
                                  {kpiVariations.variations.invested_assets.variation_percent >= 0 ? 
                                    <IconArrowUpRight size={20} color="green" /> : 
                                    <IconArrowDownRight size={20} color="red" />
                                  }
                                </Group>
                              </Stack>
                            </Paper>
                          </Grid.Col>
                        </Grid>
                        
                        <Grid gutter="sm">
                          <Grid.Col span={6}>
                            <Paper withBorder padding="md" h={80}>
                              <Stack justify="center" align="center" h="100%" gap="xs">
                                <Text size="xs" c="dimmed" tt="uppercase" fw={500} ta="center">
                                  Portfólio Cripto
                                </Text>
                                <Group gap="xs" align="center">
                                  <Text 
                                    fw={700} 
                                    size="xl" 
                                    c={kpiVariations.variations.crypto_portfolio.variation_percent >= 0 ? 'green' : 'red'}
                                  >
                                    {kpiVariations.variations.crypto_portfolio.variation_percent >= 0 ? '+' : ''}
                                    {kpiVariations.variations.crypto_portfolio.variation_percent.toFixed(2)}%
                                  </Text>
                                  {kpiVariations.variations.crypto_portfolio.variation_percent >= 0 ? 
                                    <IconArrowUpRight size={20} color="green" /> : 
                                    <IconArrowDownRight size={20} color="red" />
                                  }
                                </Group>
                              </Stack>
                            </Paper>
                          </Grid.Col>
                          
                          <Grid.Col span={6}>
                            <Paper withBorder padding="md" h={80}>
                              <Stack justify="center" align="center" h="100%" gap="xs">
                                <Text size="xs" c="dimmed" tt="uppercase" fw={500} ta="center">
                                  Portfólio Ações
                                </Text>
                                <Group gap="xs" align="center">
                                  <Text 
                                    fw={700} 
                                    size="xl" 
                                    c={kpiVariations.variations.stock_portfolio.variation_percent >= 0 ? 'green' : 'red'}
                                  >
                                    {kpiVariations.variations.stock_portfolio.variation_percent >= 0 ? '+' : ''}
                                    {kpiVariations.variations.stock_portfolio.variation_percent.toFixed(2)}%
                                  </Text>
                                  {kpiVariations.variations.stock_portfolio.variation_percent >= 0 ? 
                                    <IconArrowUpRight size={20} color="green" /> : 
                                    <IconArrowDownRight size={20} color="red" />
                                  }
                                </Group>
                              </Stack>
                            </Paper>
                          </Grid.Col>
                        </Grid>
                      </Stack>
                    ) : (
                      <Center h={200}>
                        <Stack align="center">
                          <IconTrendingUp size={48} color="gray" />
                          <Text c="dimmed">Dados insuficientes para calcular variações</Text>
                        </Stack>
                      </Center>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
        </Stack>
      </Card>

      {/* PHASE 4: Widget de Patrimônio Físico - Treemap */}
      <Card withBorder padding="md">
        <Stack gap="md">
          <Group>
            <IconBuildingWarehouse size={24} />
            <Title order={3}>Composição do Patrimônio Físico</Title>
          </Group>
          
          {loadingPhysicalAssets ? (
            <Center h={300}>
              <Loader />
            </Center>
          ) : physicalAssetsData && physicalAssetsData.summary ? (
            <>
              {/* KPIs em Destaque - Melhor Alinhamento */}
              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                  <Card withBorder padding="lg" h={140}>
                    <Stack gap="sm" h="100%" justify="space-between">
                      <Group justify="space-between" align="flex-start">
                        <Text size="sm" c="dimmed" tt="uppercase" fw={600} lh={1.2}>
                          Valor de Mercado Total
                        </Text>
                        <IconBuildingWarehouse size={20} color="#3b82f6" />
                      </Group>
                      <Text size="xl" fw={700} c="blue" ta="left">
                        {formatCurrency(physicalAssetsData.summary.total_market_value)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {physicalAssetsData.summary.total_count} {physicalAssetsData.summary.total_count === 1 ? 'bem cadastrado' : 'bens cadastrados'}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                  <Card withBorder padding="lg" h={140}>
                    <Stack gap="sm" h="100%" justify="space-between">
                      <Group justify="space-between" align="flex-start">
                        <Text size="sm" c="dimmed" tt="uppercase" fw={600} lh={1.2}>
                          Custo de Aquisição
                        </Text>
                        <IconCash size={20} color="#6b7280" />
                      </Group>
                      <Text size="xl" fw={700} c="gray" ta="left">
                        {formatCurrency(physicalAssetsData.summary.total_acquisition_cost)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Investimento inicial
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 12, md: 4 }}>
                  <Card withBorder padding="lg" h={140}>
                    <Stack gap="sm" h="100%" justify="space-between">
                      <Group justify="space-between" align="flex-start">
                        <Text size="sm" c="dimmed" tt="uppercase" fw={600} lh={1.2}>
                          Variação de Valor
                        </Text>
                        {physicalAssetsData.summary.total_value_variation >= 0 ? 
                          <IconArrowUpRight size={20} color="green" /> : 
                          <IconArrowDownRight size={20} color="red" />
                        }
                      </Group>
                      <Group align="baseline" gap="xs">
                        <Text size="xl" fw={700} c={physicalAssetsData.summary.total_value_variation >= 0 ? 'green' : 'red'} ta="left">
                          {formatCurrency(physicalAssetsData.summary.total_value_variation)}
                        </Text>
                        <Text size="sm" fw={600} c={physicalAssetsData.summary.total_value_variation >= 0 ? 'green' : 'red'}>
                          ({physicalAssetsData.summary.value_variation_percentage >= 0 ? '+' : ''}{physicalAssetsData.summary.value_variation_percentage.toFixed(1)}%)
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {physicalAssetsData.summary.total_value_variation >= 0 ? 'Valorização' : 'Desvalorização'}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>

              {/* Visualização Principal - Treemap */}
              {physicalAssetsData.assets && physicalAssetsData.assets.length > 0 ? (
                <>
                  <Text size="sm" c="dimmed">Cada retângulo representa um bem físico, com área proporcional ao seu valor atual.</Text>
                  <Paper withBorder padding="md">
                    <ResponsiveContainer width="100%" height={400}>
                      <Treemap
                        data={physicalAssetsData.assets.map(asset => ({
                          name: asset.description,
                          size: asset.current_value,
                          category: asset.asset_class_name,
                          acquisitionCost: asset.acquisition_cost,
                          valueVariation: asset.value_variation,
                          icon: asset.asset_icon_url
                        }))}
                        dataKey="size"
                        aspectRatio={4/3}
                        stroke="#fff"
                        fill="#8884d8"
                      >
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              const data = payload[0].payload;
                              return (
                                <Paper withBorder padding="sm" shadow="md">
                                  <Stack gap={4}>
                                    <Text fw={500} size="sm">{data.name}</Text>
                                    <Text size="xs" c="dimmed">{data.category}</Text>
                                    <Text size="sm" c="blue">Valor Atual: {formatCurrency(data.size)}</Text>
                                    <Text size="sm" c="gray">Custo: {formatCurrency(data.acquisitionCost)}</Text>
                                    <Text size="sm" c={data.valueVariation >= 0 ? 'green' : 'red'}>
                                      Variação: {formatCurrency(data.valueVariation)}
                                    </Text>
                                  </Stack>
                                </Paper>
                              );
                            }
                            return null;
                          }}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  </Paper>
                  
                  {/* Tabela Avançada com Filtros e Ordenação */}
                  <AdvancedTable
                    data={physicalAssetsData.assets}
                    columns={[
                      {
                        key: 'bem',
                        label: 'Bem',
                        sortable: true,
                        render: (asset) => (
                          <Group gap="xs">
                            {asset.asset_icon_url && (
                              <img src={asset.asset_icon_url} alt="" width={20} height={20} style={{ borderRadius: '4px' }} />
                            )}
                            <div>
                              <Text size="sm" fw={500}>{asset.description}</Text>
                              <Text size="xs" c="dimmed">{asset.asset_class_name}</Text>
                            </div>
                          </Group>
                        )
                      },
                      {
                        key: 'acquisition_date',
                        label: 'Data Aquisição',
                        sortable: true,
                        render: (asset) => (
                          <Text size="sm" c="dimmed">
                            {asset.acquisition_date ? new Date(asset.acquisition_date).toLocaleDateString('pt-BR') : '-'}
                          </Text>
                        )
                      },
                      {
                        key: 'current_value',
                        label: 'Valor Atual',
                        sortable: true,
                        render: (asset) => (
                          <Text size="sm" fw={600} c="blue">
                            {formatCurrency(asset.current_value)}
                          </Text>
                        )
                      },
                      {
                        key: 'acquisition_cost',
                        label: 'Custo',
                        sortable: true,
                        render: (asset) => (
                          <Text size="sm" c="dimmed">
                            {formatCurrency(asset.acquisition_cost)}
                          </Text>
                        )
                      },
                      {
                        key: 'value_variation',
                        label: 'Variação',
                        sortable: true,
                        render: (asset) => {
                          const variation = asset.value_variation || 0;
                          const variationPercent = asset.acquisition_cost > 0 ? (variation / asset.acquisition_cost * 100) : 0;
                          return (
                            <div>
                              <Group gap="xs" align="center">
                                <Text size="sm" fw={500} c={variation >= 0 ? 'green' : 'red'}>
                                  {formatCurrency(variation)}
                                </Text>
                                {variation >= 0 ? 
                                  <IconArrowUpRight size={14} color="green" /> : 
                                  <IconArrowDownRight size={14} color="red" />
                                }
                              </Group>
                              <Text size="xs" c={variation >= 0 ? 'green' : 'red'}>
                                {variationPercent >= 0 ? '+' : ''}{variationPercent.toFixed(1)}%
                              </Text>
                            </div>
                          );
                        }
                      }
                    ]}
                    searchable={true}
                    searchPlaceholder="Buscar por bem, categoria..."
                    sortBy="current_value"
                    sortOrder="desc"
                  />
                </>
              ) : (
                <Center h={200}>
                  <Stack align="center">
                    <IconBuildingWarehouse size={48} color="gray" />
                    <Text c="dimmed">Nenhum bem físico cadastrado</Text>
                    <Text size="sm" c="dimmed">Cadastre seus bens físicos para visualizar a composição do patrimônio</Text>
                  </Stack>
                </Center>
              )}
            </>
          ) : (
            <Center h={200}>
              <Stack align="center">
                <IconBuildingWarehouse size={48} color="gray" />
                <Text c="dimmed">Nenhum bem físico cadastrado</Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </Card>

      {/* PHASE 4: Widget de Análise de Fluxo de Caixa */}
      <Card withBorder padding="md">
        <Stack gap="md">
          <Group>
            <IconCash size={24} />
            <div>
              <Title order={3}>Análise de Fluxo de Caixa</Title>
              <Text size="sm" c="dimmed">Esta análise reflete seu fluxo de caixa operacional e exclui transações de capital (compra/venda de patrimônio).</Text>
            </div>
          </Group>
          <Stack gap="lg">
            {/* KPIs Principais - FONTE DA VERDADE DO BACKEND */}
            <Grid>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card withBorder padding="lg" h="100%">
                  <Stack gap="xs" h="100%" justify="center">
                    <Group>
                      <IconTrendingUp size={24} color="#10b981" />
                      <Text size="sm" c="dimmed" tt="uppercase" fw={500}>
                        Total de Receitas
                      </Text>
                      {loadingKPIs && <Loader size="xs" />}
                    </Group>
                    <Text fw={700} size="xl" c="green">
                      {formatCurrency(cashFlowKPIs.totalRevenue)}
                    </Text>
                  </Stack>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card withBorder padding="lg" h="100%">
                  <Stack gap="xs" h="100%" justify="center">
                    <Group>
                      <IconTrendingDown size={24} color="#dc2626" />
                      <Text size="sm" c="dimmed" tt="uppercase" fw={500}>
                        Total de Despesas
                      </Text>
                      {loadingKPIs && <Loader size="xs" />}
                    </Group>
                    <Text fw={700} size="xl" c="red">
                      {formatCurrency(cashFlowKPIs.totalExpenses)}
                    </Text>
                  </Stack>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card withBorder padding="lg" h="100%">
                  <Stack gap="xs" h="100%" justify="center">
                    <Group>
                      <IconScale size={24} color="#3b82f6" />
                      <Text size="sm" c="dimmed" tt="uppercase" fw={500}>
                        Saldo do Período (Receitas - Despesas)
                      </Text>
                      {loadingKPIs && <Loader size="xs" />}
                    </Group>
                    <Text 
                      fw={700} 
                      size="xl" 
                      c={cashFlowKPIs.balance >= 0 ? 'green' : 'red'}
                    >
                      {formatCurrency(cashFlowKPIs.balance)}
                    </Text>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Widget Principal - Receitas vs. Despesas */}
            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text fw={600} size="xl">Receitas vs. Despesas Mensal</Text>
                      {loadingCashFlow && <Loader size="sm" />}
                    </Group>
                    
                    {cashFlowData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={cashFlowData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month" 
                            tickFormatter={(value) => value}
                          />
                          <YAxis 
                            tickFormatter={(value) => 
                              new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              }).format(value)
                            }
                          />
                          <Tooltip 
                            formatter={(value, name) => [
                              formatCurrency(value),
                              name === 'income' ? 'Receitas' : 'Despesas'
                            ]}
                            labelFormatter={(month) => `Mês: ${month}`}
                          />
                          <Legend 
                            formatter={(value) => value === 'income' ? 'Receitas' : 'Despesas'}
                          />
                          <Bar dataKey="income" fill="#10b981" name="income" />
                          <Bar dataKey="expense" fill="#dc2626" name="expense" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Center h={400}>
                        <Stack align="center">
                          <IconCash size={48} color="gray" />
                          <Text c="dimmed">Nenhum dado de fluxo de caixa disponível</Text>
                        </Stack>
                      </Center>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>

              {/* Detalhamento por Categoria - Treemap Refinado */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card withBorder padding="lg" h="100%">
                  <Stack gap="md">
                    <Text fw={600} size="lg">Detalhamento por Categoria</Text>
                    
                    {expenseAnalysis && Object.keys(expenseAnalysis.expense_categories).length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <Treemap
                          data={Object.entries(expenseAnalysis.expense_categories).map(([category, amount], index) => ({
                            name: category,
                            size: amount,
                            fill: [
                              '#dc2626', '#f59e0b', '#8b5cf6', '#3b82f6', 
                              '#10b981', '#ef4444', '#f97316', '#a855f7'
                            ][index % 8]
                          }))}
                          dataKey="size"
                          aspectRatio={1}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          <Tooltip 
                            formatter={(value, name, props) => [
                              formatCurrency(value), 
                              `${((value / expenseAnalysis.total_expenses_last_30_days) * 100).toFixed(1)}%`
                            ]}
                            labelFormatter={(name) => `Categoria: ${name}`}
                          />
                        </Treemap>
                      </ResponsiveContainer>
                    ) : (
                      <Center h={400}>
                        <Stack align="center">
                          <IconChartLine size={48} color="gray" />
                          <Text c="dimmed">Sem dados de categorias</Text>
                        </Stack>
                      </Center>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Maiores Despesas com Progress Bar */}
            <Card withBorder padding="lg">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600} size="lg">Maiores Despesas no Período</Text>
                  {loadingTopExpenses && <Loader size="sm" />}
                </Group>
                
                {topExpenses.length > 0 ? (
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Data</Table.Th>
                        <Table.Th>Descrição</Table.Th>
                        <Table.Th>Categoria</Table.Th>
                        <Table.Th>Valor</Table.Th>
                        <Table.Th>% do Total</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {topExpenses.map((expense, index) => {
                        const maxAmount = topExpenses[0]?.amount || 1;
                        const percentage = (expense.amount / maxAmount) * 100;
                        
                        return (
                          <Table.Tr key={expense.transaction_id}>
                            <Table.Td>
                              <Text size="sm">
                                {new Date(expense.date).toLocaleDateString('pt-BR')}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" lineClamp={1}>
                                {expense.description}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {expense.category}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text fw={600} c="red" size="sm">
                                {formatCurrency(expense.amount)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs" style={{ minWidth: '120px' }}>
                                <Progress 
                                  value={percentage} 
                                  size="sm" 
                                  style={{ flex: 1 }} 
                                  color="red"
                                />
                                <Text size="xs" c="dimmed" style={{ minWidth: '35px' }}>
                                  {percentage.toFixed(0)}%
                                </Text>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Center py="xl">
                    <Stack align="center">
                      <IconTrendingDown size={48} color="gray" />
                      <Text c="dimmed">Nenhuma despesa encontrada no período</Text>
                    </Stack>
                  </Center>
                )}
              </Stack>
            </Card>
          </Stack>
        </Stack>
      </Card>

      {/* PHASE 4: Widget de Performance de Investimentos */}
      <Card withBorder padding="md">
        <Stack gap="md">
          <Group>
            <IconTrendingUp size={24} />
            <Title order={3}>Performance de Investimentos</Title>
          </Group>
          
          {/* Placeholders para análises de performance */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper withBorder padding="md" h={200}>
                <Center h="100%">
                  <Stack align="center">
                    <Text fw={500}>Crescimento do Portfólio</Text>
                    <Text size="sm" c="dimmed">Em desenvolvimento</Text>
                  </Stack>
                </Center>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper withBorder padding="md" h={200}>
                <Center h="100%">
                  <Stack align="center">
                    <Text fw={500}>Rentabilidade por Classe</Text>
                    <Text size="sm" c="dimmed">Em desenvolvimento</Text>
                  </Stack>
                </Center>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper withBorder padding="md" h={200}>
                <Center h="100%">
                  <Stack align="center">
                    <Text fw={500}>Performance Individual</Text>
                    <Text size="sm" c="dimmed">Em desenvolvimento</Text>
                  </Stack>
                </Center>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* Modal de Drill-Down */}
      <Modal
        opened={drillDownModal}
        onClose={() => setDrillDownModal(false)}
        title={
          selectedDate ? 
            `Detalhes do Patrimônio em ${new Date(selectedDate).toLocaleDateString('pt-BR')}` : 
            'Detalhes do Patrimônio'
        }
        size="xl"
      >
        {loadingDetails ? (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        ) : snapshotDetails ? (
          <Stack gap="md">
            {/* Resumo */}
            <Grid>
              <Grid.Col span={6}>
                <Paper withBorder padding="sm">
                  <Text size="sm" c="dimmed">Total de Contas</Text>
                  <Text fw={600} size="lg">{snapshotDetails.summary.total_accounts}</Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span={6}>
                <Paper withBorder padding="sm">
                  <Text size="sm" c="dimmed">Total de Posições</Text>
                  <Text fw={600} size="lg">{snapshotDetails.summary.total_holdings}</Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span={6}>
                <Paper withBorder padding="sm">
                  <Text size="sm" c="dimmed">Saldo Total das Contas</Text>
                  <Text fw={600} size="lg" c={snapshotDetails.summary.total_account_balance >= 0 ? 'green' : 'red'}>
                    {formatCurrency(snapshotDetails.summary.total_account_balance)}
                  </Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span={6}>
                <Paper withBorder padding="sm">
                  <Text size="sm" c="dimmed">Valor Total dos Investimentos</Text>
                  <Text fw={600} size="lg" c="green">
                    {formatCurrency(snapshotDetails.summary.total_holding_value)}
                  </Text>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* Tabela de Contas */}
            <div>
              <Text fw={600} mb="md">Composição das Contas na Data</Text>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Conta</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Instituição</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Saldo</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {snapshotDetails.account_details.map((account) => (
                    <Table.Tr key={account.account_id}>
                      <Table.Td>{account.account_name}</Table.Td>
                      <Table.Td>{account.account_type}</Table.Td>
                      <Table.Td>{account.institution}</Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: account.balance >= 0 ? 'green' : 'red' }}>
                        {formatCurrency(account.balance)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>

            {/* Tabela de Investimentos */}
            <div>
              <Text fw={600} mb="md">Composição dos Investimentos na Data</Text>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ativo</Table.Th>
                    <Table.Th>Classe</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Quantidade</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Preço (BRL)</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Valor de Mercado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {snapshotDetails.holding_details.map((holding) => (
                    <Table.Tr key={holding.asset_id}>
                      <Table.Td>
                        <div>
                          <Text fw={500}>{holding.symbol}</Text>
                          <Text size="xs" c="dimmed">{holding.name}</Text>
                        </div>
                      </Table.Td>
                      <Table.Td>{holding.asset_class}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(holding.quantity)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {formatCurrency(holding.price_brl)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {formatCurrency(holding.market_value_brl)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>

            {/* Verificação de integridade */}
            <Alert color="blue" title="Verificação de Integridade">
              <Text size="sm">
                Patrimônio calculado pelo modal: {formatCurrency(
                  snapshotDetails.summary.total_account_balance + snapshotDetails.summary.total_holding_value
                )}
              </Text>
              <Text size="sm">
                Este valor deve coincidir com o patrimônio líquido mostrado no gráfico para a mesma data.
              </Text>
            </Alert>
          </Stack>
        ) : (
          <Center py="xl">
            <Text c="red">Erro ao carregar detalhes do snapshot</Text>
          </Center>
        )}
      </Modal>
    </Stack>
  );
}