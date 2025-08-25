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
  Anchor
} from '@mantine/core';
import { Link } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { 
  IconPlus, 
  IconPencil, 
  IconTrash, 
  IconAlertCircle,
  IconCreditCard,
  IconRefresh
} from '@tabler/icons-react';
import api from '../api';
import { notifications } from '@mantine/notifications';

export function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [error, setError] = useState('');
  const [syncingAccounts, setSyncingAccounts] = useState(new Set());

  const form = useForm({
    initialValues: {
      name: '',
      type: '',
      institution: '',
      balance: 0.00,
      credit_limit: 0.00,
      invoice_due_day: null,
      public_address: ''
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Nome deve ter pelo menos 2 caracteres' : null),
      type: (value) => (!value ? 'Tipo é obrigatório' : null)
    }
  });

  const accountTypes = [
    { value: 'CONTA_CORRENTE', label: 'CORRENTE' },
    { value: 'POUPANCA', label: 'POUPANCA' },
    { value: 'CORRETORA_NACIONAL', label: 'CORRETORA NACIONAL' },
    { value: 'CORRETORA_INTERNACIONAL', label: 'CORRETORA INTERNACIONAL' },
    { value: 'CORRETORA_CRIPTO', label: 'CORRETORA CRIPTO' },
    { value: 'CARTEIRA_CRIPTO', label: 'CARTEIRA CRIPTO' },
    { value: 'CARTAO_CREDITO', label: 'CARTAO DE CRÉDITO' },
    { value: 'DINHEIRO_VIVO', label: 'DINHEIRO VIVO' }
  ];

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data.accounts || []);
    } catch (err) {
      setError('Erro ao carregar contas');
      console.error('Error loading accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const openCreateModal = () => {
    setEditingAccount(null);
    form.reset();
    setModalOpened(true);
  };

  const openEditModal = (account) => {
    setEditingAccount(account);
    // Para edição, garantir que o saldo atual seja exibido no formulário
    form.setValues({
      ...account,
      balance: account.balance || 0.00  // Saldo atual calculado dinamicamente
    });
    setModalOpened(true);
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    
    try {
      if (editingAccount) {
        values.name = values.name.endsWith(' ') ? values.name.slice(0, -1) : `${values.name} `;
        
        await api.put(`/accounts/${editingAccount.id}`, values);
        
        // Feedback específico para ajuste de saldo
        const balanceChanged = values.balance !== editingAccount.balance;
        if (balanceChanged) {
          notifications.show({
            title: 'Saldo Ajustado!',
            message: `O saldo da conta foi ajustado e uma transação de ajuste foi criada automaticamente`,
            color: 'green',
            autoClose: 5000,
          });
        } else {
          notifications.show({
            title: 'Conta Atualizada!',
            message: `As informações da conta foram atualizadas com sucesso`,
            color: 'blue',
            autoClose: 3000,
          });
        }
      } else {
        await api.post('/accounts', values);
        
        // Feedback para nova conta
        const hasInitialBalance = values.balance > 0;
        if (hasInitialBalance) {
          notifications.show({
            title: 'Conta Criada!',
            message: `Conta criada com saldo inicial de R$ ${values.balance.toFixed(2)}. Uma transação de "Saldo Inicial" foi registrada automaticamente.`,
            color: 'green',
            autoClose: 5000,
          });
        } else {
          notifications.show({
            title: 'Conta Criada!',
            message: `Nova conta criada com sucesso`,
            color: 'blue',
            autoClose: 3000,
          });
        }
      }

      setModalOpened(false);
      await loadAccounts();
    } catch (err) {
      setError(editingAccount ? 'Erro ao atualizar conta' : 'Erro ao criar conta');
      console.error('Error submitting account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (accountId) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
    
    setLoading(true);
    setError('');
    
    try {
      await api.delete(`/accounts/${accountId}`);
      await loadAccounts();
    } catch (err) {
      setError('Erro ao excluir conta');
      console.error('Error deleting account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWallet = async (accountId, accountName) => {
    setSyncingAccounts(prev => new Set([...prev, accountId]));
    
    try {
      const response = await api.post(`/accounts/${accountId}/sync`);
      
      notifications.show({
        title: 'Sincronização Completa!',
        message: `${accountName} foi sincronizada com a blockchain`,
        color: 'green',
        autoClose: 4000,
      });

      // Informar sobre tokens sincronizados
      const syncResult = response.data.sync_result;
      if (syncResult && syncResult.tokens_synced > 0) {
        setTimeout(() => {
          notifications.show({
            title: 'Tokens Sincronizados',
            message: `${syncResult.tokens_synced} tokens atualizados`,
            color: 'blue',
            autoClose: 3000,
          });
        }, 1000);
      }

      // Recarregar lista de contas para mostrar saldos atualizados
      await loadAccounts();
    } catch (err) {
      setError('Erro ao sincronizar carteira');
      notifications.show({
        title: 'Erro na Sincronização',
        message: 'Não foi possível sincronizar a carteira. Tente novamente.',
        color: 'red',
        autoClose: 5000,
      });
      console.error('Error syncing wallet:', err);
    } finally {
      setSyncingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }
  };

  const getAccountTypeLabel = (type) => {
    const accountType = accountTypes.find(t => t.value === type);
    return accountType ? accountType.label : type;
  };

  const getBalanceColor = (balance, accountType) => {
    // Para contas CRIPTO, usar azul (cor de investimento)
    if (accountType === 'CARTEIRA_CRIPTO' || accountType === 'CORRETORA_CRIPTO') {
      return 'blue';
    }
    // Para outras contas, manter lógica verde/vermelho
    return balance >= 0 ? 'green' : 'red';
  };

  return (
    <Stack gap="md">
      <Title order={2}>Gerenciador de Contas</Title>
      
      {error && (
        <Alert icon={<IconAlertCircle size="1rem" />} color="red">
          {error}
        </Alert>
      )}

      <Group justify="flex-start">
        <Button 
          leftSection={<IconPlus size={14} />}
          onClick={openCreateModal}
          loading={loading}
        >
          Nova Conta
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Tipo</Table.Th>
            <Table.Th>Instituição</Table.Th>
            <Table.Th>Saldo</Table.Th>
            <Table.Th width={120}>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {accounts.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                <Text c="dimmed">
                  {loading ? 'Carregando contas...' : 'Nenhuma conta encontrada'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            accounts.map((account) => (
              <Table.Tr key={account.id}>
                <Table.Td>
                  <Group gap="sm">
                    <IconCreditCard size={16} />
                    <Anchor 
                      component={Link} 
                      to={
                        (account.type === 'CARTEIRA_CRIPTO' || account.type === 'CORRETORA_CRIPTO') 
                          ? `/contas/cripto/${account.id}` 
                          : `/contas/${account.id}`
                      } 
                      fw={500}
                    >
                      {account.name}
                    </Anchor>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">
                    {getAccountTypeLabel(account.type)}
                  </Badge>
                </Table.Td>
                <Table.Td>{account.institution || '-'}</Table.Td>
                <Table.Td>
                  <Text c={getBalanceColor(account.balance, account.type)} fw={500}>
                    R$ {Number(account.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {(account.type === 'CARTEIRA_CRIPTO' || account.type === 'CORRETORA_CRIPTO') && (
                      <ActionIcon
                        variant="light"
                        color="green"
                        onClick={() => handleSyncWallet(account.id, account.name)}
                        loading={syncingAccounts.has(account.id)}
                        disabled={loading || syncingAccounts.has(account.id)}
                        title="Sincronizar com blockchain"
                      >
                        <IconRefresh size={14} />
                      </ActionIcon>
                    )}
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => openEditModal(account)}
                      disabled={loading}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleDelete(account.id)}
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
        title={editingAccount ? 'Editar Conta' : 'Nova Conta'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Nome da Conta"
              placeholder="Ex: Banco do Brasil - Conta Corrente"
              {...form.getInputProps('name')}
            />

            <Select
              label="Tipo de Conta"
              data={accountTypes}
              {...form.getInputProps('type')}
            />

            <TextInput
              label="Instituição"
              placeholder="Ex: Banco do Brasil, Nubank, Binance"
              {...form.getInputProps('institution')}
            />

            <NumberInput
              label={editingAccount ? "Saldo Atual (Ajustar)" : "Saldo Inicial"}
              placeholder="0.00"
              decimalScale={2}
              fixedDecimalScale
              {...form.getInputProps('balance')}
              description={editingAccount ? 
                "Altere este valor para ajustar automaticamente o saldo da conta através de transações" : 
                "Valor inicial que a conta possui no momento da criação"
              }
            />

            {['CARTEIRA_CRIPTO', 'CORRETORA_CRIPTO'].includes(form.values.type) && (
              <TextInput
                label="Endereço Público (Opcional)"
                placeholder="0x..."
                {...form.getInputProps('public_address')}
              />
            )}

            {form.values.type === 'CARTAO_CREDITO' && (
              <>
                <NumberInput
                  label="Limite de Crédito Total"
                  placeholder="0.00"
                  decimalScale={2}
                  fixedDecimalScale
                  {...form.getInputProps('credit_limit')}
                />

                <NumberInput
                  label="Dia de Vencimento da Fatura"
                  placeholder="10"
                  min={1}
                  max={31}
                  {...form.getInputProps('invoice_due_day')}
                />
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
                {editingAccount ? 'Atualizar' : 'Criar'} Conta
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}