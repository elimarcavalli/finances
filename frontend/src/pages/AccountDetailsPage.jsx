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
  Divider,
  Avatar,
  Center,
  ScrollArea,
  ActionIcon,
  UnstyledButton,
  Popover,
  TextInput,
  Menu
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconRefresh, IconCreditCard, IconFilter, IconSortAscending, IconSortDescending, IconSearch } from '@tabler/icons-react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import api from '../api';

export function AccountDetailsPage() {
  const { accountId } = useParams();
  const [account, setAccount] = useState(null);
  const [portfolioSummary, setPortfolioSummary] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Estados para filtros e ordenação
  const [sortField, setSortField] = useState('market_value_brl');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({
    name: '',
    asset_class: ''
  });
  const [openedPopovers, setOpenedPopovers] = useState({});

  const fetchAccount = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/accounts/${accountId}`);
      setAccount(response.data);
    } catch (error) {
      console.error('Erro ao buscar conta:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar os dados da conta',
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
      console.error('Erro ao buscar resumo do portfólio:', error);
      
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
        console.log('Fallback successful:', convertedPortfolio);
      } catch (fallbackError) {
        console.error('Erro no fallback também:', fallbackError);
        notifications.show({
          title: 'Erro',
          message: 'Não foi possível carregar o resumo do portfólio',
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
      console.error('Erro ao buscar movimentações:', error);
      // Se o novo endpoint falhar, apenas mostramos uma lista vazia
      setMovements([]);
      console.log('Sem movimentações disponíveis para esta conta');
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
      'SINCRONIZACAO': 'Sincronização'
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

  const ASSET_CLASSES = [
    { value: 'CRIPTO', label: 'Criptomoedas' },
    { value: 'ACAO_BR', label: 'Ações Brasil' },
    { value: 'ACAO_US', label: 'Ações EUA' },
    { value: 'FUNDO', label: 'Fundos' },
    { value: 'FII', label: 'FIIs' },
    { value: 'COE', label: 'COEs' },
    { value: 'RENDA_FIXA', label: 'Renda Fixa' },
    { value: 'TESOURO', label: 'Tesouro' },
    { value: 'COMMODITIES', label: 'Commodities' },
    { value: 'OUTROS', label: 'Outros' }
  ];

  // Funções de filtro e ordenação
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const applyFilters = (portfolioData) => {
    return portfolioData.filter(position => {
      // Filtro por nome do ativo (incluindo símbolo)
      if (filters.name) {
        const searchTerm = filters.name.toLowerCase();
        const matchesName = position.name && position.name.toLowerCase().includes(searchTerm);
        const matchesSymbol = position.symbol && position.symbol.toLowerCase().includes(searchTerm);
        
        if (!matchesName && !matchesSymbol) {
          return false;
        }
      }
      
      // Filtro por classe do ativo
      if (filters.asset_class && position.asset_class !== filters.asset_class) {
        return false;
      }
      
      return true;
    });
  };

  const clearFilters = () => {
    setFilters({ name: '', asset_class: '' });
    setOpenedPopovers({});
  };

  // Componente de filtro de texto
  const TextFilterMenu = ({ field, placeholder }) => {
    const isOpen = openedPopovers[field] || false;
    
    const togglePopover = (e) => {
      e.stopPropagation();
      setOpenedPopovers(prev => ({ ...prev, [field]: !prev[field] }));
    };

    return (
      <Popover 
        width={200} 
        position="bottom-start" 
        withArrow 
        shadow="md"
        opened={isOpen}
        onClose={() => setOpenedPopovers(prev => ({ ...prev, [field]: false }))}
      >
        <Popover.Target>
          <ActionIcon 
            variant="subtle" 
            size="sm"
            onClick={togglePopover}
            color={filters[field] ? 'blue' : 'gray'}
          >
            <IconFilter size={12} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <TextInput
            placeholder={placeholder}
            value={filters[field]}
            onChange={(e) => setFilters(prev => ({ ...prev, [field]: e.target.value }))}
            leftSection={<IconSearch size={14} />}
            size="xs"
            autoFocus
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setOpenedPopovers(prev => ({ ...prev, [field]: false }));
              }
            }}
          />
        </Popover.Dropdown>
      </Popover>
    );
  };

  // Componente de filtro de classe
  const ClassFilterMenu = () => {
    const isOpen = openedPopovers.asset_class || false;
    
    const togglePopover = (e) => {
      e.stopPropagation();
      setOpenedPopovers(prev => ({ ...prev, asset_class: !prev.asset_class }));
    };

    return (
      <Popover 
        width={200} 
        position="bottom-start" 
        withArrow 
        shadow="md"
        opened={isOpen}
        onClose={() => setOpenedPopovers(prev => ({ ...prev, asset_class: false }))}
      >
        <Popover.Target>
          <ActionIcon 
            variant="subtle" 
            size="sm"
            onClick={togglePopover}
            color={filters.asset_class ? 'blue' : 'gray'}
          >
            <IconFilter size={12} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setFilters(prev => ({ ...prev, asset_class: '' }))}>
              Todos
            </Menu.Item>
            <Menu.Divider />
            {ASSET_CLASSES.map((assetClass) => (
              <Menu.Item 
                key={assetClass.value}
                onClick={() => setFilters(prev => ({ ...prev, asset_class: assetClass.value }))}
              >
                {assetClass.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Popover.Dropdown>
      </Popover>
    );
  };

  // Componente de cabeçalho ordenável
  const SortableHeader = ({ field, children, filterType = 'none', filterPlaceholder = '' }) => (
    <Group gap="xs" justify="flex-start" style={{ width: '100%' }}>
      {filterType === 'text' && <TextFilterMenu field={field} placeholder={filterPlaceholder} />}
      {filterType === 'class' && <ClassFilterMenu />}
      <UnstyledButton onClick={() => handleSort(field)} style={{ flex: 1, textAlign: 'left' }}>
        <Group gap="xs">
          <Text fw={500} size="sm">{children}</Text>
          {sortField === field && (
            sortDirection === 'asc' ? <IconSortAscending size={12} /> : <IconSortDescending size={12} />
          )}
        </Group>
      </UnstyledButton>
    </Group>
  );

  // Aplicar filtros e ordenação
  const filteredAndSortedPortfolio = React.useMemo(() => {
    const filtered = applyFilters(portfolioSummary);
    
    return filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Para campos numéricos
      if (['quantity', 'average_price_brl', 'current_price_brl', 'market_value_brl', 'unrealized_pnl_brl', 'unrealized_pnl_percentage_brl'].includes(sortField)) {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else {
        // Para campos de texto
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [portfolioSummary, filters, sortField, sortDirection]);

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

  // Cores para o gráfico de pizza
  const getAssetClassHexColor = (assetClass) => {
    const colors = {
      'CRIPTO': '#fd7e14',
      'ACAO_BR': '#51cf66',
      'ACAO_US': '#339af0',
      'FII': '#9775fa',
      'FUNDO': '#22b8cf',
      'RENDA_FIXA': '#868e96',
      'COMMODITIES': '#ffd43b',
      'OUTROS': '#495057'
    };
    return colors[assetClass] || '#868e96';
  };

  // Preparar dados para o gráfico de alocação por classe de ativo
  const prepareAllocationData = () => {
    if (!portfolioSummary || portfolioSummary.length === 0) {
      return [];
    }

    const allocationMap = {};
    let totalValue = 0;

    // Agrupar por classe de ativo
    portfolioSummary.forEach(position => {
      const assetClass = position.asset_class || 'OUTROS';
      const marketValue = position.market_value_brl || 0;
      
      if (!allocationMap[assetClass]) {
        allocationMap[assetClass] = 0;
      }
      allocationMap[assetClass] += marketValue;
      totalValue += marketValue;
    });

    // Converter para array com percentuais
    return Object.entries(allocationMap).map(([assetClass, value]) => ({
      name: assetClass,
      value: value,
      percentage: totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0,
      color: getAssetClassHexColor(assetClass)
    })).filter(item => item.value > 0);
  };

  const allocationData = prepareAllocationData();

  if (loading) {
    return (
      <Stack gap="md" align="center" mt="xl">
        <Loader size="lg" />
        <Text>Carregando dados da conta...</Text>
      </Stack>
    );
  }

  if (!account) {
    return (
      <Alert color="red" title="Erro">
        Conta não encontrada
      </Alert>
    );
  }

  // Redirecionar contas cripto para a página especializada
  if (account.type === 'CARTEIRA_CRIPTO' || account.type === 'CORRETORA_CRIPTO') {
    return <Navigate to={`/contas/cripto/${accountId}`} replace />;
  }

  const portfolioRows = portfolioSummary.map((position, index) => (
    <Table.Tr key={`${position.asset_id}-${index}`}>
      <Table.Td>
        <Group gap="sm">
          <Badge color={getAssetClassColor(position.asset_class)} variant="light" size="sm">
            {position.symbol}
          </Badge>
          <Text size="sm">{position.name}</Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text ta="right">{Number(position.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</Text>
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

  const movementRows = movements.slice(0, 10).map((movement, index) => (
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
          <Badge color={getAssetClassColor(movement.asset_class)} variant="outline" size="sm">
            {movement.symbol}
          </Badge>
          <Text size="sm">{movement.asset_name}</Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text ta="right">{Number(movement.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</Text>
      </Table.Td>
      <Table.Td>
        <Text ta="right">
          {movement.price_per_unit ? formatCurrency(movement.price_per_unit) : '-'}
        </Text>
      </Table.Td>
    </Table.Tr>
  ));

  const totalPortfolioValue = portfolioSummary.reduce((sum, position) => {
    return sum + (position.market_value_brl || 0);
  }, 0);

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
            <Group gap="md">
              {account.icon_url ? (
                <Avatar src={account.icon_url} size="xl" radius="md" />
              ) : (
                <Center style={{ width: 64, height: 64, backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <IconCreditCard size={32} color="#6c757d" />
                </Center>
              )}
              <div>
                <Title order={2}>{account.name}</Title>
                <Text c="dimmed">{account.institution}</Text>
              </div>
            </Group>
            <Button leftSection={<IconArrowLeft size={16} />} variant="light" component={Link} to="/accounts">
              Voltar
            </Button>
          </Group>

          <div>
            <Text size="sm" c="dimmed">Tipo de Conta</Text>
            <Badge variant="light">{account.type}</Badge>
          </div>
        </Stack>
      </Card>

      {/* KPIs modernos da conta */}
      <Title order={4} mb="md">Resumo Financeiro da Conta</Title>
      
      {['CORRETORA_NACIONAL', 'CORRETORA_INTERNACIONAL'].includes(account.type) && (
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Saldo em Caixa</Text>
                <Text size="xl" fw={700} c="green">
                  {formatCurrency(account.balance)}
                </Text>
                <Text size="xs" c="dimmed">
                  Disponível para investimentos
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Valor Investido</Text>
                <Text size="xl" fw={700} c="blue">
                  {formatCurrency(totalPortfolioValue)}
                </Text>
                <Text size="xs" c="dimmed">
                  Posições de ativos
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Valor Total</Text>
                <Text size="xl" fw={700} c="indigo">
                  {formatCurrency((account.balance || 0) + totalPortfolioValue)}
                </Text>
                <Text size="xs" c="dimmed">
                  Saldo + Investimentos
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Número de Ativos</Text>
                <Text size="xl" fw={700} c="purple">
                  {portfolioSummary.length}
                </Text>
                <Text size="xs" c="dimmed">
                  Diferentes ativos
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Para contas não-investimento, mostrar apenas o saldo normal */}
      {!['CORRETORA_NACIONAL', 'CORRETORA_INTERNACIONAL'].includes(account.type) && (
        <Card withBorder>
          <Group gap="xl">
            <div>
              <Text size="sm" c="dimmed">Saldo da Conta</Text>
              <Text fw={500}>{formatCurrency(account.balance)}</Text>
            </div>
            {totalPortfolioValue > 0 && (
              <div>
                <Text size="sm" c="dimmed">Valor do Portfólio</Text>
                <Text fw={500} c="blue">{formatCurrency(totalPortfolioValue)}</Text>
              </div>
            )}
          </Group>
        </Card>
      )}

      {/* Widget de Alocação por Classe de Ativo */}
      {allocationData.length > 0 && (
        <>
          <Title order={4} mb="md">Alocação de Ativos por Classe</Title>
          
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Text fw={500} mb="xs">Distribuição do Portfólio</Text>
                  <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={allocationData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                        >
                          {allocationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value, name) => [formatCurrency(value), name]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Stack>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Text fw={500} mb="xs">Resumo por Classe</Text>
                  <Stack gap="sm">
                    {allocationData.map((item, index) => (
                      <Group key={index} justify="space-between">
                        <Group gap="xs">
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: item.color
                            }}
                          />
                          <Text size="sm">{item.name}</Text>
                        </Group>
                        <Stack gap={0} align="flex-end">
                          <Text size="sm" fw={500}>{formatCurrency(item.value)}</Text>
                          <Text size="xs" c="dimmed">{item.percentage}%</Text>
                        </Stack>
                      </Group>
                    ))}
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>

          <Divider my="xl" />
        </>
      )}

      <Group justify="space-between">
        <div>
          <Title order={3}>Posições de Ativos</Title>
          <Text c="dimmed">Visão consolidada dos investimentos nesta conta</Text>
        </div>
        <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={handleRefresh}>
          Atualizar
        </Button>
      </Group>

      <Card withBorder>
        <ScrollArea style={{ height: 'calc(100vh - 500px)', minHeight: '400px' }}>
          <Table striped highlightOnHover stickyHeader>
            <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white' }}>
              <Table.Tr>
                <Table.Th>
                  <SortableHeader 
                    field="name" 
                    filterType="text" 
                    filterPlaceholder="Filtrar ativo..."
                  >
                    Ativo
                  </SortableHeader>
                </Table.Th>
                <Table.Th>
                  <SortableHeader 
                    field="asset_class" 
                    filterType="class"
                  >
                    Classe
                  </SortableHeader>
                </Table.Th>
                <Table.Th ta="right">
                  <SortableHeader field="quantity">
                    <div style={{ textAlign: 'right', width: '100%' }}>Quantidade</div>
                  </SortableHeader>
                </Table.Th>
                <Table.Th ta="right">
                  <SortableHeader field="average_price_brl">
                    <div style={{ textAlign: 'right', width: '100%' }}>Preço Médio</div>
                  </SortableHeader>
                </Table.Th>
                <Table.Th ta="right">
                  <SortableHeader field="market_value_brl">
                    <div style={{ textAlign: 'right', width: '100%' }}>Valor de Mercado</div>
                  </SortableHeader>
                </Table.Th>
                <Table.Th ta="right">
                  <div style={{ textAlign: 'right', width: '100%' }}>% do Portfólio</div>
                </Table.Th>
                <Table.Th ta="right">
                  <SortableHeader field="unrealized_pnl_brl">
                    <div style={{ textAlign: 'right', width: '100%' }}>P&L Não Realizado</div>
                  </SortableHeader>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {portfolioLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Loader size="sm" />
                  </Table.Td>
                </Table.Tr>
              ) : filteredAndSortedPortfolio.length > 0 ? (
                filteredAndSortedPortfolio.map((position, index) => (
                  <Table.Tr key={`${position.asset_id}-${index}`}>
                    <Table.Td>
                      <Group gap="sm">
                        {position.icon_url ? (
                          <Avatar src={position.icon_url} size="sm" radius="xl" />
                        ) : (
                          <Center style={{ width: 32, height: 32 }}>
                            <Text size="xs" fw={600} color="dimmed">
                              {position.symbol ? position.symbol.slice(0, 2) : 'N/A'}
                            </Text>
                          </Center>
                        )}
                        <Badge color={getAssetClassColor(position.asset_class)} variant="light" size="sm">
                          {position.symbol || 'N/A'}
                        </Badge>
                        <Text size="sm">{position.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getAssetClassColor(position.asset_class)} variant="dot" size="sm">
                        {position.asset_class}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text ta="right">{Number(position.quantity || 0).toLocaleString('pt-BR')}</Text>
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
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    Nenhuma posição encontrada nesta conta
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
            
            {/* Rodapé com Totalizadores */}
            <Table.Tfoot style={{ 
              position: 'sticky', 
              bottom: 0, 
              zIndex: 1,
              backgroundColor: 'black'
            }}>
              <Table.Tr style={{ 
                backgroundColor: 'black', 
                borderTop: '2px solid black' 
              }}>
                <Table.Td>
                  <Text size="sm" fw={600}>
                    {filteredAndSortedPortfolio.length} ativos
                  </Text>
                </Table.Td>
                <Table.Td></Table.Td>
                <Table.Td></Table.Td>
                <Table.Td></Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" fw={600}>
                    {formatCurrency(
                      filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.market_value_brl || 0), 0)
                    )}
                  </Text>
                </Table.Td>
                <Table.Td></Table.Td>
                <Table.Td ta="center">
                  <Text size="sm" fw={600} c={
                    filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.unrealized_pnl_brl || 0), 0) >= 0 
                      ? 'green' : 'red'
                  }>
                    {formatCurrency(
                      filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.unrealized_pnl_brl || 0), 0)
                    )}
                  </Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </ScrollArea>
        
        {/* Botão Limpar Filtros */}
        {(filters.name || filters.asset_class) && (
          <Group justify="center" mt="md">
            <Button 
              variant="light" 
              size="sm"
              onClick={clearFilters}
            >
              Limpar Filtros
            </Button>
          </Group>
        )}
      </Card>

      {movements.length > 0 && (
        <>
          <Divider my="xl" />
          
          <Title order={3} mb="md">Últimas Movimentações de Ativos</Title>
          
          <Paper withBorder>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Ativo</Table.Th>
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
                      <Text c="dimmed">Nenhuma movimentação encontrada nesta conta</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
            {movements.length > 10 && (
              <Group justify="center" p="md">
                <Text size="sm" c="dimmed">
                  Mostrando as 10 movimentações mais recentes de {movements.length} no total
                </Text>
              </Group>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}