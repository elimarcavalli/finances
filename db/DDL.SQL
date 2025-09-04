-- --------------------------------------------------------
-- Servidor:                     127.0.0.1
-- Versão do servidor:           8.0.30 - MySQL Community Server - GPL
-- OS do Servidor:               Win64
-- HeidiSQL Versão:              12.1.0.6537
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Copiando estrutura para tabela finances.accounts
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `institution_id` int DEFAULT NULL COMMENT 'Chave estrangeira para a tabela de instituições.',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('CONTA_CORRENTE','POUPANCA','CORRETORA_NACIONAL','CORRETORA_CRIPTO','CARTEIRA_CRIPTO','CARTAO_CREDITO','DINHEIRO_VIVO') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credit_limit` decimal(20,2) DEFAULT '0.00',
  `invoice_due_day` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `public_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `balance` decimal(20,2) DEFAULT NULL,
  `icon_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `fk_account_institution` (`institution_id`),
  CONSTRAINT `accounts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_account_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=112 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.assets
CREATE TABLE IF NOT EXISTS `assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `symbol` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `asset_class` enum('CRIPTO','ACAO_BR','ACAO_US','PREVIDENCIA','FUNDO','FII','COE','RENDA_FIXA','TESOURO','COMMODITIES','OUTROS','PATRIMONIO_FISICO') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `price_api_identifier` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contract_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `decimals` int DEFAULT '18',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_price_usdt` decimal(36,18) DEFAULT NULL,
  `last_price_brl` decimal(36,18) DEFAULT NULL,
  `last_price_updated_at` datetime DEFAULT NULL,
  `icon_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `av_open` decimal(20,8) DEFAULT NULL COMMENT 'Alpha Vantage - Preço de abertura',
  `av_high` decimal(20,8) DEFAULT NULL COMMENT 'Alpha Vantage - Preço mais alto do dia',
  `av_low` decimal(20,8) DEFAULT NULL COMMENT 'Alpha Vantage - Preço mais baixo do dia',
  `av_volume` bigint DEFAULT NULL COMMENT 'Alpha Vantage - Volume negociado',
  `av_latest_trading_day` date DEFAULT NULL COMMENT 'Alpha Vantage - Último dia de negociação',
  `av_previous_close` decimal(20,8) DEFAULT NULL COMMENT 'Alpha Vantage - Fechamento anterior',
  `av_change` decimal(20,8) DEFAULT NULL COMMENT 'Alpha Vantage - Variação absoluta',
  `av_change_percent` decimal(20,8) DEFAULT NULL COMMENT 'Alpha Vantage - Variação percentual',
  PRIMARY KEY (`id`),
  UNIQUE KEY `symbol` (`symbol`),
  KEY `idx_assets_av_trading_day` (`av_latest_trading_day`)
) ENGINE=InnoDB AUTO_INCREMENT=118 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.asset_movements
CREATE TABLE IF NOT EXISTS `asset_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `account_id` int NOT NULL,
  `asset_id` int NOT NULL,
  `movement_type` enum('COMPRA','VENDA','TRANSFERENCIA_ENTRADA','TRANSFERENCIA_SAIDA','SINCRONIZACAO','SWAP_IN','SWAP_OUT') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `movement_date` datetime NOT NULL,
  `quantity` decimal(36,18) NOT NULL,
  `price_per_unit` decimal(36,18) DEFAULT NULL,
  `fee` decimal(36,18) DEFAULT '0.000000000000000000',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tx_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `from_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `to_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `block_number` bigint DEFAULT NULL,
  `gas_fee` decimal(36,18) DEFAULT NULL,
  `linked_movement_id` int DEFAULT NULL COMMENT 'ID do movimento vinculado (usado para SWAP - vincula SWAP_IN com SWAP_OUT)',
  `cost_basis_brl` decimal(36,18) DEFAULT NULL COMMENT 'Custo de aquisição em BRL no momento da transação - fonte da verdade para cálculos de P&L',
  PRIMARY KEY (`id`),
  UNIQUE KEY `tx_hash` (`tx_hash`),
  KEY `user_id` (`user_id`),
  KEY `account_id` (`account_id`),
  KEY `asset_id` (`asset_id`),
  KEY `idx_linked_movement` (`linked_movement_id`),
  KEY `idx_movement_type` (`movement_type`),
  KEY `idx_portfolio_cost_basis` (`user_id`,`asset_id`,`movement_type`,`cost_basis_brl`),
  CONSTRAINT `asset_movements_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_movements_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_movements_ibfk_3` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_linked_movement` FOREIGN KEY (`linked_movement_id`) REFERENCES `asset_movements` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=145 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.backtests
CREATE TABLE IF NOT EXISTS `backtests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `strategy_id` int DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `initial_balance_usdt` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `status` enum('pending','running','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `strategy_id` (`strategy_id`),
  CONSTRAINT `backtests_ibfk_1` FOREIGN KEY (`strategy_id`) REFERENCES `strategies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.backtest_results
CREATE TABLE IF NOT EXISTS `backtest_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `backtest_id` int DEFAULT NULL,
  `win_rate_percent` decimal(5,2) DEFAULT NULL,
  `risk_reward_ratio` decimal(10,2) DEFAULT NULL,
  `total_profit_usdt` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `net_pnl_percent` decimal(10,2) DEFAULT NULL,
  `results_summary` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `backtest_id` (`backtest_id`),
  CONSTRAINT `backtest_results_ibfk_1` FOREIGN KEY (`backtest_id`) REFERENCES `backtests` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.daily_financial_snapshots
CREATE TABLE IF NOT EXISTS `daily_financial_snapshots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `snapshot_date` date NOT NULL,
  `total_net_worth_brl` decimal(20,2) NOT NULL COMMENT 'Patrimônio líquido consolidado (Ativos - Passivos)',
  `total_assets_brl` decimal(20,2) NOT NULL COMMENT 'Valor total de todos os ativos',
  `total_liabilities_brl` decimal(20,2) NOT NULL COMMENT 'Valor total de todos os passivos (dívidas)',
  `liquid_assets_brl` decimal(20,2) NOT NULL COMMENT 'Valor de ativos líquidos (caixa, conta corrente, etc)',
  `invested_assets_brl` decimal(20,2) NOT NULL COMMENT 'Valor de ativos investidos (ações, cripto, fundos, etc)',
  `crypto_portfolio_value_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Valor consolidado do portfólio de criptoativos',
  `stock_portfolio_value_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Valor consolidado do portfólio de ações (BR + US)',
  `fixed_income_value_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Valor consolidado em Renda Fixa e Tesouro',
  `real_estate_funds_value_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Valor consolidado em Fundos Imobiliários (FIIs)',
  `other_investments_value_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Valor consolidado em outras classes de investimentos',
  `income_last_30_days_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Soma de receitas nos últimos 30 dias até a data do snapshot',
  `expenses_last_30_days_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Soma de despesas nos últimos 30 dias até a data do snapshot',
  `investments_last_30_days_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Soma de aportes (compras de ativos) nos últimos 30 dias',
  `disinvestments_last_30_days_brl` decimal(20,2) DEFAULT '0.00' COMMENT 'Soma de resgates (vendas de ativos) nos últimos 30 dias',
  `asset_class_distribution_json` json DEFAULT NULL COMMENT 'Estrutura JSON com a quebra de valor por classe de ativo. Ex: {"CRIPTO": 50000, "ACAO_BR": 120000}',
  `expense_category_distribution_json` json DEFAULT NULL COMMENT 'Estrutura JSON com a quebra de despesas por categoria nos últimos 30 dias. Ex: {"Moradia": 2500, "Alimentação": 1200}',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `total_physical_assets_brl` decimal(20,2) NOT NULL DEFAULT '0.00' COMMENT 'Valor consolidado do patrimônio físico \r\n  (bens)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_snapshot_date` (`user_id`,`snapshot_date`),
  CONSTRAINT `fk_snapshot_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Armazena snapshots diários detalhados da situação financeira do usuário para análises históricas.';

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.financial_obligations
CREATE TABLE IF NOT EXISTS `financial_obligations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(20,2) NOT NULL,
  `due_date` date NOT NULL,
  `type` enum('PAYABLE','RECEIVABLE','TRANSFERENCIA') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('PENDING','PAID','OVERDUE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'PENDING',
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `linked_transaction_id` int DEFAULT NULL,
  `recurring_rule_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `linked_transaction_id` (`linked_transaction_id`),
  KEY `fk_recurring_rule` (`recurring_rule_id`),
  CONSTRAINT `financial_obligations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `financial_obligations_ibfk_2` FOREIGN KEY (`linked_transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_recurring_rule` FOREIGN KEY (`recurring_rule_id`) REFERENCES `recurring_rules` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.historical_price_data
CREATE TABLE IF NOT EXISTS `historical_price_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_symbol` varchar(20) NOT NULL COMMENT 'Símbolo do ativo (ex: BTCUSDT)',
  `timeframe` varchar(10) NOT NULL COMMENT 'Timeframe (ex: 1d, 4h, 1h)',
  `date` date NOT NULL COMMENT 'Data do ponto de dados',
  `open_price` decimal(20,8) NOT NULL,
  `high_price` decimal(20,8) NOT NULL,
  `low_price` decimal(20,8) NOT NULL,
  `close_price` decimal(20,8) NOT NULL,
  `volume` decimal(20,8) NOT NULL DEFAULT '0.00000000',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_price_point` (`asset_symbol`,`timeframe`,`date`),
  KEY `idx_symbol_timeframe` (`asset_symbol`,`timeframe`),
  KEY `idx_date_range` (`date`),
  KEY `idx_symbol_timeframe_date` (`asset_symbol`,`timeframe`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Cache de dados históricos de preços para backtesting';

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.institutions
CREATE TABLE IF NOT EXISTS `institutions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nome oficial completo da instituição.',
  `short_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nome curto ou fantasia da instituição.',
  `type` enum('BANK','BROKERAGE','CRYPTO_EXCHANGE','DIGITAL_WALLET','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tipo da instituição para categorização.',
  `country_code` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BRA' COMMENT 'Código do país da instituição (ISO 3166-1 alpha-3).',
  `ispb_code` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Identificador do Sistema de Pagamentos Brasileiro (código único de 8 dígitos).',
  `compe_code` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Código do Sistema de Compensação de Cheques e Outros Papéis (3 dígitos).',
  `website_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL do site oficial da instituição.',
  `logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL para a logomarca da instituição.',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Status da instituição. 1 para ativa, 0 para inativa.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_institution_name_country` (`name`,`country_code`),
  UNIQUE KEY `ispb_code` (`ispb_code`),
  KEY `idx_institution_type` (`type`),
  KEY `idx_institution_country` (`country_code`)
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cadastro centralizado de instituições financeiras (bancos, corretoras, etc.).';

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.net_worth_snapshots_old
CREATE TABLE IF NOT EXISTS `net_worth_snapshots_old` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `snapshot_date` date NOT NULL,
  `total_net_worth` decimal(20,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`snapshot_date`),
  CONSTRAINT `net_worth_snapshots_old_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.optimization_job_results
CREATE TABLE IF NOT EXISTS `optimization_job_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `parameters` json NOT NULL,
  `total_trades` int DEFAULT NULL,
  `win_rate_percent` decimal(5,2) DEFAULT NULL,
  `net_profit_percent` decimal(10,2) DEFAULT NULL,
  `max_drawdown_percent` decimal(5,2) DEFAULT NULL,
  `sharpe_ratio` decimal(10,4) DEFAULT NULL,
  `fitness_score` decimal(20,10) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `job_id` (`job_id`),
  CONSTRAINT `optimization_job_results_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `strategy_optimization_jobs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2764 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.physical_assets
CREATE TABLE IF NOT EXISTS `physical_assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `asset_id` int NOT NULL COMMENT 'FK para assets.id, aponta para a CATEGORIA do bem',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ex: Honda Civic EXL 2023',
  `acquisition_date` date NOT NULL COMMENT 'Data da compra',
  `acquisition_cost` decimal(20,2) NOT NULL COMMENT 'Valor pago na compra',
  `current_value` decimal(20,2) NOT NULL COMMENT 'Valor de mercado atual, atualizado manualmente',
  `last_valuation_date` date NOT NULL COMMENT 'Data da última avaliação do valor de mercado',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('ATIVO','VENDIDO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ATIVO',
  `acquisition_transaction_id` int DEFAULT NULL,
  `liquidation_transaction_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acquisition_transaction_id` (`acquisition_transaction_id`),
  UNIQUE KEY `liquidation_transaction_id` (`liquidation_transaction_id`),
  KEY `user_id` (`user_id`),
  KEY `asset_id` (`asset_id`),
  KEY `idx_physical_assets_status` (`status`),
  KEY `idx_physical_assets_acquisition_tx` (`acquisition_transaction_id`),
  KEY `idx_physical_assets_liquidation_tx` (`liquidation_transaction_id`),
  CONSTRAINT `physical_assets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `physical_assets_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `physical_assets_ibfk_3` FOREIGN KEY (`acquisition_transaction_id`) REFERENCES `transactions` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `physical_assets_ibfk_4` FOREIGN KEY (`liquidation_transaction_id`) REFERENCES `transactions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.recurring_rules
CREATE TABLE IF NOT EXISTS `recurring_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(20,2) NOT NULL,
  `type` enum('PAYABLE','RECEIVABLE','TRANSFERENCIA') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `frequency` enum('DAILY','WEEKLY','MONTHLY','YEARLY') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `interval_value` int NOT NULL DEFAULT '1',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `from_account_id` int DEFAULT NULL,
  `to_account_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `fk_recurring_rule_from_account` (`from_account_id`),
  KEY `fk_recurring_rule_to_account` (`to_account_id`),
  CONSTRAINT `fk_recurring_rule_from_account` FOREIGN KEY (`from_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_recurring_rule_to_account` FOREIGN KEY (`to_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `recurring_rules_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.strategies
CREATE TABLE IF NOT EXISTS `strategies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `parameters` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `strategies_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.strategy_optimization_jobs
CREATE TABLE IF NOT EXISTS `strategy_optimization_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `base_strategy_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_id` int NOT NULL,
  `timeframe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `parameter_ranges` json NOT NULL,
  `status` enum('PENDING','RUNNING','COMPLETED','FAILED') COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING',
  `progress` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT 'Progresso da otimização em porcentagem (0.00 - 100.00)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `strategy_optimization_jobs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `strategy_optimization_jobs_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.strategy_vaults
CREATE TABLE IF NOT EXISTS `strategy_vaults` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_wallet_id` int NOT NULL,
  `contract_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `strategy_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `contract_address` (`contract_address`),
  KEY `user_wallet_id` (`user_wallet_id`),
  CONSTRAINT `strategy_vaults_ibfk_1` FOREIGN KEY (`user_wallet_id`) REFERENCES `user_wallets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.transactions
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(20,2) NOT NULL,
  `transaction_date` date NOT NULL,
  `type` enum('RECEITA','DESPESA','TRANSFERENCIA') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `from_account_id` int DEFAULT NULL,
  `to_account_id` int DEFAULT NULL,
  `status` enum('EFETIVADO','PENDENTE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `from_account_id` (`from_account_id`),
  KEY `to_account_id` (`to_account_id`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`from_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transactions_ibfk_3` FOREIGN KEY (`to_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=234 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  `last_logout` timestamp NULL DEFAULT NULL,
  `user_level` int NOT NULL DEFAULT '0' COMMENT 'Níveis de acesso: 0 = convidado, 1 = usuário, 5 = moderador, 10 = editor, 15 = gerente, 23 = administrador',
  `google_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `avatar_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para tabela finances.user_wallets
CREATE TABLE IF NOT EXISTS `user_wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `wallet_id` int NOT NULL,
  `wallet_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_wallet_unique` (`user_id`,`wallet_id`),
  KEY `wallet_id` (`wallet_id`),
  CONSTRAINT `user_wallets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_wallets_ibfk_2` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para view finances.vw_portfolio_summary
-- Criando tabela temporária para evitar erros de dependência de VIEW
CREATE TABLE `vw_portfolio_summary` (
	`user_id` INT(10) NOT NULL,
	`account_id` INT(10) NOT NULL,
	`asset_id` INT(10) NOT NULL,
	`symbol` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`asset_name` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_general_ci',
	`asset_class` ENUM('CRIPTO','ACAO_BR','ACAO_US','PREVIDENCIA','FUNDO','FII','COE','RENDA_FIXA','TESOURO','COMMODITIES','OUTROS') NOT NULL COLLATE 'utf8mb4_general_ci',
	`price_api_identifier` VARCHAR(255) NULL COLLATE 'utf8mb4_general_ci',
	`last_price_usdt` DECIMAL(36,18) NULL,
	`last_price_brl` DECIMAL(36,18) NULL,
	`last_price_updated_at` DATETIME NULL,
	`total_bought` DECIMAL(58,18) NULL,
	`total_sold` DECIMAL(58,18) NULL,
	`total_invested` DECIMAL(65,30) NULL,
	`weighted_quantity` DECIMAL(58,18) NULL,
	`acquisition_date` DATETIME NULL
) ENGINE=MyISAM;

-- Copiando estrutura para tabela finances.wallets
CREATE TABLE IF NOT EXISTS `wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `public_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `private_key_encrypted` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_address` (`public_address`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Exportação de dados foi desmarcado.

-- Copiando estrutura para view finances.vw_portfolio_summary
-- Removendo tabela temporária e criando a estrutura VIEW final
DROP TABLE IF EXISTS `vw_portfolio_summary`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `vw_portfolio_summary` AS select `am`.`user_id` AS `user_id`,`am`.`account_id` AS `account_id`,`am`.`asset_id` AS `asset_id`,`a`.`symbol` AS `symbol`,`a`.`name` AS `asset_name`,`a`.`asset_class` AS `asset_class`,`a`.`price_api_identifier` AS `price_api_identifier`,`a`.`last_price_usdt` AS `last_price_usdt`,`a`.`last_price_brl` AS `last_price_brl`,`a`.`last_price_updated_at` AS `last_price_updated_at`,sum((case when (`am`.`movement_type` in ('COMPRA','TRANSFERENCIA_ENTRADA','SINCRONIZACAO')) then `am`.`quantity` else 0 end)) AS `total_bought`,sum((case when (`am`.`movement_type` in ('VENDA','TRANSFERENCIA_SAIDA')) then `am`.`quantity` else 0 end)) AS `total_sold`,sum((case when ((`am`.`movement_type` in ('COMPRA','TRANSFERENCIA_ENTRADA','SINCRONIZACAO')) and (`am`.`price_per_unit` is not null)) then (`am`.`quantity` * `am`.`price_per_unit`) else 0 end)) AS `total_invested`,sum((case when ((`am`.`movement_type` in ('COMPRA','TRANSFERENCIA_ENTRADA','SINCRONIZACAO')) and (`am`.`price_per_unit` is not null)) then `am`.`quantity` else 0 end)) AS `weighted_quantity`,max(`am`.`movement_date`) AS `acquisition_date` from (`if0_37442735_edbdb`.`asset_movements` `am` join `if0_37442735_edbdb`.`assets` `a` on((`am`.`asset_id` = `a`.`id`))) group by `am`.`asset_id`,`a`.`symbol`,`a`.`name`,`a`.`asset_class`,`a`.`price_api_identifier`,`a`.`last_price_usdt`,`a`.`last_price_brl`,`a`.`last_price_updated_at`,`am`.`user_id`,`am`.`account_id` having ((`total_bought` - `total_sold`) > 0);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
