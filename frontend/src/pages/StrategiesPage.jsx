import React, { useState, useEffect, useCallback } from 'react';
import { 
  Title, 
  Button, 
  Table, 
  Modal, 
  TextInput, 
  Textarea, 
  Select, 
  NumberInput,
  Stack, 
  Group, 
  ActionIcon,
  Alert,
  Tooltip,
  Box,
  Text
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { 
  IconPlus, 
  IconPencil, 
  IconTrash, 
  IconHelpCircle,
  IconAlertCircle,
  IconDeviceFloppy
} from '@tabler/icons-react';
import api from '../api';
import { TokenInput } from '../components/TokenInput';
import { findTokenByAddress } from '../utils/tokenConstants';

export function StrategiesPage() {
  // Estados do componente
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [strategyToDelete, setStrategyToDelete] = useState(null);
  const [error, setError] = useState('');

  // Formulário do Mantine
  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      type: 'PRICE_TRIGGER',
      targetPrice: '',
      tokenToSpendAddress: null,
      tokenToBuyAddress: null,
      amountToSpend: ''
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Nome deve ter pelo menos 2 caracteres' : null),
      targetPrice: (value, values) => {
        if (values.type === 'PRICE_TRIGGER' && (!value || value <= 0)) {
          return 'Preço alvo deve ser maior que zero';
        }
        return null;
      },
      tokenToSpendAddress: (value, values) => {
        if (values.type === 'PRICE_TRIGGER' && !value) {
          return 'Token a ser gasto é obrigatório';
        }
        return null;
      },
      tokenToBuyAddress: (value, values) => {
        if (values.type === 'PRICE_TRIGGER' && !value) {
          return 'Token a ser comprado é obrigatório';
        }
        return null;
      },
      amountToSpend: (value, values) => {
        if (values.type === 'PRICE_TRIGGER' && (!value || value <= 0)) {
          return 'Quantidade a gastar deve ser maior que zero';
        }
        return null;
      }
    }
  });

  // Carregar estratégias
  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/strategies');
      setStrategies(response.data.strategies || []);
    } catch (err) {
      setError('Erro ao carregar estratégias');
      console.error('Error loading strategies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar estratégias ao montar o componente
  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  // Abrir modal para criar nova estratégia
  const openCreateModal = () => {
    setEditingStrategy(null);
    form.reset();
    setModalOpened(true);
  };

  // Abrir modal para editar estratégia
  const openEditModal = (strategy) => {
    setEditingStrategy(strategy);
    
    // Preencher formulário com dados da estratégia
    const tokenToSpend = strategy.parameters?.tokenToSpendAddress 
      ? findTokenByAddress(strategy.parameters.tokenToSpendAddress) 
      : null;
    const tokenToBuy = strategy.parameters?.tokenToBuyAddress 
      ? findTokenByAddress(strategy.parameters.tokenToBuyAddress) 
      : null;
      
    form.setValues({
      name: strategy.name || '',
      description: strategy.description || '',
      type: strategy.parameters?.type || 'PRICE_TRIGGER',
      targetPrice: strategy.parameters?.targetPrice || '',
      tokenToSpendAddress: tokenToSpend,
      tokenToBuyAddress: tokenToBuy,
      amountToSpend: strategy.parameters?.amountToSpend || ''
    });
    
    setModalOpened(true);
  };

  // Abrir modal de confirmação de exclusão
  const openDeleteModal = (strategy) => {
    setStrategyToDelete(strategy);
    setDeleteModalOpened(true);
  };

  // Submeter formulário (criar ou editar)
  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    
    try {
      // Construir objeto de dados da estratégia
      const strategyData = {
        name: values.name,
        description: values.description,
        parameters: {
          type: values.type,
          targetPrice: parseFloat(values.targetPrice),
          tokenToSpendAddress: values.tokenToSpendAddress?.address || values.tokenToSpendAddress,
          tokenToBuyAddress: values.tokenToBuyAddress?.address || values.tokenToBuyAddress,
          amountToSpend: parseFloat(values.amountToSpend)
        }
      };

      if (editingStrategy) {
        // Atualizar estratégia existente
        await api.put(`/strategies/${editingStrategy.id}`, strategyData);
      } else {
        // Criar nova estratégia
        await api.post('/strategies', strategyData);
      }

      // Fechar modal e recarregar lista
      setModalOpened(false);
      await loadStrategies();
    } catch (err) {
      setError(editingStrategy ? 'Erro ao atualizar estratégia' : 'Erro ao criar estratégia');
      console.error('Error submitting strategy:', err);
    } finally {
      setLoading(false);
    }
  };

  // Confirmar exclusão
  const confirmDelete = async () => {
    if (!strategyToDelete) return;
    
    setLoading(true);
    setError('');
    
    try {
      await api.delete(`/strategies/${strategyToDelete.id}`);
      setDeleteModalOpened(false);
      setStrategyToDelete(null);
      await loadStrategies();
    } catch (err) {
      setError('Erro ao excluir estratégia');
      console.error('Error deleting strategy:', err);
    } finally {
      setLoading(false);
    }
  };

  // Opções do select de tipo
  const strategyTypes = [
    { value: 'PRICE_TRIGGER', label: 'Gatilho de Preço Simples' }
  ];

  return (
    <Stack gap="md">
      <Title order={2}>Gerenciador de Estratégias</Title>
      
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
          Criar Nova Estratégia
        </Button>
      </Group>

      {/* Tabela de estratégias */}
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Descrição</Table.Th>
            <Table.Th>Tipo</Table.Th>
            <Table.Th width={120}>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {strategies.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                <Text c="dimmed">
                  {loading ? 'Carregando estratégias...' : 'Nenhuma estratégia encontrada'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            strategies.map((strategy) => (
              <Table.Tr key={strategy.id}>
                <Table.Td>{strategy.name}</Table.Td>
                <Table.Td>{strategy.description || '-'}</Table.Td>
                <Table.Td>
                  {strategy.parameters?.type === 'PRICE_TRIGGER' ? 'Gatilho de Preço' : strategy.parameters?.type || '-'}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => openEditModal(strategy)}
                      disabled={loading}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => openDeleteModal(strategy)}
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

      {/* Modal de criação/edição */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingStrategy ? 'Editar Estratégia' : 'Configurar Nova Estratégia'}
        size="xl"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="xl">
            {/* Seção: Informações Básicas */}
            <Stack gap="sm">
              <Text size="sm" fw={500} c="dimmed">Informações Básicas</Text>
              <TextInput
                label={<Text size="sm" fw={500}>Nome da Estratégia</Text>}
                placeholder="Ex: Acumular MATIC em baixas de mercado"
                variant="filled"
                {...form.getInputProps('name')}
              />
              <Textarea
                label={<Text size="sm" fw={500}>Descrição</Text>}
                placeholder="O objetivo desta automação é comprar X de token Y toda vez que o preço cair abaixo de Z..."
                rows={3}
                variant="filled"
                {...form.getInputProps('description')}
              />
            </Stack>


            {/* Seção: Tipo de Estratégia */}
            <Stack gap="sm">
              <Text size="sm" fw={500} c="dimmed">Tipo de Automação</Text>
              <Select
                label={<Text size="sm" fw={500}>Estratégia</Text>}
                data={strategyTypes}
                variant="filled"
                {...form.getInputProps('type')}
              />
            </Stack>

            {/* Seção: Parâmetros */}
            {form.values.type === 'PRICE_TRIGGER' && (
              <Stack gap="sm">
                <Text size="sm" fw={500} c="dimmed">Parâmetros da Automação</Text>
                <Stack gap="md">
                  <Group align="start">
                    <NumberInput
                      label={<Text size="sm" fw={500}>Preço de Ativação (USD)</Text>}
                      placeholder="Ex: 0.85"
                      decimalScale={6}
                      fixedDecimalScale={false}
                      variant="filled"
                      style={{ flex: 1 }}
                      {...form.getInputProps('targetPrice')}
                    />
                    <Tooltip label="O preço em USD que o oráculo da Chainlink irá monitorar. A ordem de compra será executada se o preço real for igual ou menor que este valor.">
                      <IconHelpCircle size={16} style={{ marginTop: 28, color: 'var(--mantine-color-gray-6)' }} />
                    </Tooltip>
                  </Group>

                  <Group align="start">
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" fw={500} mb={4}>Usar este Ativo para Comprar</Text>
                      <TokenInput
                        placeholder="Selecionar ativo de pagamento"
                        {...form.getInputProps('tokenToSpendAddress')}
                      />
                    </Box>
                    <Tooltip label="O ativo que será usado para realizar a compra (normalmente stablecoin como USDC). Certifique-se de ter saldo suficiente no Vault.">
                      <IconHelpCircle size={16} style={{ marginTop: 28, color: 'var(--mantine-color-gray-6)' }} />
                    </Tooltip>
                  </Group>

                  <Group align="start">
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" fw={500} mb={4}>Comprar este Ativo</Text>
                      <TokenInput
                        placeholder="Selecionar ativo alvo"
                        {...form.getInputProps('tokenToBuyAddress')}
                      />
                    </Box>
                    <Tooltip label="O ativo que será comprado quando o preço de ativação for atingido.">
                      <IconHelpCircle size={16} style={{ marginTop: 28, color: 'var(--mantine-color-gray-6)' }} />
                    </Tooltip>
                  </Group>

                  <Group align="start">
                    <NumberInput
                      label={<Text size="sm" fw={500}>Quantidade a Gastar por Operação</Text>}
                      placeholder="Ex: 100"
                      decimalScale={6}
                      fixedDecimalScale={false}
                      variant="filled"
                      style={{ flex: 1 }}
                      {...form.getInputProps('amountToSpend')}
                    />
                    <Tooltip label="A quantidade exata de 'Ativo para Comprar' que o Vault usará nesta operação de compra. Certifique-se de ter saldo suficiente no Vault.">
                      <IconHelpCircle size={16} style={{ marginTop: 28, color: 'var(--mantine-color-gray-6)' }} />
                    </Tooltip>
                  </Group>
                </Stack>
              </Stack>
            )}

            <Group justify="flex-end" mt="xl">
              <Button 
                variant="light" 
                onClick={() => setModalOpened(false)}
                disabled={loading}
                radius="md"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                loading={loading}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                leftSection={<IconDeviceFloppy size={18} />}
                radius="md"
              >
                {editingStrategy ? 'Atualizar' : 'Salvar'} Estratégia
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <Stack>
          <Text>
            Tem certeza que deseja excluir a estratégia "{strategyToDelete?.name}"?
            Esta ação não pode ser desfeita.
          </Text>
          <Group justify="flex-end">
            <Button 
              variant="light" 
              onClick={() => setDeleteModalOpened(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              color="red" 
              onClick={confirmDelete}
              loading={loading}
            >
              Excluir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}