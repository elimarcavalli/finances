import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Radio,
  ScrollArea,
  Paper,
  Flex
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { 
  IconPlus, 
  IconPencil, 
  IconTrash, 
  IconAlertCircle,
  IconReceipt2,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconArrowRight
} from '@tabler/icons-react';
import api from '../api';
import { AccountIcon } from '../components/AccountIcon';

export function TransactionsPage() {
  // Estados principais
  const [transactions, setTransactions] = useState([]);
  const [rawAccounts, setRawAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [error, setError] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [transactionType, setTransactionType] = useState('RECEITA');

  const form = useForm({
    initialValues: {
      description: '',
      amount: 0,
      transaction_date: new Date(),
      type: 'RECEITA',
      category: '',
      from_account_id: null,
      to_account_id: null
    },
    validate: {
      description: (value) => (value.length < 2 ? 'Descrição deve ter pelo menos 2 caracteres' : null),
      amount: (value) => (value <= 0 ? 'Valor deve ser maior que zero' : null),
      transaction_date: (value) => (!value ? 'Data é obrigatória' : null)
    }
  });

  // Passo 1: Busca centralizada e isolada das contas
  const loadAccounts = useCallback(async () => {
    setIsLoading(true); // Inicia o carregamento
    try {
      const response = await api.get('/accounts');
      setRawAccounts(response.data.accounts || []);
    } catch (error) {
      console.error("Falha ao buscar contas", error);
      // Adicione aqui uma notificação de erro para o usuário
    } finally {
      setIsLoading(false); // Finaliza o carregamento, com sucesso ou falha
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, []); // Array vazio garante que isso execute APENAS UMA VEZ

  // Busca das transações (separada das contas)
  const loadTransactions = useCallback(async (accountId = null) => {
    setLoading(true);
    setError('');
    try {
      const params = accountId ? { account_id: accountId } : {};
      const response = await api.get('/transactions', { params });
      setTransactions(response.data.transactions || []);
    } catch (err) {
      setError('Erro ao carregar lançamentos');
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, []); // Carrega transações uma vez

  const handleAccountFilterChange = (value) => {
    const accountId = value === '' ? null : parseInt(value);
    setSelectedAccount(value);
    loadTransactions(accountId);
  };

  const openCreateModal = () => {
    setEditingTransaction(null);
    // RESETA o formulário para um estado inicial limpo e conhecido
    form.reset();
    // GARANTE que o tipo de transação padrão esteja definido no formulário
    form.setFieldValue('type', transactionType);
    setModalOpened(true);
  };

  const openEditModal = (transaction) => {
    setEditingTransaction(transaction);
    form.setValues({
      ...transaction,
      transaction_date: new Date(transaction.transaction_date)
    });
    setTransactionType(transaction.type);
    setModalOpened(true);
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    
    try {
      // Validações condicionais baseadas no tipo de transação
      if (values.type === 'RECEITA' && !values.to_account_id) {
        setError('Conta de destino é obrigatória para receitas');
        return;
      }
      if (values.type === 'DESPESA' && !values.from_account_id) {
        setError('Conta de origem é obrigatória para despesas');
        return;
      }
      if (values.type === 'TRANSFERENCIA' && (!values.from_account_id || !values.to_account_id)) {
        setError('Contas de origem e destino são obrigatórias para transferências');
        return;
      }
      if (values.type === 'TRANSFERENCIA' && values.from_account_id === values.to_account_id) {
        setError('Conta de origem e destino devem ser diferentes');
        return;
      }

      // Formatar data e converter IDs para números para o backend
      const formattedData = {
        ...values,
        transaction_date: values.transaction_date.toISOString().split('T')[0],
        from_account_id: values.from_account_id ? parseInt(values.from_account_id) : null,
        to_account_id: values.to_account_id ? parseInt(values.to_account_id) : null
      };

      // LOG DETALHADO: Objeto enviado para debug de erro 400
      console.log('[TRANSACTIONS_PAGE] Payload enviado para POST /transactions:');
      console.log(JSON.stringify(formattedData, null, 2));

      if (editingTransaction) {
        await api.put(`/transactions/${editingTransaction.id}`, formattedData);
      } else {
        await api.post('/transactions', formattedData);
      }

      setModalOpened(false);
      await loadTransactions(selectedAccount);
      // Recarregar contas para atualizar saldos
      const response = await api.get('/accounts');
      setRawAccounts(response.data.accounts || []);
    } catch (err) {
      setError(editingTransaction ? 'Erro ao atualizar lançamento' : 'Erro ao criar lançamento');
      console.error('Error submitting transaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (transactionId) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
    
    setLoading(true);
    setError('');
    
    try {
      await api.delete(`/transactions/${transactionId}`);
      await loadTransactions(selectedAccount);
      // Recarregar contas para atualizar saldos
      const response = await api.get('/accounts');
      setRawAccounts(response.data.accounts || []);
    } catch (err) {
      setError('Erro ao excluir lançamento');
      console.error('Error deleting transaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'RECEITA':
        return <IconArrowUpRight size={16} color="green" />;
      case 'DESPESA':
        return <IconArrowDownLeft size={16} color="red" />;
      case 'TRANSFERENCIA':
        return <IconArrowRight size={16} color="blue" />;
      default:
        return <IconReceipt2 size={16} />;
    }
  };

  const getAmountColor = (type) => {
    switch (type) {
      case 'RECEITA':
        return 'green';
      case 'DESPESA':
        return 'red';
      case 'TRANSFERENCIA':
        return 'blue';
      default:
        return 'dark';
    }
  };

  const getTransactionTypeLabel = (type) => {
    const types = {
      'RECEITA': 'Receita',
      'DESPESA': 'Despesa', 
      'TRANSFERENCIA': 'Transferência'
    };
    return types[type] || type;
  };

  // Memorizar opções formatadas dos selects baseado em rawAccounts
  const accountOptions = useMemo(() => {
    // Se a lista de contas ainda não carregou, retorne um array vazio.
    if (!rawAccounts || rawAccounts.length === 0) {
      return [];
    }
    // Mapeie a lista para o formato que o Mantine Select espera.
    return rawAccounts.map(account => ({
      value: account.id.toString(),
      label: `${account.name} (${account.institution})`,
    }));
  }, [rawAccounts]); // Esta linha é crucial: o cálculo só será refeito se a lista 'rawAccounts' mudar.

  const filterAccountOptions = useMemo(() => [
    { value: '', label: 'Todas as contas' },
    ...accountOptions
  ], [accountOptions]);

  // Função para atualizar tipo de transação
  const handleTransactionTypeChange = (newType) => {
    setTransactionType(newType);
    form.setFieldValue('type', newType);
    // Limpar campos condicionais quando o tipo muda
    if (newType === 'RECEITA') {
      form.setFieldValue('from_account_id', null);
    } else if (newType === 'DESPESA') {
      form.setFieldValue('to_account_id', null);
    }
  };

  return (
    <Stack gap="md">
      <Title order={2}>Meus Lançamentos</Title>
      
      {error && (
        <Alert icon={<IconAlertCircle size="1rem" />} color="red">
          {error}
        </Alert>
      )}

      <Group justify="space-between">
        <Select
          label="Filtrar por Conta"
          placeholder="Todas as contas"
          data={filterAccountOptions}
          value={selectedAccount}
          onChange={handleAccountFilterChange}
          clearable
          style={{ minWidth: 200 }}
        />
        
        <Button
          onClick={openCreateModal}
          disabled={isLoading} // O botão fica desabilitado enquanto os dados carregam
          leftSection={isLoading ? <Loader size="sm" /> : <IconPlus size={14} />}
        >
          {isLoading ? 'Carregando Contas...' : 'Novo Lançamento'}
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data</Table.Th>
            <Table.Th>Descrição</Table.Th>
            <Table.Th>Tipo</Table.Th>
            <Table.Th>Categoria</Table.Th>
            <Table.Th>Valor</Table.Th>
            <Table.Th>Conta</Table.Th>
            <Table.Th width={120}>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {transactions.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                <Text c="dimmed">
                  {loading ? 'Carregando lançamentos...' : 'Nenhum lançamento encontrado'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            transactions.map((transaction) => (
              <Table.Tr key={transaction.id}>
                <Table.Td>
                  {new Date(transaction.transaction_date).toLocaleDateString('pt-BR')}
                </Table.Td>
                <Table.Td>
                  <Group gap="sm">
                    {getTransactionIcon(transaction.type)}
                    {transaction.description}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={getAmountColor(transaction.type)}>
                    {getTransactionTypeLabel(transaction.type)}
                  </Badge>
                </Table.Td>
                <Table.Td>{transaction.category || '-'}</Table.Td>
                <Table.Td>
                  <Text c={getAmountColor(transaction.type)} fw={500}>
                    {formatCurrency(transaction.amount)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {transaction.type === 'TRANSFERENCIA' 
                    ? `${transaction.from_account_name} → ${transaction.to_account_name}`
                    : transaction.from_account_name || transaction.to_account_name || '-'
                  }
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => openEditModal(transaction)}
                      disabled={loading}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleDelete(transaction.id)}
                      disabled={loading}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {/* Seletor de Tipo de Transação */}
            <SegmentedControl
              value={transactionType}
              onChange={handleTransactionTypeChange}
              data={[
                { label: 'Receita', value: 'RECEITA' },
                { label: 'Despesa', value: 'DESPESA' },
                { label: 'Transferência', value: 'TRANSFERENCIA' }
              ]}
            />

            {/* Campos Comuns */}
            <TextInput
              label="Descrição"
              placeholder="Ex: Salário, Compra supermercado, etc."
              {...form.getInputProps('description')}
            />

            <NumberInput
              label="Valor"
              placeholder="0,00"
              decimalScale={2}
              fixedDecimalScale
              {...form.getInputProps('amount')}
            />

            <DatePickerInput
              label="Data"
              placeholder="Selecione a data"
              {...form.getInputProps('transaction_date')}
            />

            <TextInput
              label="Categoria"
              placeholder="Ex: Alimentação, Transporte, Salário"
              {...form.getInputProps('category')}
            />

            {/* Seletores Visuais de Conta - Cartões */}
            {transactionType === 'RECEITA' && (
              <div>
                <Text size="sm" fw={500} mb="xs">Conta de Destino</Text>
                <ScrollArea h={150}>
                  <Radio.Group {...form.getInputProps('to_account_id')}>
                    <Group gap="md">
                      {rawAccounts.map((account) => (
                        <Radio
                          key={account.id}
                          value={account.id.toString()}
                          label={
                            <Paper
                              p="md"
                              withBorder
                              style={{ 
                                cursor: 'pointer',
                                minWidth: 200,
                                transition: 'all 0.2s ease',
                                ':hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }
                              }}
                            >
                              <Flex align="center" gap="sm">
                                <AccountIcon type={account.type} />
                                <div style={{ flex: 1 }}>
                                  <Text fw={700} size="sm">{account.name}</Text>
                                  <Text size="xs" c="dimmed">{account.institution}</Text>
                                  <Text size="sm" c="blue" fw={500}>
                                    {formatCurrency(account.balance)}
                                  </Text>
                                </div>
                              </Flex>
                            </Paper>
                          }
                        />
                      ))}
                    </Group>
                  </Radio.Group>
                </ScrollArea>
              </div>
            )}

            {transactionType === 'DESPESA' && (
              <div>
                <Text size="sm" fw={500} mb="xs">Conta de Origem</Text>
                <ScrollArea h={150}>
                  <Radio.Group {...form.getInputProps('from_account_id')}>
                    <Group gap="md">
                      {rawAccounts.map((account) => (
                        <Radio
                          key={account.id}
                          value={account.id.toString()}
                          label={
                            <Paper
                              p="md"
                              withBorder
                              style={{ 
                                cursor: 'pointer',
                                minWidth: 200,
                                transition: 'all 0.2s ease',
                                ':hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }
                              }}
                            >
                              <Flex align="center" gap="sm">
                                <AccountIcon type={account.type} />
                                <div style={{ flex: 1 }}>
                                  <Text fw={700} size="sm">{account.name}</Text>
                                  <Text size="xs" c="dimmed">{account.institution}</Text>
                                  <Text size="sm" c="blue" fw={500}>
                                    {formatCurrency(account.balance)}
                                  </Text>
                                </div>
                              </Flex>
                            </Paper>
                          }
                        />
                      ))}
                    </Group>
                  </Radio.Group>
                </ScrollArea>
              </div>
            )}

            {transactionType === 'TRANSFERENCIA' && (
              <>
                <div>
                  <Text size="sm" fw={500} mb="xs">Conta de Origem</Text>
                  <ScrollArea h={150}>
                    <Radio.Group {...form.getInputProps('from_account_id')}>
                      <Group gap="md">
                        {rawAccounts.map((account) => (
                          <Radio
                            key={account.id}
                            value={account.id.toString()}
                            label={
                              <Paper
                                p="md"
                                withBorder
                                style={{ 
                                  cursor: 'pointer',
                                  minWidth: 200,
                                  transition: 'all 0.2s ease',
                                  ':hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }
                                }}
                              >
                                <Flex align="center" gap="sm">
                                  <AccountIcon type={account.type} />
                                  <div style={{ flex: 1 }}>
                                    <Text fw={700} size="sm">{account.name}</Text>
                                    <Text size="xs" c="dimmed">{account.institution}</Text>
                                    <Text size="sm" c="blue" fw={500}>
                                      {formatCurrency(account.balance)}
                                    </Text>
                                  </div>
                                </Flex>
                              </Paper>
                            }
                          />
                        ))}
                      </Group>
                    </Radio.Group>
                  </ScrollArea>
                </div>
                
                <div>
                  <Text size="sm" fw={500} mb="xs">Conta de Destino</Text>
                  <ScrollArea h={150}>
                    <Radio.Group {...form.getInputProps('to_account_id')}>
                      <Group gap="md">
                        {rawAccounts.map((account) => (
                          <Radio
                            key={account.id}
                            value={account.id.toString()}
                            label={
                              <Paper
                                p="md"
                                withBorder
                                style={{ 
                                  cursor: 'pointer',
                                  minWidth: 200,
                                  transition: 'all 0.2s ease',
                                  ':hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }
                                }}
                              >
                                <Flex align="center" gap="sm">
                                  <AccountIcon type={account.type} />
                                  <div style={{ flex: 1 }}>
                                    <Text fw={700} size="sm">{account.name}</Text>
                                    <Text size="xs" c="dimmed">{account.institution}</Text>
                                    <Text size="sm" c="blue" fw={500}>
                                      {formatCurrency(account.balance)}
                                    </Text>
                                  </div>
                                </Flex>
                              </Paper>
                            }
                          />
                        ))}
                      </Group>
                    </Radio.Group>
                  </ScrollArea>
                </div>
              </>
            )}

            <Group justify="flex-end" mt="md">
              <Button 
                variant="light" 
                onClick={() => setModalOpened(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                loading={loading}
              >
                {editingTransaction ? 'Atualizar' : 'Salvar'} Lançamento
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}