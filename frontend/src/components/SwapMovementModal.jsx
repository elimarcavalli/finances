import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Stack,
  Group,
  TextInput,
  NumberInput,
  Button,
  Select,
  Text,
  Box,
  Avatar,
  Badge,
  Divider,
  Alert,
  Loader,
  ActionIcon,
  Tooltip,
  Card
} from '@mantine/core';
import {
  IconArrowsExchange2,
  IconCalendar,
  IconCoin,
  IconInfoCircle,
  IconArrowDown,
  IconX
} from '@tabler/icons-react';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { getAuthToken } from '../utils/auth';
import { handleApiError, handleApiSuccess } from '../utils/errorHandler';

export function SwapMovementModal({ 
  isOpen, 
  onClose, 
  onSwapSuccess, 
  accounts = [], 
  cryptoAssets = [] 
}) {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Formulário usando Mantine Form
  const form = useForm({
    initialValues: {
      account_id: '',
      from_asset_id: '',
      to_asset_id: '',
      from_quantity: '',
      to_quantity: '',
      movement_date: new Date(),
      fee: 0,
      notes: ''
    },
    validate: {
      account_id: (value) => (!value ? 'Selecione uma conta' : null),
      from_asset_id: (value) => (!value ? 'Selecione o ativo vendido' : null),
      to_asset_id: (value) => (!value ? 'Selecione o ativo comprado' : null),
      from_quantity: (value) => {
        if (!value || value <= 0) return 'Quantidade deve ser maior que zero';
        return null;
      },
      to_quantity: (value) => {
        if (!value || value <= 0) return 'Quantidade deve ser maior que zero';
        return null;
      },
      movement_date: (value) => (!value ? 'Data é obrigatória' : null),
      fee: (value) => {
        if (value < 0) return 'Taxa não pode ser negativa';
        return null;
      }
    }
  });

  // Filtrar apenas contas de cripto
  const cryptoAccounts = useMemo(() => {
    return accounts.filter(account => 
      account.type === 'CORRETORA_CRIPTO' || account.type === 'CARTEIRA_CRIPTO'
    );
  }, [accounts]);

  // Preparar dados dos ativos para os selects
  const assetSelectData = useMemo(() => {
    return cryptoAssets.map(asset => ({
      value: asset.id.toString(),
      label: `${asset.name} (${asset.symbol})`,
      symbol: asset.symbol,
      icon_url: asset.icon_url,
      current_price_brl: asset.current_price_brl,
      asset: asset
    }));
  }, [cryptoAssets]);

  // Preparar dados das contas para o select
  const accountSelectData = useMemo(() => {
    return cryptoAccounts.map(account => ({
      value: account.id.toString(),
      label: account.name,
      type: account.type,
      balance: account.balance
    }));
  }, [cryptoAccounts]);

  // Obter dados dos ativos selecionados
  const selectedFromAsset = useMemo(() => {
    if (!form.values.from_asset_id) return null;
    return assetSelectData.find(asset => asset.value === form.values.from_asset_id);
  }, [form.values.from_asset_id, assetSelectData]);

  const selectedToAsset = useMemo(() => {
    if (!form.values.to_asset_id) return null;
    return assetSelectData.find(asset => asset.value === form.values.to_asset_id);
  }, [form.values.to_asset_id, assetSelectData]);

  // Calcular preview da operação
  useEffect(() => {
    const { from_asset_id, to_asset_id, from_quantity, to_quantity } = form.values;
    
    if (from_asset_id && to_asset_id && from_quantity > 0 && to_quantity > 0) {
      const fromAsset = assetSelectData.find(a => a.value === from_asset_id);
      const toAsset = assetSelectData.find(a => a.value === to_asset_id);
      
      if (fromAsset && toAsset) {
        const fromValueBRL = from_quantity * (fromAsset.current_price_brl || 0);
        const toValueBRL = to_quantity * (toAsset.current_price_brl || 0);
        const priceDifference = fromValueBRL - toValueBRL;
        const percentageDiff = fromValueBRL > 0 ? ((priceDifference / fromValueBRL) * 100) : 0;

        setPreviewData({
          fromAsset,
          toAsset,
          fromValueBRL,
          toValueBRL,
          priceDifference,
          percentageDiff
        });
      }
    } else {
      setPreviewData(null);
    }
  }, [form.values, assetSelectData]);

  // Inverter os ativos selecionados
  const handleSwapAssets = () => {
    const fromId = form.values.from_asset_id;
    const toId = form.values.to_asset_id;
    const fromQty = form.values.from_quantity;
    const toQty = form.values.to_quantity;

    form.setValues({
      from_asset_id: toId,
      to_asset_id: fromId,
      from_quantity: toQty,
      to_quantity: fromQty
    });
  };

  // Submeter o formulário
  const handleSubmit = async (values) => {
    if (!form.isValid()) {
      form.validate();
      return;
    }

    setLoading(true);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const swapData = {
        account_id: parseInt(values.account_id),
        from_asset_id: parseInt(values.from_asset_id),
        to_asset_id: parseInt(values.to_asset_id),
        from_quantity: parseFloat(values.from_quantity),
        to_quantity: parseFloat(values.to_quantity),
        movement_date: values.movement_date.toISOString(),
        fee: parseFloat(values.fee || 0),
        notes: values.notes || null
      };

      const response = await fetch('http://localhost:8000/portfolio/movements/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(swapData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao executar SWAP');
      }

      const result = await response.json();
      
      handleApiSuccess(
        `SWAP realizado: ${selectedFromAsset?.symbol} → ${selectedToAsset?.symbol}`,
        'SWAP Executado'
      );

      // Chamar callback de sucesso
      if (onSwapSuccess) {
        onSwapSuccess(result.data);
      }

      // Fechar modal e resetar formulário
      handleClose();

    } catch (error) {
      console.error('Erro no SWAP:', error);
      handleApiError(error, 'Erro ao executar operação de SWAP');
    } finally {
      setLoading(false);
    }
  };

  // Fechar modal
  const handleClose = () => {
    if (!loading) {
      form.reset();
      setPreviewData(null);
      onClose();
    }
  };

  // Componente de seleção de ativo customizado
  const AssetSelectItem = ({ asset, ...others }) => (
    <Group gap="sm" {...others}>
      <Avatar
        src={asset.icon_url}
        alt={asset.symbol}
        size="sm"
        radius="xl"
      >
        {asset.symbol?.slice(0, 2)}
      </Avatar>
      <Box style={{ flex: 1 }}>
        <Text size="sm" fw={500}>
          {asset.asset?.name || 'Nome não disponível'}
        </Text>
        <Text size="xs" c="dimmed">
          {asset.symbol} • R$ {(asset.current_price_brl || 0).toLocaleString('pt-BR', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
          })}
        </Text>
      </Box>
    </Group>
  );

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <IconArrowsExchange2 size={20} color="var(--mantine-color-blue-6)" />
          <Text fw={600} size="lg">Registrar SWAP</Text>
        </Group>
      }
      size="lg"
      centered
      styles={{
        title: { width: '100%' }
      }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          
          {/* Seleção de Conta */}
          <Select
            label="Conta"
            placeholder="Selecione a conta onde ocorreu o SWAP"
            data={accountSelectData}
            required
            leftSection={<IconCoin size={16} />}
            {...form.getInputProps('account_id')}
          />

          <Divider label="Detalhes do SWAP" labelPosition="center" />

          {/* Ativo Vendido (FROM) */}
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Ativo Vendido (SWAP OUT)
            </Text>
            <Group align="flex-end" gap="sm">
              <Select
                placeholder="Selecione o ativo vendido"
                data={assetSelectData.filter(asset => 
                  asset.value !== form.values.to_asset_id
                )}
                searchable
                required
                style={{ flex: 1 }}
                itemComponent={({ value, ...item }) => {
                  const asset = assetSelectData.find(a => a.value === value);
                  return asset ? <AssetSelectItem asset={asset} {...item} /> : null;
                }}
                {...form.getInputProps('from_asset_id')}
              />
            </Group>
            <NumberInput
              placeholder="Quantidade vendida"
              required
              mt="xs"
              min={0}
              step={0.000001}
              decimalScale={6}
              {...form.getInputProps('from_quantity')}
            />
          </Box>

          {/* Botão de Inversão */}
          <Group justify="center">
            <Tooltip label="Inverter ativos">
              <ActionIcon
                variant="light"
                size="lg"
                radius="xl"
                color="blue"
                onClick={handleSwapAssets}
                disabled={!form.values.from_asset_id || !form.values.to_asset_id}
              >
                <IconArrowDown size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Ativo Comprado (TO) */}
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Ativo Comprado (SWAP IN)
            </Text>
            <Group align="flex-end" gap="sm">
              <Select
                placeholder="Selecione o ativo comprado"
                data={assetSelectData.filter(asset => 
                  asset.value !== form.values.from_asset_id
                )}
                searchable
                required
                style={{ flex: 1 }}
                itemComponent={({ value, ...item }) => {
                  const asset = assetSelectData.find(a => a.value === value);
                  return asset ? <AssetSelectItem asset={asset} {...item} /> : null;
                }}
                {...form.getInputProps('to_asset_id')}
              />
            </Group>
            <NumberInput
              placeholder="Quantidade comprada"
              required
              mt="xs"
              min={0}
              step={0.000001}
              decimalScale={6}
              {...form.getInputProps('to_quantity')}
            />
          </Box>

          {/* Preview da Operação */}
          {previewData && (
            <Card withBorder p="md" bg="gray.0">
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>Preview da Operação</Text>
                <Badge
                  color={Math.abs(previewData.percentageDiff) < 5 ? 'green' : 'orange'}
                  variant="light"
                >
                  {previewData.percentageDiff > 0 ? '+' : ''}
                  {previewData.percentageDiff.toFixed(2)}%
                </Badge>
              </Group>
              
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">
                    Vendendo: {form.values.from_quantity} {previewData.fromAsset.symbol}
                  </Text>
                  <Text size="sm" fw={500}>
                    R$ {previewData.fromValueBRL.toLocaleString('pt-BR', { 
                      minimumFractionDigits: 2 
                    })}
                  </Text>
                </Group>
                
                <Group justify="space-between">
                  <Text size="sm">
                    Comprando: {form.values.to_quantity} {previewData.toAsset.symbol}
                  </Text>
                  <Text size="sm" fw={500}>
                    R$ {previewData.toValueBRL.toLocaleString('pt-BR', { 
                      minimumFractionDigits: 2 
                    })}
                  </Text>
                </Group>
                
                <Divider />
                
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Diferença:</Text>
                  <Text 
                    size="sm" 
                    fw={500}
                    c={previewData.priceDifference > 0 ? 'green' : 'red'}
                  >
                    R$ {Math.abs(previewData.priceDifference).toLocaleString('pt-BR', { 
                      minimumFractionDigits: 2 
                    })}
                  </Text>
                </Group>
              </Stack>
            </Card>
          )}

          <Divider label="Informações Adicionais" labelPosition="center" />

          {/* Data/Hora */}
          <DateTimePicker
            label="Data e Hora do SWAP"
            placeholder="Selecione a data e hora"
            required
            leftSection={<IconCalendar size={16} />}
            {...form.getInputProps('movement_date')}
          />

          {/* Taxa */}
          <NumberInput
            label="Taxa da Operação"
            placeholder="0.00"
            min={0}
            step={0.01}
            decimalScale={2}
            leftSection={<Text size="sm">R$</Text>}
            {...form.getInputProps('fee')}
          />

          {/* Observações */}
          <TextInput
            label="Observações"
            placeholder="Observações sobre o SWAP (opcional)"
            {...form.getInputProps('notes')}
          />

          {/* Informação sobre preços históricos */}
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
          >
            O custo de aquisição será calculado automaticamente usando preços históricos 
            para garantir precisão nos cálculos de P&L.
          </Alert>

          {/* Botões */}
          <Group justify="flex-end" gap="sm" mt="md">
            <Button 
              variant="subtle" 
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loading}
              leftSection={<IconArrowsExchange2 size={16} />}
              disabled={!form.isValid() || loading}
            >
              Executar SWAP
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}