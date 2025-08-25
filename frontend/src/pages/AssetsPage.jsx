import React, { useState, useEffect } from 'react';
import {
  Title,
  Text,
  Stack,
  Table,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Group,
  Badge,
  ActionIcon,
  Avatar,
  Center
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconRefresh, IconPhoto } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import api from '../api';

const ASSET_CLASSES = [
  { value: 'CRIPTO', label: 'Criptomoeda' },
  { value: 'ACAO_BR', label: 'Ação Brasileira' },
  { value: 'ACAO_US', label: 'Ação Americana' },
  { value: 'PREVIDENCIA', label: 'Previdência' },
  { value: 'FUNDO', label: 'Fundo de Investimento' },
  { value: 'FII', label: 'Fundo Imobiliário' },
  { value: 'COE', label: 'COE' },
  { value: 'RENDA_FIXA', label: 'Renda Fixa' },
  { value: 'TESOURO', label: 'Tesouro Direto' },
  { value: 'COMMODITIES', label: 'Commodities' },
  { value: 'OUTROS', label: 'Outros' }
];

export function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [updatingIcons, setUpdatingIcons] = useState(false);
  const [updatingAsset, setUpdatingAsset] = useState(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [editingAsset, setEditingAsset] = useState(null);

  const form = useForm({
    initialValues: {
      symbol: '',
      name: '',
      asset_class: '',
      price_api_identifier: '',
      icon_url: '',
      last_price_usdt: 0,
      last_price_brl: 0
    },
    validate: {
      symbol: (value) => (!value ? 'Símbolo é obrigatório' : null),
      name: (value) => (!value ? 'Nome é obrigatório' : null),
      asset_class: (value) => (!value ? 'Classe do ativo é obrigatória' : null)
    }
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const response = await api.get('/assets');
      setAssets(response.data.assets);
    } catch (error) {
      console.error('Erro ao buscar ativos:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível carregar os ativos',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleSubmit = async (values) => {
    try {
      if (editingAsset) {
        await api.put(`/assets/${editingAsset.id}`, values);
        notifications.show({
          title: 'Sucesso',
          message: 'Ativo atualizado com sucesso',
          color: 'green'
        });
      } else {
        await api.post('/assets', values);
        notifications.show({
          title: 'Sucesso',
          message: 'Ativo criado com sucesso',
          color: 'green'
        });
      }
      
      form.reset();
      close();
      setEditingAsset(null);
      fetchAssets();
    } catch (error) {
      console.error('Erro ao salvar ativo:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível salvar o ativo',
        color: 'red'
      });
    }
  };

  const handleEdit = (asset) => {
    setEditingAsset(asset);
    form.setValues({
      symbol: asset.symbol,
      name: asset.name,
      asset_class: asset.asset_class,
      price_api_identifier: asset.price_api_identifier || '',
      last_price_usdt: asset.last_price_usdt || '',
      last_price_brl: asset.last_price_brl || ''
    });
    open();
  };

  const handleDelete = async (assetId) => {
    if (!confirm('Tem certeza que deseja deletar este ativo?')) return;
    
    try {
      await api.delete(`/assets/${assetId}`);
      notifications.show({
        title: 'Sucesso',
        message: 'Ativo deletado com sucesso',
        color: 'green'
      });
      fetchAssets();
    } catch (error) {
      console.error('Erro ao deletar ativo:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível deletar o ativo',
        color: 'red'
      });
    }
  };

  const openNewAssetModal = () => {
    setEditingAsset(null);
    form.reset();
    open();
  };

  const updateAssetPrice = async (assetId) => {
    setUpdatingAsset(assetId);
    try {
      const response = await api.post('/assets/update-prices', {
        asset_ids: [assetId]
      });
      
      notifications.show({
        title: 'Sucesso',
        message: `Preço atualizado! ${response.data.updated_count} ativo(s) processado(s)`,
        color: 'green'
      });
      
      fetchAssets(); // Recarregar dados
    } catch (error) {
      console.error('Erro ao atualizar preço:', error);
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Não foi possível atualizar o preço',
        color: 'red'
      });
    } finally {
      setUpdatingAsset(null);
    }
  };

  const updateAllCryptoPrices = async () => {
    setUpdatingPrices(true);
    try {
      const response = await api.post('/assets/update-all-crypto-prices');
      
      notifications.show({
        title: 'Sucesso',
        message: `Preços atualizados! ${response.data.updated_count} ativo(s) processado(s)`,
        color: 'green'
      });
      
      fetchAssets(); // Recarregar dados
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

  const updateAllCryptoIcons = async () => {
    setUpdatingIcons(true);
    try {
      const response = await api.post('/assets/icons/update-all');
      
      notifications.show({
        title: 'Sucesso!',
        message: `${response.data.updated_count} ícones atualizados com sucesso`,
        color: 'green',
        autoClose: 5000
      });
      
      if (response.data.errors && response.data.errors.length > 0) {
        notifications.show({
          title: 'Avisos',
          message: `${response.data.errors.length} ícones não puderam ser atualizados`,
          color: 'yellow',
          autoClose: 3000
        });
      }
      
      // Recarregar a lista
      fetchAssets();
    } catch (error) {
      console.error('Erro:', error);
      notifications.show({
        title: 'Erro',
        message: 'Erro ao atualizar ícones das criptos',
        color: 'red'
      });
    } finally {
      setUpdatingIcons(false);
    }
  };

  const formatPrice = (price, currency = 'BRL') => {
    if (!price || price === 0) return '-';
    
    if (currency === 'BRL') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(price);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(price);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
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

  const rows = assets.map((asset) => (
    <Table.Tr key={asset.id}>
      <Table.Td>
        <Group gap="sm">
          {asset.icon_url ? (
            <Avatar src={asset.icon_url} size="sm" radius="xl" />
          ) : (
            <Center style={{ width: 32, height: 32 }}>
              <Text size="xs" fw={600} color="dimmed">
                {asset.symbol.slice(0, 2)}
              </Text>
            </Center>
          )}
          <Text fw={500}>{asset.symbol}</Text>
        </Group>
      </Table.Td>
      <Table.Td>{asset.name}</Table.Td>
      <Table.Td>
        <Badge color={getAssetClassColor(asset.asset_class)} variant="light">
          {ASSET_CLASSES.find(ac => ac.value === asset.asset_class)?.label || asset.asset_class}
        </Badge>
      </Table.Td>
      <Table.Td>{asset.price_api_identifier || '-'}</Table.Td>
      <Table.Td>{formatPrice(asset.last_price_usdt, 'USD')}</Table.Td>
      <Table.Td>{formatPrice(asset.last_price_brl, 'BRL')}</Table.Td>
      <Table.Td>{formatDate(asset.last_price_updated_at)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          {asset.asset_class === 'CRIPTO' && asset.price_api_identifier && (
            <ActionIcon
              variant="light"
              color="green"
              loading={updatingAsset === asset.id}
              onClick={() => updateAssetPrice(asset.id)}
              disabled={updatingPrices}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          )}
          <ActionIcon
            variant="light"
            color="blue"
            onClick={() => handleEdit(asset)}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="red"
            onClick={() => handleDelete(asset.id)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Gerenciador de Ativos</Title>
          <Text c="dimmed">
            Gerencie o dicionário de ativos disponíveis no sistema
          </Text>
        </div>
        <Group>
          <Button 
            variant="light" 
            color="green"
            leftSection={<IconRefresh size={16} />} 
            onClick={updateAllCryptoPrices}
            loading={updatingPrices}
          >
            Atualizar Criptos (menos USDT)
          </Button>
          {/* <Button 
            variant="light" 
            color="orange"
            leftSection={<IconPhoto size={16} />} 
            onClick={updateAllCryptoIcons}
            loading={updatingIcons}
            disabled={updatingPrices}
          >
            Atualizar Ícones
          </Button> */}
          <Button leftSection={<IconPlus size={16} />} onClick={openNewAssetModal}>
            Novo Ativo
          </Button>
        </Group>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Símbolo</Table.Th>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Classe</Table.Th>
            <Table.Th>ID CoinGecko</Table.Th>
            <Table.Th>Preço (USDT)</Table.Th>
            <Table.Th>Preço (BRL)</Table.Th>
            <Table.Th>Última Atualização</Table.Th>
            <Table.Th>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Tr>
              <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                Carregando...
              </Table.Td>
            </Table.Tr>
          ) : rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                Nenhum ativo encontrado
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={opened}
        onClose={close}
        title={editingAsset ? 'Editar Ativo' : 'Novo Ativo'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Símbolo"
              placeholder="Ex: BTC, PETR4, AAPL"
              {...form.getInputProps('symbol')}
              required
            />
            
            <TextInput
              label="Nome"
              placeholder="Ex: Bitcoin, Petrobras PN, Apple Inc"
              {...form.getInputProps('name')}
              required
            />
            
            <Select
              label="Classe do Ativo"
              placeholder="Selecione a classe"
              data={ASSET_CLASSES}
              {...form.getInputProps('asset_class')}
              required
            />
            
            <TextInput
              label="Identificador CoinGecko (opcional)"
              placeholder="Ex: bitcoin, ethereum"
              description="Para ativos com cotação no CoinGecko"
              {...form.getInputProps('price_api_identifier')}
            />
            
            <TextInput
              label="URL do Ícone (opcional)"
              placeholder="Ex: https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png"
              description="URL da imagem do ativo"
              {...form.getInputProps('icon_url')}
            />

            <NumberInput
              label="Preço (USDT)"
              placeholder="Ex: 150.05056"
              description=""
              {...form.getInputProps('last_price_usdt')}
            />

            <NumberInput
              label="Preço (BRL)"
              placeholder="Ex: 501.99548"
              description=""
              {...form.getInputProps('last_price_brl')}
            />
            
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingAsset ? 'Atualizar' : 'Criar'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}