// pages/PatrimonioPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Title,
  Text,
  Stack,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Group,
  Card,
  Textarea,
  ActionIcon,
  SimpleGrid,
  Badge,
  Image,
  Switch,
  SegmentedControl,
  Box,
  Divider,
  ThemeIcon
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconPencil, IconTrash, IconBuildingWarehouse, IconCurrencyDollar, IconTable, IconLayoutGrid, IconCalendar } from '@tabler/icons-react';
import api from '../api';
import { AdvancedTable } from '../components/AdvancedTable';

export function PatrimonioPage() {
  const [assets, setAssets] = useState([]);
  const [assetClasses, setAssetClasses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [liquidateModalOpened, setLiquidateModalOpened] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [liquidatingAsset, setLiquidatingAsset] = useState(null);
  
  // PHASE 3: Novos states para controle de visualização
  const [viewMode, setViewMode] = useState('cards'); // 'cards' ou 'table'
  const [statusFilter, setStatusFilter] = useState('ATIVO'); // 'ATIVO', 'VENDIDO', ou ''

  const form = useForm({
    initialValues: {
      asset_id: '',
      description: '',
      acquisition_date: new Date(),
      acquisition_cost: 0,
      current_value: 0,
      last_valuation_date: new Date(),
      notes: '',
      source_account_id: ''
    },
    validate: {
      asset_id: (value) => !value ? 'Categoria é obrigatória' : null,
      description: (value) => value.trim().length < 3 ? 'Descrição deve ter pelo menos 3 caracteres' : null,
      current_value: (value) => value <= 0 ? 'Valor atual deve ser maior que zero' : null,
      source_account_id: (value) => !value ? 'Conta de origem é obrigatória' : null,
    },
  });

  const liquidateForm = useForm({
    initialValues: {
      sale_value: 0,
      destination_account_id: '',
      sale_date: new Date()
    },
    validate: {
      sale_value: (value) => value <= 0 ? 'Valor da venda deve ser maior que zero' : null,
      destination_account_id: (value) => !value ? 'Conta de destino é obrigatória' : null,
    },
  });

  const fetchPhysicalAssets = useCallback(async () => {
    setLoading(true);
    try {
      // PHASE 3: Incluir filtro de status na URL
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== '') {
        params.append('status', statusFilter);
      }
      
      const url = '/physical-assets' + (params.toString() ? '?' + params.toString() : '');
      const response = await api.get(url);
      setAssets(response.data || []);
    } catch (error) {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar patrimônio', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchAssetClasses = useCallback(async () => {
    try {
      const response = await api.get('/assets?asset_class=PATRIMONIO_FISICO');
      console.log('Asset classes response:', response.data);
      
      // Verificar diferentes possíveis estruturas da resposta
      let assetsList = [];
      if (response.data.assets) {
        assetsList = response.data.assets;
      } else if (Array.isArray(response.data)) {
        assetsList = response.data;
      } else {
        console.error('Unexpected response structure for assets:', response.data);
        return;
      }
      
      let classes = [];
      if (assetsList.length > 0) {
        classes = assetsList.map(ac => ({
          value: ac.id.toString(),
          label: ac.name
        }));
      } else {
        // Fallback: criar algumas opções padrão se não encontrar PATRIMONIO_FISICO
        console.warn('Nenhum asset class PATRIMONIO_FISICO encontrado, usando fallback');
        classes = [
          { value: '1', label: 'Veículos' },
          { value: '2', label: 'Imóveis' },
          { value: '3', label: 'Eletrônicos' },
          { value: '4', label: 'Outros Bens' }
        ];
      }
      console.log('Asset classes formatted:', classes);
      setAssetClasses(classes);
    } catch (error) {
      console.error('Erro ao carregar asset classes:', error);
      notifications.show({ title: 'Erro', message: 'Falha ao carregar categorias de patrimônio', color: 'red' });
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await api.get('/accounts');
      console.log('Accounts response:', response.data);
      
      // Usar exatamente como na ObligationsPage
      const allAccounts = response.data.accounts || [];
      
      // Filtrar apenas contas de caixa
      const cashAccountTypes = ['CONTA_CORRENTE', 'POUPANCA', 'DINHEIRO_VIVO', 'CARTEIRA_DIGITAL'];
      const filteredAccounts = allAccounts.filter(account => 
        cashAccountTypes.includes(account.type)
      );
      let accountOptions = [];
      if (filteredAccounts.length > 0) {
        accountOptions = filteredAccounts.map(account => ({
          value: account.id.toString(),
          label: `${account.name} (${account.type})`
        }));
      } else if (allAccounts.length > 0) {
        // Se não achou contas de caixa, usar todas as contas disponíveis
        console.warn('Nenhuma conta de caixa encontrada, usando todas as contas');
        accountOptions = allAccounts.map(account => ({
          value: account.id.toString(),
          label: `${account.name} (${account.type || 'N/A'})`
        }));
      }
      console.log('All accounts from API:', allAccounts);
      console.log('Filtered cash accounts:', filteredAccounts);
      console.log('Accounts formatted:', accountOptions);
      setAccounts(accountOptions);
    } catch (error) {
      console.error('Erro ao carregar accounts:', error);
      notifications.show({ title: 'Erro', message: 'Falha ao carregar contas', color: 'red' });
    }
  }, []);

  useEffect(() => {
    fetchPhysicalAssets();
    fetchAssetClasses();
    fetchAccounts();
  }, [fetchPhysicalAssets, fetchAssetClasses, fetchAccounts]);

  const openModal = (asset = null) => {
    console.log('Opening modal - assetClasses count:', assetClasses.length, 'accounts count:', accounts.length);
    setEditingAsset(asset);
    if (asset) {
      form.setValues({
        ...asset,
        asset_id: asset.asset_id.toString(),
        acquisition_date: new Date(asset.acquisition_date),
        last_valuation_date: new Date(asset.last_valuation_date),
        source_account_id: asset.source_account_id?.toString() || ''
      });
    } else {
      form.reset();
    }
    setModalOpened(true);
  };

  const openLiquidateModal = (asset) => {
    setLiquidatingAsset(asset);
    liquidateForm.setValues({
      sale_value: parseFloat(asset.current_value),
      destination_account_id: '',
      sale_date: new Date()
    });
    setLiquidateModalOpened(true);
  };

  const handleSubmit = async (values) => {
    // Converter as datas para formato ISO date string (YYYY-MM-DD)
    const formattedValues = {
      ...values,
      acquisition_date: values.acquisition_date instanceof Date 
        ? values.acquisition_date.toISOString().split('T')[0]
        : values.acquisition_date,
      last_valuation_date: values.last_valuation_date instanceof Date 
        ? values.last_valuation_date.toISOString().split('T')[0] 
        : values.last_valuation_date
    };

    const apiCall = editingAsset
      ? api.put(`/physical-assets/${editingAsset.id}`, formattedValues)
      : api.post('/physical-assets', formattedValues);

    try {
      await apiCall;
      notifications.show({
        title: 'Sucesso!',
        message: `Bem ${editingAsset ? 'atualizado' : 'cadastrado'} com sucesso.`,
        color: 'green',
      });
      setModalOpened(false);
      fetchPhysicalAssets();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: `Falha ao ${editingAsset ? 'atualizar' : 'cadastrar'} o bem.`,
        color: 'red',
      });
    }
  };

  const handleDelete = async (id) => {
    // PHASE 3: Modal de confirmação mais específico
    const confirmed = confirm(
      '⚠️ ATENÇÃO: Esta ação é irreversível!\n\n' +
      'Esta operação irá excluir permanentemente este bem E todas as suas transações financeiras associadas (aquisição e venda).\n\n' +
      'Deseja realmente continuar?'
    );
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/physical-assets/${id}`);
      notifications.show({ 
        title: 'Bem Excluído Permanentemente', 
        message: 'O bem e todas as suas transações foram removidos do sistema.', 
        color: 'green' 
      });
      fetchPhysicalAssets();
    } catch (error) {
      // PHASE 3: Tratamento melhorado de erros
      const errorMessage = error.response?.data?.detail || 'Falha ao remover o bem.';
      notifications.show({ 
        title: 'Erro na Exclusão', 
        message: errorMessage, 
        color: 'red' 
      });
    }
  };

  const handleLiquidate = async (values) => {
    // Converter a data para formato ISO date string (YYYY-MM-DD)
    const formattedValues = {
      ...values,
      sale_date: values.sale_date instanceof Date 
        ? values.sale_date.toISOString().split('T')[0]
        : values.sale_date
    };

    try {
      await api.post(`/physical-assets/${liquidatingAsset.id}/liquidate`, formattedValues);
      notifications.show({
        title: 'Sucesso!',
        message: 'Bem liquidado com sucesso. A receita foi registrada.',
        color: 'green',
      });
      setLiquidateModalOpened(false);
      fetchPhysicalAssets();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: 'Falha ao liquidar o bem.',
        color: 'red',
      });
    }
  };
  
  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('pt-BR');

  // PHASE 3: Componente de Card para cada bem físico
  const renderAssetCard = (asset) => {
    const isActive = asset.status === 'ATIVO';
    
    return (
      <Card key={asset.id} withBorder radius="md" padding="lg" style={{ height: 'auto' }}>
        <Stack gap="sm">
          {/* Header com ícone da categoria e badge de status */}
          <Group justify="space-between" align="flex-start">
            <Group align="center">
              {asset.asset_icon_url ? (
                <Image
                  src={asset.asset_icon_url}
                  alt={asset.asset_class_name}
                  width={32}
                  height={32}
                  radius="sm"
                  fallbackSrc="https://img.icons8.com/material/32/treasure-chest.png"
                />
              ) : (
                <ThemeIcon size="lg" variant="light" color="blue">
                  <IconBuildingWarehouse size={20} />
                </ThemeIcon>
              )}
              <div>
                <Text size="xs" c="dimmed">{asset.asset_class_name}</Text>
                <Badge 
                  color={isActive ? 'green' : 'gray'} 
                  variant="light" 
                  size="sm"
                >
                  {asset.status}
                </Badge>
              </div>
            </Group>
            
            {/* Ações */}
            <Group gap="xs">
              <ActionIcon 
                color="blue" 
                variant="light" 
                onClick={() => openModal(asset)}
                size="sm"
              >
                <IconPencil size={16} />
              </ActionIcon>
              {isActive && (
                <ActionIcon 
                  color="green" 
                  variant="light" 
                  onClick={() => openLiquidateModal(asset)}
                  size="sm"
                >
                  <IconCurrencyDollar size={16} />
                </ActionIcon>
              )}
              <ActionIcon 
                color="red" 
                variant="light" 
                onClick={() => handleDelete(asset.id)}
                size="sm"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {/* Descrição do bem */}
          <div>
            <Text fw={600} size="sm" lineClamp={2} title={asset.description}>
              {asset.description}
            </Text>
          </div>

          <Divider />

          {/* Valores principais */}
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed">Valor Atual</Text>
              <Text fw={700} size="lg" c="blue">
                {formatCurrency(asset.current_value)}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Custo de Aquisição</Text>
              <Text fw={500} size="sm">
                {formatCurrency(asset.acquisition_cost)}
              </Text>
            </div>
          </Group>

          {/* Datas importantes */}
          <Group gap="sm" wrap="wrap">
            <Group gap="xs">
              <IconCalendar size={14} />
              <div>
                <Text size="xs" c="dimmed">Adquirido em</Text>
                <Text size="xs">{formatDate(asset.acquisition_date)}</Text>
              </div>
            </Group>
            {!isActive && (
              <Group gap="xs">
                <IconCalendar size={14} />
                <div>
                  <Text size="xs" c="dimmed">Vendido em</Text>
                  <Text size="xs">{formatDate(asset.last_valuation_date)}</Text>
                </div>
              </Group>
            )}
          </Group>
        </Stack>
      </Card>
    );
  };

  const columns = [
    {
      accessor: 'description',
      header: 'Descrição do Bem',
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (row) => <Text fw={500}>{row.description}</Text>
    },
    {
      accessor: 'asset_class_name',
      header: 'Categoria',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: assetClasses.map(ac => ({ value: ac.label, label: ac.label })),
    },
    {
      accessor: 'acquisition_cost',
      header: 'Custo de Aquisição',
      sortable: true,
      align: 'right',
      render: (row) => formatCurrency(row.acquisition_cost)
    },
    {
      accessor: 'current_value',
      header: 'Valor Atual (Mercado)',
      sortable: true,
      align: 'right',
      render: (row) => <Text fw={700} c="blue">{formatCurrency(row.current_value)}</Text>
    },
    {
      accessor: 'last_valuation_date',
      header: 'Última Avaliação',
      sortable: true,
      render: (row) => formatDate(row.last_valuation_date)
    },
    {
      accessor: 'actions',
      header: 'Ações',
      align: 'center',
      render: (row) => (
        <Group gap="xs" justify="center">
          <ActionIcon color="blue" variant="light" onClick={() => openModal(row)}><IconPencil size={16} /></ActionIcon>
          <ActionIcon color="green" variant="light" onClick={() => openLiquidateModal(row)}><IconCurrencyDollar size={16} /></ActionIcon>
          <ActionIcon color="red" variant="light" onClick={() => handleDelete(row.id)}><IconTrash size={16} /></ActionIcon>
        </Group>
      )
    }
  ];

  const totalPatrimonio = assets.reduce((sum, asset) => sum + parseFloat(asset.current_value), 0);
  const totalCustoAquisicao = assets.reduce((sum, asset) => sum + parseFloat(asset.acquisition_cost), 0);

  const footerCalculations = [
    {
      accessor: 'acquisition_cost',
      calculation: (data) => data.reduce((sum, item) => sum + parseFloat(item.acquisition_cost || 0), 0),
      formatFunction: formatCurrency,
      label: 'Total Custo Aquisição'
    },
    {
      accessor: 'current_value', 
      calculation: (data) => data.reduce((sum, item) => sum + parseFloat(item.current_value || 0), 0),
      formatFunction: formatCurrency,
      label: 'Total Valor Atual'
    }
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Patrimônio | Bens | Ativos Físicos</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => openModal()}>
          Adicionar Bem
        </Button>
      </Group>
      {/* <Text c="dimmed">Gerencie seus bens físicos como veículos, imóveis, eletrônicos e outros ativos de valor.</Text> */}

      <Card withBorder padding="md" radius="md">
        <Group>
            <IconBuildingWarehouse size={32} color="var(--mantine-color-blue-6)" />
            <div>
                <Text c="dimmed" size="xs">Valor Total do Patrimônio {statusFilter === 'ATIVO' ? 'Ativo' : statusFilter === 'VENDIDO' ? 'Vendido' : ''}</Text>
                <Text fw={700} size="xl">{formatCurrency(totalPatrimonio)}</Text>
            </div>
        </Group>
      </Card>
      
      {/* PHASE 3: Controles de filtro e visualização */}
      <Group justify="space-between" align="center">
        <Group>
          <Text size="sm" fw={500}>Status:</Text>
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { label: 'Ativos', value: 'ATIVO' },
              { label: 'Vendidos', value: 'VENDIDO' },
              { label: 'Todos', value: '' }
            ]}
            size="sm"
          />
        </Group>
        
        <Group>
          <Text size="sm" fw={500}>Visualização:</Text>
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            data={[
              { label: <IconLayoutGrid size={16} />, value: 'cards' },
              { label: <IconTable size={16} />, value: 'table' }
            ]}
            size="sm"
          />
        </Group>
      </Group>
      
      {/* PHASE 3: Renderização condicional baseada no modo de visualização */}
      {viewMode === 'cards' ? (
        <div>
          {loading ? (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} withBorder radius="md" padding="lg" style={{ height: 200 }}>
                  <Text c="dimmed">Carregando...</Text>
                </Card>
              ))}
            </SimpleGrid>
          ) : assets.length > 0 ? (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
              {assets.map(asset => renderAssetCard(asset))}
            </SimpleGrid>
          ) : (
            <Card withBorder padding="xl" radius="md" style={{ textAlign: 'center' }}>
              <Stack align="center" gap="sm">
                <IconBuildingWarehouse size={48} color="var(--mantine-color-gray-5)" />
                <Text size="lg" fw={500} c="dimmed">
                  {statusFilter === 'ATIVO' ? 'Nenhum bem ativo' : 
                   statusFilter === 'VENDIDO' ? 'Nenhum bem vendido' : 
                   'Nenhum bem cadastrado'}
                </Text>
                <Text size="sm" c="dimmed">
                  {statusFilter === 'ATIVO' || !statusFilter ? 'Adicione seu primeiro bem para compor seu patrimônio.' : 
                   'Nenhum bem foi vendido ainda.'}
                </Text>
                {(statusFilter === 'ATIVO' || !statusFilter) && (
                  <Button 
                    leftSection={<IconPlus size={16} />} 
                    onClick={() => openModal()}
                    mt="sm"
                  >
                    Adicionar Primeiro Bem
                  </Button>
                )}
              </Stack>
            </Card>
          )}
        </div>
      ) : (
        <div className="page-table-container">
          <AdvancedTable
              data={assets}
              columns={columns}
              loading={loading}
              emptyStateText={
                statusFilter === 'ATIVO' ? 'Nenhum bem ativo' : 
                statusFilter === 'VENDIDO' ? 'Nenhum bem vendido' : 
                'Nenhum bem cadastrado'
              }
              emptyStateDescription={
                statusFilter === 'ATIVO' || !statusFilter ? 'Adicione seu primeiro bem para compor seu patrimônio.' : 
                'Nenhum bem foi vendido ainda.'
              }
              footerCalculations={footerCalculations}
          />
        </div>
      )}

      <Modal 
        opened={modalOpened} 
        onClose={() => setModalOpened(false)} 
        title={editingAsset ? 'Editar Bem' : 'Adicionar Novo Bem'} 
        size="lg"
        zIndex={1000}
        overlayProps={{ backgroundOpacity: 0.5 }}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput label="Descrição do Bem" placeholder="Ex: Veículo Honda Civic EXL 2023" {...form.getInputProps('description')} required />
            <Select 
              label="Categoria" 
              placeholder={assetClasses.length === 0 ? "Carregando categorias..." : "Selecione uma categoria"} 
              data={assetClasses} 
              {...form.getInputProps('asset_id')} 
              required 
              withinPortal
              comboboxProps={{ zIndex: 1001 }}
              searchable
              disabled={assetClasses.length === 0}
            />
            {!editingAsset && (
              <Select 
                label="Conta de Origem" 
                placeholder={accounts.length === 0 ? "Carregando contas..." : "Selecione a conta de onde saiu o dinheiro"} 
                data={accounts} 
                {...form.getInputProps('source_account_id')} 
                required 
                withinPortal
                comboboxProps={{ zIndex: 1001 }}
                searchable
                disabled={accounts.length === 0}
              />
            )}
            <Group grow>
              <DatePickerInput 
                label="Data de Aquisição" 
                {...form.getInputProps('acquisition_date')} 
                required 
                withinPortal
                popoverProps={{ zIndex: 1001 }}
              />
              <NumberInput label="Custo de Aquisição" prefix="R$ " thousandSeparator="." decimalSeparator="," precision={2} {...form.getInputProps('acquisition_cost')} />
            </Group>
            <Group grow>
              <DatePickerInput 
                label="Data da Avaliação" 
                {...form.getInputProps('last_valuation_date')} 
                required 
                withinPortal
                popoverProps={{ zIndex: 1001 }}
              />
              <NumberInput label="Valor Atual de Mercado" prefix="R$ " thousandSeparator="." decimalSeparator="," precision={2} {...form.getInputProps('current_value')} required />
            </Group>
            <Textarea label="Notas (Opcional)" placeholder="Número de série, placa, observações..." {...form.getInputProps('notes')} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setModalOpened(false)}>Cancelar</Button>
              <Button type="submit">{editingAsset ? 'Salvar Alterações' : 'Adicionar Bem'}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal 
        opened={liquidateModalOpened} 
        onClose={() => setLiquidateModalOpened(false)} 
        title="Liquidar Bem" 
        size="md"
        zIndex={1000}
        overlayProps={{ backgroundOpacity: 0.5 }}
      >
        <form onSubmit={liquidateForm.onSubmit(handleLiquidate)}>
          <Stack>
            <Text c="dimmed" size="sm">
              Liquidando: <strong>{liquidatingAsset?.description}</strong>
            </Text>
            <NumberInput 
              label="Valor da Venda" 
              prefix="R$ " 
              thousandSeparator="." 
              decimalSeparator="," 
              precision={2} 
              {...liquidateForm.getInputProps('sale_value')} 
              required 
            />
            <Select 
              label="Conta de Destino" 
              placeholder={accounts.length === 0 ? "Carregando contas..." : "Para onde vai o dinheiro?"} 
              data={accounts} 
              {...liquidateForm.getInputProps('destination_account_id')} 
              required 
              withinPortal
              comboboxProps={{ zIndex: 1001 }}
              searchable
              disabled={accounts.length === 0}
            />
            <DatePickerInput 
              label="Data da Venda" 
              {...liquidateForm.getInputProps('sale_date')} 
              required 
              withinPortal
              popoverProps={{ zIndex: 1001 }}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setLiquidateModalOpened(false)}>Cancelar</Button>
              <Button type="submit" color="green">Liquidar Bem</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}