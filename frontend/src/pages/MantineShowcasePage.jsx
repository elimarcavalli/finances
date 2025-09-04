import React, { useState, useRef } from 'react';
import { useDisclosure } from '@mantine/hooks';
import {
  AppShell, Burger, Group, Title, Container, Button, Card, Text, Badge, SimpleGrid,
  useMantineTheme, Stack, Paper, Alert, ThemeIcon, Progress, Table, Tooltip, Select,
  SegmentedControl, Modal, NumberInput, Switch, Slider, Box, TextInput, Textarea,
  Checkbox, Radio, MultiSelect, Autocomplete, PasswordInput, FileInput, ColorInput,
  Tabs, Accordion, Timeline, Divider, Center, Image, Avatar, AvatarGroup, Rating,
  PinInput, JsonInput, Stepper, Notification, LoadingOverlay, Skeleton,
  HoverCard, Popover, Menu, Drawer, Affix,
  ActionIcon, CopyButton, ColorPicker,
  Breadcrumbs, Pagination, ScrollArea, Anchor, RingProgress, List, Grid,
  Chip, Overlay, AspectRatio, Blockquote,
  Mark, Highlight, Kbd, Code, rem, NavLink, UnstyledButton, Indicator,
  Transition, Collapse,
  NumberFormatter, Space, Fieldset, CloseButton,
  rem as mantineRem
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { CodeHighlight } from '@mantine/code-highlight';
import { Dropzone, IMAGE_MIME_TYPE, PDF_MIME_TYPE } from '@mantine/dropzone';
import { Carousel } from '@mantine/carousel';
import { spotlight, Spotlight } from '@mantine/spotlight';
import { modals } from '@mantine/modals';
import { nprogress } from '@mantine/nprogress';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, 
  PieChart, Pie, Cell, ComposedChart, Scatter, ScatterChart, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Treemap, FunnelChart, Funnel, LabelList
} from 'recharts';
import {
  IconPlus, IconPencil, IconTrash, IconShare, IconSettings, IconUser, IconBell,
  IconSearch, IconCalendar, IconUpload, IconLock, IconEye, IconInfoCircle, IconShield,
  // IconStar, IconHeart, IconBookmark, IconHome, IconDownload, IconClock,
  // IconCamera, IconMicrophone, IconVideo, IconMusic, 
  // IconStop, IconVolume, IconVolumeOff, IconMail, IconPhone, IconMapPin, 
  // IconPalette, IconBrush, IconColorPicker, IconEyeOff,  IconArrowDown,
  // IconUnlock, IconKey, IconAlertCircle, IconArrowLeft, IconArrowRight, 
  // IconPhoto, IconMessageCircle,IconBuildingBank, IconCreditCard, IconBuildingWarehouse, 
  // IconChartBar, IconChartArea, IconDatabase, IconPresentationAnalytics, IconX as IconClose,
  // IconGitBranch, IconGitCommit, IconGitPullRequest, IconMessageDots
  IconX, IconCheck, 
  IconArrowUp, IconChevronDown, IconMenu2, IconDotsVertical, 
  IconFilter, IconRefresh, IconCoin, IconTrendingUp, IconTrendingDown,
  IconWallet, IconCoins, IconCash, IconReceiptTax, 
  IconCurrencyDollar, IconPigMoney, 
  IconChartPie, IconChartLine, 
  IconReportAnalytics,  IconFileAnalytics,
  IconCloudUpload, 
  IconDashboard, IconBulb, IconTarget, IconRocket
} from '@tabler/icons-react';

// Dados de exemplo aprimorados para sistema financeiro
const portfolioData = [
  { month: 'Jan', portfolio: 125000, benchmark: 120000, invested: 110000 },
  { month: 'Fev', portfolio: 132000, benchmark: 125000, invested: 115000 },
  { month: 'Mar', portfolio: 145000, benchmark: 130000, invested: 120000 },
  { month: 'Abr', portfolio: 138000, benchmark: 128000, invested: 125000 },
  { month: 'Mai', portfolio: 155000, benchmark: 135000, invested: 130000 },
  { month: 'Jun', portfolio: 162000, benchmark: 140000, invested: 135000 },
  { month: 'Jul', portfolio: 178250, benchmark: 145000, invested: 140000 }
];

const assetAllocation = [
  { name: 'Ações BR', value: 45000, color: '#2563eb', percentage: 25.2 },
  { name: 'Ações US', value: 62000, color: '#dc2626', percentage: 34.8 },
  { name: 'Cripto', value: 35000, color: '#f59e0b', percentage: 19.6 },
  { name: 'FIIs', value: 21000, color: '#059669', percentage: 11.8 },
  { name: 'Renda Fixa', value: 15250, color: '#7c3aed', percentage: 8.6 }
];

const cryptoHoldings = [
  { symbol: 'BTC', name: 'Bitcoin', quantity: 2.5, value: 145000, change: 2.5, logo: '₿' },
  { symbol: 'ETH', name: 'Ethereum', quantity: 15.3, value: 85000, change: -1.2, logo: 'Ξ' },
  { symbol: 'ADA', name: 'Cardano', quantity: 25000, value: 12500, change: 5.8, logo: '₳' },
  { symbol: 'SOL', name: 'Solana', quantity: 180, value: 25000, change: -3.1, logo: '◎' }
];

const riskMetrics = [
  { metric: 'Sharpe Ratio', value: 1.85, benchmark: 1.45 },
  { metric: 'Max Drawdown', value: -8.5, benchmark: -12.3 },
  { metric: 'Volatilidade', value: 15.2, benchmark: 18.7 },
  { metric: 'Beta', value: 0.92, benchmark: 1.0 },
  { metric: 'Alpha', value: 3.2, benchmark: 0.0 }
];

const transactionHistory = [
  { id: '1', date: '2025-07-15', asset: 'ITUB4', type: 'Compra', quantity: 100, price: 32.50, value: 3250, status: 'Executada' },
  { id: '2', date: '2025-07-14', asset: 'PETR4', type: 'Venda', quantity: 50, price: 38.20, value: 1910, status: 'Executada' },
  { id: '3', date: '2025-07-13', asset: 'BTC', type: 'Compra', quantity: 0.1, price: 58000, value: 5800, status: 'Pendente' },
  { id: '4', date: '2025-07-12', asset: 'HASH11', type: 'Compra', quantity: 25, price: 125.30, value: 3132.50, status: 'Falhou' }
];

const aiAnalysisExample = {
  recommendation: {
    action: "REBALANCEAR",
    confidence: 0.87,
    timeframe: "2-3 semanas",
    risk_level: "MODERADO"
  },
  analysis: {
    portfolio_health: "EXCELENTE",
    diversification_score: 8.5,
    risk_adjusted_return: 15.2,
    market_correlation: 0.73
  },
  actions: [
    { action: "Reduzir exposição em Ações US", percentage: -5, reason: "Sobrevalorização setorial" },
    { action: "Aumentar posição em FIIs", percentage: 3, reason: "Oportunidade em imóveis comerciais" },
    { action: "Manter cripto", percentage: 0, reason: "Posição adequada para diversificação" }
  ]
};

const spotlightActions = [
  {
    id: 'dashboard',
    label: 'Dashboard Principal',
    description: 'Visão geral do portfólio',
    onClick: () => console.log('Navigate to dashboard'),
    leftSection: <IconDashboard size="1rem" />,
  },
  {
    id: 'portfolio',
    label: 'Gerenciar Portfólio',
    description: 'Visualizar e editar investimentos',
    onClick: () => console.log('Navigate to portfolio'),
    leftSection: <IconWallet size="1rem" />,
  },
  {
    id: 'transactions',
    label: 'Histórico de Transações',
    description: 'Ver todas as operações realizadas',
    onClick: () => console.log('Navigate to transactions'),
    leftSection: <IconReceiptTax size="1rem" />,
  },
  {
    id: 'analytics',
    label: 'Análises e Relatórios',
    description: 'Relatórios detalhados de performance',
    onClick: () => console.log('Navigate to analytics'),
    leftSection: <IconReportAnalytics size="1rem" />,
  },
];

export function MantineShowcasePage() {
  const [opened, { toggle }] = useDisclosure();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [popoverOpened, setPopoverOpened] = useState(false);
  const [hoverCardOpened, setHoverCardOpened] = useState(false);
  const [activeTab, setActiveTab] = useState('financial-widgets');
  const [stepperActive, setStepperActive] = useState(1);
  const [loading, setLoading] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [collapseOpened, setCollapseOpened] = useState(false);
  const [selectedChip, setSelectedChip] = useState('portfolio');
  const [carouselIndex, setCarouselIndex] = useState(0);
  
  const theme = useMantineTheme();
  
  // Funções utilitárias
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleProgressStart = () => {
    nprogress.start();
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 30;
        if (next >= 100) {
          nprogress.complete();
          clearInterval(interval);
          return 100;
        }
        return next;
      });
    }, 200);
  };

  const openConfirmModal = () => modals.openConfirmModal({
    title: 'Confirmar operação',
    children: (
      <Text size="sm">
        Você tem certeza que deseja executar esta operação de investimento?
        Esta ação não pode ser desfeita.
      </Text>
    ),
    labels: { confirm: 'Confirmar', cancel: 'Cancelar' },
    confirmProps: { color: 'red' },
    onCancel: () => console.log('Cancel'),
    onConfirm: () => console.log('Confirmed'),
  });

  const transactionRows = transactionHistory.map((tx) => {
    let statusColor = 'blue';
    if (tx.status === 'Executada') statusColor = 'green';
    if (tx.status === 'Pendente') statusColor = 'yellow';
    if (tx.status === 'Falhou') statusColor = 'red';

    return (
      <Table.Tr key={tx.id}>
        <Table.Td>{new Date(tx.date).toLocaleDateString('pt-BR')}</Table.Td>
        <Table.Td>
          <Group gap="xs">
            <ThemeIcon size="sm" radius="xl" color="blue">
              <IconCoins size="0.8rem" />
            </ThemeIcon>
            <Text fw={500}>{tx.asset}</Text>
          </Group>
        </Table.Td>
        <Table.Td>
          <Badge color={tx.type === 'Compra' ? 'green' : 'red'} variant="light">
            {tx.type}
          </Badge>
        </Table.Td>
        <Table.Td ta="right">
          <Text size="sm">
            <NumberFormatter value={tx.quantity} thousandSeparator="." decimalSeparator="," />
          </Text>
        </Table.Td>
        <Table.Td ta="right">
          <Text size="sm">
            <NumberFormatter value={tx.price} prefix="R$ " thousandSeparator="." decimalSeparator="," decimalScale={2} />
          </Text>
        </Table.Td>
        <Table.Td ta="right">
          <Text fw={500}>
            <NumberFormatter value={tx.value} prefix="R$ " thousandSeparator="." decimalSeparator="," decimalScale={2} />
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge color={statusColor} variant="light">{tx.status}</Badge>
        </Table.Td>
        <Table.Td>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle">
                <IconDotsVertical size="1rem" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEye size={14} />}>
                Ver detalhes
              </Menu.Item>
              <Menu.Item leftSection={<IconPencil size={14} />}>
                Editar
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconTrash size={14} />} color="red">
                Cancelar
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <>
      <Spotlight
        actions={spotlightActions}
        nothingFound="Nenhum resultado encontrado..."
        highlightQuery
        searchProps={{
          leftSection: <IconSearch size="1rem" />,
          placeholder: 'Buscar funcionalidades...',
        }}
      />

      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <Title order={3} c="blue">
                <IconBulb size="1.2rem" style={{ marginRight: '8px' }} />
                Mantine Financial Showcase
              </Title>
            </Group>
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconDashboard size="1rem" />}
                onClick={() => spotlight.open()}
              >
                Buscar (Ctrl+K)
              </Button>
              <Indicator label="3" size={16}>
                <ActionIcon variant="subtle" size="lg">
                  <IconBell size="1.2rem" />
                </ActionIcon>
              </Indicator>
              <Avatar size="sm" color="blue">JD</Avatar>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <Stack>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Categorias
            </Text>
            
            <NavLink
              label="Widgets Financeiros"
              leftSection={<IconChartPie size="1rem" />}
              active={activeTab === 'financial-widgets'}
              onClick={() => setActiveTab('financial-widgets')}
            />
            
            <NavLink
              label="Dashboards & KPIs"
              leftSection={<IconDashboard size="1rem" />}
              active={activeTab === 'dashboards'}
              onClick={() => setActiveTab('dashboards')}
            />
            
            <NavLink
              label="Formulários Avançados"
              leftSection={<IconPencil size="1rem" />}
              active={activeTab === 'forms'}
              onClick={() => setActiveTab('forms')}
            />
            
            <NavLink
              label="Visualização de Dados"
              leftSection={<IconChartLine size="1rem" />}
              active={activeTab === 'data-viz'}
              onClick={() => setActiveTab('data-viz')}
            />
            
            <NavLink
              label="Interações & Overlays"
              leftSection={<IconTarget size="1rem" />}
              active={activeTab === 'interactions'}
              onClick={() => setActiveTab('interactions')}
            />
            
            <NavLink
              label="Navegação & UX"
              leftSection={<IconRocket size="1rem" />}
              active={activeTab === 'navigation'}
              onClick={() => setActiveTab('navigation')}
            />

            <Divider my="sm" />
            
            <Button
              variant="light"
              leftSection={<IconRefresh size="1rem" />}
              onClick={handleProgressStart}
              size="xs"
            >
              Testar Progress
            </Button>
          </Stack>
        </AppShell.Navbar>

        <AppShell.Main>
          <Container fluid>
            <Stack gap="xl">

              {/* SEÇÃO: WIDGETS FINANCEIROS */}
              {activeTab === 'financial-widgets' && (
                <>
                  <Group justify="space-between">
                    <Title order={2} c="blue">Widgets Financeiros Essenciais</Title>
                    <Button
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'cyan' }}
                      leftSection={<IconPigMoney size="1rem" />}
                    >
                      Novo Investimento
                    </Button>
                  </Group>
                  
                  {/* KPIs Financeiros Principais */}
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                    <Paper
                      p="md"
                      radius="lg"
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white'
                      }}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text size="xs" tt="uppercase" fw={700} opacity={0.8}>
                            Patrimônio Líquido
                          </Text>
                          <Text fz={24} fw={700}>
                            <NumberFormatter 
                              value={178250.72} 
                              prefix="R$ " 
                              thousandSeparator="." 
                              decimalSeparator="," 
                              decimalScale={2} 
                            />
                          </Text>
                          <Group gap={4} mt={4}>
                            <IconTrendingUp size="0.9rem" />
                            <Text size="xs" fw={500}>+2.5% no mês</Text>
                          </Group>
                        </div>
                        <ThemeIcon size={50} radius="md" color="rgba(255,255,255,0.2)" variant="light">
                          <IconWallet size="1.5rem" />
                        </ThemeIcon>
                      </Group>
                    </Paper>
                    
                    <Paper
                      p="md"
                      radius="lg"
                      style={{
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        color: 'white'
                      }}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text size="xs" tt="uppercase" fw={700} opacity={0.8}>
                            Rentabilidade
                          </Text>
                          <Text fz={24} fw={700}>+27.3%</Text>
                          <Group gap={4} mt={4}>
                            <IconTrendingUp size="0.9rem" />
                            <Text size="xs" fw={500}>vs CDI: +8.2%</Text>
                          </Group>
                        </div>
                        <RingProgress
                          size={50}
                          thickness={6}
                          sections={[{ value: 27.3, color: 'rgba(255,255,255,0.8)' }]}
                          label={<Text ta="center" size="xs" c="white">27%</Text>}
                        />
                      </Group>
                    </Paper>
                    
                    <Paper
                      p="md"
                      radius="lg"
                      style={{
                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        color: 'white'
                      }}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text size="xs" tt="uppercase" fw={700} opacity={0.8}>
                            Liquidez Disponível
                          </Text>
                          <Text fz={24} fw={700}>
                            <NumberFormatter 
                              value={25430} 
                              prefix="R$ " 
                              thousandSeparator="." 
                              decimalSeparator="," 
                            />
                          </Text>
                          <Text size="xs" fw={500} opacity={0.8}>
                            14.3% do total
                          </Text>
                        </div>
                        <ThemeIcon size={50} radius="md" color="rgba(255,255,255,0.2)" variant="light">
                          <IconCash size="1.5rem" />
                        </ThemeIcon>
                      </Group>
                    </Paper>
                    
                    <Paper
                      p="md"
                      radius="lg"
                      style={{
                        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        color: 'white'
                      }}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text size="xs" tt="uppercase" fw={700} opacity={0.8}>
                            Risco Portfolio
                          </Text>
                          <Text fz={24} fw={700}>Moderado</Text>
                          <Group gap={4} mt={4}>
                            <Text size="xs" fw={500} opacity={0.8}>
                              Sharpe: 1.85
                            </Text>
                          </Group>
                        </div>
                        <Progress.Root size="xl" radius="xl" w={50}>
                          <Progress.Section value={62} color="rgba(255,255,255,0.8)" />
                        </Progress.Root>
                      </Group>
                    </Paper>
                  </SimpleGrid>

                  {/* Widget de Alocação de Ativos */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Group justify="space-between" mb="lg">
                      <div>
                        <Title order={3}>Alocação de Ativos</Title>
                        <Text size="sm" c="dimmed">
                          Distribuição do seu portfólio de investimentos
                        </Text>
                      </div>
                      <Chip.Group value={selectedChip} onChange={setSelectedChip}>
                        <Group>
                          <Chip value="portfolio" size="sm">Por Valor</Chip>
                          <Chip value="percentage" size="sm">Por %</Chip>
                          <Chip value="risk" size="sm">Por Risco</Chip>
                        </Group>
                      </Chip.Group>
                    </Group>
                    
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <Box style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={assetAllocation}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name}: ${percentage}%`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {assetAllocation.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                      
                      <Stack gap="md">
                        {assetAllocation.map((asset, index) => (
                          <Paper key={asset.name} withBorder p="md" radius="md">
                            <Group justify="space-between">
                              <Group gap="sm">
                                <Box
                                  w={12}
                                  h={12}
                                  bg={asset.color}
                                  style={{ borderRadius: 2 }}
                                />
                                <div>
                                  <Text fw={500} size="sm">{asset.name}</Text>
                                  <Text size="xs" c="dimmed">
                                    {asset.percentage.toFixed(1)}% da carteira
                                  </Text>
                                </div>
                              </Group>
                              <div style={{ textAlign: 'right' }}>
                                <Text fw={600} size="sm">
                                  {formatCurrency(asset.value)}
                                </Text>
                                <Progress value={asset.percentage} size="xs" mt={4} color={asset.color} />
                              </div>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    </SimpleGrid>
                  </Card>

                  {/* Holdings de Criptomoedas */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Group justify="space-between" mb="lg">
                      <div>
                        <Title order={3}>
                          <Group gap="sm">
                            <IconCoins size="1.5rem" color={theme.colors.orange[6]} />
                            Portfólio Crypto
                          </Group>
                        </Title>
                        <Text size="sm" c="dimmed">
                          Principais posições em criptomoedas
                        </Text>
                      </div>
                      <Badge
                        size="lg"
                        variant="gradient"
                        gradient={{ from: 'orange', to: 'red' }}
                      >
                        {formatCurrency(cryptoHoldings.reduce((acc, holding) => acc + holding.value, 0))}
                      </Badge>
                    </Group>
                    
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                      {cryptoHoldings.map((crypto) => (
                        <Paper
                          key={crypto.symbol}
                          withBorder
                          p="md"
                          radius="md"
                          style={{ position: 'relative', overflow: 'hidden' }}
                        >
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 40,
                            height: 40,
                            background: crypto.change >= 0 ? 
                              'linear-gradient(45deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.3))' : 
                              'linear-gradient(45deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.3))',
                            borderRadius: '0 0 0 40px'
                          }} />
                          
                          <Group justify="space-between" mb="sm">
                            <Group gap="xs">
                              <Avatar size="sm" radius="xl" color="orange">
                                {crypto.logo}
                              </Avatar>
                              <div>
                                <Text fw={600} size="sm">{crypto.symbol}</Text>
                                <Text size="xs" c="dimmed">{crypto.name}</Text>
                              </div>
                            </Group>
                            <Badge
                              color={crypto.change >= 0 ? 'green' : 'red'}
                              variant="light"
                              size="sm"
                            >
                              {crypto.change >= 0 ? '+' : ''}{crypto.change}%
                            </Badge>
                          </Group>
                          
                          <Stack gap={4}>
                            <Text fw={500}>
                              {formatCurrency(crypto.value)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              <NumberFormatter 
                                value={crypto.quantity} 
                                thousandSeparator="." 
                                decimalSeparator="," 
                                decimalScale={4}
                                suffix={` ${crypto.symbol}`}
                              />
                            </Text>
                          </Stack>
                        </Paper>
                      ))}
                    </SimpleGrid>
                  </Card>
                </>
              )}

              {/* SEÇÃO: DASHBOARDS & KPIs */}
              {activeTab === 'dashboards' && (
                <>
                  <Title order={2} c="blue">Dashboards & Análises</Title>
                  
                  {/* Performance Chart */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Group justify="space-between" mb="lg">
                      <div>
                        <Title order={3}>Performance do Portfólio</Title>
                        <Text size="sm" c="dimmed">
                          Comparação com benchmark e valor investido
                        </Text>
                      </div>
                      <SegmentedControl
                        data={[
                          { label: '7D', value: '7d' },
                          { label: '1M', value: '1m' },
                          { label: '3M', value: '3m' },
                          { label: '1A', value: '1y' },
                          { label: 'Tudo', value: 'all' }
                        ]}
                      />
                    </Group>
                    
                    <Box style={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={portfolioData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.gray[3]} />
                          <XAxis dataKey="month" stroke={theme.colors.gray[6]} />
                          <YAxis stroke={theme.colors.gray[6]} />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: theme.colors.dark[6],
                              border: 'none',
                              borderRadius: 8,
                              color: theme.colors.gray[0]
                            }}
                            formatter={(value) => [formatCurrency(value)]}
                          />
                          <Area
                            type="monotone"
                            dataKey="invested"
                            fill="rgba(99, 102, 241, 0.1)"
                            stroke="rgba(99, 102, 241, 0.5)"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                          />
                          <Line
                            type="monotone"
                            dataKey="benchmark"
                            stroke={theme.colors.gray[5]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="portfolio"
                            stroke={theme.colors.blue[6]}
                            strokeWidth={3}
                            dot={{ r: 4, fill: theme.colors.blue[6] }}
                            activeDot={{ r: 6, stroke: theme.colors.blue[6], strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </Box>
                  </Card>

                  {/* Métricas de Risco */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Group justify="space-between" mb="lg">
                      <div>
                        <Title order={3}>Análise de Risco</Title>
                        <Text size="sm" c="dimmed">
                          Principais métricas de risco vs benchmark
                        </Text>
                      </div>
                      <Badge size="lg" color="blue" variant="light">
                        Risco Moderado
                      </Badge>
                    </Group>
                    
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }}>
                      {riskMetrics.map((metric) => (
                        <Paper key={metric.metric} withBorder p="md" radius="md">
                          <Stack gap="xs">
                            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                              {metric.metric}
                            </Text>
                            <Group justify="space-between" align="flex-end">
                              <div>
                                <Text fw={700} size="lg">
                                  {metric.value}{metric.metric.includes('%') || metric.metric.includes('Drawdown') ? '%' : ''}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Benchmark: {metric.benchmark}{metric.metric.includes('%') || metric.metric.includes('Drawdown') ? '%' : ''}
                                </Text>
                              </div>
                              <ThemeIcon
                                size="sm"
                                color={
                                  metric.metric === 'Max Drawdown' ? 
                                    (metric.value > metric.benchmark ? 'red' : 'green') :
                                    (metric.value > metric.benchmark ? 'green' : 'red')
                                }
                                variant="light"
                              >
                                {metric.metric === 'Max Drawdown' ? 
                                  (metric.value > metric.benchmark ? <IconTrendingDown size="0.8rem" /> : <IconTrendingUp size="0.8rem" />) :
                                  (metric.value > metric.benchmark ? <IconTrendingUp size="0.8rem" /> : <IconTrendingDown size="0.8rem" />)
                                }
                              </ThemeIcon>
                            </Group>
                          </Stack>
                        </Paper>
                      ))}
                    </SimpleGrid>
                  </Card>

                  {/* IA Financial Analysis */}
                  <Card withBorder radius="lg" p="xl" shadow="sm" style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 100,
                      height: 100,
                      background: 'linear-gradient(45deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.3))',
                      borderRadius: '0 0 0 100px'
                    }} />
                    
                    <Group justify="space-between" mb="lg">
                      <div>
                        <Title order={3}>
                          <Group gap="sm">
                            <IconBulb size="1.5rem" color={theme.colors.violet[6]} />
                            Análise IA Financeira
                          </Group>
                        </Title>
                        <Text size="sm" c="dimmed">
                          Recomendações baseadas em machine learning
                        </Text>
                      </div>
                      <Badge
                        size="lg"
                        variant="gradient"
                        gradient={{ from: 'violet', to: 'purple' }}
                      >
                        Confiança: {Math.round(aiAnalysisExample.recommendation.confidence * 100)}%
                      </Badge>
                    </Group>
                    
                    <SimpleGrid cols={{ base: 1, md: 3 }}>
                      <Paper withBorder p="md" radius="md" bg="blue.0">
                        <Stack gap="xs">
                          <Group gap="xs">
                            <IconTarget size="1rem" color={theme.colors.blue[6]} />
                            <Text fw={600} size="sm" c="blue">Recomendação</Text>
                          </Group>
                          <Text fw={700} size="lg">{aiAnalysisExample.recommendation.action}</Text>
                          <Text size="xs" c="dimmed">
                            Prazo: {aiAnalysisExample.recommendation.timeframe}
                          </Text>
                        </Stack>
                      </Paper>
                      
                      <Paper withBorder p="md" radius="md" bg="green.0">
                        <Stack gap="xs">
                          <Group gap="xs">
                            <IconShield size="1rem" color={theme.colors.green[6]} />
                            <Text fw={600} size="sm" c="green">Health Score</Text>
                          </Group>
                          <Text fw={700} size="lg">{aiAnalysisExample.analysis.portfolio_health}</Text>
                          <Text size="xs" c="dimmed">
                            Diversificação: {aiAnalysisExample.analysis.diversification_score}/10
                          </Text>
                        </Stack>
                      </Paper>
                      
                      <Paper withBorder p="md" radius="md" bg="orange.0">
                        <Stack gap="xs">
                          <Group gap="xs">
                            <IconTrendingUp size="1rem" color={theme.colors.orange[6]} />
                            <Text fw={600} size="sm" c="orange">Retorno Ajustado</Text>
                          </Group>
                          <Text fw={700} size="lg">{aiAnalysisExample.analysis.risk_adjusted_return}%</Text>
                          <Text size="xs" c="dimmed">
                            Correlação: {aiAnalysisExample.analysis.market_correlation}
                          </Text>
                        </Stack>
                      </Paper>
                    </SimpleGrid>
                    
                    <Divider my="md" />
                    
                    <Text fw={600} mb="sm">Ações Recomendadas:</Text>
                    <Stack gap="sm">
                      {aiAnalysisExample.actions.map((action, index) => (
                        <Paper key={index} withBorder p="sm" radius="sm">
                          <Group justify="space-between">
                            <div>
                              <Text fw={500} size="sm">{action.action}</Text>
                              <Text size="xs" c="dimmed">{action.reason}</Text>
                            </div>
                            <Badge
                              color={action.percentage > 0 ? 'green' : action.percentage < 0 ? 'red' : 'gray'}
                              variant="light"
                            >
                              {action.percentage > 0 ? '+' : ''}{action.percentage}%
                            </Badge>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                    
                    <Group mt="md">
                      <Button variant="light" leftSection={<IconCheck size="1rem" />}>
                        Implementar Sugestões
                      </Button>
                      <Button variant="outline" leftSection={<IconX size="1rem" />}>
                        Ignorar
                      </Button>
                    </Group>
                  </Card>
                </>
              )}

              {/* SEÇÃO: FORMULÁRIOS AVANÇADOS */}
              {activeTab === 'forms' && (
                <>
                  <Title order={2} c="blue">Formulários & Inputs Avançados</Title>
                  
                  <SimpleGrid cols={{ base: 1, lg: 2 }}>
                    {/* Formulário de Nova Ordem */}
                    <Card withBorder radius="lg" p="xl" shadow="sm">
                      <Title order={3} mb="lg">Nova Ordem de Investimento</Title>
                      
                      <Stack gap="md">
                        <Select
                          label="Tipo de Ativo"
                          placeholder="Selecione o tipo"
                          data={[
                            { value: 'stocks', label: '📈 Ações' },
                            { value: 'crypto', label: '₿ Criptomoedas' },
                            { value: 'fiis', label: '🏢 FIIs' },
                            { value: 'bonds', label: '💰 Renda Fixa' }
                          ]}
                          leftSection={<IconCoins size="1rem" />}
                        />
                        
                        <Autocomplete
                          label="Ativo"
                          placeholder="Digite o código do ativo"
                          data={['ITUB4', 'PETR4', 'VALE3', 'BBAS3', 'WEGE3', 'HASH11', 'HGLG11']}
                          leftSection={<IconSearch size="1rem" />}
                        />
                        
                        <Group grow>
                          <NumberInput
                            label="Quantidade"
                            placeholder="0"
                            min={0}
                            leftSection={<IconTarget size="1rem" />}
                          />
                          
                          <NumberInput
                            label="Preço Limite"
                            placeholder="0,00"
                            prefix="R$ "
                            decimalScale={2}
                            min={0}
                            leftSection={<IconCurrencyDollar size="1rem" />}
                          />
                        </Group>
                        
                        <SegmentedControl
                          data={[
                            { label: 'Comprar', value: 'buy' },
                            { label: 'Vender', value: 'sell' }
                          ]}
                          size="md"
                        />
                        
                        <Textarea
                          label="Observações"
                          placeholder="Adicione notas sobre esta operação..."
                          minRows={2}
                          autosize
                        />
                        
                        <Group>
                          <Checkbox label="Executar imediatamente" />
                          <Switch label="Enviar notificação" defaultChecked />
                        </Group>
                        
                        <Group justify="flex-end">
                          <Button variant="outline">Cancelar</Button>
                          <Button
                            gradient={{ from: 'blue', to: 'cyan' }}
                            variant="gradient"
                            leftSection={<IconCheck size="1rem" />}
                          >
                            Executar Ordem
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                    
                    {/* Configurações Avançadas */}
                    <Card withBorder radius="lg" p="xl" shadow="sm">
                      <Title order={3} mb="lg">Configurações do Sistema</Title>
                      
                      <Stack gap="lg">
                        <Fieldset legend="Perfil de Investimento">
                          <Stack gap="md">
                            <Slider
                              label="Tolerância ao Risco"
                              description="Defina seu nível de risco aceitável"
                              defaultValue={40}
                              marks={[
                                { value: 20, label: 'Conservador' },
                                { value: 50, label: 'Moderado' },
                                { value: 80, label: 'Agressivo' },
                              ]}
                              color="blue"
                            />
                            
                            <Radio.Group
                              name="investmentGoal"
                              label="Objetivo Principal"
                              description="Qual é seu foco de investimento?"
                            >
                              <Group mt="xs">
                                <Radio value="preservation" label="Preservação de Capital" />
                                <Radio value="income" label="Renda Regular" />
                                <Radio value="growth" label="Crescimento" />
                              </Group>
                            </Radio.Group>
                          </Stack>
                        </Fieldset>
                        
                        <Fieldset legend="Notificações">
                          <Stack gap="sm">
                            <Switch
                              label="Alertas de Preço"
                              description="Receber notificações quando atingir alvos de preço"
                              defaultChecked
                            />
                            <Switch
                              label="Relatórios Semanais"
                              description="Resumo semanal da performance"
                              defaultChecked
                            />
                            <Switch
                              label="Análises IA"
                              description="Recomendações baseadas em inteligência artificial"
                            />
                          </Stack>
                        </Fieldset>
                        
                        <Fieldset legend="Segurança">
                          <Stack gap="md">
                            <PasswordInput
                              label="Nova Senha"
                              placeholder="Digite uma senha forte"
                              leftSection={<IconLock size="1rem" />}
                            />
                            
                            <PinInput
                              label="PIN de Segurança"
                              description="4 dígitos para operações críticas"
                              length={4}
                              mask
                            />
                            
                            <Checkbox label="Ativar autenticação de dois fatores" />
                          </Stack>
                        </Fieldset>
                      </Stack>
                    </Card>
                  </SimpleGrid>
                  
                  {/* Upload de Documentos */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Title order={3} mb="lg">Upload de Documentos</Title>
                    
                    <Dropzone
                      onDrop={(files) => console.log('accepted files', files)}
                      onReject={(files) => console.log('rejected files', files)}
                      maxSize={3 * 1024 ** 2}
                      accept={[...IMAGE_MIME_TYPE, ...PDF_MIME_TYPE]}
                    >
                      <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
                        <Dropzone.Accept>
                          <IconUpload
                            style={{ width: mantineRem(52), height: mantineRem(52), color: 'var(--mantine-color-blue-6)' }}
                            stroke={1.5}
                          />
                        </Dropzone.Accept>
                        <Dropzone.Reject>
                          <IconX
                            style={{ width: mantineRem(52), height: mantineRem(52), color: 'var(--mantine-color-red-6)' }}
                            stroke={1.5}
                          />
                        </Dropzone.Reject>
                        <Dropzone.Idle>
                          <IconCloudUpload
                            style={{ width: mantineRem(52), height: mantineRem(52), color: 'var(--mantine-color-dimmed)' }}
                            stroke={1.5}
                          />
                        </Dropzone.Idle>

                        <div>
                          <Text size="xl" inline>
                            Arraste documentos para cá ou clique para selecionar
                          </Text>
                          <Text size="sm" c="dimmed" inline mt={7}>
                            Anexe comprovantes de investimento, extratos ou relatórios (máx. 3MB)
                          </Text>
                        </div>
                      </Group>
                    </Dropzone>
                  </Card>
                </>
              )}

              {/* SEÇÃO: VISUALIZAÇÃO DE DADOS */}
              {activeTab === 'data-viz' && (
                <>
                  <Title order={2} c="blue">Visualização de Dados & Tabelas</Title>
                  
                  {/* Histórico de Transações Avançado */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Group justify="space-between" mb="lg">
                      <div>
                        <Title order={3}>Histórico de Transações</Title>
                        <Text size="sm" c="dimmed">
                          Todas as operações realizadas nos últimos 30 dias
                        </Text>
                      </div>
                      <Group>
                        <DatePickerInput
                          placeholder="Filtrar por período"
                          leftSection={<IconCalendar size="1rem" />}
                          style={{ width: 200 }}
                        />
                        <Button
                          variant="outline"
                          leftSection={<IconFilter size="1rem" />}
                        >
                          Filtros
                        </Button>
                      </Group>
                    </Group>
                    
                    <ScrollArea>
                      <Table.ScrollContainer minWidth={800}>
                        <Table striped highlightOnHover withTableBorder>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>
                                <Group gap="xs">
                                  <IconCalendar size="0.9rem" />
                                  <Text fw={600}>Data</Text>
                                </Group>
                              </Table.Th>
                              <Table.Th>
                                <Group gap="xs">
                                  <IconCoins size="0.9rem" />
                                  <Text fw={600}>Ativo</Text>
                                </Group>
                              </Table.Th>
                              <Table.Th>Operação</Table.Th>
                              <Table.Th ta="right">Qtd</Table.Th>
                              <Table.Th ta="right">Preço</Table.Th>
                              <Table.Th ta="right">Valor Total</Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th>Ações</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>{transactionRows}</Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    </ScrollArea>
                    
                    <Group justify="space-between" mt="md">
                      <Text size="sm" c="dimmed">
                        Mostrando {transactionHistory.length} de {transactionHistory.length} transações
                      </Text>
                      <Pagination total={5} size="sm" />
                    </Group>
                  </Card>

                  {/* Carousel de Gráficos */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Group justify="space-between" mb="lg">
                      <Title order={3}>Análises Visuais</Title>
                      <Text size="sm" c="dimmed">
                        Deslize para ver diferentes visualizações
                      </Text>
                    </Group>
                    
                    <Carousel
                      height={400}
                      slideSize="100%"
                      slideGap="md"
                      loop
                      align="start"
                      slidesToScroll={1}
                    >
                      <Carousel.Slide>
                        <Paper withBorder p="md" radius="md" h="100%">
                          <Text fw={600} mb="md">Evolução do Patrimônio</Text>
                          <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={portfolioData}>
                              <defs>
                                <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                              <Area
                                type="monotone"
                                dataKey="portfolio"
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorPortfolio)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Carousel.Slide>
                      
                      <Carousel.Slide>
                        <Paper withBorder p="md" radius="md" h="100%">
                          <Text fw={600} mb="md">Comparação vs Benchmark</Text>
                          <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={portfolioData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                              <Line
                                type="monotone"
                                dataKey="portfolio"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                name="Seu Portfólio"
                              />
                              <Line
                                type="monotone"
                                dataKey="benchmark"
                                stroke="#6b7280"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                name="Benchmark"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Carousel.Slide>
                      
                      <Carousel.Slide>
                        <Paper withBorder p="md" radius="md" h="100%">
                          <Text fw={600} mb="md">Distribuição por Classe</Text>
                          <ResponsiveContainer width="100%" height={320}>
                            <Treemap
                              data={assetAllocation}
                              dataKey="value"
                              ratio={4/3}
                              stroke="#fff"
                              fill="#8884d8"
                            />
                          </ResponsiveContainer>
                        </Paper>
                      </Carousel.Slide>
                    </Carousel>
                  </Card>

                  {/* Lista com Code Highlight */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Title order={3} mb="lg">Análise Técnica - Código Python</Title>
                    <CodeHighlight
                      code={`import pandas as pd
import numpy as np
from ta import add_all_ta_features

# Análise técnica automatizada
def analyze_portfolio(portfolio_data):
    """
    Análise completa do portfólio com indicadores técnicos
    """
    df = pd.DataFrame(portfolio_data)
    
    # Adicionar todos os indicadores técnicos
    df = add_all_ta_features(df, 
                           open="open", high="high", 
                           low="low", close="close", 
                           volume="volume")
    
    # Calcular métricas de risco
    returns = df['close'].pct_change()
    sharpe_ratio = returns.mean() / returns.std() * np.sqrt(252)
    max_drawdown = (df['close'] / df['close'].cummax() - 1).min()
    
    return {
        'sharpe_ratio': sharpe_ratio,
        'max_drawdown': max_drawdown,
        'volatility': returns.std() * np.sqrt(252),
        'recommendation': 'BUY' if sharpe_ratio > 1.5 else 'HOLD'
    }

# Executar análise
result = analyze_portfolio(portfolio_data)
print(f"Recomendação: {result['recommendation']}")
print(f"Sharpe Ratio: {result['sharpe_ratio']:.2f}")
print(f"Max Drawdown: {result['max_drawdown']:.2%}")`}
                      language="python"
                    />
                  </Card>
                </>
              )}

              {/* SEÇÃO: INTERAÇÕES & OVERLAYS */}
              {activeTab === 'interactions' && (
                <>
                  <Title order={2} c="blue">Interações & Overlays</Title>
                  
                  <SimpleGrid cols={{ base: 1, lg: 2 }}>
                    {/* Controles Interativos */}
                    <Card withBorder radius="lg" p="xl" shadow="sm">
                      <Title order={3} mb="lg">Controles Interativos</Title>
                      
                      <Stack gap="lg">
                        <Group>
                          <Button
                            onClick={openModal}
                            leftSection={<IconPlus size="1rem" />}
                            variant="gradient"
                            gradient={{ from: 'blue', to: 'cyan' }}
                          >
                            Abrir Modal
                          </Button>
                          
                          <Button
                            onClick={openDrawer}
                            variant="outline"
                            leftSection={<IconMenu2 size="1rem" />}
                          >
                            Abrir Drawer
                          </Button>
                          
                          <Button
                            onClick={openConfirmModal}
                            color="red"
                            leftSection={<IconTrash size="1rem" />}
                          >
                            Modal de Confirmação
                          </Button>
                        </Group>
                        
                        <Group>
                          <Button
                            onClick={() => setNotificationVisible(!notificationVisible)}
                            color="green"
                            leftSection={<IconBell size="1rem" />}
                          >
                            {notificationVisible ? 'Ocultar' : 'Mostrar'} Notification
                          </Button>
                          
                          <CopyButton value="BTC: $58,245.30">
                            {({ copied, copy }) => (
                              <Button
                                color={copied ? 'teal' : 'blue'}
                                onClick={copy}
                                leftSection={<IconCoin size="1rem" />}
                              >
                                {copied ? 'Preço Copiado!' : 'Copiar Preço BTC'}
                              </Button>
                            )}
                          </CopyButton>
                        </Group>
                        
                        <Divider />
                        
                        <Group>
                          <HoverCard width={280} shadow="md">
                            <HoverCard.Target>
                              <Button variant="light">
                                Detalhes do Ativo
                              </Button>
                            </HoverCard.Target>
                            <HoverCard.Dropdown>
                              <Group>
                                <Avatar size="sm" color="orange">₿</Avatar>
                                <div>
                                  <Text size="sm" fw={500}>Bitcoin (BTC)</Text>
                                  <Text size="xs" c="dimmed">Criptomoeda</Text>
                                </div>
                              </Group>
                              <Text size="sm" mt="md">
                                A primeira e maior criptomoeda por capitalização de mercado.
                                Atual: $58,245 (+2.5%)
                              </Text>
                            </HoverCard.Dropdown>
                          </HoverCard>
                          
                          <Popover width={300} position="bottom" withArrow shadow="md">
                            <Popover.Target>
                              <Button variant="outline">
                                Configurações Rápidas
                              </Button>
                            </Popover.Target>
                            <Popover.Dropdown>
                              <Stack gap="sm">
                                <Text size="sm" fw={500}>Preferências</Text>
                                <Switch label="Modo escuro" />
                                <Switch label="Notificações push" defaultChecked />
                                <Switch label="Análises automáticas" />
                                <Button size="xs" fullWidth>
                                  Salvar configurações
                                </Button>
                              </Stack>
                            </Popover.Dropdown>
                          </Popover>
                        </Group>
                        
                        {notificationVisible && (
                          <Notification
                            icon={<IconCheck size="1.1rem" />}
                            color="teal"
                            title="Operação Executada!"
                            onClose={() => setNotificationVisible(false)}
                          >
                            Compra de 100 ações ITUB4 executada com sucesso.
                          </Notification>
                        )}
                      </Stack>
                    </Card>
                    
                    {/* Menu Contextual e Transições */}
                    <Card withBorder radius="lg" p="xl" shadow="sm">
                      <Title order={3} mb="lg">Menu & Transições</Title>
                      
                      <Stack gap="lg">
                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <Paper
                              withBorder
                              p="xl"
                              style={{ textAlign: 'center', cursor: 'pointer' }}
                            >
                              <IconCoins size="2rem" color={theme.colors.blue[6]} />
                              <Text mt="sm" fw={500}>
                                Clique para Menu
                              </Text>
                              <Text size="sm" c="dimmed">
                                Menu dropdown aparecerá
                              </Text>
                            </Paper>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconEye size={14} />}>
                              Ver Detalhes
                            </Menu.Item>
                            <Menu.Item leftSection={<IconPencil size={14} />}>
                              Editar Posição
                            </Menu.Item>
                            <Menu.Item leftSection={<IconShare size={14} />}>
                              Compartilhar
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                            >
                              Vender Tudo
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                        
                        <Group>
                          <Button
                            onClick={() => setCollapseOpened(!collapseOpened)}
                            leftSection={<IconChevronDown size="1rem" />}
                          >
                            Toggle Collapse
                          </Button>
                        </Group>
                        
                        <Collapse in={collapseOpened}>
                          <Paper withBorder p="md" radius="md" bg="blue.0">
                            <Text fw={500} mb="sm">Informações Adicionais</Text>
                            <Text size="sm">
                              Este conteúdo só é exibido quando expandido.
                              Útil para mostrar detalhes extras sem sobrecarregar a interface.
                            </Text>
                          </Paper>
                        </Collapse>
                        
                        <Group gap="xs">
                          <ActionIcon variant="filled" size="lg" color="blue">
                            <IconSettings size="1rem" />
                          </ActionIcon>
                          <ActionIcon variant="outline" size="lg" color="green">
                            <IconCheck size="1rem" />
                          </ActionIcon>
                          <ActionIcon variant="light" size="lg" color="red">
                            <IconX size="1rem" />
                          </ActionIcon>
                          <ActionIcon variant="subtle" size="lg" color="orange">
                            <IconShare size="1rem" />
                          </ActionIcon>
                        </Group>
                      </Stack>
                    </Card>
                  </SimpleGrid>
                </>
              )}

              {/* SEÇÃO: NAVEGAÇÃO & UX */}
              {activeTab === 'navigation' && (
                <>
                  <Title order={2} c="blue">Navegação & Experiência do Usuário</Title>
                  
                  {/* Stepper para Processo de Investimento */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Title order={3} mb="lg">Processo de Investimento</Title>
                    
                    <Stepper active={stepperActive} onStepClick={setStepperActive} breakpoint="sm">
                      <Stepper.Step
                        label="Análise de Perfil"
                        description="Defina seu perfil de investidor"
                        icon={<IconUser size="1rem" />}
                      >
                        <Stack gap="md">
                          <Text>Etapa 1: Análise do Perfil de Investidor</Text>
                          <Text size="sm" c="dimmed">
                            Complete o questionário para identificarmos seu perfil de risco
                            e objetivos de investimento.
                          </Text>
                          <Progress value={100} color="blue" size="sm" />
                        </Stack>
                      </Stepper.Step>
                      
                      <Stepper.Step
                        label="Seleção de Ativos"
                        description="Escolha seus investimentos"
                        icon={<IconCoins size="1rem" />}
                      >
                        <Stack gap="md">
                          <Text>Etapa 2: Seleção de Ativos</Text>
                          <Text size="sm" c="dimmed">
                            Com base no seu perfil, sugeriremos uma carteira diversificada
                            de investimentos adequados aos seus objetivos.
                          </Text>
                          <Progress value={stepperActive >= 1 ? 100 : 0} color="blue" size="sm" />
                        </Stack>
                      </Stepper.Step>
                      
                      <Stepper.Step
                        label="Configuração"
                        description="Configure automações"
                        icon={<IconSettings size="1rem" />}
                      >
                        <Stack gap="md">
                          <Text>Etapa 3: Configuração de Automações</Text>
                          <Text size="sm" c="dimmed">
                            Configure aportes automáticos, rebalanceamentos e alertas
                            para otimizar sua estratégia de investimento.
                          </Text>
                          <Progress value={stepperActive >= 2 ? 100 : 0} color="blue" size="sm" />
                        </Stack>
                      </Stepper.Step>
                      
                      <Stepper.Step
                        label="Execução"
                        description="Execute suas ordens"
                        icon={<IconRocket size="1rem" />}
                      >
                        <Stack gap="md">
                          <Text>Etapa 4: Execução das Ordens</Text>
                          <Text size="sm" c="dimmed">
                            Revise e execute suas ordens de investimento. O sistema
                            monitorará automaticamente sua performance.
                          </Text>
                          <Progress value={stepperActive >= 3 ? 100 : 0} color="blue" size="sm" />
                        </Stack>
                      </Stepper.Step>
                      
                      <Stepper.Completed>
                        <Stack gap="md" align="center">
                          <ThemeIcon size={60} radius="xl" color="green">
                            <IconCheck size="2rem" />
                          </ThemeIcon>
                          <Text fw={600} size="lg">Parabéns!</Text>
                          <Text size="sm" c="dimmed" ta="center">
                            Seu portfólio foi configurado com sucesso. Agora você pode
                            acompanhar sua performance em tempo real.
                          </Text>
                        </Stack>
                      </Stepper.Completed>
                    </Stepper>

                    <Group justify="center" mt="xl">
                      <Button
                        variant="default"
                        onClick={() => setStepperActive(Math.max(0, stepperActive - 1))}
                        disabled={stepperActive === 0}
                      >
                        Voltar
                      </Button>
                      <Button
                        onClick={() => setStepperActive(Math.min(4, stepperActive + 1))}
                        disabled={stepperActive === 4}
                      >
                        Próximo
                      </Button>
                    </Group>
                  </Card>
                  
                  {/* Tabs Avançadas */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Title order={3} mb="lg">Dashboard Multi-Visão</Title>
                    
                    <Tabs defaultValue="overview" variant="pills">
                      <Tabs.List grow>
                        <Tabs.Tab
                          value="overview"
                          leftSection={<IconDashboard size="0.8rem" />}
                        >
                          Visão Geral
                        </Tabs.Tab>
                        <Tabs.Tab
                          value="portfolio"
                          leftSection={<IconWallet size="0.8rem" />}
                        >
                          Portfólio
                        </Tabs.Tab>
                        <Tabs.Tab
                          value="performance"
                          leftSection={<IconTrendingUp size="0.8rem" />}
                        >
                          Performance
                        </Tabs.Tab>
                        <Tabs.Tab
                          value="risk"
                          leftSection={<IconShield size="0.8rem" />}
                        >
                          Análise de Risco
                        </Tabs.Tab>
                      </Tabs.List>

                      <Tabs.Panel value="overview" pt="lg">
                        <SimpleGrid cols={{ base: 1, sm: 3 }}>
                          <Paper withBorder p="md" radius="md">
                            <Text size="sm" c="dimmed">Valor Total</Text>
                            <Text fw={700} size="xl" c="blue">R$ 178.250</Text>
                          </Paper>
                          <Paper withBorder p="md" radius="md">
                            <Text size="sm" c="dimmed">Rentabilidade</Text>
                            <Text fw={700} size="xl" c="green">+27.3%</Text>
                          </Paper>
                          <Paper withBorder p="md" radius="md">
                            <Text size="sm" c="dimmed">Risco</Text>
                            <Text fw={700} size="xl" c="orange">Moderado</Text>
                          </Paper>
                        </SimpleGrid>
                      </Tabs.Panel>

                      <Tabs.Panel value="portfolio" pt="lg">
                        <Stack gap="sm">
                          {assetAllocation.map((asset) => (
                            <Group key={asset.name} justify="space-between">
                              <Group>
                                <Box w={12} h={12} bg={asset.color} style={{ borderRadius: 2 }} />
                                <Text fw={500}>{asset.name}</Text>
                              </Group>
                              <Group gap="xs">
                                <Text fw={600}>{formatCurrency(asset.value)}</Text>
                                <Badge variant="light">{asset.percentage.toFixed(1)}%</Badge>
                              </Group>
                            </Group>
                          ))}
                        </Stack>
                      </Tabs.Panel>

                      <Tabs.Panel value="performance" pt="lg">
                        <Text>Gráficos de performance apareceriam aqui</Text>
                      </Tabs.Panel>

                      <Tabs.Panel value="risk" pt="lg">
                        <Text>Análises de risco detalhadas apareceriam aqui</Text>
                      </Tabs.Panel>
                    </Tabs>
                  </Card>
                  
                  {/* Breadcrumbs e Pagination */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Title order={3} mb="lg">Navegação de Páginas</Title>
                    
                    <Stack gap="lg">
                      <div>
                        <Text size="sm" fw={500} mb="sm">Breadcrumbs:</Text>
                        <Breadcrumbs>
                          <Anchor href="#" size="sm">Dashboard</Anchor>
                          <Anchor href="#" size="sm">Investimentos</Anchor>
                          <Anchor href="#" size="sm">Ações Brasileiras</Anchor>
                          <Text size="sm">ITUB4</Text>
                        </Breadcrumbs>
                      </div>
                      
                      <Divider />
                      
                      <div>
                        <Group justify="space-between" mb="sm">
                          <Text size="sm" fw={500}>Paginação:</Text>
                          <Text size="xs" c="dimmed">1-10 de 150 transações</Text>
                        </Group>
                        <Pagination total={15} boundaries={2} siblings={2} />
                      </div>
                    </Stack>
                  </Card>
                  
                  {/* Timeline de Atividades */}
                  <Card withBorder radius="lg" p="xl" shadow="sm">
                    <Title order={3} mb="lg">Linha do Tempo - Atividades Recentes</Title>
                    
                    <Timeline active={2} bulletSize={24} lineWidth={2}>
                      <Timeline.Item
                        bullet={<IconCoins size={12} />}
                        title="Nova compra executada"
                        color="green"
                      >
                        <Text c="dimmed" size="sm">
                          Compra de 100 ações ITUB4 por R$ 32,50 cada
                        </Text>
                        <Text size="xs" mt={4} c="dimmed">2 horas atrás</Text>
                      </Timeline.Item>

                      <Timeline.Item
                        bullet={<IconTrendingUp size={12} />}
                        title="Meta de rentabilidade atingida"
                        color="blue"
                      >
                        <Text c="dimmed" size="sm">
                          Seu portfólio atingiu a meta de 25% de rentabilidade
                        </Text>
                        <Text size="xs" mt={4} c="dimmed">1 dia atrás</Text>
                      </Timeline.Item>

                      <Timeline.Item
                        title="Rebalanceamento automático"
                        bullet={<IconSettings size={12} />}
                        color="yellow"
                      >
                        <Text c="dimmed" size="sm">
                          Portfolio rebalanceado automaticamente conforme estratégia
                        </Text>
                        <Text size="xs" mt={4} c="dimmed">3 dias atrás</Text>
                      </Timeline.Item>

                      <Timeline.Item
                        title="Relatório mensal gerado"
                        bullet={<IconFileAnalytics size={12} />}
                      >
                        <Text c="dimmed" size="sm">
                          Relatório de performance de Janeiro disponível
                        </Text>
                        <Text size="xs" mt={4} c="dimmed">1 semana atrás</Text>
                      </Timeline.Item>
                    </Timeline>
                  </Card>
                </>
              )}
            </Stack>
          </Container>
        </AppShell.Main>
      </AppShell>
      
      {/* Modais e Overlays */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="Confirmar Nova Operação"
        centered
        size="md"
      >
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size="1rem" />} color="blue">
            Você está prestes a executar uma ordem de investimento
          </Alert>
          
          <Paper withBorder p="md" radius="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Ativo:</Text>
                <Text fw={500}>ITUB4</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Operação:</Text>
                <Text fw={500} c="green">Compra</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Quantidade:</Text>
                <Text fw={500}>100 ações</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Valor Total:</Text>
                <Text fw={500}>R$ 3.250,00</Text>
              </Grid.Col>
            </Grid>
          </Paper>
          
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              color="green"
              onClick={() => {
                closeModal();
                setNotificationVisible(true);
              }}
            >
              Confirmar Operação
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        title="Menu de Navegação Rápida"
        position="right"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
            Principais Funcionalidades
          </Text>
          
          <NavLink
            label="Dashboard Principal"
            description="Visão geral dos investimentos"
            leftSection={<IconDashboard size="1rem" />}
            rightSection={<Badge size="sm">Novo</Badge>}
          />
          
          <NavLink
            label="Gerenciar Portfólio"
            description="Adicionar ou remover ativos"
            leftSection={<IconWallet size="1rem" />}
          />
          
          <NavLink
            label="Análises e Relatórios"
            description="Performance detalhada"
            leftSection={<IconReportAnalytics size="1rem" />}
          />
          
          <NavLink
            label="Configurações"
            description="Preferências do sistema"
            leftSection={<IconSettings size="1rem" />}
          />
          
          <Divider my="md" />
          
          <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
            Ações Rápidas
          </Text>
          
          <Button
            variant="light"
            fullWidth
            leftSection={<IconPlus size="1rem" />}
            justify="flex-start"
          >
            Nova Operação
          </Button>
          
          <Button
            variant="light"
            fullWidth
            leftSection={<IconTrendingUp size="1rem" />}
            justify="flex-start"
          >
            Ver Performance
          </Button>
          
          <Button
            variant="light"
            fullWidth
            leftSection={<IconBell size="1rem" />}
            justify="flex-start"
          >
            Configurar Alertas
          </Button>
        </Stack>
      </Drawer>

      {/* Floating Action Button */}
      <Affix position={{ bottom: 20, right: 20 }}>
        <Transition transition="slide-up" mounted={true}>
          {(transitionStyles) => (
            <ActionIcon
              size={60}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              style={transitionStyles}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <IconArrowUp size="1.5rem" />
            </ActionIcon>
          )}
        </Transition>
      </Affix>
    </>
  );
}