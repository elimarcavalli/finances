import React, { useState, useEffect } from 'react';
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
  Badge,
  ActionIcon,
  Avatar,
  Center,
  Card,
  ScrollArea
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconRefresh, IconPhoto } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import api from '../api';
import { AdvancedTable } from '../components/AdvancedTable';

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
  const [updatingStocksBR, setUpdatingStocksBR] = useState(false);
  const [updatingStocksUS, setUpdatingStocksUS] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageError, setImageError] = useState(false);

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
      icon_url: asset.icon_url || '',
      last_price_usdt: asset.last_price_usdt || '',
      last_price_brl: asset.last_price_brl || ''
    });
    setImagePreviewUrl(asset.icon_url || '');
    setImageError(false);
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
    setImagePreviewUrl('');
    setImageError(false);
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

  const updateStockPricesBulk = async (assetClass) => {
    const isUpdatingBR = assetClass === 'ACAO_BR';
    const setUpdatingState = isUpdatingBR ? setUpdatingStocksBR : setUpdatingStocksUS;
    
    setUpdatingState(true);
    
    // Circuit Breaker: contador de erros consecutivos
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10;
    
    try {
      // Buscar todos os assets da classe específica primeiro
      const assetsResponse = await api.get('/assets');
      const targetAssets = assetsResponse.data.assets.filter(asset => asset.asset_class === assetClass);
      
      if (targetAssets.length === 0) {
        notifications.show({
          title: 'Aviso',
          message: `Nenhum ativo da classe ${assetClass} encontrado`,
          color: 'yellow'
        });
        return;
      }
      
      let successCount = 0;
      let totalErrors = [];
      
      // Atualizar cada ativo individualmente com circuit breaker
      for (let i = 0; i < targetAssets.length; i++) {
        const asset = targetAssets[i];
        
        // Verificar se atingimos o limite de erros consecutivos
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          notifications.show({
            title: 'Processo Interrompido',
            message: `Muitas falhas consecutivas (${MAX_CONSECUTIVE_ERRORS}). Processo interrompido para evitar sobrecarga da API.`,
            color: 'red',
            autoClose: 8000
          });
          break;
        }
        
        try {
          const response = await api.post(`/assets/${asset.id}/update-price`);
          
          if (response.data.success) {
            successCount++;
            consecutiveErrors = 0; // Reset contador em caso de sucesso
            
            // Mostrar progresso a cada 5 sucessos ou no final
            if (successCount % 5 === 0 || i === targetAssets.length - 1) {
              notifications.show({
                title: 'Progresso',
                message: `${successCount}/${targetAssets.length} ações atualizadas com sucesso`,
                color: 'blue',
                autoClose: 2000
              });
            }
          } else {
            consecutiveErrors++;
            totalErrors.push(`${asset.symbol}: ${response.data.error || 'Erro desconhecido'}`);
          }
          
        } catch (error) {
          consecutiveErrors++;
          const errorMsg = error.response?.data?.detail || error.message || 'Erro de conexão';
          totalErrors.push(`${asset.symbol}: ${errorMsg}`);
          
          // Log do erro para debug
          console.warn(`Erro ao atualizar ${asset.symbol}:`, error);
        }
        
        // Delay pequeno entre requests para não sobrecarregar a API
        if (i < targetAssets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Relatório final
      if (successCount > 0) {
        notifications.show({
          title: 'Atualização Concluída!',
          message: `${successCount}/${targetAssets.length} ações atualizadas com sucesso`,
          color: 'green',
          autoClose: 5000
        });
      }
      
      if (totalErrors.length > 0) {
        notifications.show({
          title: 'Avisos',
          message: `${totalErrors.length} ações não puderam ser atualizadas. Verifique o console para detalhes.`,
          color: 'yellow',
          autoClose: 5000
        });
        console.warn('Erros na atualização:', totalErrors);
      }
      
      // Recarregar a lista
      fetchAssets();
      
    } catch (error) {
      console.error('Erro ao buscar ativos para atualização:', error);
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao buscar lista de ativos para atualização',
        color: 'red'
      });
    } finally {
      setUpdatingState(false);
    }
  };

  const updateStockPrice = async (assetId) => {
    setUpdatingAsset(assetId);
    try {
      const response = await api.post(`/assets/${assetId}/update-price`);
      
      notifications.show({
        title: 'Sucesso!',
        message: `Preço de ${response.data.symbol} atualizado: R$ ${response.data.price_brl.toFixed(2)}`,
        color: 'green',
        autoClose: 3000
      });
      
      // Recarregar a lista
      fetchAssets();
    } catch (error) {
      console.error('Erro ao atualizar preço da ação:', error);
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao atualizar preço da ação',
        color: 'red'
      });
    } finally {
      setUpdatingAsset(null);
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

  // Configuração das colunas para AdvancedTable
  const columns = [
    {
      accessor: 'symbol',
      header: 'Símbolo',
      sortable: true,
      filterable: true,
      filterType: 'text',
      filterPlaceholder: 'Filtrar por símbolo...',
      render: (row) => (
        <Group gap="sm">
          {row.icon_url ? (
            <Avatar src={row.icon_url} size="sm" radius="xl" />
          ) : (
            <Center style={{ width: 32, height: 32 }}>
              <Text size="xs" fw={600} color="dimmed">
                {row.symbol.slice(0, 2)}
              </Text>
            </Center>
          )}
          <Text fw={500} size="sm">{row.symbol}</Text>
        </Group>
      )
    },
    {
      accessor: 'name',
      header: 'Nome',
      sortable: true,
      filterable: true,
      filterType: 'text',
      filterPlaceholder: 'Filtrar por nome...',
      render: (row) => <Text size="sm">{row.name}</Text>
    },
    {
      accessor: 'asset_class',
      header: 'Classe',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: ASSET_CLASSES,
      render: (row) => (
        <Badge color={getAssetClassColor(row.asset_class)} variant="light" size="sm">
          {ASSET_CLASSES.find(ac => ac.value === row.asset_class)?.label || row.asset_class}
        </Badge>
      )
    },
    {
      accessor: 'price_api_identifier',
      header: 'ID CoinGecko',
      sortable: true,
      filterable: true,
      filterType: 'text',
      filterPlaceholder: 'Filtrar por ID...',
      render: (row) => <Text size="sm">{row.price_api_identifier || '-'}</Text>
    },
    {
      accessor: 'last_price_usdt',
      header: 'Preço (USDT)',
      sortable: true,
      filterable: false,
      align: 'right',
      render: (row) => <Text size="sm">{formatPrice(row.last_price_usdt, 'USD')}</Text>
    },
    {
      accessor: 'last_price_brl',
      header: 'Preço (BRL)',
      sortable: true,
      filterable: false,
      align: 'right',
      render: (row) => <Text size="sm">{formatPrice(row.last_price_brl, 'BRL')}</Text>
    },
    {
      accessor: 'last_price_updated_at',
      header: 'Última Atualização',
      sortable: true,
      filterable: false,
      render: (row) => <Text size="sm">{formatDate(row.last_price_updated_at)}</Text>
    },
    {
      accessor: 'actions',
      header: 'Ações',
      sortable: false,
      filterable: false,
      align: 'center',
      render: (row) => (
        <Group gap="xs">
          {row.asset_class === 'CRIPTO' && row.price_api_identifier && (
            <ActionIcon
              variant="light"
              color="green"
              loading={updatingAsset === row.id}
              onClick={() => updateAssetPrice(row.id)}
              disabled={updatingPrices}
              title="Atualizar preço cripto"
              size="sm"
            >
              <IconRefresh size={14} />
            </ActionIcon>
          )}
          {(row.asset_class === 'ACAO_BR' || row.asset_class === 'ACAO_US') && (
            <ActionIcon
              variant="light"
              color={row.asset_class === 'ACAO_BR' ? 'teal' : 'indigo'}
              loading={updatingAsset === row.id}
              onClick={() => updateStockPrice(row.id)}
              disabled={updatingStocksBR || updatingStocksUS}
              title={`Atualizar via ${row.asset_class === 'ACAO_BR' ? 'Alpha Vantage' : 'Finnhub'}`}
              size="sm"
            >
              <IconRefresh size={14} />
            </ActionIcon>
          )}
          <ActionIcon
            variant="light"
            color="blue"
            onClick={() => handleEdit(row)}
            size="sm"
          >
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="red"
            onClick={() => handleDelete(row.id)}
            size="sm"
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      )
    }
  ];


  return (
    <div className="page-with-advanced-table">
      <div className="page-header">
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
          <Button 
            variant="light" 
            color="teal"
            leftSection={<IconRefresh size={16} />} 
            onClick={() => updateStockPricesBulk('ACAO_BR')}
            loading={updatingStocksBR}
            disabled={updatingStocksUS}
          >
            Atualizar Ações (BR)
          </Button>
          <Button 
            variant="light" 
            color="indigo"
            leftSection={<IconRefresh size={16} />} 
            onClick={() => updateStockPricesBulk('ACAO_US')}
            loading={updatingStocksUS}
            disabled={updatingStocksBR}
          >
            Atualizar Ações (US)
          </Button>
          <Button 
            variant="light" 
            color="orange"
            leftSection={<IconPhoto size={16} />} 
            onClick={updateAllCryptoIcons}
            loading={updatingIcons}
            disabled={updatingPrices}
          >
            Atualizar Ícones
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openNewAssetModal}>
            Novo Ativo
          </Button>
        </Group>
      </Group>

      <div className="page-table-container">
        <AdvancedTable
          data={assets}
          columns={columns}
          emptyStateText={loading ? "Carregando ativos..." : "Nenhum ativo encontrado"}
          emptyStateDescription="Adicione seu primeiro ativo para começar"
        />
      </div>
    </div>

      <Modal
        opened={opened}
        onClose={() => {
          close();
          setImagePreviewUrl('');
          setImageError(false);
        }}
        title={editingAsset ? 'Editar Ativo' : 'Novo Ativo'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Group align="flex-end" gap="md">
              {(imagePreviewUrl || form.values.icon_url) && !imageError && (
                <Avatar 
                src={imagePreviewUrl || form.values.icon_url} 
                size="lg" 
                radius="md"
                onError={() => setImageError(true)}
                />
              )}
              {(imagePreviewUrl || form.values.icon_url) && imageError && (
                <Center style={{ width: 48, height: 48, border: '1px dashed #ccc', borderRadius: '8px' }}>
                  <Text size="xs" c="dimmed">Erro</Text>
                </Center>
              )}
              <TextInput
                label="Símbolo"
                placeholder="Ex: BTC, PETR4, AAPL"
                {...form.getInputProps('symbol')}
                required
                style={{ flex: 1 }}
              />
            </Group>
            
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
              description="URL da imagem do ativo - Preview será atualizado automaticamente"
              {...form.getInputProps('icon_url')}
              onChange={(event) => {
                const url = event.currentTarget.value;
                form.setFieldValue('icon_url', url);
                setImagePreviewUrl(url);
                setImageError(false);
              }}
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
              <Button variant="light" onClick={() => {
                close();
                setImagePreviewUrl('');
                setImageError(false);
              }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingAsset ? 'Atualizar' : 'Criar'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </div>
  );
}