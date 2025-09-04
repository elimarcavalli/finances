import { AppShell, Title, NavLink, Group, Box, Button, Affix, Transition, ActionIcon, Indicator, Avatar } from '@mantine/core';
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
  IconReceiptTax,
  IconSearch,
  IconArrowUp,
  IconBell
} from '@tabler/icons-react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Spotlight, spotlight } from '@mantine/spotlight';
import { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { removeAuthToken } from '../utils/auth';
import { WalletAssociationManager } from '../components/WalletAssociationManager';
import api from '../api';

export function MainLayout() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [scrolled, setScrolled] = useState(false);

  // Spotlight actions
  const actions = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Página inicial com resumo geral',
      leftSection: <IconHome size={18} />,
      onClick: () => { navigate('/'); spotlight.close(); }
    },
    {
      id: 'portfolio',
      label: 'Portfólio',
      description: 'Visualizar portfólio de investimentos',
      leftSection: <IconChartPie size={18} />,
      onClick: () => { navigate('/portfolio'); spotlight.close(); }
    },
    {
      id: 'patrimonio',
      label: 'Bens Físicos',
      description: 'Gerenciar patrimônio físico',
      leftSection: <IconBuildingWarehouse size={18} />,
      onClick: () => { navigate('/patrimonio'); spotlight.close(); }
    },
    {
      id: 'accounts',
      label: 'Contas',
      description: 'Gerenciar contas financeiras',
      leftSection: <IconWallet size={18} />,
      onClick: () => { navigate('/accounts'); spotlight.close(); }
    },
    {
      id: 'assets',
      label: 'Ativos',
      description: 'Gerenciar ativos financeiros',
      leftSection: <IconChartCandle size={18} />,
      onClick: () => { navigate('/assets'); spotlight.close(); }
    },
    {
      id: 'transactions',
      label: 'Lançamentos',
      description: 'Visualizar transações financeiras',
      leftSection: <IconReceipt size={18} />,
      onClick: () => { navigate('/transactions'); spotlight.close(); }
    },
    {
      id: 'obligations',
      label: 'Fluxo de Caixa',
      description: 'Gerenciar obrigações e recorrências',
      leftSection: <IconCalendarEvent size={18} />,
      onClick: () => { navigate('/obligations'); spotlight.close(); }
    },
    {
      id: 'reports',
      label: 'Relatórios',
      description: 'Visualizar relatórios financeiros',
      leftSection: <IconReportAnalytics size={18} />,
      onClick: () => { navigate('/reports'); spotlight.close(); }
    },
    {
      id: 'wallets',
      label: 'Carteiras Web3',
      description: 'Gerenciar carteiras de criptomoedas',
      leftSection: <IconWallet size={18} />,
      onClick: () => { navigate('/wallets'); spotlight.close(); }
    },
    {
      id: 'vaults',
      label: 'Strategy Vaults',
      description: 'Gerenciar cofres de estratégias',
      leftSection: <IconLockOpen size={18} />,
      onClick: () => { navigate('/vaults'); spotlight.close(); }
    },
    {
      id: 'strategies',
      label: 'Estratégias',
      description: 'Configurar estratégias de trading',
      leftSection: <IconChartLine size={18} />,
      onClick: () => { navigate('/strategies'); spotlight.close(); }
    },
    {
      id: 'backtesting',
      label: 'Backtesting com IA',
      description: 'Testar estratégias com dados históricos',
      leftSection: <IconHistory size={18} />,
      onClick: () => { navigate('/backtesting'); spotlight.close(); }
    }
  ];
  
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

  // Controlar exibição do botão "voltar ao topo"
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
            <Button
              variant="default"
              leftSection={<IconSearch size={16} />}
              onClick={() => spotlight.open()}
            >
              Buscar (Ctrl + K)
            </Button>
            
            <Box>
              <appkit-button />
            </Box>
            
            <Indicator color="red" size={8} offset={5}>
              <ActionIcon variant="light" size="lg">
                <IconBell size={18} />
              </ActionIcon>
            </Indicator>
            
            <Avatar radius="xl" size="sm">EC</Avatar>
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

        {/* mantine-showcase */}
        <NavLink label="Mantine Showcase" leftSection={<IconCreditCard size="1rem" />} component={Link} to="/mantine-showcase" />
        
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
        
        <Affix position={{ bottom: 20, right: 20 }}>
          <Transition transition="slide-up" mounted={scrolled}>
            {(transitionStyles) => (
              <ActionIcon
                style={transitionStyles}
                variant="filled"
                size="lg"
                radius="xl"
                color="blue"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                <IconArrowUp size={18} />
              </ActionIcon>
            )}
          </Transition>
        </Affix>
        
        <Spotlight
          actions={actions}
          nothingFound="Nenhum resultado encontrado"
          searchProps={{
            placeholder: 'Buscar páginas e funcionalidades...',
          }}
        />
      </AppShell.Main>
    </AppShell>
  );
}