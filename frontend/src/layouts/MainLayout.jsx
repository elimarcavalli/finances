import { AppShell, Title, NavLink, Group, Box } from '@mantine/core';
import { 
  IconWallet, 
  IconChartCandle, 
  IconHome, 
  IconLogout, 
  IconChartLine, 
  IconAdjustments, 
  IconHistory, 
  IconLockOpen,
  IconCreditCard,
  IconCoins,
  IconTransfer,
  IconReceipt,
  IconChartPie,
  IconCalendarEvent,
  IconReportAnalytics,
  IconHexagons,
  IconBuildingBank,
  IconZoomCode,
  IconBuildingWarehouse,
  IconTargetArrow,
  IconPigMoney,
  IconReceiptTax
} from '@tabler/icons-react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { removeAuthToken } from '../utils/auth';
import { WalletAssociationManager } from '../components/WalletAssociationManager';
import api from '../api';

export function MainLayout() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  
  // Estado centralizado das carteiras do usuário
  const [userWallets, setUserWallets] = useState([]);
  const [isLoadingWallets, setIsLoadingWallets] = useState(false);
  const [walletsLoaded, setWalletsLoaded] = useState(false);

  // Função para buscar carteiras do usuário
  const fetchUserWallets = useCallback(async () => {
    setIsLoadingWallets(true);
    setWalletsLoaded(false);
    try {
      const response = await api.get('/user-wallets');
      setUserWallets(response.data.wallets || []);
    } catch (error) {
      console.error('Error fetching user wallets:', error);
      setUserWallets([]);
    } finally {
      setIsLoadingWallets(false);
      setWalletsLoaded(true);
    }
  }, []);

  // Carregar carteiras quando o componente monta
  useEffect(() => {
    fetchUserWallets();
  }, [fetchUserWallets]);

  const handleLogout = () => {
    removeAuthToken();
    navigate('/login');
  };

  return (
    <AppShell
      navbar={{
        width: 300,
        breakpoint: 'sm',
      }}
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Group justify="space-between" h="100%" px="md" align="center">
          <Title order={3}>finances.mine</Title>
          <Group gap="md">
            {isConnected && address && (
              <Box style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {address.substring(0, 6)}...{address.substring(address.length - 4)}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                  {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : 'Loading...'}
                </div>
              </Box>
            )}
            <Box>
              <appkit-button />
            </Box>
          </Group>
        </Group>
      </AppShell.Header>
      
      <AppShell.Navbar p="md">
        {/* Dashboard */}
        <NavLink label="Dashboard" leftSection={<IconHome size="1rem" />} component={Link} to="/" />
        
        {/* Patrimônio */}
        <NavLink label="Patrimônio" leftSection={<IconCoins size="1rem" />} defaultOpened>
          <NavLink label="Portfólio" leftSection={<IconChartPie size="1rem" />} component={Link} to="/portfolio" />
          <NavLink label="Bens Físicos" leftSection={<IconBuildingWarehouse size="1rem" />} component={Link} to="/patrimonio" />
          <NavLink label="Contas" leftSection={<IconWallet size="1rem" />} component={Link} to="/accounts" />
          <NavLink label="Ativos" leftSection={<IconChartCandle size="1rem" />} component={Link} to="/assets" />
        </NavLink>
        
        {/* Movimentações */}
        <NavLink label="Movimentações" leftSection={<IconTransfer size="1rem" />} defaultOpened>
          <NavLink label="Lançamentos" leftSection={<IconReceipt size="1rem" />} component={Link} to="/transactions" />
          {/* <NavLink label="Contas a Receber" leftSection={<IconReceiptTax size="1rem" />} component={Link} to="/accounts-receivable" /> */}
          <NavLink label="Fluxo de Caixa" leftSection={<IconCalendarEvent size="1rem" />} component={Link} to="/obligations" />
        </NavLink>
        
        {/* Relatórios */}
        <NavLink label="Relatórios" component={Link} to="/reports" leftSection={<IconReportAnalytics size="1rem" />} />

        {/* Automações */}
        <NavLink label="Automações" leftSection={<IconAdjustments size="1rem" />}>
          <NavLink label="Carteiras Web3" leftSection={<IconWallet size="1rem" />} component={Link} to="/wallets" />
          <NavLink label="Strategy Vaults" leftSection={<IconLockOpen size="1rem" />} component={Link} to="/vaults" />
          <NavLink label="Estratégias" leftSection={<IconChartLine size="1rem" />} component={Link} to="/strategies" />
          <NavLink label="Backtesting com IA" leftSection={<IconHistory size="1rem" />} component={Link} to="/backtesting" />
        </NavLink>

        {/* DeFi - Futuras Funcionalidades */}
        <NavLink label="DeFi" leftSection={<IconHexagons size="1rem" />} >
          <NavLink label="Lending & Staking" disabled leftSection={<IconBuildingBank size="1rem" />} />
          <NavLink label="Análises On-Chain" disabled leftSection={<IconZoomCode size="1rem" />} />
        </NavLink>

        {/* Planejamento - Futuras Funcionalidades */}
        <NavLink label="Planejamento" leftSection={<IconTargetArrow size="1rem" />} >
          <NavLink label="Orçamentos" disabled leftSection={<IconPigMoney size="1rem" />} />
          <NavLink label="Centro Fiscal (Impostos)" disabled leftSection={<IconReceiptTax size="1rem" />} />
        </NavLink>
        
        <NavLink 
          label="Sair" 
          leftSection={<IconLogout size="1rem" />} 
          onClick={handleLogout}
          style={{ marginTop: 'auto', color: 'red' }}
        />
      </AppShell.Navbar>
      
      <AppShell.Main>
        <WalletAssociationManager 
          userWallets={userWallets} 
          onWalletAssociated={fetchUserWallets}
          isLoading={isLoadingWallets}
          walletsLoaded={walletsLoaded}
        />
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}