import React, { useState, useEffect } from 'react';
import { 
  Title, 
  Container, 
  Tabs, 
  Select, 
  Button, 
  Group, 
  Paper, 
  Table,
  Text,
  Loader,
  Alert,
  Stack,
  Grid,
  Card,
  Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { 
  IconReportAnalytics, 
  IconChartPie, 
  IconChartBar, 
  IconReceipt,
  IconAlertCircle,
  IconDownload,
  IconCalendar
} from '@tabler/icons-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api';

// Cores para os gráficos
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'];

export function ReportsPage() {
  // Estados principais
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [activeTab, setActiveTab] = useState('account-statement');
  const [error, setError] = useState('');

  // Estados para Extrato por Conta
  const [selectedAccount, setSelectedAccount] = useState('');
  const [statementPeriod, setStatementPeriod] = useState([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Primeiro dia do mês atual
    new Date() // Hoje
  ]);
  const [accountStatement, setAccountStatement] = useState(null);

  // Estados para Análise de Despesas
  const [expensesPeriod, setExpensesPeriod] = useState([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    new Date()
  ]);
  const [expensesAnalysis, setExpensesAnalysis] = useState(null);

  // Estados para Fluxo de Caixa Mensal
  const [cashFlowPeriod, setCashFlowPeriod] = useState([
    new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1), // Últimos 12 meses
    new Date()
  ]);
  const [cashFlowData, setCashFlowData] = useState(null);

  // Carregar contas do usuário
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await api.get('/reports/accounts-summary');
        setAccounts(response.data.accounts || []);
      } catch (error) {
        console.error('Error loading accounts:', error);
        setError('Erro ao carregar contas');
      }
    };

    loadAccounts();
  }, []);

  // Gerar Extrato por Conta
  const generateAccountStatement = async () => {
    if (!selectedAccount || !statementPeriod[0] || !statementPeriod[1]) {
      notifications.show({
        title: 'Dados incompletos',
        message: 'Selecione uma conta e o período',
        color: 'orange'
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const startDate = statementPeriod[0].toISOString().split('T')[0];
      const endDate = statementPeriod[1].toISOString().split('T')[0];

      const response = await api.get(`/reports/account-statement`, {
        params: {
          account_id: selectedAccount,
          start_date: startDate,
          end_date: endDate
        }
      });

      setAccountStatement(response.data);
    } catch (error) {
      console.error('Error generating account statement:', error);
      setError('Erro ao gerar extrato da conta');
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao gerar extrato',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Gerar Análise de Despesas
  const generateExpensesAnalysis = async () => {
    if (!expensesPeriod[0] || !expensesPeriod[1]) {
      notifications.show({
        title: 'Dados incompletos',
        message: 'Selecione o período para análise',
        color: 'orange'
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const startDate = expensesPeriod[0].toISOString().split('T')[0];
      const endDate = expensesPeriod[1].toISOString().split('T')[0];

      const response = await api.get(`/reports/expense-by-category`, {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });

      setExpensesAnalysis(response.data);
    } catch (error) {
      console.error('Error generating expenses analysis:', error);
      setError('Erro ao gerar análise de despesas');
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao analisar despesas',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Gerar Fluxo de Caixa Mensal
  const generateCashFlow = async () => {
    if (!cashFlowPeriod[0] || !cashFlowPeriod[1]) {
      notifications.show({
        title: 'Dados incompletos',
        message: 'Selecione o período para análise',
        color: 'orange'
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const startDate = cashFlowPeriod[0].toISOString().split('T')[0];
      const endDate = cashFlowPeriod[1].toISOString().split('T')[0];

      const response = await api.get(`/reports/monthly-cash-flow`, {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });

      setCashFlowData(response.data);
    } catch (error) {
      console.error('Error generating cash flow:', error);
      setError('Erro ao gerar fluxo de caixa');
      notifications.show({
        title: 'Erro',
        message: error.response?.data?.detail || 'Erro ao gerar fluxo de caixa',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Formatador de valor monetário
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>Relatórios Financeiros</Title>
        <IconReportAnalytics size={32} />
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="account-statement" leftSection={<IconReceipt size={16} />}>
            Extrato por Conta
          </Tabs.Tab>
          <Tabs.Tab value="expense-analysis" leftSection={<IconChartPie size={16} />}>
            Análise de Despesas
          </Tabs.Tab>
          <Tabs.Tab value="cash-flow" leftSection={<IconChartBar size={16} />}>
            Fluxo de Caixa Mensal
          </Tabs.Tab>
        </Tabs.List>

        {/* Aba: Extrato por Conta */}
        <Tabs.Panel value="account-statement" pt="md">
          <Paper shadow="xs" p="md" mb="md">
            <Title order={4} mb="md">Extrato Detalhado por Conta</Title>
            
            <Grid>
              <Grid.Col span={4}>
                <Select
                  label="Selecione a Conta"
                  placeholder="Escolha uma conta"
                  data={accounts.map(account => ({
                    value: account.id.toString(),
                    label: `${account.name} (${account.type})`
                  }))}
                  value={selectedAccount}
                  onChange={setSelectedAccount}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <DatePickerInput
                  type="range"
                  label="Período"
                  placeholder="Selecione o período"
                  value={statementPeriod}
                  onChange={setStatementPeriod}
                  leftSection={<IconCalendar size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Button 
                  onClick={generateAccountStatement}
                  loading={loading}
                  leftSection={<IconDownload size={16} />}
                  mt={25}
                  fullWidth
                >
                  Gerar Extrato
                </Button>
              </Grid.Col>
            </Grid>

            {accountStatement && (
              <Stack mt="lg">
                {/* Resumo do Extrato */}
                <Grid>
                  <Grid.Col span={4}>
                    <Card withBorder>
                      <Text size="sm" c="dimmed">Saldo Inicial</Text>
                      <Text size="lg" fw={700}>
                        {formatCurrency(accountStatement.initial_balance)}
                      </Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder>
                      <Text size="sm" c="dimmed">Saldo Final</Text>
                      <Text size="lg" fw={700}>
                        {formatCurrency(accountStatement.final_balance)}
                      </Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder>
                      <Text size="sm" c="dimmed">Total de Transações</Text>
                      <Text size="lg" fw={700}>
                        {accountStatement.transactions.length}
                      </Text>
                    </Card>
                  </Grid.Col>
                </Grid>

                {/* Tabela de Transações */}
                <Paper withBorder>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Data</Table.Th>
                        <Table.Th>Descrição</Table.Th>
                        <Table.Th>Valor</Table.Th>
                        <Table.Th>Tipo</Table.Th>
                        <Table.Th>Saldo</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {accountStatement.transactions.map((transaction, index) => (
                        <Table.Tr key={transaction.id}>
                          <Table.Td>{new Date(transaction.date).toLocaleDateString('pt-BR')}</Table.Td>
                          <Table.Td>{transaction.description}</Table.Td>
                          <Table.Td>
                            <Text 
                              color={transaction.impact_amount > 0 ? 'green' : 'red'}
                              fw={500}
                            >
                              {formatCurrency(transaction.impact_amount)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={transaction.movement_type === 'CREDIT' ? 'green' : 'red'}>
                              {transaction.movement_type === 'CREDIT' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={500}>{formatCurrency(transaction.running_balance)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Aba: Análise de Despesas */}
        <Tabs.Panel value="expense-analysis" pt="md">
          <Paper shadow="xs" p="md" mb="md">
            <Title order={4} mb="md">Análise de Despesas por Categoria</Title>
            
            <Grid>
              <Grid.Col span={6}>
                <DatePickerInput
                  type="range"
                  label="Período"
                  placeholder="Selecione o período"
                  value={expensesPeriod}
                  onChange={setExpensesPeriod}
                  leftSection={<IconCalendar size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Button 
                  onClick={generateExpensesAnalysis}
                  loading={loading}
                  leftSection={<IconChartPie size={16} />}
                  mt={25}
                  fullWidth
                >
                  Analisar Despesas
                </Button>
              </Grid.Col>
            </Grid>

            {expensesAnalysis && (
              <Stack mt="lg">
                {/* Resumo Geral */}
                <Card withBorder mb="md">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" c="dimmed">Total de Despesas</Text>
                      <Text size="xl" fw={700} color="red">
                        {formatCurrency(expensesAnalysis.total_expenses)}
                      </Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">Categorias</Text>
                      <Text size="xl" fw={700}>
                        {expensesAnalysis.categories.length}
                      </Text>
                    </div>
                  </Group>
                </Card>

                {/* Gráfico de Pizza */}
                {expensesAnalysis.categories.length > 0 && (
                  <Paper withBorder p="md" mb="md">
                    <Title order={5} mb="md">Distribuição por Categoria</Title>
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={expensesAnalysis.categories}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="total_amount"
                        >
                          {expensesAnalysis.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Paper>
                )}

                {/* Tabela Detalhada */}
                <Paper withBorder>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Categoria</Table.Th>
                        <Table.Th>Total</Table.Th>
                        <Table.Th>Transações</Table.Th>
                        <Table.Th>Média</Table.Th>
                        <Table.Th>%</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {expensesAnalysis.categories.map((category, index) => (
                        <Table.Tr key={category.category}>
                          <Table.Td>
                            <Group>
                              <div 
                                style={{ 
                                  width: 12, 
                                  height: 12, 
                                  backgroundColor: COLORS[index % COLORS.length],
                                  borderRadius: '50%'
                                }}
                              />
                              <Text fw={500}>{category.category}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={500} color="red">
                              {formatCurrency(category.total_amount)}
                            </Text>
                          </Table.Td>
                          <Table.Td>{category.transaction_count}</Table.Td>
                          <Table.Td>{formatCurrency(category.average_amount)}</Table.Td>
                          <Table.Td>
                            <Badge color="blue">
                              {category.percentage.toFixed(1)}%
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Aba: Fluxo de Caixa Mensal */}
        <Tabs.Panel value="cash-flow" pt="md">
          <Paper shadow="xs" p="md" mb="md">
            <Title order={4} mb="md">Fluxo de Caixa Mensal</Title>
            
            <Grid>
              <Grid.Col span={6}>
                <DatePickerInput
                  type="range"
                  label="Período"
                  placeholder="Selecione o período"
                  value={cashFlowPeriod}
                  onChange={setCashFlowPeriod}
                  leftSection={<IconCalendar size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Button 
                  onClick={generateCashFlow}
                  loading={loading}
                  leftSection={<IconChartBar size={16} />}
                  mt={25}
                  fullWidth
                >
                  Gerar Fluxo de Caixa
                </Button>
              </Grid.Col>
            </Grid>

            {cashFlowData && (
              <Stack mt="lg">
                {/* Resumo Geral */}
                <Grid>
                  <Grid.Col span={3}>
                    <Card withBorder>
                      <Text size="sm" c="dimmed">Total Receitas</Text>
                      <Text size="lg" fw={700} color="green">
                        {formatCurrency(cashFlowData.summary.total_receitas)}
                      </Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Card withBorder>
                      <Text size="sm" c="dimmed">Total Despesas</Text>
                      <Text size="lg" fw={700} color="red">
                        {formatCurrency(cashFlowData.summary.total_despesas)}
                      </Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Card withBorder>
                      <Text size="sm" c="dimmed">Saldo Líquido</Text>
                      <Text 
                        size="lg" 
                        fw={700} 
                        color={cashFlowData.summary.net_cash_flow >= 0 ? 'green' : 'red'}
                      >
                        {formatCurrency(cashFlowData.summary.net_cash_flow)}
                      </Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Card withBorder>
                      <Text size="sm" c="dimmed">Meses</Text>
                      <Text size="lg" fw={700}>
                        {cashFlowData.summary.total_months}
                      </Text>
                    </Card>
                  </Grid.Col>
                </Grid>

                {/* Gráfico de Barras */}
                {cashFlowData.monthly_cash_flow.length > 0 && (
                  <Paper withBorder p="md" mb="md">
                    <Title order={5} mb="md">Evolução Mensal</Title>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={cashFlowData.monthly_cash_flow}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="month_name" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                        <Tooltip 
                          formatter={(value, name) => [formatCurrency(value), name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : 'Saldo Líquido']}
                        />
                        <Legend />
                        <Bar dataKey="receitas" fill="#82ca9d" name="Receitas" />
                        <Bar dataKey="despesas" fill="#ff7c7c" name="Despesas" />
                        <Bar dataKey="saldo_liquido" fill="#8884d8" name="Saldo Líquido" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                )}

                {/* Tabela Mensal */}
                <Paper withBorder>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Mês</Table.Th>
                        <Table.Th>Receitas</Table.Th>
                        <Table.Th>Despesas</Table.Th>
                        <Table.Th>Saldo Líquido</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {cashFlowData.monthly_cash_flow.map((month) => (
                        <Table.Tr key={month.year_month}>
                          <Table.Td>
                            <Text fw={500}>
                              {month.month_name} {month.year}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text color="green" fw={500}>
                              {formatCurrency(month.receitas)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text color="red" fw={500}>
                              {formatCurrency(month.despesas)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text 
                              fw={500}
                              color={month.saldo_liquido >= 0 ? 'green' : 'red'}
                            >
                              {formatCurrency(month.saldo_liquido)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {loading && (
        <Group justify="center" mt="xl">
          <Loader size="lg" />
        </Group>
      )}
    </Container>
  );
}