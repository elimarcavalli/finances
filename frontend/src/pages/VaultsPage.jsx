import React, { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Modal,
  TextInput,
  Select,
  Alert,
  Badge,
  ActionIcon,
  Table,
  NumberInput,
  Divider,
  Container,
  Paper
} from '@mantine/core';
import {
  IconPlus,
  IconWallet,
  IconSettings,
  IconDownload,
  IconUpload,
  IconTrash,
  IconExternalLink,
  IconLockOpen,
  IconAlertCircle
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import api from '../api';

export function VaultsPage() {
  const [vaults, setVaults] = useState([]);
  const [userWallets, setUserWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [registerModalOpened, { open: openRegisterModal, close: closeRegisterModal }] = useDisclosure(false);
  const [depositModalOpened, { open: openDepositModal, close: closeDepositModal }] = useDisclosure(false);
  const [withdrawModalOpened, { open: openWithdrawModal, close: closeWithdrawModal }] = useDisclosure(false);
  const [configModalOpened, { open: openConfigModal, close: closeConfigModal }] = useDisclosure(false);

  // Form states
  const [registerForm, setRegisterForm] = useState({
    contractAddress: '',
    strategyName: '',
    userWalletId: ''
  });

  const [depositForm, setDepositForm] = useState({
    tokenAddress: '',
    amount: '',
    vaultAddress: ''
  });

  const [withdrawForm, setWithdrawForm] = useState({
    tokenAddress: '',
    amount: '',
    vaultAddress: ''
  });

  const [configForm, setConfigForm] = useState({
    tokenToSpend: '',
    tokenToBuy: '',
    targetPrice: '',
    amountToSpend: '',
    poolFee: '3000',
    vaultAddress: ''
  });

  const [selectedVault, setSelectedVault] = useState(null);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vaultsResponse, walletsResponse] = await Promise.all([
        api.get('/vaults'),
        api.get('/user-wallets')
      ]);
      
      setVaults(vaultsResponse.data.vaults || []);
      setUserWallets(walletsResponse.data.wallets || []);
    } catch (err) {
      setError('Erro ao carregar dados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterVault = async () => {
    try {
      await api.post('/vaults', registerForm);
      closeRegisterModal();
      setRegisterForm({ contractAddress: '', strategyName: '', userWalletId: '' });
      loadData();
    } catch (err) {
      setError('Erro ao registrar vault');
      console.error(err);
    }
  };

  const handleDepositModal = (vault) => {
    setSelectedVault(vault);
    setDepositForm({ ...depositForm, vaultAddress: vault.contract_address });
    openDepositModal();
  };

  const handleWithdrawModal = (vault) => {
    setSelectedVault(vault);
    setWithdrawForm({ ...withdrawForm, vaultAddress: vault.contract_address });
    openWithdrawModal();
  };

  const handleConfigModal = (vault) => {
    setSelectedVault(vault);
    setConfigForm({ ...configForm, vaultAddress: vault.contract_address });
    openConfigModal();
  };

  const handleDeposit = async () => {
    if (!isConnected) {
      setError('Conecte sua carteira primeiro');
      return;
    }

    try {
      // First approve the token
      const tokenAmount = parseUnits(depositForm.amount, 18); // Assuming 18 decimals
      
      writeContract({
        address: depositForm.tokenAddress,
        abi: [
          {
            name: 'approve',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }]
          }
        ],
        functionName: 'approve',
        args: [depositForm.vaultAddress, tokenAmount]
      });
      
      // TODO: After approval, call deposit function
      closeDepositModal();
    } catch (err) {
      setError('Erro ao depositar tokens');
      console.error(err);
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      setError('Conecte sua carteira primeiro');
      return;
    }

    try {
      const tokenAmount = parseUnits(withdrawForm.amount, 18);
      
      writeContract({
        address: withdrawForm.vaultAddress,
        abi: [
          {
            name: 'withdraw',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: '_tokenAddress', type: 'address' },
              { name: '_amount', type: 'uint256' }
            ],
            outputs: []
          }
        ],
        functionName: 'withdraw',
        args: [withdrawForm.tokenAddress, tokenAmount]
      });
      
      closeWithdrawModal();
    } catch (err) {
      setError('Erro ao retirar tokens');
      console.error(err);
    }
  };

  const handleConfigStrategy = async () => {
    if (!isConnected) {
      setError('Conecte sua carteira primeiro');
      return;
    }

    try {
      const targetPriceWei = parseUnits(configForm.targetPrice, 8); // Chainlink uses 8 decimals
      const amountWei = parseUnits(configForm.amountToSpend, 18);
      
      writeContract({
        address: configForm.vaultAddress,
        abi: [
          {
            name: 'setStrategyParams',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: '_tokenToSpend', type: 'address' },
              { name: '_tokenToBuy', type: 'address' },
              { name: '_targetPrice', type: 'int256' },
              { name: '_amountToSpend', type: 'uint256' },
              { name: '_poolFee', type: 'uint24' }
            ],
            outputs: []
          }
        ],
        functionName: 'setStrategyParams',
        args: [
          configForm.tokenToSpend,
          configForm.tokenToBuy,
          targetPriceWei,
          amountWei,
          parseInt(configForm.poolFee)
        ]
      });
      
      closeConfigModal();
    } catch (err) {
      setError('Erro ao configurar estratégia');
      console.error(err);
    }
  };

  const deleteVault = async (vaultId) => {
    if (window.confirm('Tem certeza que deseja remover este vault?')) {
      try {
        await api.delete(`/vaults/${vaultId}`);
        loadData();
      } catch (err) {
        setError('Erro ao remover vault');
        console.error(err);
      }
    }
  };

  if (loading) {
    return <Container><Text>Carregando...</Text></Container>;
  }

  return (
    <Container size="xl">
      <Stack spacing="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>
            <Group>
              <IconLockOpen size={32} />
              Strategy Vaults
            </Group>
          </Title>
          <Button 
            leftSection={<IconPlus size="1rem" />}
            onClick={openRegisterModal}
          >
            Registrar Vault
          </Button>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size="1rem" />} color="red" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {!isConnected && (
          <Alert icon={<IconWallet size="1rem" />} color="yellow">
            Conecte sua carteira para interagir com os vaults
          </Alert>
        )}

        {vaults.length === 0 ? (
          <Paper p="xl" withBorder>
            <Stack align="center" spacing="md">
              <IconLockOpen size={64} color="gray" />
              <Title order={3} color="dimmed">Nenhum vault registrado</Title>
              <Text color="dimmed" ta="center">
                Registre seu primeiro Strategy Vault para começar a usar estratégias automatizadas
              </Text>
              <Button onClick={openRegisterModal}>
                Registrar Primeiro Vault
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Endereço do Contrato</Table.Th>
                <Table.Th>Carteira</Table.Th>
                <Table.Th>Criado em</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {vaults.map((vault) => (
                <Table.Tr key={vault.id}>
                  <Table.Td>
                    <Text weight={500}>{vault.strategy_name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group spacing="xs">
                      <Text family="monospace" size="sm">
                        {vault.contract_address}
                      </Text>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => window.open(`https://amoy.polygonscan.com/address/${vault.contract_address}`, '_blank')}
                      >
                        <IconExternalLink size="1rem" />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Stack spacing="xs">
                      <Text size="sm">{vault.wallet_name}</Text>
                      <Text size="xs" color="dimmed" family="monospace">
                        {vault.public_address}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(vault.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group spacing="xs">
                      <ActionIcon
                        color="blue"
                        variant="light"
                        onClick={() => handleDepositModal(vault)}
                        disabled={!isConnected}
                      >
                        <IconUpload size="1rem" />
                      </ActionIcon>
                      <ActionIcon
                        color="green"
                        variant="light"
                        onClick={() => handleWithdrawModal(vault)}
                        disabled={!isConnected}
                      >
                        <IconDownload size="1rem" />
                      </ActionIcon>
                      <ActionIcon
                        color="orange"
                        variant="light"
                        onClick={() => handleConfigModal(vault)}
                        disabled={!isConnected}
                      >
                        <IconSettings size="1rem" />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => deleteVault(vault.id)}
                      >
                        <IconTrash size="1rem" />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {/* Register Vault Modal */}
        <Modal opened={registerModalOpened} onClose={closeRegisterModal} title="Registrar Strategy Vault">
          <Stack spacing="md">
            <TextInput
              label="Endereço do Contrato"
              placeholder="0x..."
              value={registerForm.contractAddress}
              onChange={(e) => setRegisterForm({...registerForm, contractAddress: e.currentTarget.value})}
            />
            <TextInput
              label="Nome da Estratégia"
              placeholder="Ex: Compra MATIC quando < $0.80"
              value={registerForm.strategyName}
              onChange={(e) => setRegisterForm({...registerForm, strategyName: e.currentTarget.value})}
            />
            <Select
              label="Carteira Associada"
              placeholder="Selecione uma carteira"
              data={userWallets.map(w => ({ value: w.association_id.toString(), label: w.wallet_name }))}
              value={registerForm.userWalletId}
              onChange={(value) => setRegisterForm({...registerForm, userWalletId: value})}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeRegisterModal}>Cancelar</Button>
              <Button onClick={handleRegisterVault}>Registrar</Button>
            </Group>
          </Stack>
        </Modal>

        {/* Deposit Modal */}
        <Modal opened={depositModalOpened} onClose={closeDepositModal} title="Depositar Tokens">
          <Stack spacing="md">
            <TextInput
              label="Endereço do Token"
              placeholder="0x..."
              value={depositForm.tokenAddress}
              onChange={(e) => setDepositForm({...depositForm, tokenAddress: e.currentTarget.value})}
            />
            <NumberInput
              label="Quantidade"
              placeholder="0.0"
              value={depositForm.amount}
              onChange={(value) => setDepositForm({...depositForm, amount: value})}
              min={0}
              step={0.000001}
              precision={6}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeDepositModal}>Cancelar</Button>
              <Button onClick={handleDeposit} loading={isPending}>Depositar</Button>
            </Group>
          </Stack>
        </Modal>

        {/* Withdraw Modal */}
        <Modal opened={withdrawModalOpened} onClose={closeWithdrawModal} title="Retirar Tokens">
          <Stack spacing="md">
            <TextInput
              label="Endereço do Token"
              placeholder="0x..."
              value={withdrawForm.tokenAddress}
              onChange={(e) => setWithdrawForm({...withdrawForm, tokenAddress: e.currentTarget.value})}
            />
            <NumberInput
              label="Quantidade"
              placeholder="0.0"
              value={withdrawForm.amount}
              onChange={(value) => setWithdrawForm({...withdrawForm, amount: value})}
              min={0}
              step={0.000001}
              precision={6}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeWithdrawModal}>Cancelar</Button>
              <Button onClick={handleWithdraw} loading={isPending}>Retirar</Button>
            </Group>
          </Stack>
        </Modal>

        {/* Strategy Config Modal */}
        <Modal opened={configModalOpened} onClose={closeConfigModal} title="Configurar Estratégia" size="lg">
          <Stack spacing="md">
            <TextInput
              label="Token para Gastar"
              placeholder="0x... (ex: USDC)"
              value={configForm.tokenToSpend}
              onChange={(e) => setConfigForm({...configForm, tokenToSpend: e.currentTarget.value})}
            />
            <TextInput
              label="Token para Comprar"
              placeholder="0x... (ex: WMATIC)"
              value={configForm.tokenToBuy}
              onChange={(e) => setConfigForm({...configForm, tokenToBuy: e.currentTarget.value})}
            />
            <NumberInput
              label="Preço Alvo (USD)"
              placeholder="0.80"
              value={configForm.targetPrice}
              onChange={(value) => setConfigForm({...configForm, targetPrice: value})}
              min={0}
              step={0.01}
              precision={8}
            />
            <NumberInput
              label="Quantidade a Gastar"
              placeholder="100.0"
              value={configForm.amountToSpend}
              onChange={(value) => setConfigForm({...configForm, amountToSpend: value})}
              min={0}
              step={0.000001}
              precision={6}
            />
            <Select
              label="Taxa da Pool Uniswap"
              value={configForm.poolFee}
              onChange={(value) => setConfigForm({...configForm, poolFee: value})}
              data={[
                { value: '500', label: '0.05%' },
                { value: '3000', label: '0.30%' },
                { value: '10000', label: '1.00%' }
              ]}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeConfigModal}>Cancelar</Button>
              <Button onClick={handleConfigStrategy} loading={isPending}>Configurar</Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}