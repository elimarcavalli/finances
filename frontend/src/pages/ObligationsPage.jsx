import React, { useState, useEffect, useCallback } from 'react';
import { 
  Title, 
  Button, 
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
  SegmentedControl,
  Loader,
  ScrollArea,
  Paper,
  Flex,
  Container,
  Grid,
  Textarea,
  Card,
  Switch,
  Autocomplete
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, 
  IconPencil, 
  IconTrash, 
  IconAlertCircle,
  IconCurrencyReal,
  IconCalendar,
  IconCheck,
  IconX,
  IconClock,
  IconRepeat,
  IconTrendingUp,
  IconTrendingDown,
  IconFilter,
  IconChartPie,
  IconArrowRight
} from '@tabler/icons-react';
import api from '../api';
import { AdvancedTable } from '../components/AdvancedTable';

export function ObligationsPage() {
  // Estados principais
  const [obligations, setObligations] = useState([]);
  const [recurringRules, setRecurringRules] = useState([]);
  const [recurringRulesStatus, setRecurringRulesStatus] = useState({}); // Armazena status de liquidação
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PAYABLE');
  
  // Filtros e resumo financeiro
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [financialSummary, setFinancialSummary] = useState({
    payable_next_30d: 0,
    receivable_next_30d: 0
  });
  
  // Estados dos modais
  const [obligationModalOpened, setObligationModalOpened] = useState(false);
  const [recurringModalOpened, setRecurringModalOpened] = useState(false);
  const [settleModalOpened, setSettleModalOpened] = useState(false);
  const [cancelModalOpened, setCancelModalOpened] = useState(false);
  const [editingObligation, setEditingObligation] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [settlingItem, setSettlingItem] = useState(null); // Pode ser obligation ou recurring rule
  const [cancelingObligation, setCancelingObligation] = useState(null);
  
  const [error, setError] = useState('');

  // Estados para Autocomplete no modal de liquidação
  const [fromAccountValue, setFromAccountValue] = useState('');
  const [toAccountValue, setToAccountValue] = useState('');

  // Form para obrigações
  const obligationForm = useForm({
    initialValues: {
      description: '',
      amount: 0,
      due_date: new Date(),
      type: 'PAYABLE',
      category: '',
      entity_name: '',
      notes: '',
      status: 'PENDING',
      linked_transaction_id: '',
      recurring_rule_id: ''
    }
  });

  // Form para regras de recorrência
  const recurringForm = useForm({
    initialValues: {
      description: '',
      amount: 0,
      type: 'PAYABLE',
      category: '',
      entity_name: '',
      frequency: 'MONTHLY',
      interval_value: 1,
      start_date: new Date(),
      end_date: null,
      is_active: true,
      from_account_id: '',
      to_account_id: ''
    }
  });

  // Form para liquidação
  const settleForm = useForm({
    initialValues: {
      from_account_id: '',
      to_account_id: '',
      settlement_date: null
    },
    validate: {
      from_account_id: (value, values) => (!value && !values.to_account_id ? 'Pelo menos uma conta é obrigatória' : null),
      to_account_id: (value, values) => (!value && !values.from_account_id ? 'Pelo menos uma conta é obrigatória' : null),
      settlement_date: (value) => (!value ? 'Data de liquidação é obrigatória' : null)
    }
  });


  const loadObligations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      
      const response = await api.get(`/obligations?${params.toString()}`);
      setObligations(response.data.obligations || []);
    } catch (error) {
      console.error('Error loading obligations:', error);
      setError('Erro ao carregar obrigações');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadRecurringRules = useCallback(async () => {
    try {
      const response = await api.get('/recurring-rules');
      const rules = response.data.rules || [];
      setRecurringRules(rules);
      
      // Buscar status de liquidação para cada regra
      const statusPromises = rules.map(async (rule) => {
        try {
          const statusResponse = await api.get(`/recurring-rules/${rule.id}/last-liquidation`);
          return { ruleId: rule.id, ...statusResponse.data };
        } catch (error) {
          console.error(`Error fetching status for rule ${rule.id}:`, error);
          return { ruleId: rule.id, last_liquidation_date: null, can_reverse: false };
        }
      });
      
      const statusResults = await Promise.all(statusPromises);
      const statusMap = {};
      statusResults.forEach(status => {
        statusMap[status.ruleId] = status;
      });
      setRecurringRulesStatus(statusMap);
      
    } catch (error) {
      console.error('Error loading recurring rules:', error);
      setError('Erro ao carregar regras de recorrência');
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setError('Erro ao carregar contas');
    }
  }, []);

  const loadFinancialSummary = useCallback(async () => {
    try {
      const response = await api.get('/obligations/summary');
      setFinancialSummary(response.data);
    } catch (error) {
      console.error('Error loading financial summary:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadObligations(),
        loadRecurringRules(),
        loadAccounts(),
        loadFinancialSummary()
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [loadObligations, loadRecurringRules, loadAccounts, loadFinancialSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recarregar obrigações quando o filtro de status mudar
  useEffect(() => {
    if (!isLoading) {
      loadObligations();
    }
  }, [statusFilter, isLoading, loadObligations]);

  const handleCreateObligation = async (values) => {
    try {
      setLoading(true);
      
      // Limpar campos vazios e formatar dados para evitar problemas no backend
      const cleanedValues = { ...values };
      if (cleanedValues.linked_transaction_id === '') {
        cleanedValues.linked_transaction_id = null;
      }
      if (cleanedValues.recurring_rule_id === '') {
        cleanedValues.recurring_rule_id = null;
      }
      
      // Formatar data corretamente (Date object -> YYYY-MM-DD string)
      if (cleanedValues.due_date instanceof Date) {
        cleanedValues.due_date = cleanedValues.due_date.toISOString().split('T')[0];
      }
      
      if (editingObligation) {
        await api.put(`/obligations/${editingObligation.id}`, cleanedValues);
        notifications.show({
          title: 'Sucesso',
          message: 'Obrigação atualizada com sucesso',
          color: 'green'
        });
      } else {
        await api.post('/obligations', cleanedValues);
        notifications.show({
          title: 'Sucesso',
          message: 'Obrigação criada com sucesso',
          color: 'green'
        });
      }
      
      setObligationModalOpened(false);
      obligationForm.reset();
      setEditingObligation(null);
      await loadData();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao salvar obrigação',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecurringRule = async (values) => {
    try {
      setLoading(true);
      
      // Formatar datas corretamente (Date object -> YYYY-MM-DD string)
      const cleanedValues = { ...values };
      if (cleanedValues.start_date instanceof Date) {
        cleanedValues.start_date = cleanedValues.start_date.toISOString().split('T')[0];
      }
      if (cleanedValues.end_date instanceof Date) {
        cleanedValues.end_date = cleanedValues.end_date.toISOString().split('T')[0];
      } else if (cleanedValues.end_date === '' || cleanedValues.end_date === null) {
        cleanedValues.end_date = null;
      }
      
      // Debug simplificado
      console.log('Recurring rule update:', {
        id: editingRule?.id,
        accounts: {
          from: cleanedValues.from_account_id,
          to: cleanedValues.to_account_id
        }
      });
      
      if (editingRule) {
        await api.put(`/recurring-rules/${editingRule.id}`, cleanedValues);
        notifications.show({
          title: 'Sucesso',
          message: 'Regra de recorrência atualizada com sucesso',
          color: 'green'
        });
      } else {
        await api.post('/recurring-rules', cleanedValues);
        notifications.show({
          title: 'Sucesso',
          message: 'Regra de recorrência criada com sucesso',
          color: 'green'
        });
      }
      
      setRecurringModalOpened(false);
      recurringForm.reset();
      setEditingRule(null);
      await loadData();
    } catch (error) {
      console.error('Recurring rule save error:', error.response?.data);
      
      let errorMessage = 'Erro ao salvar regra de recorrência';
      
      // Tratamento específico para diferentes tipos de erro
      if (error.response?.status === 400) {
        if (error.response.data?.detail?.includes('Conta')) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data?.detail?.includes('Update failed')) {
          errorMessage = 'Falha na atualização. Verifique os dados e tente novamente.';
        } else if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
        } else {
          errorMessage = 'Dados inválidos. Verifique se todos os campos estão preenchidos corretamente.';
        }
      } else if (error.response?.status === 404) {
        errorMessage = 'Regra de recorrência não encontrada';
      } else if (error.response?.status === 401) {
        errorMessage = 'Sessão expirada. Faça login novamente.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      notifications.show({
        title: 'Erro',
        message: errorMessage,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSettleItem = async (values) => {
    try {
      setLoading(true);
      
      // Validações robustas
      if (!values.from_account_id && !values.to_account_id) {
        notifications.show({
          title: 'Erro',
          message: 'É obrigatório informar pelo menos uma conta (origem ou destino)',
          color: 'red'
        });
        return;
      }
      
      if (!values.settlement_date) {
        notifications.show({
          title: 'Erro', 
          message: 'Data de liquidação é obrigatória',
          color: 'red'
        });
        return;
      }
      
      // Formatar os dados corretamente - apenas enviar campos preenchidos
      const formattedData = {};
      
      if (values.from_account_id) {
        formattedData.from_account_id = parseInt(values.from_account_id);
      }
      
      if (values.to_account_id) {
        formattedData.to_account_id = parseInt(values.to_account_id);
      }
      
      formattedData.settlement_date = values.settlement_date instanceof Date 
        ? values.settlement_date.toISOString().split('T')[0] 
        : (values.settlement_date || new Date().toISOString().split('T')[0]);
      
      // Detectar se é obligation ou recurring rule
      const isRecurringRule = settlingItem.hasOwnProperty('frequency');
      const endpoint = isRecurringRule 
        ? `/recurring-rules/${settlingItem.id}/liquidate`
        : `/obligations/${settlingItem.id}/settle`;
      
      console.log('Settlement data:', formattedData);
      console.log('Endpoint:', endpoint);
      
      await api.post(endpoint, formattedData);
      
      notifications.show({
        title: 'Sucesso',
        message: isRecurringRule ? 'Recorrência liquidada com sucesso' : 'Obrigação liquidada com sucesso',
        color: 'green'
      });
      
      setSettleModalOpened(false);
      settleForm.reset();
      setSettlingItem(null);
      await loadData();
    } catch (error) {
      console.error('Settlement error:', error.response?.data);
      
      let errorMessage = 'Erro ao liquidar';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 422) {
        errorMessage = 'Dados inválidos para liquidação. Verifique se todos os campos estão preenchidos corretamente.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos. Verifique se as contas selecionadas são válidas.';
      }
      
      notifications.show({
        title: 'Erro',
        message: errorMessage,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSettlement = async () => {
    try {
      setLoading(true);
      
      await api.delete(`/obligations/${cancelingObligation.id}/cancel-settlement`);
      
      notifications.show({
        title: 'Sucesso',
        message: 'Liquidação cancelada com sucesso',
        color: 'green'
      });
      
      setCancelModalOpened(false);
      setCancelingObligation(null);
      await loadData();
    } catch (error) {
      console.error('Cancel settlement error:', error.response?.data);
      
      let errorMessage = 'Erro ao cancelar liquidação';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      notifications.show({
        title: 'Erro',
        message: errorMessage,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };




  const handleDeleteObligation = async (obligationId) => {
    try {
      await api.delete(`/obligations/${obligationId}`);
      notifications.show({
        title: 'Sucesso',
        message: 'Obrigação excluída com sucesso',
        color: 'green'
      });
      await loadData();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao excluir obrigação',
        color: 'red'
      });
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await api.delete(`/recurring-rules/${ruleId}`);
      notifications.show({
        title: 'Sucesso',
        message: 'Regra excluída com sucesso',
        color: 'green'
      });
      await loadData();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao excluir regra',
        color: 'red'
      });
    }
  };

  const openEditObligation = (obligation) => {
    setEditingObligation(obligation);
    obligationForm.setValues({
      ...obligation,
      due_date: new Date(obligation.due_date),
      status: obligation.status || 'PENDING',
      linked_transaction_id: obligation.linked_transaction_id || '',
      recurring_rule_id: obligation.recurring_rule_id || ''
    });
    setObligationModalOpened(true);
  };

  const openEditRule = (rule) => {
    setEditingRule(rule);
    recurringForm.setValues({
      ...rule,
      start_date: new Date(rule.start_date),
      end_date: rule.end_date ? new Date(rule.end_date) : null,
      from_account_id: rule.from_account_id ? rule.from_account_id.toString() : '',
      to_account_id: rule.to_account_id ? rule.to_account_id.toString() : ''
    });
    setRecurringModalOpened(true);
  };

  const openSettleModal = (item) => {
    setSettlingItem(item);
    
    // Pré-popular contas se é recurring rule com contas definidas
    const isRecurringRule = item.hasOwnProperty('frequency');
    let fromAccountId = '';
    let toAccountId = '';
    let suggestedDate = null;
    
    if (isRecurringRule) {
      // Usar contas pré-definidas da recurring rule
      fromAccountId = item.from_account_id ? item.from_account_id.toString() : '';
      toAccountId = item.to_account_id ? item.to_account_id.toString() : '';
      
      // Atualizar valores dos Autocompletes
      const fromAccount = accounts.find(acc => acc.id.toString() === fromAccountId);
      const toAccount = accounts.find(acc => acc.id.toString() === toAccountId);
      setFromAccountValue(fromAccount ? fromAccount.name : '');
      setToAccountValue(toAccount ? toAccount.name : '');
      
      // Calcular data sugerida baseada na start_date
      if (item.start_date) {
        const startDate = new Date(item.start_date);
        const today = new Date();
        const suggestedDateObj = new Date(today.getFullYear(), today.getMonth(), startDate.getDate());
        
        // Se o dia não existe no mês atual, usar último dia do mês
        if (suggestedDateObj.getMonth() !== today.getMonth()) {
          suggestedDateObj.setDate(0); // Último dia do mês anterior (atual)
        }
        
        suggestedDate = suggestedDateObj;
      }
    } else {
      // Para obligations, usar due_date como base para data sugerida
      if (item.due_date) {
        const dueDate = new Date(item.due_date);
        const today = new Date();
        const suggestedDateObj = new Date(today.getFullYear(), today.getMonth(), dueDate.getDate());
        
        // Se o dia não existe no mês atual, usar último dia do mês
        if (suggestedDateObj.getMonth() !== today.getMonth()) {
          suggestedDateObj.setDate(0);
        }
        
        suggestedDate = suggestedDateObj;
      }
    }
    
    settleForm.setValues({
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      settlement_date: suggestedDate
    });
    setSettleModalOpened(true);
  };

  const handleRevertSettlement = async (obligationId) => {
    if (!confirm('Tem certeza que deseja estornar esta liquidação?')) return;
    
    // setLoading(true);
    // try {
    //   await api.post(`/obligations/${obligationId}/revert`);
    //   notifications.show({
    //     title: 'Sucesso',
    //     message: 'Liquidação estornada com sucesso',
    //     color: 'green'
    //   });
    //   await loadData();
    // } catch (error) {
    //   notifications.show({
    //     title: 'Erro',
    //     message: error.response?.data?.detail || 'Erro ao estornar liquidação',
    //     color: 'red'
    //   });
    // } finally {
    //   setLoading(false);
    // }
    
    try {
      setLoading(true);
      
      await api.delete(`/obligations/${obligationId}/cancel-settlement`);
      
      notifications.show({
        title: 'Sucesso',
        message: 'Liquidação cancelada com sucesso',
        color: 'green'
      });
      
      setCancelModalOpened(false);
      setCancelingObligation(null);
      await loadData();
    } catch (error) {
      console.error('Cancel settlement error:', error.response?.data);
      
      let errorMessage = 'Erro ao cancelar liquidação';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      notifications.show({
        title: 'Erro',
        message: errorMessage,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReverseRecurringRule = async (ruleId) => {
    if (!confirm('Tem certeza que deseja estornar a última liquidação desta regra?')) return;
    
    setLoading(true);
    try {
      await api.post(`/recurring-rules/${ruleId}/reverse`);
      notifications.show({
        title: 'Sucesso',
        message: 'Liquidação da regra estornada com sucesso',
        color: 'green'
      });
      await loadData();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao estornar liquidação da regra',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      PENDING: 'yellow',
      PAID: 'green',
      OVERDUE: 'red'
    };
    
    const labels = {
      PENDING: 'Pendente',
      PAID: 'Pago',
      OVERDUE: 'Vencido'
    };

    return <Badge color={colors[status]}>{labels[status]}</Badge>;
  };

  const getTypeIcon = (type) => {
    if (type === 'PAYABLE') {
      return <IconCurrencyReal color="red" size={16} />;
    } else if (type === 'RECEIVABLE') {
      return <IconCurrencyReal color="green" size={16} />;
    } else if (type === 'TRANSFERENCIA') {
      return <IconArrowRight color="blue" size={16} />;
    }
    return <IconCurrencyReal color="gray" size={16} />;
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Configurações das colunas para as 3 tabelas
  const obligationsColumns = [
    {
      accessor: 'due_date',
      header: 'Vencimento',
      sortable: true,
      filterable: false,
      render: (row) => (
        <Text size="sm">
          {new Date(row.due_date).toLocaleDateString('pt-BR')}
        </Text>
      )
    },
    {
      accessor: 'description',
      header: 'Descrição',
      sortable: true,
      filterable: true,
      filterType: 'text',
      filterPlaceholder: 'Filtrar descrição...',
      render: (row) => (
        <Group gap="sm">
          {getTypeIcon(row.type)}
          <Text size="sm">{row.description}</Text>
        </Group>
      )
    },
    {
      accessor: 'entity_name',
      header: 'Entidade',
      sortable: true,
      filterable: true,
      filterType: 'text',
      filterPlaceholder: 'Filtrar entidade...',
      render: (row) => <Text size="sm">{row.entity_name || '-'}</Text>
    },
    {
      accessor: 'category',
      header: 'Categoria',
      sortable: true,
      filterable: true,
      filterType: 'text',
      filterPlaceholder: 'Filtrar categoria...',
      render: (row) => <Text size="sm">{row.category || '-'}</Text>
    },
    {
      accessor: 'amount',
      header: 'Valor',
      sortable: true,
      filterable: false,
      align: 'right',
      render: (row) => (
        <Text size="sm" fw={500} c={row.type === 'PAYABLE' ? 'red' : row.type === 'RECEIVABLE' ? 'green' : 'blue'}>
          {formatCurrency(row.amount)}
        </Text>
      )
    },
    {
      accessor: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'PENDING', label: 'Pendente' },
        { value: 'PAID', label: 'Pago' },
        { value: 'OVERDUE', label: 'Vencido' }
      ],
      render: (row) => getStatusBadge(row.status)
    },
    {
      accessor: 'actions',
      header: 'Ações',
      sortable: false,
      filterable: false,
      align: 'center',
      render: (row) => (
        <Group gap="xs">
          {row.status === 'PENDING' && (
            <ActionIcon
              variant="light"
              color="green"
              onClick={() => openSettleModal(row)}
              title="Liquidar"
              size="sm"
            >
              <IconCheck size={14} />
            </ActionIcon>
          )}
          {row.status === 'PAID' && (
            <ActionIcon
              variant="light"
              color="orange"
              onClick={() => handleRevertSettlement(row.id)}
              title="Estornar Liquidação"
              size="sm"
            >
              <IconX size={14} />
            </ActionIcon>
          )}
          <ActionIcon
            variant="light"
            color="blue"
            onClick={() => openEditObligation(row)}
            size="sm"
          >
            <IconPencil size={14} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="red"
            onClick={() => handleDeleteObligation(row.id)}
            size="sm"
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      )
    }
  ];

  const recurringRulesColumns = [
    {
      accessor: 'description',
      header: 'Descrição',
      sortable: true,
      filterable: true,
      filterType: 'text',
      filterPlaceholder: 'Filtrar descrição...',
      render: (row) => (
        <Group gap="sm">
          {getTypeIcon(row.type)}
          <Text size="sm">{row.description}</Text>
        </Group>
      )
    },
    {
      accessor: 'entity_name',
      header: 'Entidade',
      sortable: true,
      filterable: true,
      filterType: 'text',
      filterPlaceholder: 'Filtrar entidade...',
      render: (row) => <Text size="sm">{row.entity_name || '-'}</Text>
    },
    {
      accessor: 'amount',
      header: 'Valor',
      sortable: true,
      filterable: false,
      align: 'right',
      render: (row) => (
        <Text size="sm" fw={500} c={row.type === 'PAYABLE' ? 'red' : row.type === 'RECEIVABLE' ? 'green' : 'blue'}>
          {formatCurrency(row.amount)}
        </Text>
      )
    },
    {
      accessor: 'frequency',
      header: 'Frequência',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'DAILY', label: 'Diária' },
        { value: 'WEEKLY', label: 'Semanal' },
        { value: 'MONTHLY', label: 'Mensal' },
        { value: 'YEARLY', label: 'Anual' }
      ],
      render: (row) => {
        const frequencyLabels = {
          'DAILY': 'Diária',
          'WEEKLY': 'Semanal', 
          'MONTHLY': 'Mensal',
          'YEARLY': 'Anual'
        };
        return <Text size="sm">{frequencyLabels[row.frequency] || row.frequency}</Text>;
      }
    },
    {
      accessor: 'is_active',
      header: 'Ativo',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'true', label: 'Sim' },
        { value: 'false', label: 'Não' }
      ],
      align: 'center',
      render: (row) => (
        <Badge color={row.is_active ? 'green' : 'red'} size="sm">
          {row.is_active ? 'Sim' : 'Não'}
        </Badge>
      )
    },
    {
      accessor: 'actions',
      header: 'Ações',
      sortable: false,
      filterable: false,
      align: 'center',
      render: (row) => (
        <Group gap="xs">
          <ActionIcon
            variant="light"
            color="green"
            onClick={() => openSettleModal(row)}
            title="Liquidar Próxima"
            size="sm"
          >
            <IconCurrencyReal size={14} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="blue"
            onClick={() => openEditRule(row)}
            size="sm"
          >
            <IconPencil size={14} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="red"
            onClick={() => handleDeleteRule(row.id)}
            size="sm"
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      )
    }
  ];

  // Cálculos para rodapés
  const obligationsFooterCalculations = {
    amount: (filteredData) => {
      const total = filteredData.reduce((sum, obligation) => sum + obligation.amount, 0);
      return formatCurrency(total);
    }
  };

  const recurringRulesFooterCalculations = {
    amount: (filteredData) => {
      const total = filteredData.reduce((sum, rule) => sum + rule.amount, 0);
      return formatCurrency(total);
    }
  };

  const filteredObligations = obligations.filter(obligation => {
    if (activeTab === 'RECURRING') return false;
    
    let matches = false;
    
    if (activeTab === 'PAYABLE') {
      // A Pagar: type = 'PAYABLE' E category != 'Cartão de Crédito'
      matches = obligation.type === 'PAYABLE' && obligation.category !== 'Cartão de Crédito';
    } else if (activeTab === 'CREDIT_CARD') {
      // Faturas de Cartão: type = 'PAYABLE' E category = 'Cartão de Crédito'
      matches = obligation.type === 'PAYABLE' && obligation.category === 'Cartão de Crédito';
    } else if (activeTab === 'RECEIVABLE') {
      // A Receber: type = 'RECEIVABLE' (sem alteração)
      matches = obligation.type === 'RECEIVABLE';
    } else if (activeTab === 'TRANSFERENCIA') {
      // A Transferir: type = 'TRANSFERENCIA'
      matches = obligation.type === 'TRANSFERENCIA';
    }
    
    // Aplicar filtro de status se não for 'ALL'
    if (statusFilter !== 'ALL') {
      matches = matches && obligation.status === statusFilter;
    }
    
    return matches;
  });

  if (isLoading) {
    return (
      <Container size="lg">
        <Group justify="center" mt="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <div className="page-with-advanced-table">
      <div className="page-header">
      <Group justify="space-between" mb="md">
        <Title order={2}>Fluxo de Caixa</Title>
        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setObligationModalOpened(true)}
          >
            Nova Obrigação
          </Button>
          <Button
            leftSection={<IconRepeat size={16} />}
            variant="outline"
            onClick={() => setRecurringModalOpened(true)}
          >
            Nova Recorrência
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      {/* Resumo Financeiro - 30 dias */}
      <Grid mb="md">
        <Grid.Col span={6}>
          <Card withBorder padding="md">
            <Group justify="space-between">
              <div>
                <Text size="sm" color="dimmed" mb={4}>Total a Pagar (MÊS ATUAL)</Text>
                <Text size="xl" fw={700} color="red">
                  R$ {financialSummary.payable_next_30d?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                </Text>
              </div>
              <IconTrendingDown size={24} color="red" />
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card withBorder padding="md">
            <Group justify="space-between">
              <div>
                <Text size="sm" color="dimmed" mb={4}>Total a Receber (MÊS ATUAL)</Text>
                <Text size="xl" fw={700} color="green">
                  R$ {financialSummary.receivable_next_30d?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                </Text>
              </div>
              <IconTrendingUp size={24} color="green" />
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        data={[
          { label: 'A Pagar', value: 'PAYABLE' },
          { label: 'Faturas de Cartão', value: 'CREDIT_CARD' },
          { label: 'A Receber', value: 'RECEIVABLE' },
          { label: 'A Transferir', value: 'TRANSFERENCIA' },
          { label: 'Recorrências', value: 'RECURRING' }
        ]}
        mb="md"
      />

      {/* Filtro de Status - apenas para obrigações, não para recorrências */}
      {activeTab !== 'RECURRING' && (
        <Group mb="md" align="center">
          <IconFilter size={16} />
          <Text size="sm" fw={500}>Filtrar por Status:</Text>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'ALL', label: 'Todos' },
              { value: 'PENDING', label: 'Pendentes' },
              { value: 'PAID', label: 'Pagos' },
              { value: 'OVERDUE', label: 'Atrasados' }
            ]}
            w={150}
          />
        </Group>
      )}

      </div>

      {activeTab === 'RECURRING' ? (
        // Tabela de Regras de Recorrência
        <AdvancedTable
          title="Regras de Recorrência"
          data={recurringRules}
          columns={recurringRulesColumns}
          footerCalculations={recurringRulesFooterCalculations}
          emptyStateText={loading ? "Carregando regras..." : "Nenhuma regra de recorrência encontrada"}
          emptyStateDescription="Adicione sua primeira regra de recorrência"
          pagination
        />
      ) : (
        // Tabela de Obrigações
        <AdvancedTable
          title={activeTab === 'PAYABLE' ? 'Contas a Pagar' : 
                 activeTab === 'CREDIT_CARD' ? 'Faturas de Cartão de Crédito' : 
                 activeTab === 'TRANSFERENCIA' ? 'Transferências a Realizar' :
                 'Contas a Receber'}
          data={filteredObligations}
          columns={obligationsColumns}
          footerCalculations={obligationsFooterCalculations}
          emptyStateText={loading ? "Carregando obrigações..." : "Nenhuma obrigação encontrada"}
          emptyStateDescription="Adicione sua primeira obrigação"
          pagination
        />
      )}

      {/* Modal para Obrigação */}
      <Modal
        opened={obligationModalOpened}
        onClose={() => {
          setObligationModalOpened(false);
          obligationForm.reset();
          setEditingObligation(null);
        }}
        title={editingObligation ? "Editar Obrigação" : "Nova Obrigação"}
        size="md"
      >
        <form onSubmit={obligationForm.onSubmit(handleCreateObligation)}>
          <Stack>
            <TextInput
              label="Descrição"
              placeholder="Ex: Aluguel, Conta de luz..."
              {...obligationForm.getInputProps('description')}
              required
            />

            <NumberInput
              label="Valor"
              placeholder="0.00"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="R$ "
              {...obligationForm.getInputProps('amount')}
              required
            />

            <DatePickerInput
              label="Data de Vencimento"
              placeholder="dd/mm/yyyy"
              valueFormat="DD/MM/YYYY"
              clearable
              allowDeselect
              {...obligationForm.getInputProps('due_date')}
              required
            />

            <Select
              label="Tipo"
              data={[
                { value: 'PAYABLE', label: 'A Pagar' },
                { value: 'RECEIVABLE', label: 'A Receber' },
                { value: 'TRANSFERENCIA', label: 'Transferência' }
              ]}
              {...obligationForm.getInputProps('type')}
              required
            />

            <TextInput
              label="Categoria"
              placeholder="Ex: Moradia, Transporte..."
              {...obligationForm.getInputProps('category')}
            />

            <TextInput
              label="Entidade"
              placeholder="Ex: Empresa, Pessoa..."
              {...obligationForm.getInputProps('entity_name')}
            />

            <Textarea
              label="Observações"
              placeholder="Observações adicionais..."
              {...obligationForm.getInputProps('notes')}
            />

            {editingObligation && (
              <>
                <Select
                  label="Status"
                  data={[
                    { value: 'PENDING', label: 'Pendente' },
                    { value: 'PAID', label: 'Pago' },
                    { value: 'OVERDUE', label: 'Vencido' }
                  ]}
                  {...obligationForm.getInputProps('status')}
                />

                <TextInput
                  label="ID da Transação Vinculada"
                  placeholder="ID da transação de liquidação"
                  {...obligationForm.getInputProps('linked_transaction_id')}
                  description="ID da transação que liquidou esta obrigação"
                />

                <Select
                  label="Regra de Recorrência Vinculada"
                  placeholder="Selecione a regra"
                  data={recurringRules.map(rule => ({
                    value: rule.id.toString(),
                    label: rule.description
                  }))}
                  {...obligationForm.getInputProps('recurring_rule_id')}
                  description="Regra de recorrência que originou esta obrigação"
                  clearable
                />
              </>
            )}

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => {
                  setObligationModalOpened(false);
                  obligationForm.reset();
                  setEditingObligation(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {editingObligation ? "Atualizar" : "Criar"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal para Regra de Recorrência */}
      <Modal
        opened={recurringModalOpened}
        onClose={() => {
          setRecurringModalOpened(false);
          recurringForm.reset();
          setEditingRule(null);
        }}
        title={editingRule ? "Editar Regra de Recorrência" : "Nova Regra de Recorrência"}
        size="md"
      >
        <form onSubmit={recurringForm.onSubmit(handleCreateRecurringRule)}>
          <Stack>
            <TextInput
              label="Descrição"
              placeholder="Ex: Salário, Aluguel..."
              {...recurringForm.getInputProps('description')}
              required
            />

            <NumberInput
              label="Valor"
              placeholder="0.00"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="R$ "
              {...recurringForm.getInputProps('amount')}
              required
            />

            <Select
              label="Tipo"
              data={[
                { value: 'PAYABLE', label: 'A Pagar' },
                { value: 'RECEIVABLE', label: 'A Receber' },
                { value: 'TRANSFERENCIA', label: 'Transferência' }
              ]}
              {...recurringForm.getInputProps('type')}
              required
            />

            <Group grow>
              <Select
                label="Frequência"
                data={[
                  { value: 'DAILY', label: 'Diário' },
                  { value: 'WEEKLY', label: 'Semanal' },
                  { value: 'MONTHLY', label: 'Mensal' },
                  { value: 'YEARLY', label: 'Anual' }
                ]}
                {...recurringForm.getInputProps('frequency')}
                required
              />
              
              <NumberInput
                label="Intervalo"
                placeholder="1"
                min={1}
                {...recurringForm.getInputProps('interval_value')}
                required
              />
            </Group>

            <Group grow>
              <DatePickerInput
                label="Data de Início"
                placeholder="dd/mm/yyyy"
                valueFormat="DD/MM/YYYY"
                clearable
                allowDeselect
                {...recurringForm.getInputProps('start_date')}
                required
              />
              
              <DatePickerInput
                label="Data de Fim (Opcional)"
                placeholder="dd/mm/yyyy"
                valueFormat="DD/MM/YYYY"
                clearable
                allowDeselect
                {...recurringForm.getInputProps('end_date')}
              />
            </Group>

            <TextInput
              label="Categoria"
              placeholder="Ex: Moradia, Salário..."
              {...recurringForm.getInputProps('category')}
            />

            <Group grow>
              <Select
                label="Conta Origem (opcional)"
                placeholder="Selecione a conta origem..."
                data={accounts.map(account => ({
                  value: account.id.toString(),
                  label: account.name
                }))}
                searchable
                clearable
                {...recurringForm.getInputProps('from_account_id')}
              />
              
              <Select
                label="Conta Destino (opcional)"
                placeholder="Selecione a conta destino..."
                data={accounts.map(account => ({
                  value: account.id.toString(),
                  label: account.name
                }))}
                searchable
                clearable
                {...recurringForm.getInputProps('to_account_id')}
              />
            </Group>

            <TextInput
              label="Entidade"
              placeholder="Ex: Empresa, Pessoa..."
              {...recurringForm.getInputProps('entity_name')}
            />

            <Switch
              label="Regra ativa"
              {...recurringForm.getInputProps('is_active', { type: 'checkbox' })}
            />

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => {
                  setRecurringModalOpened(false);
                  recurringForm.reset();
                  setEditingRule(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {editingRule ? "Atualizar" : "Criar"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de Liquidação Unificada */}
      <Modal
        opened={settleModalOpened}
        onClose={() => {
          setSettleModalOpened(false);
          settleForm.reset();
          setSettlingItem(null);
          setFromAccountValue('');
          setToAccountValue('');
        }}
        title={settlingItem && settlingItem.hasOwnProperty('frequency') ? "Liquidar Recorrência" : "Liquidar Obrigação"}
        size="lg"
      >
        {settlingItem && (
          <form onSubmit={settleForm.onSubmit(handleSettleItem)}>
            <Stack>
              {/* Card com informações da obrigação/recorrência */}
              <Card withBorder p="md" mb="md">
                <Stack gap="sm">
                  <Text size="lg" fw={600}>
                    {settlingItem.hasOwnProperty('frequency') ? 'Recorrência' : 'Obrigação'}: {settlingItem.description}
                  </Text>
                  <Group>
                    <Text size="md" fw={500}>Valor:</Text>
                    <Text size="md" c={settlingItem.type === 'PAYABLE' ? 'red' : settlingItem.type === 'RECEIVABLE' ? 'green' : 'blue'}>
                      R$ {parseFloat(settlingItem.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Text>
                  </Group>
                  {settlingItem.category && (
                    <Group>
                      <Text size="sm">Categoria:</Text>
                      <Text size="sm" fw={500}>{settlingItem.category}</Text>
                    </Group>
                  )}
                  {settlingItem.entity_name && (
                    <Group>
                      <Text size="sm">Entidade:</Text>
                      <Text size="sm" fw={500}>{settlingItem.entity_name}</Text>
                    </Group>
                  )}
                  {settlingItem.due_date && !settlingItem.hasOwnProperty('frequency') && (
                    <Group>
                      <Text size="sm">Vencimento:</Text>
                      <Text size="sm" fw={500}>{new Date(settlingItem.due_date).toLocaleDateString('pt-BR')}</Text>
                    </Group>
                  )}
                </Stack>
              </Card>

              <Autocomplete
                label="Conta de Origem (opcional)"
                placeholder="Digite ou selecione a conta de origem"
                data={accounts
                  .filter(account => account.name.toLowerCase().includes(fromAccountValue.toLowerCase()))
                  .map(account => account.name)
                }
                value={fromAccountValue}
                onChange={(value) => setFromAccountValue(value)}
                onOptionSubmit={(value) => {
                  setFromAccountValue(value);
                  const account = accounts.find(acc => acc.name === value);
                  settleForm.setFieldValue('from_account_id', account ? account.id.toString() : '');
                }}
                description="Conta que terá o valor debitado"
                clearable
                onClear={() => {
                  setFromAccountValue('');
                  settleForm.setFieldValue('from_account_id', '');
                }}
              />

              <Autocomplete
                label="Conta de Destino (opcional)"
                placeholder="Digite ou selecione a conta de destino"
                data={accounts
                  .filter(account => account.name.toLowerCase().includes(toAccountValue.toLowerCase()))
                  .map(account => account.name)
                }
                value={toAccountValue}
                onChange={(value) => setToAccountValue(value)}
                onOptionSubmit={(value) => {
                  setToAccountValue(value);
                  const account = accounts.find(acc => acc.name === value);
                  settleForm.setFieldValue('to_account_id', account ? account.id.toString() : '');
                }}
                description="Conta que terá o valor creditado"
                clearable
                onClear={() => {
                  setToAccountValue('');
                  settleForm.setFieldValue('to_account_id', '');
                }}
              />

              <DatePickerInput
                label="Data de Liquidação"
                placeholder="dd/mm/yyyy"
                valueFormat="DD/MM/YYYY"
                clearable
                allowDeselect
                {...settleForm.getInputProps('settlement_date')}
                required
              />

              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setSettleModalOpened(false);
                    settleForm.reset();
                    setSettlingItem(null);
                    setFromAccountValue('');
                    setToAccountValue('');
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={loading} color="green">
                  Liquidar
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      {/* Modal de Cancelamento de Liquidação */}
      <Modal
        opened={cancelModalOpened}
        onClose={() => {
          setCancelModalOpened(false);
          setCancelingObligation(null);
        }}
        title="Cancelar Liquidação"
        size="sm"
      >
        {cancelingObligation && (
          <Stack>
            <Text>
              <strong>Obrigação:</strong> {cancelingObligation.description}
            </Text>
            <Text>
              <strong>Valor:</strong> R$ {parseFloat(cancelingObligation.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
            <Text color="orange" size="sm">
              Esta ação irá cancelar a liquidação e reverter o status da obrigação para PENDENTE.
            </Text>

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                onClick={() => {
                  setCancelModalOpened(false);
                  setCancelingObligation(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                color="orange"
                loading={loading}
                onClick={handleCancelSettlement}
              >
                Confirmar Cancelamento
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

    </div>
  );
}