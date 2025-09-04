import { Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { WalletsPage } from './pages/WalletsPage';
import { VaultsPage } from './pages/VaultsPage';
import { LoginPage } from './pages/LoginPage';
import { ChartsPage } from './pages/ChartsPage';
import { StrategiesPage } from './pages/StrategiesPage';
import { BacktestingPage } from './pages/BacktestingPage';
import { AccountsPage } from './pages/AccountsPage';
import { AccountDetailsPage } from './pages/AccountDetailsPage';
import { CryptoAccountDetailsPage } from './pages/CryptoAccountDetailsPage';
import { AssetsPage } from './pages/AssetsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { AccountsReceivablePage } from './pages/AccountsReceivablePage';
import { ObligationsPage } from './pages/ObligationsPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { PatrimonioPage } from './pages/PatrimonioPage';
import { ReportsPage } from './pages/ReportsPage';
import { MantineShowcasePage } from './pages/MantineShowcasePage';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute />}>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          {/* Patrimônio */}
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="patrimonio" element={<PatrimonioPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="contas/:accountId" element={<AccountDetailsPage />} />
          <Route path="contas/cripto/:accountId" element={<CryptoAccountDetailsPage />} />
          <Route path="assets" element={<AssetsPage />} />
          {/* Movimentações */}
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="accounts-receivable" element={<AccountsReceivablePage />} />
          <Route path="obligations" element={<ObligationsPage />} />
          {/* Relatórios */}
          <Route path="reports" element={<ReportsPage />} />
          {/* Automações */}
          <Route path="wallets" element={<WalletsPage />} />
          <Route path="vaults" element={<VaultsPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="backtesting" element={<BacktestingPage />} />
          {/* Showcase */}
          <Route path="mantine-showcase" element={<MantineShowcasePage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
