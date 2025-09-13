import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Select,
  NumberInput,
  Textarea,
  Button,
  Card,
  SimpleGrid,
  Paper,
  Alert,
  Badge,
  Avatar,
  Space,
  Divider,
  LoadingOverlay
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { 
  IconShoppingCart, 
  IconX, 
  IconSearch, 
  IconWallet, 
  IconPigMoney, 
  IconCoins, 
  IconCalendar,
  IconArrowDown,
  IconArrowUp,
  IconAlertTriangle,
  IconCheck
} from '@tabler/icons-react';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';
import { getAssetClassColor } from '../utils/assetUtils';
import AssetSelectItem from './AssetSelectItem';
import AccountSelectItem from './AccountSelectItem';
import api from '../api';

const AssetPurchaseModal = ({ opened, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assets, setAssets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [originAccount, setOriginAccount] = useState(null);
  const [investmentAccount, setInvestmentAccount] = useState(null);

  const form = useForm({
    initialValues: {
      asset_id: '',
      account_id: '',
      investment_account_id: '',
      quantity: '',
      price_per_unit: '',
      purchase_date: new Date(),
      fee: '',
      notes: ''
    },
    validate: {
      asset_id: (value) => !value ? 'Selecione um ativo' : null,
      account_id: (value) => !value ? 'Selecione a conta de origem' : null,
      investment_account_id: (value, values) => {
        if (!value) return 'Selecione a conta de investimento';
        if (value === values.account_id) return 'Contas devem ser diferentes';
        return null;
      },
      quantity: (value) => {
        if (!value || value <= 0) return 'Quantidade deve ser maior que zero';
        if (value > 999999999) return 'Quantidade muito alta';
        return null;
      },
      price_per_unit: (value) => {
        if (!value || value <= 0) return 'Preço deve ser maior que zero';
        return null;
      }
    }
  });

  // Cálculos em tempo real
  const calculations = useMemo(() => {
    const quantity = parseFloat(form.values.quantity) || 0;
    const pricePerUnit = parseFloat(form.values.price_per_unit) || 0;
    const fee = parseFloat(form.values.fee) || 0;
    
    const subtotal = quantity * pricePerUnit;
    const totalAmount = subtotal + fee;
    const remainingBalance = originAccount ? (originAccount.balance - totalAmount) : 0;

    return {
      subtotal,
      totalAmount,
      remainingBalance,
      isValidAmount: totalAmount > 0,
      hasSufficientFunds: remainingBalance >= 0
    };
  }, [form.values.quantity, form.values.price_per_unit, form.values.fee, originAccount]);

  // Carregar dados ao abrir modal
  useEffect(() => {
    if (opened) {
      loadData();
      form.reset();
      setSelectedAsset(null);
      setOriginAccount(null);
      setInvestmentAccount(null);
    }
  }, [opened]);

  // Atualizar asset selecionado
  useEffect(() => {
    const asset = assets.find(a => a.id.toString() === form.values.asset_id);
    setSelectedAsset(asset);
    
    // Auto-preencher preço atual se disponível
    if (asset && asset.last_price_brl && !form.values.price_per_unit) {
      form.setFieldValue('price_per_unit', asset.last_price_brl);
    }
  }, [form.values.asset_id, assets]);

  // Atualizar contas selecionadas
  useEffect(() => {
    setOriginAccount(accounts.find(a => a.id.toString() === form.values.account_id));
  }, [form.values.account_id, accounts]);

  useEffect(() => {
    setInvestmentAccount(accounts.find(a => a.id.toString() === form.values.investment_account_id));
  }, [form.values.investment_account_id, accounts]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assetsResponse, accountsResponse] = await Promise.all([
        api.get('/assets'),
        api.get('/accounts')
      ]);
      
      setAssets(assetsResponse.data || []);
      setAccounts(accountsResponse.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      notifications.show({
        title: 'Erro',
        message: 'Erro ao carregar dados. Tente novamente.',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const useCurrentPrice = () => {
    if (selectedAsset && selectedAsset.last_price_brl) {
      form.setFieldValue('price_per_unit', selectedAsset.last_price_brl);
    }
  };

  const handleSubmit = async (values) => {
    if (!calculations.hasSufficientFunds) {
      notifications.show({
        title: 'Saldo Insuficiente',
        message: 'A conta selecionada não possui saldo suficiente para esta operação.',
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      // Formatar dados para o backend
      const purchaseData = {
        asset_id: parseInt(values.asset_id),
        account_id: parseInt(values.account_id),
        investment_account_id: parseInt(values.investment_account_id),
        quantity: values.quantity.toString(),
        price_per_unit: values.price_per_unit.toString(),
        purchase_date: values.purchase_date.toISOString().split('T')[0],
        fee: values.fee ? values.fee.toString() : '0',
        notes: values.notes || null
      };

      const response = await api.post('/portfolio/buy-asset', purchaseData);

      // Feedback de sucesso
      notifications.show({
        title: 'Compra Realizada!',
        message: `${values.quantity} ${selectedAsset.symbol} adquiridos com sucesso`,
        color: 'green',
        icon: <IconCheck />
      });

      // Callback de sucesso
      if (onSuccess) {
        onSuccess(response.data);
      }

      onClose();
    } catch (error) {
      console.error('Error purchasing asset:', error);
      notifications.show({
        title: 'Erro na Compra',
        message: error.response?.data?.detail || 'Erro interno. Tente novamente.',
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Preparar dados para selects
  const assetsSelectData = assets.map(asset => ({
    value: asset.id.toString(),
    label: `${asset.symbol} - ${asset.name}`,
    ...asset
  }));

  const accountsSelectData = accounts.map(account => ({
    value: account.id.toString(),
    label: account.name,
    ...account
  }));

  const investmentAccountsData = accounts
    .filter(account => ['CORRETORA_NACIONAL', 'CORRETORA_CRIPTO', 'CARTEIRA_CRIPTO'].includes(account.type))
    .map(account => ({
      value: account.id.toString(),
      label: account.name,
      ...account
    }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group>
          <IconShoppingCart size={24} color="var(--mantine-color-green-6)" />
          <Text size="lg" weight={600}>Compra de Ativo</Text>
        </Group>
      }
      size="xl"
      centered
      overlayProps={{ opacity: 0.55, blur: 3 }}
      transitionProps={{ transition: 'fade', duration: 200 }}
    >
      <LoadingOverlay visible={loading} />
      
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack spacing="lg">
          {/* Seleção de Ativo */}
          <Stack spacing="sm">
            <Select
              label="Ativo a Comprar"
              placeholder="Busque por símbolo ou nome..."
              searchable
              size="md"
              leftSection={<IconSearch size={20} />}
              data={assetsSelectData}
              itemComponent={AssetSelectItem}
              {...form.getInputProps('asset_id')}
            />
            
            {/* Card com informações do ativo selecionado */}
            {selectedAsset && (
              <Card withBorder radius="md" p="md" bg="gray.0" style={{
                background: 'linear-gradient(145deg, var(--mantine-color-blue-0) 0%, var(--mantine-color-cyan-0) 100%)',
                transition: 'all 0.2s ease'
              }}>
                <Group>
                  <Avatar src={selectedAsset.icon_url} size="lg" radius="sm" />
                  <div>
                    <Text weight={600} size="lg">{selectedAsset.symbol}</Text>
                    <Text size="sm" color="dimmed">{selectedAsset.name}</Text>
                    <Badge color={getAssetClassColor(selectedAsset.asset_class)} variant="light">
                      {selectedAsset.asset_class}
                    </Badge>
                  </div>
                  <Space style={{ flex: 1 }} />
                  <div style={{ textAlign: 'right' }}>
                    <Text size="sm" color="dimmed">Preço Atual</Text>
                    <Text weight={600} color="green" size="lg">
                      R$ {formatCurrency(selectedAsset.last_price_brl || 0)}
                    </Text>
                    {selectedAsset.last_price_updated_at && (
                      <Text size="xs" color="dimmed">
                        Atualizado: {formatRelativeTime(selectedAsset.last_price_updated_at)}
                      </Text>
                    )}
                  </div>
                </Group>
              </Card>
            )}
          </Stack>

          {/* Dados da Compra */}
          <SimpleGrid cols={2} spacing="md">
            <Select
              label="Conta de Origem"
              description="Conta de onde sairá o dinheiro"
              placeholder="Selecione a conta..."
              leftSection={<IconWallet size={20} />}
              data={accountsSelectData}
              itemComponent={AccountSelectItem}
              size="md"
              {...form.getInputProps('account_id')}
            />
            
            <Select
              label="Conta de Investimento"
              description="Onde ficará registrado o ativo"
              placeholder="Selecione a conta..."
              leftSection={<IconPigMoney size={20} />}
              data={investmentAccountsData}
              itemComponent={AccountSelectItem}
              size="md"
              {...form.getInputProps('investment_account_id')}
            />
            
            <NumberInput
              label="Quantidade"
              description="Quantidade do ativo a comprar"
              placeholder="0.00000000"
              leftSection={<IconCoins size={20} />}
              precision={8}
              size="md"
              min={0}
              step={0.00000001}
              rightSection={selectedAsset && (
                <Text size="xs" color="dimmed" pr="sm">
                  {selectedAsset.symbol}
                </Text>
              )}
              {...form.getInputProps('quantity')}
            />
            
            <NumberInput
              label="Preço por Unidade"
              description="Preço pago por unidade (BRL)"
              placeholder="0.00"
              leftSection={<Text size="sm" color="dimmed">R$</Text>}
              precision={8}
              size="md"
              min={0}
              rightSection={selectedAsset && selectedAsset.last_price_brl && (
                <Button 
                  size="xs" 
                  variant="subtle" 
                  onClick={useCurrentPrice}
                  mr="sm"
                >
                  Atual
                </Button>
              )}
              {...form.getInputProps('price_per_unit')}
            />
          </SimpleGrid>

          {/* Informações Adicionais */}
          <SimpleGrid cols={2} spacing="md">
            <DateInput
              label="Data da Compra"
              description="Data em que a compra foi realizada"
              placeholder="Selecione a data..."
              leftSection={<IconCalendar size={20} />}
              maxDate={new Date()}
              size="md"
              valueFormat="DD/MM/YYYY"
              {...form.getInputProps('purchase_date')}
            />
            
            <NumberInput
              label="Taxas e Custos"
              description="Corretagem, taxas, etc. (opcional)"
              placeholder="0.00"
              leftSection={<Text size="sm" color="dimmed">R$</Text>}
              precision={2}
              size="md"
              min={0}
              {...form.getInputProps('fee')}
            />
          </SimpleGrid>

          <Textarea
            label="Observações"
            description="Informações adicionais (opcional)"
            placeholder="Ex: Primeira compra deste ativo..."
            minRows={2}
            maxRows={4}
            autosize
            {...form.getInputProps('notes')}
          />

          {/* Preview & Resumo da Operação */}
          {calculations.isValidAmount && (
            <Card withBorder radius="md" p="lg" style={{
              background: 'linear-gradient(145deg, var(--mantine-color-blue-0) 0%, var(--mantine-color-cyan-0) 100%)',
              border: '2px solid var(--mantine-color-blue-2)'
            }}>
              <Group position="apart" mb="md">
                <Text weight={600} size="lg">Resumo da Operação</Text>
                <Badge color="blue" variant="light">Preview</Badge>
              </Group>
              
              <SimpleGrid cols={2} spacing="xl">
                {/* Coluna Esquerda - Detalhes */}
                <Stack spacing="xs">
                  <Group position="apart">
                    <Text size="sm" color="dimmed">Ativo:</Text>
                    <Text weight={500}>
                      {form.values.quantity} {selectedAsset?.symbol}
                    </Text>
                  </Group>
                  <Group position="apart">
                    <Text size="sm" color="dimmed">Preço Unitário:</Text>
                    <Text weight={500}>R$ {formatCurrency(form.values.price_per_unit)}</Text>
                  </Group>
                  <Group position="apart">
                    <Text size="sm" color="dimmed">Subtotal:</Text>
                    <Text weight={500}>R$ {formatCurrency(calculations.subtotal)}</Text>
                  </Group>
                  <Group position="apart">
                    <Text size="sm" color="dimmed">Taxas:</Text>
                    <Text weight={500}>R$ {formatCurrency(form.values.fee || 0)}</Text>
                  </Group>
                  <Divider />
                  <Group position="apart">
                    <Text weight={600}>Total a Pagar:</Text>
                    <Text weight={700} size="lg" color="red">
                      R$ {formatCurrency(calculations.totalAmount)}
                    </Text>
                  </Group>
                </Stack>
                
                {/* Coluna Direita - Contas */}
                <Stack spacing="xs">
                  <Text size="sm" weight={500} color="dimmed">Movimentações:</Text>
                  
                  {/* Saída de Caixa */}
                  {originAccount && (
                    <Paper withBorder p="sm" radius="sm" bg="red.0">
                      <Group>
                        <IconArrowDown color="var(--mantine-color-red-6)" size={20} />
                        <div>
                          <Text size="sm" weight={500}>{originAccount.name}</Text>
                          <Text size="xs" color="dimmed">Saída</Text>
                        </div>
                        <Space style={{ flex: 1 }} />
                        <Text color="red" weight={600}>
                          -R$ {formatCurrency(calculations.totalAmount)}
                        </Text>
                      </Group>
                    </Paper>
                  )}
                  
                  {/* Entrada de Ativo */}
                  {investmentAccount && selectedAsset && (
                    <Paper withBorder p="sm" radius="sm" bg="green.0">
                      <Group>
                        <IconArrowUp color="var(--mantine-color-green-6)" size={20} />
                        <div>
                          <Text size="sm" weight={500}>{investmentAccount.name}</Text>
                          <Text size="xs" color="dimmed">Compra</Text>
                        </div>
                        <Space style={{ flex: 1 }} />
                        <Text color="green" weight={600}>
                          +{form.values.quantity} {selectedAsset.symbol}
                        </Text>
                      </Group>
                    </Paper>
                  )}
                  
                  {/* Saldo Resultante */}
                  {originAccount && (
                    <Group position="apart" mt="sm">
                      <Text size="sm" color="dimmed">Saldo Após Operação:</Text>
                      <Text 
                        weight={600} 
                        color={calculations.remainingBalance >= 0 ? 'green' : 'red'}
                      >
                        R$ {formatCurrency(calculations.remainingBalance)}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </SimpleGrid>
              
              {/* Alerta de Saldo Insuficiente */}
              {!calculations.hasSufficientFunds && originAccount && (
                <Alert 
                  color="red" 
                  icon={<IconAlertTriangle />} 
                  title="Saldo Insuficiente"
                  mt="md"
                >
                  A conta selecionada não possui saldo suficiente para esta operação.
                  Saldo atual: R$ {formatCurrency(originAccount.balance)}
                </Alert>
              )}
            </Card>
          )}

          {/* Ações */}
          <Group position="right" mt="xl">
            <Button
              variant="subtle"
              color="gray"
              onClick={onClose}
              leftIcon={<IconX size={16} />}
            >
              Cancelar
            </Button>
            
            <Button
              type="submit"
              color="green"
              size="md"
              leftIcon={<IconShoppingCart size={16} />}
              loading={submitting}
              disabled={!form.isValid() || !calculations.hasSufficientFunds || !calculations.isValidAmount}
            >
              {submitting ? 'Processando...' : 'Confirmar Compra'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default AssetPurchaseModal;