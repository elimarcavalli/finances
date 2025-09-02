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
  Progress,
  ScrollArea,
  Avatar,
  Center,
  Menu,
  UnstyledButton,
  Popover,
  RangeSlider
} from '@mantine/core';
import { DatePickerInput, DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEye,
  IconTrendingUp,
  IconTrendingDown,
  IconCoins,
  IconAlertCircle,
  IconRefresh,
  IconReload,
  IconCheck,
  IconEdit,
  IconTrash,
  IconX,
  IconDeviceFloppy,
  IconFilter,
  IconSortAscending,
  IconSortDescending,
  IconPlus as IconPlusDecimal,
  IconMinus
} from '@tabler/icons-react';
import api from '../api';

const MOVEMENT_TYPES = [
  { value: 'COMPRA', label: 'Compra' },
  { value: 'VENDA', label: 'Venda' },
  { value: 'TRANSFERENCIA_ENTRADA', label: 'Transferência Entrada' },
  { value: 'TRANSFERENCIA_SAIDA', label: 'Transferência Saída' }
];

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
  const [reconcilingWallets, setReconcilingWallets] = useState(false);
  const [assetPrice, setAssetPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [savingMovement, setSavingMovement] = useState(false);
  const [priceCurrency, setPriceCurrency] = useState('BRL');
  const [usdtToBrlRate, setUsdtToBrlRate] = useState(null);
  const [editPriceCurrency, setEditPriceCurrency] = useState('BRL');
  
  // Estados para filtros e ordenação
  const [sortField, setSortField] = useState('market_value_brl');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({
    name: '',
    asset_class: '',
    market_value_range: [0, 0]
  });
  const [openedPopovers, setOpenedPopovers] = useState({});
  const [quantityPrecision, setQuantityPrecision] = useState(4);
  const [localMarketValueRange, setLocalMarketValueRange] = useState([0, 0]);

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
      console.log('[PORTFOLIO_PAGE] Carregando ativos...');
      const response = await api.get('/assets');
      
      console.log('[PORTFOLIO_PAGE] Resposta completa da API /assets:', response);
      console.log('[PORTFOLIO_PAGE] response.data:', response.data);
      
      // O endpoint retorna {"assets": [...]}
      const assetsData = response.data.assets || [];
      
      console.log('[PORTFOLIO_PAGE] Ativos recebidos:', assetsData);
      console.log('[PORTFOLIO_PAGE] Quantidade de ativos:', assetsData.length);
      
      setAssets(assetsData);
    } catch (err) {
      console.error('[PORTFOLIO_PAGE] Erro ao carregar ativos:', err);
      setError('Erro ao carregar lista de ativos');
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
    loadAccounts();
    loadAssets();
  }, [loadPortfolio, loadAccounts, loadAssets]);

  // Buscar taxa USDT/BRL quando necessário (modal de adicionar)
  useEffect(() => {
    if (priceCurrency === 'USDT' && modalOpened && !usdtToBrlRate) {
      fetchUsdtToBrlRate();
    }
  }, [priceCurrency, modalOpened, usdtToBrlRate]);

  // Buscar taxa USDT/BRL quando necessário (edição de movimento)
  useEffect(() => {
    if (editPriceCurrency === 'USDT' && editingMovement && !usdtToBrlRate) {
      fetchUsdtToBrlRate();
    }
  }, [editPriceCurrency, editingMovement, usdtToBrlRate]);

  // Monitorar mudanças no asset_id selecionado para buscar preço
  useEffect(() => {
    if (form.values.asset_id && modalOpened) {
      fetchAssetPrice(form.values.asset_id);
    } else {
      setAssetPrice(null);
    }
  }, [form.values.asset_id, modalOpened]);

  // Calcular o range máximo para o filtro de valor de mercado usando useMemo
  const maxMarketValue = React.useMemo(() => {
    return Math.max(...portfolio.map(p => Number(p.market_value_brl) || 0), 0);
  }, [portfolio]);

  // Sincronizar localMarketValueRange com filters.market_value_range
  useEffect(() => {
    setLocalMarketValueRange(filters.market_value_range);
  }, [filters.market_value_range]);

  // Atualizar o range máximo se necessário
  useEffect(() => {
    if (maxMarketValue > 0 && filters.market_value_range[1] === 0) {
      const newRange = [0, maxMarketValue];
      setFilters(prev => ({
        ...prev,
        market_value_range: newRange
      }));
      setLocalMarketValueRange(newRange);
    }
  }, [maxMarketValue, filters.market_value_range]);

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
        const matchesName = position.name.toLowerCase().includes(searchTerm);
        const matchesSymbol = position.symbol && position.symbol.toLowerCase().includes(searchTerm);
        
        if (!matchesName && !matchesSymbol) {
          return false;
        }
      }
      
      // Filtro por classe do ativo
      if (filters.asset_class && position.asset_class !== filters.asset_class) {
        return false;
      }
      
      // Filtro por valor de mercado (range)
      const marketValue = Number(position.market_value_brl) || 0;
      const [minValue, maxValue] = filters.market_value_range;
      if (maxValue > 0 && (marketValue < minValue || marketValue > maxValue)) {
        return false;
      }
      
      return true;
    });
  };

  const filteredAndSortedPortfolio = React.useMemo(() => {
    const filtered = applyFilters(portfolio);
    
    return filtered.sort((a, b) => {
      const aValue = a[sortField] || 0;
      const bValue = b[sortField] || 0;
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [portfolio, filters, sortField, sortDirection]);

  const clearFilters = () => {
    setFilters({
      name: '',
      asset_class: '',
      market_value_range: [0, maxMarketValue]
    });
    setOpenedPopovers({});
  };

  const hasActiveFilters = filters.name || filters.asset_class || 
    (filters.market_value_range[0] > 0 || filters.market_value_range[1] < maxMarketValue);

  const handleAddMovement = async (values) => {
    setLoading(true);
    try {
      let priceInBrl = values.price_per_unit;
      
      // Se o preço foi digitado em USDT, converter para BRL
      if (priceCurrency === 'USDT' && values.price_per_unit > 0) {
        let rate = usdtToBrlRate;
        
        if (!rate) {
          console.log('[CONVERSION] Taxa não está em cache, buscando...');
          rate = await fetchUsdtToBrlRate();
          if (!rate) {
            throw new Error('Não foi possível obter a taxa de conversão USDT/BRL. Verifique se o ativo USDT está cadastrado no sistema.');
          }
        }
        
        priceInBrl = values.price_per_unit * rate;
        console.log(`[CONVERSION] Preço em USDT: ${values.price_per_unit}, Taxa: ${rate}, Preço em BRL: ${priceInBrl}`);
      }

      const formattedData = {
        ...values,
        movement_date: values.movement_date.toISOString().split('T')[0],
        account_id: parseInt(values.account_id),
        asset_id: parseInt(values.asset_id),
        price_per_unit: priceInBrl // Sempre enviar em BRL
      };

      await api.post('/portfolio/movements', formattedData);
      setModalOpened(false);
      form.reset();
      setAssetPrice(null); // Limpar preço ao fechar modal
      setPriceCurrency('BRL'); // Resetar para BRL
      await loadPortfolio();
      
      notifications.show({
        title: 'Sucesso',
        message: priceCurrency === 'USDT' ? 
          `Movimento adicionado! Preço convertido de ${values.price_per_unit} USDT para ${formatCurrency(priceInBrl)}` :
          'Movimento adicionado com sucesso',
        color: 'green'
      });
      
    } catch (err) {
      console.error('Erro ao adicionar movimento:', err);
      notifications.show({
        title: 'Erro',
        message: err.message || 'Erro ao adicionar movimento',
        color: 'red'
      });
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

  const handleReprocessWallets = async () => {
    setReconcilingWallets(true);
    setError('');

    try {
      console.log('[PORTFOLIO_PAGE] Iniciando reprocessamento de carteiras...');
      
      // Filtrar apenas contas do tipo CARTEIRA_CRIPTO ou CORRETORA_CRIPTO
      // Alterar o filtro para incluir ambos os tipos
      // const cryptoWallets = accounts.filter(account => account.type === 'CARTEIRA_CRIPTO' && account.public_address);
      const cryptoWallets = accounts.filter(account => account.type === 'CARTEIRA_CRIPTO' || account.type === 'CORRETORA_CRIPTO');

      
      if (cryptoWallets.length === 0) {
        notifications.show({
          title: 'Nenhuma Carteira Encontrada',
          message: 'Não foram encontradas contas cripto para reprocessar',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

      console.log(`[PORTFOLIO_PAGE] Processando ${cryptoWallets.length} carteiras cripto:`, cryptoWallets);

      // Exibir feedback de progresso
      notifications.show({
        id: 'reconciliation-progress',
        title: 'Reprocessando Contas Cripto',
        message: `Processando ${cryptoWallets.length} conta(s) cripto... Sincronizando carteiras e atualizando preços.`,
        color: 'blue',
        autoClose: false,
        loading: true,
      });

      let successCount = 0;
      let errorCount = 0;

      // Processar cada carteira cripto
      for (const wallet of cryptoWallets) {
        try {
          console.log(`[PORTFOLIO_PAGE] Reconciliando carteira ${wallet.id}: ${wallet.name} (${wallet.public_address})`);
          
          const response = await api.post(`/portfolio/accounts/${wallet.id}/reconcile`);
          
          console.log(`[PORTFOLIO_PAGE] Reconciliação da carteira ${wallet.id} concluída:`, response.data);
          successCount++;
          
        } catch (walletError) {
          console.error(`[PORTFOLIO_PAGE] Erro na reconciliação da carteira ${wallet.id}:`, walletError);
          errorCount++;
        }
      }

      // Atualizar notificação de progresso
      notifications.update({
        id: 'reconciliation-progress',
        title: 'Reconciliação Concluída!',
        message: `${successCount} carteira(s) processada(s) com sucesso${errorCount > 0 ? `, ${errorCount} com erro(s)` : ''}`,
        color: errorCount > 0 ? 'yellow' : 'green',
        autoClose: 5000,
        loading: false,
      });

      // Recarregar dados do portfólio
      await loadPortfolio();
      
      // Feedback adicional de sucesso
      if (successCount > 0) {
        setTimeout(() => {
          notifications.show({
            title: 'Dados Atualizados!',
            message: `O portfólio foi atualizado com os dados mais recentes da blockchain`,
            color: 'green',
            autoClose: 4000,
          });
        }, 1000);
      }

    } catch (err) {
      console.error('[PORTFOLIO_PAGE] Erro geral no reprocessamento:', err);
      
      notifications.update({
        id: 'reconciliation-progress',
        title: 'Erro na Reconciliação',
        message: 'Ocorreu um erro durante o reprocessamento das carteiras. Tente novamente.',
        color: 'red',
        autoClose: 5000,
        loading: false,
      });
      
      setError('Erro durante reconciliação das carteiras');
    } finally {
      setReconcilingWallets(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar números com precisão específica
  const formatPrecisionNumber = (value, precision = 18) => {
    if (!value || value === 0) return '0';
    
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    
    // Se precision é específico (não o padrão 18), mostrar exatamente essa quantidade de casas decimais
    if (precision !== 18) {
      return num.toLocaleString('pt-BR', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      });
    }
    
    // Para o padrão (18), remover zeros à direita
    const formatted = num.toFixed(precision);
    return formatted.replace(/\.?0+$/, '');
  };

  // Função para buscar a taxa de conversão USDT para BRL
  const fetchUsdtToBrlRate = async () => {
    try {
      console.log('[USDT_RATE] Buscando taxa de conversão USDT/BRL...');
      // Buscar o preço do USDT na tabela assets
      const response = await api.get('/assets');
      console.log('[USDT_RATE] Resposta da API:', response.data);
      
      // A API retorna {"assets": assets}, então acessamos response.data.assets
      const assetsArray = response.data.assets || response.data;
      
      if (!Array.isArray(assetsArray)) {
        console.error('[USDT_RATE] Resposta não é um array:', assetsArray);
        return null;
      }
      
      const usdtAsset = assetsArray.find(asset => asset.symbol === 'USDT');
      console.log('[USDT_RATE] Asset USDT encontrado:', usdtAsset);
      
      if (usdtAsset && usdtAsset.last_price_brl) {
        const rate = parseFloat(usdtAsset.last_price_brl);
        console.log('[USDT_RATE] Taxa obtida:', rate);
        setUsdtToBrlRate(rate);
        return rate;
      }
      
      console.warn('[USDT_RATE] USDT não encontrado ou sem preço BRL');
      return null;
    } catch (error) {
      console.error('[USDT_RATE] Erro ao buscar taxa USDT/BRL:', error);
      return null;
    }
  };

  const formatPercentage = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getPercentageColor = (value) => {
    return value >= 0 ? 'green' : 'red';
  };


  const fetchAssetPrice = async (assetId) => {
    if (!assetId) {
      setAssetPrice(null);
      return;
    }

    setPriceLoading(true);
    try {
      const response = await api.get(`/assets/${assetId}/price`);
      setAssetPrice(response.data);
    } catch (error) {
      console.error('Erro ao buscar preço do ativo:', error);
      setAssetPrice(null);
    } finally {
      setPriceLoading(false);
    }
  };

  const getTotalPortfolioValue = () => {
    return portfolio.reduce((total, position) => {
      // Usar market_value_brl se disponível, senão market_value
      const value = position.market_value_brl || position.market_value || 0;
      return total + value;
    }, 0);
  };

  const getTotalUnrealizedPnL = () => {
    return portfolio.reduce((total, position) => total + (position.unrealized_pnl_brl || position.unrealized_pnl || 0), 0);
  };

  const startEditMovement = (movement) => {
    setEditingMovement(movement.id);
    setEditPriceCurrency('BRL'); // Sempre começar com BRL (valor do banco)
    setEditingValues({
      movement_date: movement.movement_date,
      movement_type: movement.movement_type,
      account_id: movement.account_id,
      quantity: movement.quantity,
      price_per_unit: movement.price_per_unit || '', // Valor em BRL do banco
      fee: movement.fee || '',
      notes: movement.notes || ''
    });
  };

  const cancelEditMovement = () => {
    setEditingMovement(null);
    setEditingValues({});
    setEditPriceCurrency('BRL');
  };

  const saveMovementChanges = async (movementId) => {
    setSavingMovement(true);
    try {
      const changedData = {};
      
      // Comparar com valores originais e só enviar o que mudou
      const originalMovement = selectedAssetHistory.find(m => m.id === movementId);
      
      Object.keys(editingValues).forEach(key => {
        let newValue = editingValues[key];
        let originalValue = originalMovement[key];
        
        // Normalizar valores para comparação
        if (key === 'movement_date') {
          originalValue = originalValue ? originalValue.split('T')[0] : '';
          newValue = newValue ? new Date(newValue).toISOString().split('T')[0] : '';
        } else if (['quantity', 'price_per_unit', 'fee'].includes(key)) {
          originalValue = originalValue || 0;
          newValue = parseFloat(newValue) || 0;
        } else if (key === 'account_id') {
          originalValue = parseInt(originalValue);
          newValue = parseInt(newValue);
        }
        
        if (newValue !== originalValue) {
          changedData[key] = newValue;
        }
      });

      if (Object.keys(changedData).length === 0) {
        cancelEditMovement();
        return;
      }

      // Variáveis para mensagem de conversão
      let wasConverted = false;
      let originalPriceInUsdt = null;

      // Se o preço mudou e está em USDT, converter para BRL
      if (changedData.price_per_unit && editPriceCurrency === 'USDT') {
        let rate = usdtToBrlRate;
        if (!rate) {
          rate = await fetchUsdtToBrlRate();
          if (!rate) {
            throw new Error('Não foi possível obter a taxa de conversão USDT/BRL');
          }
        }
        
        originalPriceInUsdt = changedData.price_per_unit;
        changedData.price_per_unit = originalPriceInUsdt * rate;
        wasConverted = true;
        console.log(`[EDIT_CONVERSION] Preço em USDT: ${originalPriceInUsdt}, Taxa: ${rate}, Preço em BRL: ${changedData.price_per_unit}`);
      }

      await api.put(`/portfolio/movements/${movementId}`, changedData);
      
      notifications.show({
        title: 'Sucesso',
        message: wasConverted ? 
          `Movimento atualizado! Preço convertido de ${originalPriceInUsdt} USDT para ${formatCurrency(changedData.price_per_unit)}` :
          'Movimento atualizado com sucesso',
        color: 'green'
      });

      // Recarregar histórico
      const response = await api.get(`/portfolio/assets/${selectedAssetHistory[0].asset_id}/movements`);
      setSelectedAssetHistory(response.data || []);
      
      cancelEditMovement();
      
    } catch (error) {
      console.error('Erro ao salvar movimento:', error);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível atualizar o movimento',
        color: 'red'
      });
    } finally {
      setSavingMovement(false);
    }
  };

  const deleteMovement = async (movementId) => {
    if (!confirm('Tem certeza que deseja deletar este movimento? Esta ação não pode ser desfeita.')) return;
    
    try {
      console.log('[DELETE] Deletando movimento:', movementId);
      const response = await api.delete(`/portfolio/movements/${movementId}`);
      console.log('[DELETE] Resposta do servidor:', response);
      
      notifications.show({
        title: 'Sucesso',
        message: 'Movimento deletado com sucesso',
        color: 'green'
      });

      // Cancelar edição se estava editando este movimento
      if (editingMovement === movementId) {
        setEditingMovement(null);
        setEditingValues({});
      }

      // Encontrar asset_id do movimento que está sendo deletado
      const movementToDelete = selectedAssetHistory.find(m => m.id === movementId);
      if (movementToDelete) {
        // Recarregar histórico usando o asset_id correto
        const historyResponse = await api.get(`/portfolio/assets/${movementToDelete.asset_id}/movements`);
        setSelectedAssetHistory(historyResponse.data || []);
        console.log('[DELETE] Histórico recarregado:', historyResponse.data);
      }
      
      // Recarregar portfólio também
      await loadPortfolio();
      
    } catch (error) {
      console.error('Erro ao deletar movimento:', error);
      console.error('Detalhes do erro:', error.response?.data);
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Não foi possível deletar o movimento',
        color: 'red'
      });
    }
  };

  const hasUnsavedChanges = (movementId) => {
    if (editingMovement !== movementId) return false;
    
    const originalMovement = selectedAssetHistory.find(m => m.id === movementId);
    if (!originalMovement) return false;
    
    return Object.keys(editingValues).some(key => {
      let newValue = editingValues[key];
      let originalValue = originalMovement[key];
      
      if (key === 'movement_date') {
        originalValue = originalValue ? originalValue.split('T')[0] : '';
        newValue = newValue ? new Date(newValue).toISOString().split('T')[0] : '';
      } else if (['quantity', 'price_per_unit', 'fee'].includes(key)) {
        originalValue = originalValue || 0;
        newValue = parseFloat(newValue) || 0;
      } else if (key === 'account_id') {
        originalValue = parseInt(originalValue);
        newValue = parseInt(newValue);
      }
      
      return newValue !== originalValue;
    });
  };

  const accountOptions = accounts.map(account => ({
    value: account.id.toString(),
    label: `${account.name} - ${account.institution || 'N/A'}`
  }));

  // Debug: Log dos assets antes de criar as options
  console.log('[PORTFOLIO_PAGE] Estado atual de assets:', assets);
  console.log('[PORTFOLIO_PAGE] assets é array?', Array.isArray(assets));
  
  const assetOptions = Array.isArray(assets)
    ? assets.map(asset => ({
        value: asset.id.toString(),
        label: `${asset.symbol} - ${asset.name}`
      }))
    : [];
  
  console.log('[PORTFOLIO_PAGE] assetOptions geradas:', assetOptions);

  if (loading && portfolio.length === 0) {
    return (
      <Stack gap="md" align="center" mt="xl">
        <Loader size="lg" />
        <Text>Carregando portfólio...</Text>
      </Stack>
    );
  }

  // Componentes de filtro
  const TextFilterMenu = ({ field, placeholder }) => {
    const isOpen = openedPopovers[field] || false;
    
    const togglePopover = (e) => {
      e.stopPropagation();
      setOpenedPopovers(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const closePopover = () => {
      setOpenedPopovers(prev => ({ ...prev, [field]: false }));
    };

    return (
      <Popover 
        width={200} 
        position="bottom-start" 
        withArrow 
        shadow="md"
        opened={isOpen}
        onChange={(opened) => {
          if (!opened) {
            setOpenedPopovers(prev => ({ ...prev, [field]: false }));
          }
        }}
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
          <div style={{ padding: '4px' }}>
            <TextInput
              placeholder={placeholder}
              value={filters[field]}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, [field]: e.target.value }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  closePopover();
                  e.target.blur();
                }
              }}
              size="xs"
              autoFocus
              rightSection={
                filters[field] && (
                  <ActionIcon 
                    size="xs" 
                    onClick={() => setFilters(prev => ({ ...prev, [field]: '' }))}
                  >
                    ✕
                  </ActionIcon>
                )
              }
            />
          </div>
        </Popover.Dropdown>
      </Popover>
    );
  };

  const ClassFilterMenu = () => (
    <Menu shadow="md" width={250}>
      <Menu.Target>
        <ActionIcon 
          variant="subtle" 
          size="sm"
          onClick={(e) => e.stopPropagation()}
          color={filters.asset_class ? 'blue' : 'gray'}
        >
          <IconFilter size={12} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item 
          onClick={() => setFilters(prev => ({ ...prev, asset_class: '' }))}
          rightSection={!filters.asset_class ? '✓' : ''}
        >
          Todas as classes
        </Menu.Item>
        {ASSET_CLASSES.map((assetClass) => (
          <Menu.Item 
            key={assetClass.value}
            onClick={() => setFilters(prev => ({ ...prev, asset_class: assetClass.value }))}
            rightSection={filters.asset_class === assetClass.value ? '✓' : ''}
          >
            {assetClass.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );

  const PrecisionControl = () => (
    <Group gap="xs">
      <ActionIcon 
        variant="subtle" 
        size="sm"
        onClick={() => setQuantityPrecision(Math.max(0, quantityPrecision - 1))}
        disabled={quantityPrecision <= 0}
      >
        <IconMinus size={12} />
      </ActionIcon>
      <ActionIcon 
        variant="subtle" 
        size="sm"
        onClick={() => setQuantityPrecision(Math.min(8, quantityPrecision + 1))}
        disabled={quantityPrecision >= 8}
      >
        <IconPlusDecimal size={12} />
      </ActionIcon>
    </Group>
  );

  const RangeFilterMenu = () => {
    
    return (
      <Popover width={300} position="bottom-start" withArrow shadow="md">
        <Popover.Target>
          <ActionIcon 
            variant="subtle" 
            size="sm"
            onClick={(e) => e.stopPropagation()}
            color={filters.market_value_range[0] > 0 || filters.market_value_range[1] < maxMarketValue ? 'blue' : 'gray'}
          >
            <IconFilter size={12} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <div style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
            <Text size="xs" mb="xs">Valor de Mercado</Text>
            <RangeSlider
              value={localMarketValueRange}
              onChange={setLocalMarketValueRange}
              onChangeEnd={(value) => setFilters(prev => ({ ...prev, market_value_range: value }))}
              min={0}
              max={maxMarketValue}
              step={maxMarketValue / 100}
              formatLabel={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
              size="sm"
            />
            <Group justify="space-between" mt="xs">
              <Text size="xs">R$ {localMarketValueRange[0].toLocaleString('pt-BR')}</Text>
              <Text size="xs">R$ {localMarketValueRange[1].toLocaleString('pt-BR')}</Text>
            </Group>
            <Group justify="space-between" mt="xs">
              <Button 
                size="xs" 
                variant="light"
                onClick={() => {
                  setLocalMarketValueRange([0, maxMarketValue]);
                  setFilters(prev => ({ ...prev, market_value_range: [0, maxMarketValue] }));
                }}
              >
                Limpar
              </Button>
            </Group>
          </div>
        </Popover.Dropdown>
      </Popover>
    );
  };

  const SortableHeader = ({ field, children, filterType = 'none', filterPlaceholder = '' }) => (
    <Group gap="xs" justify="flex-start" style={{ width: '100%' }}>
      {filterType === 'text' && <TextFilterMenu field={field} placeholder={filterPlaceholder} />}
      {filterType === 'class' && <ClassFilterMenu />}
      {filterType === 'precision' && <PrecisionControl />}
      {filterType === 'range' && <RangeFilterMenu />}
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

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Meu Portfólio</Title>
        <Group>
          <Button
            variant="light"
            color="green"
            leftSection={<IconReload size={16} />}
            onClick={handleReprocessWallets}
            loading={reconcilingWallets}
            disabled={loading}
          >
            Reprocessar Cripto
          </Button>
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
            onClick={() => {
              setModalOpened(true);
              setAssetPrice(null); // Limpar preço ao abrir modal
            }}
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

      {/* Indicador de filtros ativos */}
      {(filters.asset_name || filters.asset_class || (filters.market_value_range[0] > 0 || filters.market_value_range[1] < maxMarketValue)) && (
        <Group justify="center">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Filtros ativos: {filteredAndSortedPortfolio.length} de {portfolio.length} posições
            </Text>
            <Button 
              variant="light" 
              size="xs"
              onClick={() => {
                setFilters({ asset_name: '', asset_class: '', market_value_range: [0, maxMarketValue] });
                setOpenedPopovers({});
              }}
            >
              Limpar Filtros
            </Button>
          </Group>
        </Group>
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
        <ScrollArea style={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}>
          <Table striped highlightOnHover stickyHeader>
          <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#404040ff' }}>
            <Table.Tr>
              <Table.Th>
                <SortableHeader 
                  field="name" 
                  filterType="text" 
                  filterPlaceholder="Filtrar por ativo..."
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
                <SortableHeader 
                  field="quantity" 
                  filterType="precision"
                >
                  Quantidade
                </SortableHeader>
              </Table.Th>
              <Table.Th ta="right">
                <SortableHeader field="average_price_brl">
                  Preço Médio
                </SortableHeader>
              </Table.Th>
              <Table.Th ta="right">
                <SortableHeader field="current_price_brl">
                  Preço Atual
                </SortableHeader>
              </Table.Th>
              <Table.Th ta="right">
                <SortableHeader 
                  field="market_value_brl" 
                  filterType="range"
                >
                  Valor de Mercado
                </SortableHeader>
              </Table.Th>
              <Table.Th ta="right">
                <SortableHeader field="unrealized_pnl_percentage_brl">
                  P&L %
                </SortableHeader>
              </Table.Th>
              <Table.Th ta="right">
                <SortableHeader field="unrealized_pnl_brl">
                  P&L Valor
                </SortableHeader>
              </Table.Th>
              <Table.Th width={80}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredAndSortedPortfolio.length === 0 ? (
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
              filteredAndSortedPortfolio.map((position) => (
                <Table.Tr key={position.asset_id}>
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
                      <div>
                        <Text fw={500} size="sm">{position.symbol}</Text>
                        <Text size="xs" c="dimmed">{position.name}</Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {position.asset_class}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" family="monospace">
                      {formatPrecisionNumber(position.quantity, quantityPrecision)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">
                      {formatCurrency(position.average_price_brl || 0)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">
                      {formatCurrency(position.current_price_brl || 0)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text
                      c={getPercentageColor(position.unrealized_pnl_brl || position.unrealized_pnl)}
                      fw={500} size="sm">
                      {formatCurrency(position.market_value_brl || position.market_value || 0)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text
                      c={getPercentageColor(position.unrealized_pnl_percentage_brl || position.unrealized_pnl_percentage)}
                      fw={500}
                      size="sm"
                    >
                      {formatPercentage(position.unrealized_pnl_percentage_brl || position.unrealized_pnl_percentage)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text
                      c={getPercentageColor(position.unrealized_pnl_brl || position.unrealized_pnl)}
                      fw={500}
                      size="sm"
                    >
                      {formatCurrency(position.unrealized_pnl_brl || position.unrealized_pnl)}
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
          
          {/* Rodapé com Totalizadores dentro da mesma tabela */}
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
              {/* Coluna 1: Ativo */}
              <Table.Td>
                <Text size="sm" fw={600}>
                  {filteredAndSortedPortfolio.length} posições
                </Text>
              </Table.Td>
              {/* Coluna 2: Classe */}
              <Table.Td></Table.Td>
              {/* Coluna 3: Quantidade */}
              <Table.Td></Table.Td>
              {/* Coluna 4: Preço Médio */}
              <Table.Td></Table.Td>
              {/* Coluna 5: Preço Atual */}
              <Table.Td></Table.Td>
              {/* Coluna 6: Valor de Mercado */}
              <Table.Td ta="right">
                <Text size="sm" fw={600}>
                  {formatCurrency(
                    filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.market_value_brl || 0), 0)
                  )}
                </Text>
              </Table.Td>
              {/* Coluna 7: P&L % */}
              <Table.Td ta="right">
                <Text size="sm" fw={600} c={
                  (() => {
                    const totalMarketValue = filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.market_value_brl || 0), 0);
                    const totalPnl = filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.unrealized_pnl_brl || 0), 0);
                    const totalPercentage = totalMarketValue > 0 ? (totalPnl / (totalMarketValue - totalPnl)) * 100 : 0;
                    return totalPercentage >= 0 ? 'green' : 'red';
                  })()
                }>
                  {(() => {
                    const totalMarketValue = filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.market_value_brl || 0), 0);
                    const totalPnl = filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.unrealized_pnl_brl || 0), 0);
                    const totalPercentage = totalMarketValue > 0 ? (totalPnl / (totalMarketValue - totalPnl)) * 100 : 0;
                    return `${totalPercentage >= 0 ? '+' : ''}${totalPercentage.toFixed(2)}%`;
                  })()}
                </Text>
              </Table.Td>
              {/* Coluna 8: P&L Valor */}
              <Table.Td ta="right">
                <Text size="sm" fw={600} c={
                  filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.unrealized_pnl_brl || 0), 0) >= 0 
                    ? 'green' : 'red'
                }>
                  {formatCurrency(
                    filteredAndSortedPortfolio.reduce((sum, pos) => sum + (pos.unrealized_pnl_brl || 0), 0)
                  )}
                </Text>
              </Table.Td>
              {/* Coluna 9: Ações */}
              <Table.Td width={80}></Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
        </ScrollArea>
        
        {/* Botão Limpar Filtros */}
        {(filters.name || filters.asset_class || 
          (filters.market_value_range[0] > 0 || filters.market_value_range[1] < maxMarketValue)) && (
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

      {/* Modal de Adicionar Movimento */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setAssetPrice(null); // Limpar preço ao fechar modal
          setPriceCurrency('BRL'); // Resetar moeda para BRL
        }}
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

            {/* Ticker de Preço para Criptomoedas */}
            {assetPrice && assetPrice.price_available && assetPrice.asset_class === 'CRIPTO' && (
              <Paper withBorder p="md" radius="md" style={{ background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)' }}>
                <Group justify="space-between" align="center">
                  <Group gap="sm">
                    {assetPrice.icon_url && (
                      <img 
                        src={assetPrice.icon_url} 
                        alt={assetPrice.symbol}
                        width={32}
                        height={32}
                        style={{ borderRadius: '50%' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <Text c="white" fw={600} size="sm">
                        {assetPrice.symbol} - {assetPrice.name}
                      </Text>
                      <Group gap={4} align="center">
                        <Text c="white" size="xs" style={{ opacity: 0.8 }}>
                          Preço Atual (Tempo Real)
                        </Text>
                        {assetPrice.price_updated_in_db && (
                          <Badge color="green" size="xs" variant="light" leftSection={<IconCheck size={10} />}>
                            Sincronizado
                          </Badge>
                        )}
                      </Group>
                    </div>
                  </Group>
                  <div style={{ textAlign: 'right' }}>
                    <Text c="white" fw={700} size="lg">
                      {formatCurrency(assetPrice.current_price_brl)}
                    </Text>
                    <Text c="white" size="xs" style={{ opacity: 0.8 }}>
                      ${assetPrice.current_price_usd?.toFixed(6)}
                    </Text>
                  </div>
                </Group>
              </Paper>
            )}

            {/* Indicador de carregamento de preço */}
            {priceLoading && form.values.asset_id && (
              <Paper withBorder p="md" radius="md" style={{ background: '#f8f9fa' }}>
                <Group justify="center" align="center" gap="sm">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Buscando preço atual...</Text>
                </Group>
              </Paper>
            )}

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

            <NumberInput
              label="Quantidade"
              placeholder="0.000000000000000000"
              decimalScale={18}
              min={0}
              {...form.getInputProps('quantity')}
            />

            <Group grow>
              <NumberInput
                label="Preço por Unidade"
                placeholder="0.000000000000000000"
                decimalScale={18}
                min={0}
                {...form.getInputProps('price_per_unit')}
              />
              <Select
                label="Moeda"
                placeholder="Selecione a moeda"
                data={[
                  { 
                    value: 'BRL', 
                    label: '🇧🇷 BRL',
                  },
                  { 
                    value: 'USDT', 
                    label: '🇺🇸 USDT',
                  }
                ]}
                value={priceCurrency}
                onChange={(value) => setPriceCurrency(value)}
                allowDeselect={false}
                w={120}
              />
            </Group>

            {priceCurrency === 'USDT' && usdtToBrlRate && (
              <Alert color="blue" variant="light" mt="xs">
                <Text size="sm">
                  Taxa de conversão: 1 USDT = {formatCurrency(usdtToBrlRate)}
                  {form.values.price_per_unit > 0 && (
                    <> | Equivalente: {formatCurrency(form.values.price_per_unit * usdtToBrlRate)}</>
                  )}
                </Text>
              </Alert>
            )}

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
              <Button variant="light" onClick={() => {
                setModalOpened(false);
                setAssetPrice(null); // Limpar preço ao cancelar
                setPriceCurrency('BRL'); // Resetar moeda para BRL
              }}>
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
        <ScrollArea>
          <Stack gap="md">
            {selectedAssetHistory.map((movement) => (
              <Paper key={movement.id} p="md" withBorder radius="md" bg={editingMovement === movement.id ? "dark.8" : undefined}>
                <Grid gutter="md">
                  {/* Data */}
                  <Grid.Col span={6} sm={3}>
                    <Text size="xs" fw={500} c="dimmed" mb={4}>Data</Text>
                    {editingMovement === movement.id ? (
                      <DateInput
                        size="sm"
                        value={editingValues.movement_date ? new Date(editingValues.movement_date) : null}
                        onChange={(value) => setEditingValues(prev => ({
                          ...prev,
                          movement_date: value ? value.toISOString().split('T')[0] : ''
                        }))}
                        styles={{
                          input: {
                            backgroundColor: 'var(--mantine-color-dark-6)',
                            borderColor: 'var(--mantine-color-blue-4)',
                            color: 'var(--mantine-color-white)',
                          }
                        }}
                      />
                    ) : (
                      <Text size="sm">
                        {new Date(movement.movement_date).toLocaleDateString('pt-BR')}
                      </Text>
                    )}
                  </Grid.Col>

                  {/* Tipo */}
                  <Grid.Col span={6} sm={3}>
                    <Text size="xs" fw={500} c="dimmed" mb={4}>Tipo</Text>
                    {editingMovement === movement.id ? (
                      <Select
                        size="sm"
                        data={[
                          { value: 'COMPRA', label: 'COMPRA' },
                          { value: 'VENDA', label: 'VENDA' },
                          { value: 'TRANSFERENCIA_ENTRADA', label: 'TRANSFERÊNCIA ENTRADA' },
                          { value: 'TRANSFERENCIA_SAIDA', label: 'TRANSFERÊNCIA SAÍDA' },
                          { value: 'SINCRONIZACAO', label: 'SINCRONIZAÇÃO' }
                        ]}
                        value={editingValues.movement_type}
                        onChange={(value) => setEditingValues(prev => ({
                          ...prev,
                          movement_type: value
                        }))}
                        styles={{
                          input: {
                            backgroundColor: 'var(--mantine-color-dark-6)',
                            borderColor: 'var(--mantine-color-blue-4)',
                            color: 'var(--mantine-color-white)',
                          }
                        }}
                      />
                    ) : (
                      <Badge 
                        color={
                          movement.movement_type === 'COMPRA' ? 'green' :
                          movement.movement_type === 'VENDA' ? 'red' : 'blue'
                        }
                        variant="light"
                      >
                        {movement.movement_type}
                      </Badge>
                    )}
                  </Grid.Col>

                  {/* Conta */}
                  <Grid.Col span={12} sm={6}>
                    <Text size="xs" fw={500} c="dimmed" mb={4}>Conta</Text>
                    {editingMovement === movement.id ? (
                      <Select
                        size="sm"
                        data={accounts.map(acc => ({ value: acc.id.toString(), label: acc.name }))}
                        value={editingValues.account_id?.toString()}
                        onChange={(value) => setEditingValues(prev => ({
                          ...prev,
                          account_id: parseInt(value)
                        }))}
                        styles={{
                          input: {
                            backgroundColor: 'var(--mantine-color-dark-6)',
                            borderColor: 'var(--mantine-color-blue-4)',
                            color: 'var(--mantine-color-white)',
                          }
                        }}
                      />
                    ) : (
                      <Text size="sm">{movement.account_name}</Text>
                    )}
                  </Grid.Col>

                  {/* Quantidade */}
                  <Grid.Col span={6} sm={3}>
                    <Text size="xs" fw={500} c="dimmed" mb={4}>Quantidade</Text>
                    {editingMovement === movement.id ? (
                      <NumberInput
                        size="sm"
                        decimalScale={18}
                        min={0}
                        value={editingValues.quantity}
                        onChange={(value) => setEditingValues(prev => ({
                          ...prev,
                          quantity: value
                        }))}
                        styles={{
                          input: {
                            backgroundColor: 'var(--mantine-color-dark-6)',
                            borderColor: 'var(--mantine-color-blue-4)',
                            color: 'var(--mantine-color-white)',
                          }
                        }}
                      />
                    ) : (
                      <Text size="sm" family="monospace">
                        {formatPrecisionNumber(movement.quantity, quantityPrecision)}
                      </Text>
                    )}
                  </Grid.Col>

                  {/* Preço */}
                  <Grid.Col span={12} sm={6}>
                    <Text size="xs" fw={500} c="dimmed" mb={4}>Preço</Text>
                    {editingMovement === movement.id ? (
                      <Group grow>
                        <NumberInput
                          size="sm"
                          decimalScale={18}
                          min={0}
                          value={editingValues.price_per_unit}
                          onChange={(value) => setEditingValues(prev => ({
                            ...prev,
                            price_per_unit: value
                          }))}
                          styles={{
                            input: {
                              backgroundColor: 'var(--mantine-color-dark-6)',
                              borderColor: 'var(--mantine-color-blue-4)',
                              color: 'var(--mantine-color-white)',
                            }
                          }}
                        />
                        <Select
                          size="sm"
                          data={[
                            { value: 'BRL', label: '🇧🇷 BRL' },
                            { value: 'USDT', label: '🇺🇸 USDT' }
                          ]}
                          value={editPriceCurrency}
                          onChange={(value) => setEditPriceCurrency(value)}
                          allowDeselect={false}
                          w={120}
                          styles={{
                            input: {
                              backgroundColor: 'var(--mantine-color-dark-6)',
                              borderColor: 'var(--mantine-color-blue-4)',
                              color: 'var(--mantine-color-white)',
                            }
                          }}
                        />
                      </Group>
                    ) : (
                      <Text size="sm">
                        {movement.price_per_unit ? formatCurrency(movement.price_per_unit) : '-'}
                      </Text>
                    )}
                  </Grid.Col>

                  {/* Alert de conversão para edição */}
                  {editingMovement === movement.id && editPriceCurrency === 'USDT' && usdtToBrlRate && (
                    <Grid.Col span={12}>
                      <Alert color="blue" variant="light" size="sm">
                        <Text size="sm">
                          Taxa de conversão: 1 USDT = {formatCurrency(usdtToBrlRate)}
                          {editingValues.price_per_unit > 0 && (
                            <> | Equivalente: {formatCurrency(editingValues.price_per_unit * usdtToBrlRate)}</>
                          )}
                        </Text>
                      </Alert>
                    </Grid.Col>
                  )}

                  {/* Taxa */}
                  <Grid.Col span={6} sm={3}>
                    <Text size="xs" fw={500} c="dimmed" mb={4}>Taxa</Text>
                    {editingMovement === movement.id ? (
                      <NumberInput
                        size="sm"
                        decimalScale={2}
                        min={0}
                        value={editingValues.fee}
                        onChange={(value) => setEditingValues(prev => ({
                          ...prev,
                          fee: value
                        }))}
                        styles={{
                          input: {
                            backgroundColor: 'var(--mantine-color-dark-6)',
                            borderColor: 'var(--mantine-color-blue-4)',
                            color: 'var(--mantine-color-white)',
                          }
                        }}
                      />
                    ) : (
                      <Text size="sm">
                        {movement.fee ? formatCurrency(movement.fee) : '-'}
                      </Text>
                    )}
                  </Grid.Col>

                  {/* Observações */}
                  <Grid.Col span={12} sm={3}>
                    <Text size="xs" fw={500} c="dimmed" mb={4}>Observações</Text>
                    {editingMovement === movement.id ? (
                      <TextInput
                        size="sm"
                        value={editingValues.notes || ''}
                        onChange={(event) => setEditingValues(prev => ({
                          ...prev,
                          notes: event.currentTarget.value
                        }))}
                        styles={{
                          input: {
                            backgroundColor: 'var(--mantine-color-dark-6)',
                            borderColor: 'var(--mantine-color-blue-4)',
                            color: 'var(--mantine-color-white)',
                          }
                        }}
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                        {movement.notes || '-'}
                      </Text>
                    )}
                  </Grid.Col>

                  {/* Ações */}
                  <Grid.Col span={12}>
                    <Group justify="flex-end" mt="sm">
                      {editingMovement === movement.id ? (
                        <>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => cancelEditMovement()}
                            size="sm"
                          >
                            <IconX size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="filled"
                            color="blue"
                            onClick={() => saveMovementChanges(movement.id)}
                            disabled={!hasUnsavedChanges(movement.id)}
                            loading={savingMovement}
                            size="sm"
                          >
                            <IconDeviceFloppy size={16} />
                          </ActionIcon>
                        </>
                      ) : (
                        <>
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => startEditMovement(movement)}
                            size="sm"
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => deleteMovement(movement.id)}
                            size="sm"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  </Grid.Col>
                </Grid>
              </Paper>
            ))}

            {selectedAssetHistory.length === 0 && (
              <Paper p="xl" ta="center">
                <Text c="dimmed">Nenhum movimento encontrado para este ativo.</Text>
              </Paper>
            )}
          </Stack>
        </ScrollArea>
      </Modal>
    </Stack>
  );
}