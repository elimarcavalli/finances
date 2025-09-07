import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Stack,
  Group,
  ThemeIcon,
  TextInput,
  NumberInput,
  Button,
  Select,
  Text,
  Box,
  Avatar,
  Badge,
  Grid,
  Center,
  Accordion,
  Divider,
  Alert,
  Loader,
  Fieldset,
  ActionIcon,
  Tooltip,
  Card
} from '@mantine/core';
import {
  IconArrowsExchange2,
  IconCalendar,
  IconCoin,
  IconNotes,
  IconTrendingUp,
  IconInfoCircle,
  IconTrendingDown,
  IconWallet,
  IconCurrencyDollar
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
  const [historicalPrices, setHistoricalPrices] = useState({});
  const [loadingHistoricalPrices, setLoadingHistoricalPrices] = useState(false);

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

  // Buscar preços históricos quando os parâmetros necessários estiverem disponíveis
  const fetchHistoricalPrices = async (fromAssetId, toAssetId, movementDate) => {
    if (!fromAssetId || !toAssetId || !movementDate) return;
    
    setLoadingHistoricalPrices(true);
    
    try {
      const token = getAuthToken();
      const dateStr = new Date(movementDate).toISOString().slice(0, 19);
      
      const fromAsset = cryptoAssets.find(a => a.id.toString() === fromAssetId);
      const toAsset = cryptoAssets.find(a => a.id.toString() === toAssetId);
      
      if (!fromAsset || !toAsset) return;
      
      const promises = [
        fetch(`http://localhost:8000/price/historical?api_id=${fromAsset.price_api_identifier}&date=${dateStr}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/price/historical?api_id=${toAsset.price_api_identifier}&date=${dateStr}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ];
      
      const [fromResponse, toResponse] = await Promise.all(promises);
      
      const fromPrice = fromResponse.ok ? (await fromResponse.json()).price_brl : null;
      const toPrice = toResponse.ok ? (await toResponse.json()).price_brl : null;
      
      setHistoricalPrices({
        [fromAssetId]: fromPrice,
        [toAssetId]: toPrice,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Erro ao buscar preços históricos:', error);
    } finally {
      setLoadingHistoricalPrices(false);
    }
  };

  // Debounce para buscar preços históricos
  useEffect(() => {
    const { from_asset_id, to_asset_id, movement_date } = form.values;
    
    if (from_asset_id && to_asset_id && movement_date) {
      const timeoutId = setTimeout(() => {
        fetchHistoricalPrices(from_asset_id, to_asset_id, movement_date);
      }, 500); // Debounce de 500ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [form.values.from_asset_id, form.values.to_asset_id, form.values.movement_date]);

  // Calcular preview da operação com preços históricos
  useEffect(() => {
    const { from_asset_id, to_asset_id, from_quantity, to_quantity } = form.values;
    
    if (from_asset_id && to_asset_id && from_quantity > 0 && to_quantity > 0) {
      const fromAsset = assetSelectData.find(a => a.value === from_asset_id);
      const toAsset = assetSelectData.find(a => a.value === to_asset_id);
      
      if (fromAsset && toAsset) {
        // Usar preços históricos se disponíveis, senão usar preços atuais como fallback
        const fromHistoricalPrice = historicalPrices[from_asset_id];
        const toHistoricalPrice = historicalPrices[to_asset_id];
        
        const fromPriceBRL = fromHistoricalPrice || fromAsset.current_price_brl || 0;
        const toPriceBRL = toHistoricalPrice || toAsset.current_price_brl || 0;
        
        const fromValueBRL = from_quantity * fromPriceBRL;
        const toValueBRL = to_quantity * toPriceBRL;
        const priceDifference = toValueBRL - fromValueBRL;
        const percentageDiff = fromValueBRL > 0 ? ((priceDifference / fromValueBRL) * 100) : 0;

        setPreviewData({
          fromAsset,
          toAsset,
          fromValueBRL,
          toValueBRL,
          priceDifference,
          percentageDiff,
          usingHistoricalPrices: !!(fromHistoricalPrice && toHistoricalPrice)
        });
      }
    } else {
      setPreviewData(null);
    }
  }, [form.values, assetSelectData, historicalPrices]);

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
        movement_date: new Date(values.movement_date).toISOString().slice(0, 19),
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

  // Componente de renderização customizada para opções de ativo
  const renderAssetOption = ({ option, checked, ...others }) => {
    const asset = assetSelectData.find(a => a.value === option.value);
    if (!asset) return null;

    return (
      <Group gap="sm" p="sm" {...others}>
        <Avatar
          src={asset.icon_url}
          alt={asset.symbol}
          size="md"
          radius="xl"
        >
          {asset.symbol?.slice(0, 2)}
        </Avatar>
        <Box style={{ flex: 1 }}>
          <Group gap="xs" align="center">
            <Badge variant="light" size="sm">
              {asset.symbol}
            </Badge>
            <Text size="sm" fw={500} style={{ flex: 1 }}>
              {asset.asset?.name || 'Nome não disponível'}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            R$ {(asset.current_price_brl || 0).toLocaleString('pt-BR', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 6
            })}
          </Text>
        </Box>
      </Group>
    );
  };

  // Calcular taxa de câmbio implícita
  const exchangeRate = useMemo(() => {
    if (!form.values.from_quantity || !form.values.to_quantity || 
        form.values.from_quantity <= 0 || form.values.to_quantity <= 0) return null;
    
    return parseFloat(form.values.from_quantity) / parseFloat(form.values.to_quantity);
  }, [form.values.from_quantity, form.values.to_quantity]);

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" variant="light" color="blue">
            <IconArrowsExchange2 size={20} />
          </ThemeIcon>
          <Text fw={600} size="xl">Registrar SWAP de Ativos</Text>
        </Group>
      }
      size="xl"
      centered
      styles={{
        title: { width: '100%' }
      }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          
          {/* Campos Globais */}
          <Group grow>
            <Select
              label="Conta"
              placeholder="Selecione a conta"
              data={accountSelectData}
              required
              leftSection={<IconWallet size={16} />}
              {...form.getInputProps('account_id')}
            />
            <DateTimePicker
              label="Data e Hora"
              placeholder="Data do SWAP"
              required
              leftSection={<IconCalendar size={16} />}
              {...form.getInputProps('movement_date')}
            />
          </Group>

          {/* Layout Principal com Grid - Ativo comprado à esquerda */}
          <Grid>
            {/* Coluna de Destino (Ativo Comprado) - À ESQUERDA */}
            <Grid.Col span={5}>
              <Fieldset 
                legend="Você Compra (SWAP IN)" 
                style={{ height: '100%' }}
              >
                <Stack gap="md">
                  <Select
                    label="Ativo Comprado"
                    placeholder="Selecione o ativo"
                    data={assetSelectData.filter(asset => 
                      asset.value !== form.values.from_asset_id
                    )}
                    searchable
                    required
                    renderOption={renderAssetOption}
                    leftSection={<IconCoin size={16} />}
                    {...form.getInputProps('to_asset_id')}
                  />
                  <NumberInput
                    label="Quantidade Comprada"
                    placeholder="0.000000"
                    required
                    min={0}
                    step={0.000001}
                    decimalScale={6}
                    leftSection={<IconCurrencyDollar size={16} />}
                    {...form.getInputProps('to_quantity')}
                  />
                  {selectedToAsset && (
                    <Box p="xs" bg="gray.0" style={{ borderRadius: 8 }}>
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">
                          Preço atual: R$ {selectedToAsset.current_price_brl?.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6
                          })}
                        </Text>
                        {historicalPrices[form.values.to_asset_id] && (
                          <Text size="xs" c="blue" fw={500}>
                            Histórico: R$ {historicalPrices[form.values.to_asset_id].toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6
                            })}
                          </Text>
                        )}
                      </Group>
                      {loadingHistoricalPrices && (
                        <Text size="xs" c="dimmed">Carregando preço histórico...</Text>
                      )}
                    </Box>
                  )}
                </Stack>
              </Fieldset>
            </Grid.Col>

            {/* Coluna Central */}
            <Grid.Col span={2}>
              <Center style={{ height: '100%' }}>
                <Stack gap="sm" align="center">
                  <Tooltip label="Inverter ativos">
                    <ActionIcon
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'cyan' }}
                      size="xl"
                      radius="xl"
                      onClick={handleSwapAssets}
                      disabled={!form.values.from_asset_id || !form.values.to_asset_id}
                    >
                      <IconArrowsExchange2 size={24} />
                    </ActionIcon>
                  </Tooltip>
                  {exchangeRate && selectedFromAsset && selectedToAsset && (
                    <Box style={{ textAlign: 'center' }}>
                      <Text size="xs" c="dimmed" fw={500}>
                        Taxa de Câmbio
                      </Text>
                      <Text size="sm" fw={600}>
                        1 {selectedToAsset.symbol} ≈ {exchangeRate.toFixed(6)} {selectedFromAsset.symbol}
                      </Text>
                    </Box>
                  )}
                </Stack>
              </Center>
            </Grid.Col>

            {/* Coluna de Origem (Ativo Vendido) - À DIREITA */}
            <Grid.Col span={5}>
              <Fieldset 
                legend="Você Vende (SWAP OUT)" 
                style={{ height: '100%' }}
              >
                <Stack gap="md">
                  <Select
                    label="Ativo Vendido"
                    placeholder="Selecione o ativo"
                    data={assetSelectData.filter(asset => 
                      asset.value !== form.values.to_asset_id
                    )}
                    searchable
                    required
                    renderOption={renderAssetOption}
                    leftSection={<IconCoin size={16} />}
                    {...form.getInputProps('from_asset_id')}
                  />
                  <NumberInput
                    label="Quantidade Vendida"
                    placeholder="0.000000"
                    required
                    min={0}
                    step={0.000001}
                    decimalScale={6}
                    leftSection={<IconCurrencyDollar size={16} />}
                    {...form.getInputProps('from_quantity')}
                  />
                  {selectedFromAsset && (
                    <Box p="xs" bg="gray.0" style={{ borderRadius: 8 }}>
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">
                          Preço atual: R$ {selectedFromAsset.current_price_brl?.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6
                          })}
                        </Text>
                        {historicalPrices[form.values.from_asset_id] && (
                          <Text size="xs" c="blue" fw={500}>
                            Histórico: R$ {historicalPrices[form.values.from_asset_id].toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6
                            })}
                          </Text>
                        )}
                      </Group>
                      {loadingHistoricalPrices && (
                        <Text size="xs" c="dimmed">Carregando preço histórico...</Text>
                      )}
                    </Box>
                  )}
                </Stack>
              </Fieldset>
            </Grid.Col>
          </Grid>

          {/* Preview da Operação */}
          {previewData && (
            <Card withBorder p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="light" color="blue">
                    <IconTrendingUp size={14} />
                  </ThemeIcon>
                  <Text size="lg" fw={600}>Preview da Operação</Text>
                  {previewData.usingHistoricalPrices && (
                    <Badge size="sm" color="blue" variant="light">
                      Preços Históricos
                    </Badge>
                  )}
                </Group>
                <Badge
                  size="lg"
                  color={Math.abs(previewData.percentageDiff) < 5 ? 'green' : 'orange'}
                  variant="light"
                >
                  {previewData.percentageDiff > 0 ? '+' : ''}
                  {previewData.percentageDiff.toFixed(2)}%
                </Badge>
              </Group>
              
              <Grid>
                {/* Ativo Comprado - À ESQUERDA (alinhado com layout) */}
                <Grid.Col span={5}>
                  <Box p="md" bg="green.0" style={{ borderRadius: 8, textAlign: 'center' }}>
                    <Text size="sm" c="dimmed" mb="xs">Comprando</Text>
                    <Text size="lg" fw={600} c="green">
                      {form.values.to_quantity} {previewData.toAsset.symbol}
                    </Text>
                    <Text size="sm" fw={500}>
                      R$ {previewData.toValueBRL.toLocaleString('pt-BR', { 
                        minimumFractionDigits: 2 
                      })}
                    </Text>
                  </Box>
                </Grid.Col>
                
                <Grid.Col span={2}>
                  <Center style={{ height: '100%' }}>
                    <IconArrowsExchange2 size={20} color="var(--mantine-color-gray-6)" />
                  </Center>
                </Grid.Col>
                
                {/* Ativo Vendido - À DIREITA (alinhado com layout) */}
                <Grid.Col span={5}>
                  <Box p="md" bg="red.0" style={{ borderRadius: 8, textAlign: 'center' }}>
                    <Text size="sm" c="dimmed" mb="xs">Vendendo</Text>
                    <Text size="lg" fw={600} c="red">
                      {form.values.from_quantity} {previewData.fromAsset.symbol}
                    </Text>
                    <Text size="sm" fw={500}>
                      R$ {previewData.fromValueBRL.toLocaleString('pt-BR', { 
                        minimumFractionDigits: 2 
                      })}
                    </Text>
                  </Box>
                </Grid.Col>
              </Grid>
              
              <Divider my="md" />
              
              <Group justify="space-between">
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Diferença Financeira:</Text>
                  <Text size="xs" c="dimmed">
                    (Valor recebido - Valor pago)
                  </Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon
                    size="sm"
                    variant="light"
                    color={previewData.priceDifference > 0 ? 'green' : 'red'}
                  >
                    {previewData.priceDifference > 0 ? 
                      <IconTrendingUp size={12} /> : 
                      <IconTrendingDown size={12} />
                    }
                  </ThemeIcon>
                  <Text 
                    size="md" 
                    fw={600}
                    c={previewData.priceDifference > 0 ? 'green' : 'red'}
                  >
                    {previewData.priceDifference > 0 ? '+' : ''}R$ {previewData.priceDifference.toLocaleString('pt-BR', { 
                      minimumFractionDigits: 2 
                    })}
                  </Text>
                </Group>
              </Group>
              
              {loadingHistoricalPrices && (
                <Alert color="blue" variant="light" mt="md">
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm">Carregando preços históricos para cálculos precisos...</Text>
                  </Group>
                </Alert>
              )}
            </Card>
          )}

          {/* Informações Adicionais em Accordion */}
          <Accordion variant="separated">
            <Accordion.Item value="additional-info">
              <Accordion.Control>Informações Adicionais</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="md">
                  <NumberInput
                    label="Taxa da Operação"
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    decimalScale={2}
                    leftSection={<Text size="sm">R$</Text>}
                    {...form.getInputProps('fee')}
                  />
                  <TextInput
                    label="Observações"
                    placeholder="Observações sobre o SWAP (opcional)"
                    leftSection={<IconNotes size={16} />}
                    {...form.getInputProps('notes')}
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

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
          <Group justify="flex-end" gap="md" mt="xl">
            <Button 
              variant="subtle" 
              size="md"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="md"
              loading={loading}
              leftSection={<IconArrowsExchange2 size={18} />}
              disabled={!form.isValid() || loading}
              gradient={{ from: 'blue', to: 'cyan' }}
              variant="gradient"
            >
              Executar SWAP
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}