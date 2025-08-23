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
    { value: 'CONTA_CORRENTE', label: 'Conta Corrente' },
    { value: 'POUPANCA', label: 'Poupança' },
    { value: 'CORRETORA_NACIONAL', label: 'Corretora Nacional' },
    { value: 'CORRETORA_CRIPTO', label: 'Corretora Cripto' },
    { value: 'CARTEIRA_CRIPTO', label: 'Carteira Cripto' },
    { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
    { value: 'DINHEIRO_VIVO', label: 'Dinheiro Vivo' }
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
    form.setValues(account);
    setModalOpened(true);
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    
    try {
      if (editingAccount) {
        await api.put(`/accounts/${editingAccount.id}`, values);
      } else {
        await api.post('/accounts', values);
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

  const getBalanceColor = (balance) => {
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
                    <Anchor component={Link} to={`/contas/${account.id}`} fw={500}>
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
                  <Text c={getBalanceColor(account.balance)} fw={500}>
                    R$ {Number(account.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {account.type === 'CARTEIRA_CRIPTO' && (
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
              label="Saldo Inicial"
              placeholder="0.00"
              decimalScale={2}
              fixedDecimalScale
              {...form.getInputProps('balance')}
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
                  label="Limite de Crédito"
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