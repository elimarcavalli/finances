import React, { useState, useEffect } from 'react';
import {
  Title,
  Text,
  Stack,
  Table,
  Button,
  Modal,
  Select,
  NumberInput,
  Group,
  Badge,
  ActionIcon,
  Card,
  Breadcrumbs,
  Anchor,
  Loader,
  Alert,
  Grid
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconArrowLeft } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useParams, Link } from 'react-router-dom';
import { DatePickerInput } from '@mantine/dates';
import api from '../api';

export function AccountDetailsPage() {
  const { accountId } = useParams();
  const [account, setAccount] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);
  const [editingHolding, setEditingHolding] = useState(null);

  const form = useForm({
    initialValues: {
      asset_id: '',
      quantity: 0,
      average_buy_price: 0,
      acquisition_date: new Date()
    },
    validate: {
      asset_id: (value) => (!value ? 'Ativo é obrigatório' : null),
      quantity: (value) => (value <= 0 ? 'Quantidade deve ser maior que zero' : null),
      average_buy_price: (value) => (value < 0 ? 'Preço deve ser maior ou igual a zero' : null)
    }
  });

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

  const fetchHoldings = async () => {
    setHoldingsLoading(true);
    try {
      const response = await api.get(`/holdings?account_id=${accountId}`);
      setHoldings(response.data.holdings || []);
    } catch (error) {
      console.error('Erro ao buscar posições:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar as posições',
        color: 'red'
      });
    } finally {
      setHoldingsLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const response = await api.get('/assets');
      setAssets(response.data.assets || []);
    } catch (error) {
      console.error('Erro ao buscar ativos:', error);
    }
  };

  useEffect(() => {
    fetchAccount();
    fetchHoldings();
    fetchAssets();
  }, [accountId]);

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        account_id: parseInt(accountId),
        acquisition_date: values.acquisition_date.toISOString().split('T')[0]
      };
      
      if (editingHolding) {
        await api.put(`/holdings/${editingHolding.id}`, payload);
        notifications.show({
          title: 'Sucesso',
          message: 'Posição atualizada com sucesso',
          color: 'green'
        });
      } else {
        await api.post('/holdings', payload);
        notifications.show({
          title: 'Sucesso',
          message: 'Posição adicionada com sucesso',
          color: 'green'
        });
      }
      
      form.reset();
      setEditingHolding(null);
      close();
      fetchHoldings();
    } catch (error) {
      console.error('Erro ao salvar posição:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível salvar a posição',
        color: 'red'
      });
    }
  };

  const handleEditHolding = (holding) => {
    setEditingHolding(holding);
    form.setValues({
      asset_id: holding.asset_id.toString(),
      quantity: holding.quantity,
      average_buy_price: holding.average_buy_price,
      acquisition_date: new Date(holding.acquisition_date)
    });
    open();
  };

  const handleDeleteHolding = async (holdingId) => {
    if (!confirm('Tem certeza que deseja deletar esta posição?')) return;
    
    try {
      await api.delete(`/holdings/${holdingId}`);
      notifications.show({
        title: 'Sucesso',
        message: 'Posição deletada com sucesso',
        color: 'green'
      });
      fetchHoldings();
    } catch (error) {
      console.error('Erro ao deletar posição:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível deletar a posição',
        color: 'red'
      });
    }
  };

  const openNewHoldingModal = () => {
    setEditingHolding(null);
    form.reset();
    open();
  };

  const formatCurrency = (value, currency = 'BRL') => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const calculatePortfolioPercentage = (marketValue) => {
    if (!marketValue || holdings.length === 0) return 0;
    const totalPortfolioValue = holdings.reduce((sum, holding) => {
      return sum + (holding.current_market_value_brl || 0);
    }, 0);
    return totalPortfolioValue > 0 ? ((marketValue / totalPortfolioValue) * 100) : 0;
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

  const assetsOptions = assets.map(asset => ({
    value: asset.id.toString(),
    label: `${asset.symbol} - ${asset.name}`,
    group: asset.asset_class
  }));

  const rows = holdings.map((holding) => (
    <Table.Tr key={holding.id}>
      <Table.Td>
        <Group gap="sm">
          <Badge color={getAssetClassColor(holding.asset_class)} variant="light" size="sm">
            {holding.symbol}
          </Badge>
          <Text size="sm">{holding.asset_name}</Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text ta="right">{Number(holding.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</Text>
      </Table.Td>
      <Table.Td>
        <Text ta="right">{formatCurrency(holding.average_buy_price)}</Text>
      </Table.Td>
      <Table.Td>
        <Stack gap="xs">
          <Text ta="right" fw={500}>
            {formatCurrency(holding.current_market_value_brl)}
          </Text>
          {holding.current_price_brl && (
            <Text size="xs" c="dimmed" ta="right">
              {formatCurrency(holding.current_price_brl)} / unidade
              {holding.price_cached && ' (cache)'}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <Text ta="right" fw={500}>
          {calculatePortfolioPercentage(holding.current_market_value_brl).toFixed(2)}%
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="light"
            color="blue"
            onClick={() => handleEditHolding(holding)}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="red"
            onClick={() => handleDeleteHolding(holding.id)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  const totalPortfolioValue = holdings.reduce((sum, holding) => {
    return sum + (holding.current_market_value_brl || 0);
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
            <div>
              <Title order={2}>{account.name}</Title>
              <Text c="dimmed">{account.institution}</Text>
            </div>
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

      {/* Cards para contas de investimento - mostrar saldo em caixa separadamente */}
      {['CORRETORA_NACIONAL', 'CORRETORA_CRIPTO', 'CARTEIRA_CRIPTO', 'CORRETORA_INTERNACIONAL'].includes(account.type) && (
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Saldo em Caixa nesta Conta</Text>
                <Text size="xl" fw={700} c="green">
                  {formatCurrency(account.balance)}
                </Text>
                <Text size="xs" c="dimmed">
                  Valor disponível para novos investimentos
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Valor Investido (Posições)</Text>
                <Text size="xl" fw={700} c="blue">
                  {formatCurrency(totalPortfolioValue)}
                </Text>
                <Text size="xs" c="dimmed">
                  Valor atual de mercado dos ativos
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Para contas não-investimento, mostrar apenas o saldo normal */}
      {!['CORRETORA_NACIONAL', 'CORRETORA_CRIPTO', 'CARTEIRA_CRIPTO', 'CORRETORA_INTERNACIONAL'].includes(account.type) && (
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

      <Group justify="space-between">
        <div>
          <Title order={3}>Posições de Ativos</Title>
          <Text c="dimmed">Investimentos registrados nesta conta</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openNewHoldingModal}>
          Adicionar Posição
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Ativo</Table.Th>
            <Table.Th ta="right">Quantidade</Table.Th>
            <Table.Th ta="right">Preço Médio</Table.Th>
            <Table.Th ta="right">Valor de Mercado</Table.Th>
            <Table.Th ta="right">% do Portfólio</Table.Th>
            <Table.Th ta="center">Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {holdingsLoading ? (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                <Loader size="sm" />
              </Table.Td>
            </Table.Tr>
          ) : rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                Nenhuma posição encontrada nesta conta
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={opened}
        onClose={() => {
          close();
          setEditingHolding(null);
          form.reset();
        }}
        title={editingHolding ? 'Editar Posição' : 'Adicionar Posição'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Select
              label="Ativo"
              placeholder="Pesquise e selecione um ativo"
              data={assetsOptions}
              searchable
              {...form.getInputProps('asset_id')}
              required
            />
            
            <NumberInput
              label="Quantidade"
              placeholder="0.0000"
              decimalScale={4}
              {...form.getInputProps('quantity')}
              required
            />
            
            <NumberInput
              label="Preço Médio de Compra"
              placeholder="0.00"
              decimalScale={2}
              {...form.getInputProps('average_buy_price')}
            />
            
            <DatePickerInput
              label="Data de Aquisição"
              placeholder="Selecione a data"
              {...form.getInputProps('acquisition_date')}
              required
            />
            
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={() => {
                close();
                setEditingHolding(null);
                form.reset();
              }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingHolding ? 'Atualizar' : 'Adicionar'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}