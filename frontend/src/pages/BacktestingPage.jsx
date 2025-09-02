import React, { useState, useEffect } from 'react';
import {
  Title, Text, Stack, Card, Grid, Group, Button, Select, 
  NumberInput, Badge, Loader, Alert, ThemeIcon,
  Modal, Table, Progress, Container, Tabs, ActionIcon,
  Tooltip, Box, RingProgress, Paper, SimpleGrid, TextInput, Textarea
} from '@mantine/core';
import { AdvancedTable } from '../components/AdvancedTable';
import { DatePickerInput, DateInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconRocket, IconBrain, IconChartLine, IconSettings, IconCheck, IconX, IconRefresh, IconGauge, IconArrowsUpDown, IconPercentage } from '@tabler/icons-react';
import { handleApiError, withErrorHandling, withErrorHandlingSilent, apiCircuitBreaker, checkAuthResponse } from '../utils/errorHandler.js';
import api from '../api';
import { assetsCache } from '../utils/assetsCache.js';
import TradingViewChart from '../components/TradingViewChart.jsx';
import { getStudiesForStrategy } from '../utils/strategyChartMapper.js';
import { assetToTradingViewSymbol } from '../utils/assetSymbolMapper.js';
import { useJobPolling } from '../hooks/useJobPolling.js';

const PREDEFINED_STRATEGIES = [
  { value: 'RSI_MACD', label: 'RSI + MACD Strategy' },
  { value: 'BOLLINGER_RSI', label: 'Bollinger Bands + RSI' },
  { value: 'MOVING_AVERAGE_CROSSOVER', label: 'Moving Average Crossover' },
  { value: 'MOMENTUM_BREAKOUT', label: 'Momentum Breakout' },
  { value: 'MEAN_REVERSION', label: 'Mean Reversion' }
];

const PARAMETER_TEMPLATES = {
  'RSI_MACD': {
    rsi_period:      { type: 'int',   min: 6,  max: 20,  default: 14, label: 'RSI Period' },
    rsi_oversold:    { type: 'int',   min: 10, max: 35,  default: 30, label: 'RSI Oversold Level' },
    rsi_overbought:  { type: 'int',   min: 60, max: 90,  default: 70, label: 'RSI Overbought Level' },
    macd_fast:       { type: 'int',   min: 8,  max: 16,  default: 12, label: 'MACD Fast Period' },
    macd_slow:       { type: 'int',   min: 20, max: 34,  default: 26, label: 'MACD Slow Period' },
    macd_signal:     { type: 'int',   min: 7,  max: 12,  default: 9,  label: 'MACD Signal Period' },
    stop_loss:       { type: 'float', min: 0.005, max: 0.08, default: 0.03, label: 'Stop Loss (%)' },
    take_profit:     { type: 'float', min: 0.01,  max: 0.25, default: 0.06, label: 'Take Profit (%)' }
  },
  'BOLLINGER_RSI': {
    bb_period:       { type: 'int',   min: 12, max: 30, default: 20, label: 'Bollinger Bands Period' },
    bb_std:          { type: 'float', min: 1.5, max: 2.8, default: 2.0, label: 'Bollinger Bands Std Dev' },
    rsi_period:      { type: 'int',   min: 6,  max: 18, default: 14, label: 'RSI Period' },
    rsi_threshold:   { type: 'int',   min: 20, max: 40, default: 30, label: 'RSI Threshold' },
    stop_loss:       { type: 'float', min: 0.005, max: 0.06, default: 0.025, label: 'Stop Loss (%)' },
    take_profit:     { type: 'float', min: 0.015, max: 0.20, default: 0.05, label: 'Take Profit (%)' }
  },
  'MOVING_AVERAGE_CROSSOVER': {
    ma_short: { type: 'int', min: 5,  max: 30,  default: 10, label: 'Short MA Period' },
    ma_long:  { type: 'int', min: 50, max: 200, default: 100, label: 'Long MA Period' },
    ma_type:  { type: 'choice', values: ['SMA', 'EMA'], default: 'EMA', label: 'MA Type' },
    stop_loss: { type: 'float', min: 0.01, max: 0.05, default: 0.02, label: 'Stop Loss (%)' },
    take_profit: { type: 'float', min: 0.03, max: 0.15, default: 0.06, label: 'Take Profit (%)' }
  },
  'MOMENTUM_BREAKOUT': {
    lookback_period:    { type: 'int',   min: 10, max: 60, default: 20, label: 'Lookback Period' },
    breakout_threshold: { type: 'float', min: 0.008, max: 0.06, default: 0.02, label: 'Breakout Threshold (%)' },
    volume_multiplier:  { type: 'float', min: 1.2, max: 4.0, default: 1.6, label: 'Volume Multiplier' },
    stop_loss:          { type: 'float', min: 0.005, max: 0.08, default: 0.025, label: 'Stop Loss (%)' },
    take_profit:        { type: 'float', min: 0.02,  max: 0.30, default: 0.06, label: 'Take Profit (%)' }
  },
  'MEAN_REVERSION': {
    lookback_period: { type: 'int',   min: 10, max: 40, default: 20, label: 'Lookback Period' },
    z_score_entry:   { type: 'float', min: 1.5, max: 3.0,  default: 2.0, label: 'Z-Score Entry Level' },
    z_score_exit:    { type: 'float', min: 0.2, max: 1.0,  default: 0.5, label: 'Z-Score Exit Level' },
    stop_loss:       { type: 'float', min: 0.005, max: 0.06, default: 0.03, label: 'Stop Loss (%)' },
    take_profit:     { type: 'float', min: 0.01,  max: 0.15, default: 0.06, label: 'Take Profit (%)' }
  }
};

export function BacktestingPage() {
  const [assets, setAssets] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [timeframe, setTimeframe] = useState('1d');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)); // 1 ano atrás
  const [endDate, setEndDate] = useState(new Date());
  const [parameterRanges, setParameterRanges] = useState({});
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobResults, setJobResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  // Polling inteligente para jobs em execução
  const handleJobUpdate = async (jobId, updatedData) => {
    try {
      // Atualizar o job na lista local
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId 
            ? { ...job, ...updatedData }
            : job
        )
      );
      
      // Se o job foi completado, mostrar notificação
      if (updatedData.status === 'COMPLETED') {
        notifications.show({
          title: 'Otimização Concluída',
          message: `Job #${jobId} foi concluído com sucesso!`,
          color: 'green'
        });
      } else if (updatedData.status === 'FAILED') {
        notifications.show({
          title: 'Otimização Falhou',
          message: `Job #${jobId} falhou durante a execução.`,
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error updating job:', error);
    }
  };
  
  const { isPolling, checkNow } = useJobPolling(jobs, handleJobUpdate, 5000);
  const [currentTradingViewSymbol, setCurrentTradingViewSymbol] = useState('BTCUSDT');
  const [chartStudies, setChartStudies] = useState([]);
  const [showChart, setShowChart] = useState(false);

  const [opened, { open, close }] = useDisclosure(false);
  const [resultsModalOpened, { open: openResultsModal, close: closeResultsModal }] = useDisclosure(false);
  const [saveStrategyModalOpened, { open: openSaveStrategyModal, close: closeSaveStrategyModal }] = useDisclosure(false);
  const [strategyToSave, setStrategyToSave] = useState(null);

  // Auto-load assets and jobs on page mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (!assetsLoaded) {
        await fetchAssets();
        setAssetsLoaded(true);
      }
      if (!jobsLoaded) {
        await fetchJobs();
        setJobsLoaded(true);
      }
    };
    
    loadInitialData();
  }, []); // Empty dependency array - only runs on mount

  // Update parameter ranges when strategy changes
  useEffect(() => {
    if (selectedStrategy && PARAMETER_TEMPLATES[selectedStrategy]) {
      const template = PARAMETER_TEMPLATES[selectedStrategy];
      const initialRanges = {};
      
      Object.entries(template).forEach(([key, config]) => {
        initialRanges[key] = {
          type: config.type,
          min: config.min,
          max: config.max,
          values: config.values,
          current_min: config.min || (config.values ? config.values[0] : config.default),
          current_max: config.max || (config.values ? config.values[config.values.length - 1] : config.default)
        };
      });
      
      setParameterRanges(initialRanges);
    }
  }, [selectedStrategy]);

  // Update TradingView symbol when selected asset changes
  useEffect(() => {
    if (selectedAsset && assets.length > 0) {
      const asset = assets.find(a => a.id.toString() === selectedAsset);
      if (asset) {
        const tvSymbol = assetToTradingViewSymbol(asset);
        setCurrentTradingViewSymbol(tvSymbol);
      }
    }
  }, [selectedAsset, assets]);

  // Usar o custom hook para polling inteligente
  // O hook automaticamente monitora jobs RUNNING e para quando não há jobs em execução

  const fetchAssets = async (silent = false) => {
    // Check cache first
    const cachedAssets = assetsCache.get();
    if (cachedAssets) {
      setAssets(cachedAssets);
      return { assets: cachedAssets };
    }
    
    // Prevent duplicate loading
    if (assetsCache.getLoading()) {
      return null;
    }
    
    assetsCache.setLoading(true);
    if (!silent) setAssetsLoading(true);
    const errorHandler = silent ? withErrorHandlingSilent : withErrorHandling;
    
    try {
      return await errorHandler(async () => {
        return await apiCircuitBreaker.execute(async () => {
          const response = await api.get('/assets');
          const data = response.data;
          
          const assets = data.assets || [];
          setAssets(assets);
          assetsCache.set(assets); // Cache the results
          return data;
        });
      }, 'Erro ao carregar ativos', null, !silent);
    } finally {
      assetsCache.setLoading(false);
      if (!silent) setAssetsLoading(false);
    }
  };

  const fetchJobs = async (silent = false) => {
    if (!silent) setJobsLoading(true);
    
    const errorHandler = silent ? withErrorHandlingSilent : withErrorHandling;
    
    try {
      return await errorHandler(async () => {
        return await apiCircuitBreaker.execute(async () => {
          const response = await api.get('/strategy-optimization/jobs');
          const data = response.data;
          
          setJobs(data.jobs || []);
          return data;
        });
      }, 'Erro ao carregar jobs de otimização', null, !silent);
    } finally {
      if (!silent) setJobsLoading(false);
    }
  };

  const fetchJobResults = async (jobId) => {
    console.log('fetchJobResults called with jobId:', jobId, typeof jobId);
    if (!jobId || jobId === undefined || jobId === null) {
      console.error('fetchJobResults called with invalid jobId:', jobId);
      console.trace('Stack trace for invalid jobId call:');
      return; // Remove notification to prevent spam
    }
    
    setResultsLoading(true);
    try {
      console.log('Fetching results for job:', jobId);
      const response = await api.get(`/strategy-optimization/jobs/${jobId}/results?limit=50`);
      const data = response.data;
      
      console.log('Job results fetched successfully:', data.results?.length, 'results');
      setJobResults(data.results || []);
      openResultsModal();
    } catch (error) {
      console.error('Error fetching job results:', error);
      // Don't show notification to prevent spam during loops
    } finally {
      setResultsLoading(false);
    }
  };

  const createOptimizationJob = async () => {
    // Single validation check to prevent spam
    if (!selectedStrategy || !selectedAsset || !startDate || !endDate) {
      notifications.show({
        title: 'Dados incompletos',
        message: 'Por favor, preencha todos os campos obrigatórios',
        color: 'orange'
      });
      return;
    }

    setLoading(true);
    try {
      const jobData = {
        base_strategy_name: selectedStrategy,
        asset_id: parseInt(selectedAsset),
        timeframe,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        parameter_ranges: parameterRanges
      };

      const response = await api.post('/strategy-optimization/jobs', jobData);
      const data = response.data;
      
      notifications.show({
        title: 'Job de otimização criado',
        message: 'O algoritmo genético foi iniciado. Os resultados aparecerão em alguns minutos.',
        color: 'green',
        icon: <IconRocket />
      });

      // Reset form and refresh jobs
      setSelectedStrategy('');
      setSelectedAsset('');
      setParameterRanges({});
      await fetchJobs(false); // Explicit refresh after job creation
      
    } catch (error) {
      handleApiError(error, 'Erro ao criar job de otimização');
    } finally {
      setLoading(false);
    }
  };

  const updateParameterRange = (paramName, field, value) => {
    setParameterRanges(prev => ({
      ...prev,
      [paramName]: {
        ...prev[paramName],
        [field]: value
      }
    }));
  };

  const openSaveAsStrategyModal = (job) => {
    if (!job || !jobResults || jobResults.length === 0) {
      notifications.show({
        title: 'Erro',
        message: 'Nenhum resultado disponível para salvar',
        color: 'red'
      });
      return;
    }

    // Preparar dados da melhor estratégia
    const bestResult = jobResults[0];
    const strategyData = {
      jobId: job.id,
      baseStrategyName: job.base_strategy_name,
      assetSymbol: job.asset_symbol,
      timeframe: job.timeframe,
      startDate: job.start_date,
      endDate: job.end_date,
      parameters: bestResult.parameters,
      performance: {
        totalTrades: bestResult.total_trades,
        winRatePercent: bestResult.win_rate_percent,
        netProfitPercent: bestResult.net_profit_percent,
        maxDrawdownPercent: bestResult.max_drawdown_percent,
        sharpeRatio: bestResult.sharpe_ratio,
        fitnessScore: bestResult.fitness_score
      }
    };

    setStrategyToSave(strategyData);
    openSaveStrategyModal();
  };

  const saveAsStrategy = async (formData) => {
    try {
      const strategyPayload = {
        name: formData.name,
        description: formData.description,
        type: 'BACKTESTING_OPTIMIZED',
        parameters: {
          base_strategy: strategyToSave.baseStrategyName,
          asset_symbol: strategyToSave.assetSymbol,
          timeframe: strategyToSave.timeframe,
          optimized_parameters: strategyToSave.parameters,
          backtest_period: {
            start_date: strategyToSave.startDate,
            end_date: strategyToSave.endDate
          },
          performance_metrics: strategyToSave.performance
        }
      };

      const response = await api.post('/strategies', strategyPayload);

      closeSaveStrategyModal();
      setStrategyToSave(null);
      
      notifications.show({
        title: 'Estratégia Salva',
        message: `A estratégia "${formData.name}" foi salva com sucesso!`,
        color: 'green'
      });

    } catch (error) {
      notifications.show({
        title: 'Erro ao Salvar',
        message: 'Não foi possível salvar a estratégia. Tente novamente.',
        color: 'red'
      });
      console.error('Error saving strategy:', error);
    }
  };

  const sendToChart = async () => {
    if (!selectedStrategy || !selectedAsset) {
      notifications.show({
        title: 'Configuração incompleta',
        message: 'Selecione uma estratégia e um ativo antes de enviar para o gráfico',
        color: 'orange'
      });
      return;
    }

    // Get current parameter values for the selected strategy
    const currentParams = {};
    if (parameterRanges && PARAMETER_TEMPLATES[selectedStrategy]) {
      Object.entries(PARAMETER_TEMPLATES[selectedStrategy]).forEach(([key, config]) => {
        if (config.type === 'choice') {
          currentParams[key] = parameterRanges[key]?.current_min || config.default;
        } else {
          // Use mid-point of range for display
          const min = parameterRanges[key]?.current_min || config.min;
          const max = parameterRanges[key]?.current_max || config.max;
          currentParams[key] = (min + max) / 2;
        }
      });
    }

    try {

      // Buscar configuração do backend
      const response = await api.post('/charts/config', {
        strategy_name: selectedStrategy,
        strategy_params: currentParams,
        asset_symbol: selectedAsset,
        timeframe: timeframe,
        theme: 'light'
      });

      const chartConfig = response.data;
      
      // Usar os studies do backend
      setChartStudies(chartConfig.studies || []);
      setShowChart(true);

      notifications.show({
        title: 'Configuração enviada',
        message: `Estratégia ${selectedStrategy} aplicada ao gráfico de ${selectedAsset}`,
        color: 'green',
        icon: <IconChartLine />
      });

    } catch (error) {
      notifications.show({
        title: 'Erro ao aplicar configuração',
        message: 'Não foi possível aplicar a estratégia ao gráfico. Usando configuração local.',
        color: 'orange'
      });
      
      // Fallback para configuração local
      const studies = getStudiesForStrategy(selectedStrategy, currentParams);
      setChartStudies(studies);
      setShowChart(true);
      
      console.error('Error sending chart config:', error);
    }
  };

  const handleChartSymbolChange = (newSymbol) => {
    setCurrentTradingViewSymbol(newSymbol);
    
    // Try to find corresponding asset in our list
    const matchingAsset = assets.find(asset => {
      const tvSymbol = assetToTradingViewSymbol(asset);
      return tvSymbol === newSymbol;
    });
    
    if (matchingAsset) {
      setSelectedAsset(matchingAsset.id.toString());
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'green';
      case 'RUNNING': return 'blue';
      case 'FAILED': return 'red';
      case 'PENDING': return 'orange';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED': return <IconCheck size={16} />;
      case 'RUNNING': return <Loader size={16} />;
      case 'FAILED': return <IconX size={16} />;
      default: return <IconSettings size={16} />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatNumber = (value, decimals = 2) => {
    return Number(value).toFixed(decimals);
  };

  const getIconForParameter = (paramName) => {
    if (paramName.includes('period')) return <IconGauge size={20} />;
    if (paramName.includes('level') || paramName.includes('over') || paramName.includes('sold') || paramName.includes('bought')) return <IconArrowsUpDown size={20} />;
    if (paramName.includes('loss') || paramName.includes('profit')) return <IconPercentage size={20} />;
    return <IconSettings size={20} />;
  };

  const renderParameterControls = () => {
    if (!selectedStrategy || !PARAMETER_TEMPLATES[selectedStrategy]) {
      return null;
    }

    const template = PARAMETER_TEMPLATES[selectedStrategy];

    return (
      <Card withBorder p="lg" mt="xl" radius="md">
        <Group mb="lg">
          <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <IconSettings size={28} />
          </ThemeIcon>
          <div>
            <Title order={4}>Configurar Ranges dos Parâmetros</Title>
            <Text size="sm" c="dimmed">Ajuste os intervalos que o algoritmo de IA irá testar.</Text>
          </div>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {Object.entries(template).map(([paramName, config]) => (
            <Paper withBorder shadow="xs" p="md" radius="md" key={paramName}>
              <Stack gap="xs">
                <Group gap="sm">
                  <ThemeIcon variant="light" size="lg" radius="md">
                    {getIconForParameter(paramName)}
                  </ThemeIcon>
                  <Text fw={500} size="sm">{config.label}</Text>
                </Group>
                
                {config.type === 'choice' ? (
                  <Select
                    data={config.values.map(v => ({ value: v, label: v }))}
                    value={parameterRanges[paramName]?.current_min || config.default}
                    onChange={(value) => updateParameterRange(paramName, 'current_min', value)}
                    size="sm"
                  />
                ) : (
                  <Group grow align="flex-end">
                    <NumberInput
                      label="Mínimo"
                      value={parameterRanges[paramName]?.current_min || config.min}
                      onChange={(value) => updateParameterRange(paramName, 'current_min', Number(value))}
                      min={config.min}
                      max={parameterRanges[paramName]?.current_max || config.max}
                      step={config.type === 'float' ? 0.01 : 1}
                      allowDecimal={config.type === 'float'}
                      decimalScale={config.type === 'float' ? 4 : 0}
                      clampBehavior="strict"
                      size="sm"
                    />
                    <NumberInput
                      label="Máximo"
                      value={parameterRanges[paramName]?.current_max || config.max}
                      onChange={(value) => updateParameterRange(paramName, 'current_max', Number(value))}
                      min={parameterRanges[paramName]?.current_min || config.min}
                      max={config.max}
                      step={config.type === 'float' ? 0.01 : 1}
                      allowDecimal={config.type === 'float'}
                      decimalScale={config.type === 'float' ? 4 : 0}
                      clampBehavior="strict"
                      size="sm"
                    />
                  </Group>
                )}
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Card>
    );
  };

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>
              <Group>
                <IconBrain size={32} />
                Laboratório de IA
              </Group>
            </Title>
            <Text c="dimmed" size="sm">
              Otimização automática de estratégias usando algoritmos genéticos
            </Text>
          </div>
          <Group>
            <Button 
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => {
                assetsCache.clear(); // Clear cache to force refresh
                Promise.all([
                  fetchAssets(false),
                  fetchJobs(false)
                ]).then(() => {
                  checkNow(); // Força verificação imediata do polling
                }).catch(error => {
                  console.error('Error updating data:', error);
                });
              }}
              loading={assetsLoading || jobsLoading}
            >
              Atualizar Dados{isPolling && ' (Auto)'}
            </Button>
          </Group>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="create" leftSection={<IconRocket size={16} />}>
              Criar Otimização
            </Tabs.Tab>
            <Tabs.Tab value="results" leftSection={<IconChartLine size={16} />}>
              Histórico e Resultados
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="create" pt="md">
            <Card withBorder p="lg">
              <Title order={3} mb="md">Nova Otimização de Estratégia</Title>
              
              <Grid>
                <Grid.Col span={6}>
                  <Select
                    label="Estratégia Base"
                    placeholder="Selecione uma estratégia para otimizar"
                    data={PREDEFINED_STRATEGIES}
                    value={selectedStrategy}
                    onChange={setSelectedStrategy}
                    required
                  />
                </Grid.Col>
                
                <Grid.Col span={6}>
                  <Select
                    label="Ativo"
                    placeholder={assetsLoading ? "Carregando ativos..." : assets.length > 0 ? "Selecione o ativo para teste" : "Nenhum ativo disponível"}
                    data={assets.map(asset => ({
                      value: asset.id.toString(),
                      label: `${asset.symbol} - ${asset.name}`
                    }))}
                    value={selectedAsset}
                    onChange={setSelectedAsset}
                    required
                    disabled={assetsLoading || assets.length === 0}
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <Select
                    label="Timeframe"
                    data={[
                      { value: '1h', label: '1 Hora' },
                      { value: '4h', label: '4 Horas' },
                      { value: '1d', label: '1 Dia' },
                      { value: '1w', label: '1 Semana' }
                    ]}
                    value={timeframe}
                    onChange={setTimeframe}
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <DateInput
                    label="Data de Início"
                    value={startDate}
                    onChange={setStartDate}
                    required
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <DateInput
                    label="Data de Fim"
                    value={endDate}
                    onChange={setEndDate}
                    required
                  />
                </Grid.Col>
              </Grid>

              {renderParameterControls()}

              <Group justify="space-between" mt="xl">
                <Button 
                  size="lg"
                  variant="outline"
                  leftSection={<IconChartLine size={20} />}
                  onClick={sendToChart}
                  disabled={!selectedStrategy || !selectedAsset}
                >
                  Enviar para Gráfico
                </Button>
                <Button 
                  size="lg"
                  leftSection={<IconBrain size={20} />}
                  onClick={createOptimizationJob}
                  loading={loading}
                  disabled={!selectedStrategy || !selectedAsset}
                >
                  Iniciar Otimização com IA
                </Button>
              </Group>
            </Card>
            
            {/* TradingView Chart Section */}
            {showChart && (
              <Card withBorder p="lg" mt="md">
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={3}>Gráfico de Análise Técnica</Title>
                    <Text size="sm" c="dimmed">
                      Estratégia: {selectedStrategy} • Ativo: {currentTradingViewSymbol}
                    </Text>
                  </div>
                  <Button
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => setShowChart(false)}
                  >
                    Fechar Gráfico
                  </Button>
                </Group>
                
                <TradingViewChart
                  symbol={currentTradingViewSymbol}
                  interval="1D"
                  height={900}
                  width="100%"
                  studies={chartStudies.map(study => study.id)}
                  theme="light"
                  onSymbolChange={handleChartSymbolChange}
                  onError={(error) => {
                    console.error('TradingView chart error:', error);
                    notifications.show({
                      title: 'Erro no gráfico',
                      message: error,
                      color: 'red'
                    });
                  }}
                />
                
                <Group justify="center" mt="md">
                  <Text size="sm" c="dimmed">
                    Indicadores aplicados: {chartStudies.length > 0 ? 
                      chartStudies.map((study, idx) => `Indicador ${idx + 1}`).join(', ') : 
                      'Nenhum indicador aplicado'
                    }
                  </Text>
                </Group>
              </Card>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="results" pt="md">
            <Card withBorder p="lg">
              <Group justify="space-between" mb="md">
                <Title order={3}>Jobs de Otimização</Title>
                <Badge variant="light" size="lg">
                  {jobs.length} jobs criados
                </Badge>
              </Group>

              {jobsLoading ? (
                <Group justify="center" p="xl">
                  <Loader size="lg" />
                  <Text>Carregando jobs...</Text>
                </Group>
              ) : jobs.length === 0 ? (
                <Alert icon={<IconBrain size={16} />} title="Nenhuma otimização criada">
                  Crie sua primeira otimização na aba "Criar Otimização" para começar a usar o poder da IA.
                </Alert>
              ) : (
                <SimpleGrid cols={2} spacing="md">
                  {jobs.map((job) => (
                    <Card key={job.id} withBorder p="md" radius="md">
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Badge 
                            variant="light" 
                            color={getStatusColor(job.status)}
                            leftSection={getStatusIcon(job.status)}
                          >
                            {job.status}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            #{job.id}
                          </Text>
                        </Group>

                        <div>
                          <Text fw={500} size="sm">{job.base_strategy_name}</Text>
                          <Text size="xs" c="dimmed">{job.asset_symbol} • {job.timeframe}</Text>
                        </div>

                        <Group justify="space-between">
                          <div>
                            <Text size="xs" c="dimmed">Período</Text>
                            <Text size="sm">
                              {formatDate(job.start_date)} - {formatDate(job.end_date)}
                            </Text>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <Text size="xs" c="dimmed">Criado em</Text>
                            <Text size="sm">{formatDate(job.created_at)}</Text>
                          </div>
                        </Group>

                        {job.status === 'COMPLETED' && (
                          <Button 
                            variant="light" 
                            size="sm" 
                            fullWidth
                            leftSection={<IconChartLine size={16} />}
                            onClick={() => {
                              console.log('Button clicked for job:', job);
                              if (job && job.id) {
                                setSelectedJob(job);
                                fetchJobResults(job.id).catch(error => {
                                  console.error('Error fetching job results:', error);
                                });
                              } else {
                                console.error('Invalid job object:', job);
                                notifications.show({
                                  title: 'Erro',
                                  message: 'Job inválido selecionado',
                                  color: 'red'
                                });
                              }
                            }}
                            loading={resultsLoading}
                          >
                            Ver Resultados
                          </Button>
                        )}

                        {job.status === 'RUNNING' && (
                          <Progress 
                            value={job.progress || 0} 
                            size="sm" 
                            striped 
                            animated 
                            label={`Processando... ${Math.round(job.progress || 0)}%`}
                          />
                        )}
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>

        {/* Results Modal */}
        <Modal
          opened={resultsModalOpened}
          onClose={closeResultsModal}
          size="xl"
          title={selectedJob ? `Resultados: ${selectedJob.base_strategy_name}` : "Resultados da Otimização"}
        >
          {resultsLoading ? (
            <Group justify="center" p="xl">
              <Loader size="lg" />
              <Text>Carregando resultados...</Text>
            </Group>
          ) : jobResults.length === 0 ? (
            <Alert icon={<IconX size={16} />} title="Nenhum resultado encontrado">
              Este job ainda não possui resultados disponíveis.
            </Alert>
          ) : (
            <Stack>
              <Group justify="space-between">
                <Text size="lg" fw={500}>
                  Top {jobResults.length} Combinações de Parâmetros
                </Text>
                <Badge variant="light" size="lg">
                  Fitness Score: {formatNumber(jobResults[0]?.fitness_score)} (melhor)
                </Badge>
              </Group>

              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rank</Table.Th>
                    <Table.Th>Fitness</Table.Th>
                    <Table.Th>Lucro (%)</Table.Th>
                    <Table.Th>Drawdown (%)</Table.Th>
                    <Table.Th>Win Rate (%)</Table.Th>
                    <Table.Th>Sharpe</Table.Th>
                    <Table.Th>Trades</Table.Th>
                    <Table.Th>Parâmetros</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {jobResults.slice(0, 20).map((result, index) => (
                    <Table.Tr key={result.id}>
                      <Table.Td>
                        <Badge 
                          variant={index === 0 ? "filled" : "light"} 
                          color={index === 0 ? "gold" : index < 3 ? "blue" : "gray"}
                        >
                          #{index + 1}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={index === 0 ? 700 : 400}>
                          {formatNumber(result.fitness_score, 4)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text color={result.net_profit_percent > 0 ? "green" : "red"}>
                          {formatNumber(result.net_profit_percent)}%
                        </Text>
                      </Table.Td>
                      <Table.Td>{formatNumber(result.max_drawdown_percent)}%</Table.Td>
                      <Table.Td>{formatNumber(result.win_rate_percent)}%</Table.Td>
                      <Table.Td>{formatNumber(result.sharpe_ratio, 3)}</Table.Td>
                      <Table.Td>{result.total_trades}</Table.Td>
                      <Table.Td>
                        <Box style={{ maxWidth: 200 }}>
                          <Text size="xs" style={{ wordBreak: 'break-all' }}>
                            {Object.entries(result.parameters || {}).map(([key, value]) => 
                              `${key}: ${value}`
                            ).join(', ')}
                          </Text>
                        </Box>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {selectedJob && jobResults.length > 0 && (
                <Card withBorder p="md" mt="md">
                  <Title order={4} mb="md">Melhor Configuração Encontrada</Title>
                  <SimpleGrid cols={2}>
                    <div>
                      <Text size="sm" fw={500} mb="xs">Métricas de Performance</Text>
                      <Stack gap={5}>
                        <Group justify="space-between">
                          <Text size="sm">Lucro Total:</Text>
                          <Text size="sm" fw={500} c={jobResults[0].net_profit_percent > 0 ? "green" : "red"}>
                            {formatNumber(jobResults[0].net_profit_percent)}%
                          </Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Drawdown Máximo:</Text>
                          <Text size="sm" fw={500}>{formatNumber(jobResults[0].max_drawdown_percent)}%</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Win Rate:</Text>
                          <Text size="sm" fw={500}>{formatNumber(jobResults[0].win_rate_percent)}%</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Sharpe Ratio:</Text>
                          <Text size="sm" fw={500}>{formatNumber(jobResults[0].sharpe_ratio, 3)}</Text>
                        </Group>
                      </Stack>
                    </div>
                    <div>
                      <Text size="sm" fw={500} mb="xs">Parâmetros Otimizados</Text>
                      <Stack gap={5}>
                        {Object.entries(jobResults[0].parameters || {}).map(([key, value]) => (
                          <Group key={key} justify="space-between">
                            <Text size="sm">{key}:</Text>
                            <Text size="sm" fw={500}>{value}</Text>
                          </Group>
                        ))}
                      </Stack>
                    </div>
                  </SimpleGrid>
                  
                  <Group justify="center" mt="md">
                    <Button 
                      variant="filled" 
                      leftSection={<IconRocket size={16} />}
                      onClick={() => openSaveAsStrategyModal(selectedJob)}
                    >
                      Salvar como Nova Estratégia
                    </Button>
                  </Group>
                </Card>
              )}
            </Stack>
          )}
        </Modal>

        {/* Save Strategy Modal */}
        <Modal
          opened={saveStrategyModalOpened}
          onClose={closeSaveStrategyModal}
          size="md"
          title="Salvar como Nova Estratégia"
        >
          {strategyToSave && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              saveAsStrategy({
                name: formData.get('name'),
                description: formData.get('description')
              });
            }}>
              <Stack gap="md">
                <Alert color="blue">
                  <Text size="sm">
                    <strong>Estratégia Base:</strong> {strategyToSave.baseStrategyName}<br/>
                    <strong>Ativo:</strong> {strategyToSave.assetSymbol}<br/>
                    <strong>Timeframe:</strong> {strategyToSave.timeframe}<br/>
                    <strong>Fitness Score:</strong> {strategyToSave.performance.fitnessScore}
                  </Text>
                </Alert>

                <TextInput
                  label="Nome da Estratégia"
                  name="name"
                  placeholder="Ex: RSI_MACD Otimizada BTC"
                  required
                />

                <Textarea
                  label="Descrição"
                  name="description"
                  placeholder="Descreva esta estratégia otimizada..."
                  minRows={3}
                  required
                />

                <Group justify="flex-end" mt="md">
                  <Button variant="outline" onClick={closeSaveStrategyModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" leftSection={<IconRocket size={16} />}>
                    Salvar Estratégia
                  </Button>
                </Group>
              </Stack>
            </form>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}