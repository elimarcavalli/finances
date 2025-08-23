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
  SegmentedControl,
  Loader,
  ScrollArea,
  Paper,
  Flex,
  Container,
  Grid,
  Textarea,
  Card,
  Switch
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
  IconChartPie
} from '@tabler/icons-react';
import api from '../api';

export function ObligationsPage() {
  // Estados principais
  const [obligations, setObligations] = useState([]);
  const [recurringRules, setRecurringRules] = useState([]);
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
  const [editingObligation, setEditingObligation] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [settlingObligation, setSettlingObligation] = useState(null);
  
  const [error, setError] = useState('');

  // Form para obrigações
  const obligationForm = useForm({
    initialValues: {
      description: '',
      amount: 0,
      due_date: new Date(),
      type: 'PAYABLE',
      category: '',
      entity_name: '',
      notes: ''
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
      is_active: true
    }
  });

  // Form para liquidação
  const settleForm = useForm({
    initialValues: {
      account_id: '',
      settlement_date: new Date()
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
      setRecurringRules(response.data.recurring_rules || []);
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
      if (editingObligation) {
        await api.put(`/obligations/${editingObligation.id}`, values);
        notifications.show({
          title: 'Sucesso',
          message: 'Obrigação atualizada com sucesso',
          color: 'green'
        });
      } else {
        await api.post('/obligations', values);
        notifications.show({
          title: 'Sucesso',
          message: 'Obrigação criada com sucesso',
          color: 'green'
        });
      }
      
      setObligationModalOpened(false);
      obligationForm.reset();
      setEditingObligation(null);
      await loadObligations();
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
      if (editingRule) {
        await api.put(`/recurring-rules/${editingRule.id}`, values);
        notifications.show({
          title: 'Sucesso',
          message: 'Regra de recorrência atualizada com sucesso',
          color: 'green'
        });
      } else {
        await api.post('/recurring-rules', values);
        notifications.show({
          title: 'Sucesso',
          message: 'Regra de recorrência criada com sucesso',
          color: 'green'
        });
      }
      
      setRecurringModalOpened(false);
      recurringForm.reset();
      setEditingRule(null);
      await loadRecurringRules();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao salvar regra de recorrência',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSettleObligation = async (values) => {
    try {
      setLoading(true);
      await api.post(`/obligations/${settlingObligation.id}/settle`, values);
      
      notifications.show({
        title: 'Sucesso',
        message: 'Obrigação liquidada com sucesso',
        color: 'green'
      });
      
      setSettleModalOpened(false);
      settleForm.reset();
      setSettlingObligation(null);
      await loadObligations();
    } catch (error) {
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao liquidar obrigação',
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
      await loadObligations();
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
      await loadRecurringRules();
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
      due_date: new Date(obligation.due_date)
    });
    setObligationModalOpened(true);
  };

  const openEditRule = (rule) => {
    setEditingRule(rule);
    recurringForm.setValues({
      ...rule,
      start_date: new Date(rule.start_date),
      end_date: rule.end_date ? new Date(rule.end_date) : null
    });
    setRecurringModalOpened(true);
  };

  const openSettleModal = (obligation) => {
    setSettlingObligation(obligation);
    settleForm.setValues({
      account_id: '',
      settlement_date: new Date()
    });
    setSettleModalOpened(true);
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
    return type === 'PAYABLE' ? (
      <IconCurrencyReal color="red" size={16} />
    ) : (
      <IconCurrencyReal color="green" size={16} />
    );
  };

  const filteredObligations = obligations.filter(obligation => {
    if (activeTab === 'RECURRING') return false;
    return obligation.type === activeTab;
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
    <Container size="xl">
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
                <Text size="sm" color="dimmed" mb={4}>Total a Pagar (30d)</Text>
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
                <Text size="sm" color="dimmed" mb={4}>Total a Receber (30d)</Text>
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
          { label: 'A Receber', value: 'RECEIVABLE' },
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

      {activeTab === 'RECURRING' ? (
        // Tabela de Regras de Recorrência
        <Paper shadow="xs" p="md">
          <Title order={4} mb="md">Regras de Recorrência</Title>
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Frequência</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recurringRules.map((rule) => (
                  <Table.Tr key={rule.id}>
                    <Table.Td>
                      <Group>
                        {getTypeIcon(rule.type)}
                        <div>
                          <Text fw={500}>{rule.description}</Text>
                          {rule.entity_name && <Text size="sm" c="dimmed">{rule.entity_name}</Text>}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>R$ {parseFloat(rule.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Table.Td>
                    <Table.Td>{rule.type === 'PAYABLE' ? 'A Pagar' : 'A Receber'}</Table.Td>
                    <Table.Td>{rule.frequency}</Table.Td>
                    <Table.Td>
                      <Badge color={rule.is_active ? 'green' : 'gray'}>
                        {rule.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group>
                        <ActionIcon
                          variant="subtle"
                          onClick={() => openEditRule(rule)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      ) : (
        // Tabela de Obrigações
        <Paper shadow="xs" p="md">
          <Title order={4} mb="md">
            {activeTab === 'PAYABLE' ? 'Contas a Pagar' : 'Contas a Receber'}
          </Title>
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Vencimento</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredObligations.map((obligation) => (
                  <Table.Tr 
                    key={obligation.id}
                    style={{ 
                      backgroundColor: obligation.status === 'OVERDUE' ? '#fff5f5' : undefined 
                    }}
                  >
                    <Table.Td>
                      <Group>
                        {getTypeIcon(obligation.type)}
                        <div>
                          <Text fw={500}>{obligation.description}</Text>
                          {obligation.entity_name && <Text size="sm" c="dimmed">{obligation.entity_name}</Text>}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>R$ {parseFloat(obligation.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Table.Td>
                    <Table.Td>{new Date(obligation.due_date).toLocaleDateString('pt-BR')}</Table.Td>
                    <Table.Td>{getStatusBadge(obligation.status)}</Table.Td>
                    <Table.Td>
                      <Group>
                        {(obligation.status === 'PENDING' || obligation.status === 'OVERDUE') && (
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            onClick={() => openSettleModal(obligation)}
                          >
                            Liquidar
                          </Button>
                        )}
                        <ActionIcon
                          variant="subtle"
                          onClick={() => openEditObligation(obligation)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteObligation(obligation.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
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
              placeholder="Selecione a data"
              {...obligationForm.getInputProps('due_date')}
              required
            />

            <Select
              label="Tipo"
              data={[
                { value: 'PAYABLE', label: 'A Pagar' },
                { value: 'RECEIVABLE', label: 'A Receber' }
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
                { value: 'RECEIVABLE', label: 'A Receber' }
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
                placeholder="Selecione a data"
                {...recurringForm.getInputProps('start_date')}
                required
              />
              
              <DatePickerInput
                label="Data de Fim (Opcional)"
                placeholder="Selecione a data"
                {...recurringForm.getInputProps('end_date')}
              />
            </Group>

            <TextInput
              label="Categoria"
              placeholder="Ex: Moradia, Salário..."
              {...recurringForm.getInputProps('category')}
            />

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

      {/* Modal de Liquidação */}
      <Modal
        opened={settleModalOpened}
        onClose={() => {
          setSettleModalOpened(false);
          settleForm.reset();
          setSettlingObligation(null);
        }}
        title="Liquidar Obrigação"
        size="sm"
      >
        {settlingObligation && (
          <form onSubmit={settleForm.onSubmit(handleSettleObligation)}>
            <Stack>
              <Text>
                <strong>Obrigação:</strong> {settlingObligation.description}
              </Text>
              <Text>
                <strong>Valor:</strong> R$ {parseFloat(settlingObligation.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>

              <Select
                label={settlingObligation.type === 'PAYABLE' ? 'Conta de Origem' : 'Conta de Destino'}
                placeholder="Selecione a conta"
                data={accounts.map(account => ({
                  value: account.id.toString(),
                  label: `${account.name} (${account.type})`
                }))}
                {...settleForm.getInputProps('account_id')}
                required
              />

              <DatePickerInput
                label="Data de Liquidação"
                placeholder="Selecione a data"
                {...settleForm.getInputProps('settlement_date')}
                required
              />

              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setSettleModalOpened(false);
                    settleForm.reset();
                    setSettlingObligation(null);
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
    </Container>
  );
}