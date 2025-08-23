import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Modal, TextInput, Button, Text, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { getAuthToken } from '../utils/auth';
import { api } from '../api';

export function WalletAssociationManager({ userWallets = [], onWalletAssociated, isLoading = false, walletsLoaded = false }) {
  const { address, isConnected } = useAccount();
  const [opened, { open, close }] = useDisclosure(false);
  const [walletName, setWalletName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastProcessedAddress, setLastProcessedAddress] = useState(null);

  useEffect(() => {
    // Verificar se há uma nova conexão de carteira
    // IMPORTANTE: Aguardar o carregamento das carteiras antes de processar
    if (!isConnected || !address || address === lastProcessedAddress || isLoading) {
      return;
    }

    // Se as carteiras ainda não foram carregadas, aguardar
    if (!walletsLoaded) {
      return;
    }

    setLastProcessedAddress(address);

    // LÓGICA DE RECONHECIMENTO: Verificar se a carteira já está associada
    const isAlreadyAssociated = userWallets.some(
      wallet => wallet.public_address.toLowerCase() === address.toLowerCase()
    );

    if (isAlreadyAssociated) {
      // CARTEIRA JÁ ASSOCIADA: Não abrir modal, apenas mostrar notificação
      const existingWallet = userWallets.find(
        wallet => wallet.public_address.toLowerCase() === address.toLowerCase()
      );
      
      notifications.show({
        title: 'Carteira Reconhecida!',
        message: `${existingWallet.wallet_name} conectada com sucesso`,
        color: 'green',
        autoClose: 3000,
      });
    } else {
      // CARTEIRA NOVA: Abrir modal para nomear
      setWalletName(''); // Limpa o campo
      open(); // Abre o modal para nomear a carteira
    }
  }, [isConnected, address, lastProcessedAddress, userWallets, isLoading, walletsLoaded, open]);

  const handleAssociateWallet = async () => {
    if (!walletName.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Usar novo endpoint que cria conta automaticamente e sincroniza posições
      const response = await api.post('/accounts/from-wallet', {
        public_address: address,
        wallet_name: walletName.trim(),
      });

      console.log('Wallet account created and synchronized:', response.data);
      
      // Feedback de sucesso
      notifications.show({
        title: 'Carteira Criada e Sincronizada!',
        message: `${walletName.trim()} foi adicionada e suas posições foram sincronizadas automaticamente`,
        color: 'green',
        autoClose: 5000,
      });

      close(); // Fecha o modal
      
      // Atualizar tanto a lista de carteiras quanto a lista de contas
      if (onWalletAssociated) {
        await onWalletAssociated();
      }
      
      // Informar sobre tokens sincronizados
      const syncResult = response.data.sync_result;
      if (syncResult && syncResult.tokens_synced > 0) {
        setTimeout(() => {
          notifications.show({
            title: 'Sincronização Completa',
            message: `${syncResult.tokens_synced} tokens sincronizados da blockchain`,
            color: 'blue',
            autoClose: 4000,
          });
        }, 1000);
      }
      
    } catch (error) {
      console.error('Error creating wallet account:', error);
      
      if (error.response?.status === 400 && error.response?.data?.detail?.includes('already associated')) {
        // Carteira já está associada, apenas fecha o modal
        notifications.show({
          title: 'Carteira já associada',
          message: 'Esta carteira já está vinculada à sua conta',
          color: 'yellow',
          autoClose: 3000,
        });
        close();
      } else {
        // Outros erros
        notifications.show({
          title: 'Erro',
          message: 'Erro ao criar conta da carteira. Tente novamente.',
          color: 'red',
          autoClose: 5000,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    close();
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      title="Nome da Carteira"
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Text size="sm" mb="md">
        Uma nova carteira foi conectada. Dê um nome para criar uma conta automática e sincronizar suas posições:
      </Text>
      
      <Text size="xs" c="dimmed" mb="md">
        Endereço: {address}
      </Text>
      
      <TextInput
        label="Nome da carteira"
        placeholder="Ex: MetaMask Principal, Carteira de Trading, etc."
        value={walletName}
        onChange={(e) => setWalletName(e.currentTarget.value)}
        mb="lg"
        autoFocus
        onKeyPress={(e) => {
          if (e.key === 'Enter' && walletName.trim()) {
            handleAssociateWallet();
          }
        }}
      />
      
      <Group justify="space-between">
        <Button
          variant="subtle"
          onClick={handleSkip}
          disabled={isSubmitting}
        >
          Pular
        </Button>
        <Button
          onClick={handleAssociateWallet}
          loading={isSubmitting}
          disabled={!walletName.trim()}
        >
          Salvar
        </Button>
      </Group>
    </Modal>
  );
}