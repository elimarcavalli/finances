import React, { useState, useEffect } from 'react';
import {
  Title,
  Text,
  Stack,
  Table,
  Button,
  Modal,
  TextInput,
  Select,
  Group,
  Badge,
  ActionIcon
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import api from '../api';

const ASSET_CLASSES = [
  { value: 'CRIPTO', label: 'Criptomoeda' },
  { value: 'ACAO_BR', label: 'Ação Brasileira' },
  { value: 'ACAO_US', label: 'Ação Americana' },
  { value: 'FII', label: 'Fundo Imobiliário' },
  { value: 'FUNDO', label: 'Fundo de Investimento' },
  { value: 'RENDA_FIXA', label: 'Renda Fixa' },
  { value: 'COMMODITIES', label: 'Commodities' },
  { value: 'OUTROS', label: 'Outros' }
];

export function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);
  const [editingAsset, setEditingAsset] = useState(null);

  const form = useForm({
    initialValues: {
      symbol: '',
      name: '',
      asset_class: '',
      price_api_identifier: ''
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
      price_api_identifier: asset.price_api_identifier || ''
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
      <Table.Td>{asset.symbol}</Table.Td>
      <Table.Td>{asset.name}</Table.Td>
      <Table.Td>
        <Badge color={getAssetClassColor(asset.asset_class)} variant="light">
          {ASSET_CLASSES.find(ac => ac.value === asset.asset_class)?.label || asset.asset_class}
        </Badge>
      </Table.Td>
      <Table.Td>{asset.price_api_identifier || '-'}</Table.Td>
      <Table.Td>
        <Group gap="xs">
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
        <Button leftSection={<IconPlus size={16} />} onClick={openNewAssetModal}>
          Novo Ativo
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Símbolo</Table.Th>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Classe</Table.Th>
            <Table.Th>ID CoinGecko</Table.Th>
            <Table.Th>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Tr>
              <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                Carregando...
              </Table.Td>
            </Table.Tr>
          ) : rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
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