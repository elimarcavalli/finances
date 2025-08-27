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
import { IconArrowLeft, IconRefresh, IconWallet, IconTrendingUp, IconFilter, IconSortAscending, IconSortDescending, IconSearch } from '@tabler/icons-react';
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
  const [updatingPrices, setUpdatingPrices] = useState(false);

  // Estados para filtros e ordenação
  const [sortField, setSortField] = useState('market_value_brl');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({
    name: ''
  });
  const [openedPopovers, setOpenedPopovers] = useState({});

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

  const updateCryptoPrices = async () => {
    setUpdatingPrices(true);
    try {
      // Obter lista de asset_ids únicos das criptos na conta
      const cryptoAssetIds = [...new Set(
        portfolioSummary.map(position => position.asset_id)
      )];

      if (cryptoAssetIds.length === 0) {
        notifications.show({
          title: 'Aviso',
          message: 'Nenhuma criptomoeda encontrada nesta conta',
          color: 'yellow'
        });
        return;
      }

      const response = await api.post('/assets/update-prices', {
        asset_ids: cryptoAssetIds
      });
      
      notifications.show({
        title: 'Sucesso',
        message: `Preços atualizados! ${response.data.updated_count} ativo(s) processado(s)`,
        color: 'green'
      });
      
      // Recarregar dados do portfólio
      await fetchPortfolioSummary();
    } catch (error) {
      console.error('Erro ao atualizar preços:', error);
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Não foi possível atualizar os preços',
        color: 'red'
      });
    } finally {
      setUpdatingPrices(false);
    }
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
      
      return true;
    });
  };

  const clearFilters = () => {
    setFilters({ name: '' });
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

  // Componente de cabeçalho ordenável
  const SortableHeader = ({ field, children, filterType = 'none', filterPlaceholder = '' }) => (
    <Group gap="xs" justify="flex-start" style={{ width: '100%' }}>
      {filterType === 'text' && <TextFilterMenu field={field} placeholder={filterPlaceholder} />}
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

  // Aplicar filtros e ordenação
  const filteredAndSortedPortfolio = React.useMemo(() => {
    const cryptoBalances = calculateCryptoBalances();
    const filtered = applyFilters(cryptoBalances.investmentPositions);
    
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
          {position.icon_url ? (
            <Avatar src={position.icon_url} size="sm" radius="xl" />
          ) : (
            <Center style={{ width: 32, height: 32 }}>
              <Text size="xs" fw={600} color="dimmed">
                {position.symbol.slice(0, 2)}
              </Text>
            </Center>
          )}
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
          {movement.icon_url ? (
            <Avatar src={movement.icon_url} size="sm" radius="xl" />
          ) : (
            <Center style={{ width: 32, height: 32 }}>
              <Text size="xs" fw={600} color="dimmed">
                {movement.symbol.slice(0, 2)}
              </Text>
            </Center>
          )}
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
            <Group gap="md">
              {account.icon_url ? (
                <Avatar src={account.icon_url} size="xl" radius="md" />
              ) : (
                <Center style={{ width: 64, height: 64, backgroundColor: '#fff3e0', borderRadius: '8px' }}>
                  <IconWallet size={32} color="orange" />
                </Center>
              )}
              <div>
                <Title order={2}>{account.name}</Title>
                <Text c="dimmed">{account.institution} • Conta Cripto</Text>
              </div>
            </Group>
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
        <Button 
          leftSection={<IconRefresh size={16} />} 
          variant="light" 
          color="green"
          onClick={updateCryptoPrices}
          loading={updatingPrices}
        >
          {updatingPrices ? 'Atualizando...' : 'Atualizar Preços'}
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
                    filterPlaceholder="Filtrar cripto..."
                  >
                    Criptomoeda
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
                  <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
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
                              {position.symbol.slice(0, 2)}
                            </Text>
                          </Center>
                        )}
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
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                    Nenhuma criptomoeda encontrada nesta conta
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
                    {filteredAndSortedPortfolio.length} criptos
                  </Text>
                </Table.Td>
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
        {filters.name && (
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