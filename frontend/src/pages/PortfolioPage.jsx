import React, { useState, useEffect, useCallback } from 'react';
import {
  Title,
  Button,
  Table,
  Modal,
  TextInput,
  Select,
  NumberInput,
  Stack,
  Group,
  ActionIcon,
  Alert,
  Text,
  Badge,
  Card,
  Grid,
  Loader,
  Paper,
  Progress
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconEye,
  IconTrendingUp,
  IconTrendingDown,
  IconCoins,
  IconAlertCircle,
  IconRefresh
} from '@tabler/icons-react';
import api from '../api';

const MOVEMENT_TYPES = [
  { value: 'COMPRA', label: 'Compra' },
  { value: 'VENDA', label: 'Venda' },
  { value: 'TRANSFERENCIA_ENTRADA', label: 'Transferência Entrada' },
  { value: 'TRANSFERENCIA_SAIDA', label: 'Transferência Saída' }
];

export function PortfolioPage() {
  const [portfolio, setPortfolio] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [detailsModalOpened, setDetailsModalOpened] = useState(false);
  const [selectedAssetHistory, setSelectedAssetHistory] = useState([]);
  const [selectedAssetName, setSelectedAssetName] = useState('');
  const [error, setError] = useState('');

  const form = useForm({
    initialValues: {
      account_id: '',
      asset_id: '',
      movement_type: 'COMPRA',
      movement_date: new Date(),
      quantity: 0,
      price_per_unit: 0,
      fee: 0,
      notes: ''
    },
    validate: {
      account_id: (value) => (!value ? 'Conta é obrigatória' : null),
      asset_id: (value) => (!value ? 'Ativo é obrigatório' : null),
      quantity: (value) => (value <= 0 ? 'Quantidade deve ser maior que zero' : null)
    }
  });

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/portfolio/summary');
      
      // LOG DETALHADO: Resposta completa da API para debug
      console.log('[PORTFOLIO_PAGE] Resposta completa da API /portfolio/summary:', response.data);
      
      // Verificar campos críticos
      if (response.data && response.data.length > 0) {
        response.data.forEach((holding, index) => {
          console.log(`[PORTFOLIO_PAGE] Holding ${index + 1}:`, {
            symbol: holding.symbol,
            current_price: holding.current_price,
            market_value: holding.market_value,
            market_value_brl: holding.market_value_brl,
            quantity: holding.quantity
          });
        });
      }
      
      setPortfolio(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar portfólio:', err);
      setError('Erro ao carregar portfólio');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data.accounts || []);
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
    }
  }, []);

  const loadAssets = useCallback(async () => {
    try {
      const response = await api.get('/assets');
      setAssets(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar ativos:', err);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
    loadAccounts();
    loadAssets();
  }, [loadPortfolio, loadAccounts, loadAssets]);

  const handleAddMovement = async (values) => {
    setLoading(true);
    try {
      const formattedData = {
        ...values,
        movement_date: values.movement_date.toISOString().split('T')[0],
        account_id: parseInt(values.account_id),
        asset_id: parseInt(values.asset_id)
      };

      await api.post('/portfolio/movements', formattedData);
      setModalOpened(false);
      form.reset();
      await loadPortfolio();
    } catch (err) {
      console.error('Erro ao adicionar movimento:', err);
      setError('Erro ao adicionar movimento');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAssetDetails = async (assetId, assetName) => {
    try {
      const response = await api.get(`/portfolio/assets/${assetId}/movements`);
      setSelectedAssetHistory(response.data || []);
      setSelectedAssetName(assetName);
      setDetailsModalOpened(true);
    } catch (err) {
      console.error('Erro ao carregar histórico do ativo:', err);
      setError('Erro ao carregar histórico do ativo');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getPercentageColor = (value) => {
    return value >= 0 ? 'green' : 'red';
  };

  const getTotalPortfolioValue = () => {
    return portfolio.reduce((total, position) => {
      // Usar market_value_brl se disponível, senão market_value
      const value = position.market_value_brl || position.market_value || 0;
      return total + value;
    }, 0);
  };

  const getTotalUnrealizedPnL = () => {
    return portfolio.reduce((total, position) => total + position.unrealized_pnl, 0);
  };

  const accountOptions = accounts.map(account => ({
    value: account.id.toString(),
    label: `${account.name} - ${account.institution || 'N/A'}`
  }));

  const assetOptions = Array.isArray(assets)
  ? assets.map(asset => ({
      value: asset.id.toString(),
      label: `${asset.symbol} - ${asset.name}`
    }))
  : [];

  if (loading && portfolio.length === 0) {
    return (
      <Stack gap="md" align="center" mt="xl">
        <Loader size="lg" />
        <Text>Carregando portfólio...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Meu Portfólio</Title>
        <Group>
          <ActionIcon
            variant="light"
            color="blue"
            onClick={loadPortfolio}
            loading={loading}
            title="Atualizar"
          >
            <IconRefresh size={16} />
          </ActionIcon>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpened(true)}
          >
            Adicionar Movimento
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size="1rem" />} color="red">
          {error}
        </Alert>
      )}

      {/* Resumo do Portfólio */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="lg" style={{ background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)' }}>
            <Group justify="space-between">
              <div>
                <Text c="white" size="xs" fw={500}>Valor Total</Text>
                <Text c="white" size="lg" fw={700}>
                  {formatCurrency(getTotalPortfolioValue())}
                </Text>
              </div>
              <IconCoins size={32} color="white" style={{ opacity: 0.8 }} />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="lg" style={{ 
            background: getTotalUnrealizedPnL() >= 0 
              ? 'linear-gradient(45deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(45deg, #ef4444 0%, #dc2626 100%)'
          }}>
            <Group justify="space-between">
              <div>
                <Text c="white" size="xs" fw={500}>P&L Não Realizado</Text>
                <Text c="white" size="lg" fw={700}>
                  {formatCurrency(getTotalUnrealizedPnL())}
                </Text>
              </div>
              {getTotalUnrealizedPnL() >= 0 ? 
                <IconTrendingUp size={32} color="white" style={{ opacity: 0.8 }} /> :
                <IconTrendingDown size={32} color="white" style={{ opacity: 0.8 }} />
              }
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="lg">
            <Text fw={500} size="sm" mb="xs">Posições Ativas</Text>
            <Text size="xl" fw={700} c="blue">
              {portfolio.length}
            </Text>
            <Text size="xs" c="dimmed">ativos diferentes</Text>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Tabela do Portfólio */}
      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ativo</Table.Th>
              <Table.Th>Classe</Table.Th>
              <Table.Th ta="right">Quantidade</Table.Th>
              <Table.Th ta="right">Preço Médio</Table.Th>
              <Table.Th ta="right">Preço Atual</Table.Th>
              <Table.Th ta="right">Valor de Mercado</Table.Th>
              <Table.Th ta="right">P&L %</Table.Th>
              <Table.Th ta="right">P&L Valor</Table.Th>
              <Table.Th width={80}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {portfolio.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Stack gap="md" align="center">
                    <IconCoins size={48} color="#adb5bd" />
                    <div>
                      <Text c="dimmed" fw={500}>Nenhuma posição encontrada</Text>
                      <Text c="dimmed" size="sm">
                        Adicione seu primeiro movimento para começar
                      </Text>
                    </div>
                  </Stack>
                </Table.Td>
              </Table.Tr>
            ) : (
              portfolio.map((position) => (
                <Table.Tr key={position.asset_id}>
                  <Table.Td>
                    <div>
                      <Text fw={500} size="sm">{position.symbol}</Text>
                      <Text size="xs" c="dimmed">{position.name}</Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {position.asset_class}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">
                      {new Intl.NumberFormat('pt-BR', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      }).format(position.quantity)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">
                      {formatCurrency(position.average_price)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">
                      {formatCurrency(position.current_price)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={500} size="sm">
                      {formatCurrency(position.market_value_brl || position.market_value || 0)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text
                      c={getPercentageColor(position.unrealized_pnl_percentage)}
                      fw={500}
                      size="sm"
                    >
                      {formatPercentage(position.unrealized_pnl_percentage)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text
                      c={getPercentageColor(position.unrealized_pnl)}
                      fw={500}
                      size="sm"
                    >
                      {formatCurrency(position.unrealized_pnl)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => handleViewAssetDetails(position.asset_id, `${position.symbol} - ${position.name}`)}
                      title="Ver Histórico"
                    >
                      <IconEye size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal de Adicionar Movimento */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Adicionar Movimento de Ativo"
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleAddMovement)}>
          <Stack gap="md">
            <Group grow>
              <Select
                label="Conta"
                placeholder="Selecione uma conta"
                data={accountOptions}
                {...form.getInputProps('account_id')}
              />
              <Select
                label="Ativo"
                placeholder="Selecione um ativo"
                data={assetOptions}
                searchable
                {...form.getInputProps('asset_id')}
              />
            </Group>

            <Group grow>
              <Select
                label="Tipo de Movimento"
                data={MOVEMENT_TYPES}
                {...form.getInputProps('movement_type')}
              />
              <DatePickerInput
                label="Data do Movimento"
                {...form.getInputProps('movement_date')}
              />
            </Group>

            <Group grow>
              <NumberInput
                label="Quantidade"
                placeholder="0.00"
                decimalScale={8}
                min={0}
                {...form.getInputProps('quantity')}
              />
              <NumberInput
                label="Preço por Unidade"
                placeholder="0.00"
                decimalScale={8}
                min={0}
                {...form.getInputProps('price_per_unit')}
              />
            </Group>

            <NumberInput
              label="Taxa (Opcional)"
              placeholder="0.00"
              decimalScale={2}
              min={0}
              {...form.getInputProps('fee')}
            />

            <TextInput
              label="Observações (Opcional)"
              placeholder="Notas sobre a operação..."
              {...form.getInputProps('notes')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={() => setModalOpened(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                Adicionar Movimento
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de Detalhes do Ativo */}
      <Modal
        opened={detailsModalOpened}
        onClose={() => setDetailsModalOpened(false)}
        title={`Histórico de Movimentos - ${selectedAssetName}`}
        size="xl"
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Conta</Table.Th>
              <Table.Th ta="right">Quantidade</Table.Th>
              <Table.Th ta="right">Preço</Table.Th>
              <Table.Th ta="right">Taxa</Table.Th>
              <Table.Th>Observações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {selectedAssetHistory.map((movement) => (
              <Table.Tr key={movement.id}>
                <Table.Td>
                  {new Date(movement.movement_date).toLocaleDateString('pt-BR')}
                </Table.Td>
                <Table.Td>
                  <Badge 
                    color={
                      movement.movement_type === 'COMPRA' ? 'green' :
                      movement.movement_type === 'VENDA' ? 'red' : 'blue'
                    }
                    variant="light"
                  >
                    {movement.movement_type}
                  </Badge>
                </Table.Td>
                <Table.Td>{movement.account_name}</Table.Td>
                <Table.Td ta="right">
                  {new Intl.NumberFormat('pt-BR', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8
                  }).format(movement.quantity)}
                </Table.Td>
                <Table.Td ta="right">
                  {movement.price_per_unit ? formatCurrency(movement.price_per_unit) : '-'}
                </Table.Td>
                <Table.Td ta="right">
                  {movement.fee ? formatCurrency(movement.fee) : '-'}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {movement.notes || '-'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Modal>
    </Stack>
  );
}