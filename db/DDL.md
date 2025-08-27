# Documentação do Modelo de Banco de Dados: Ecossistema de Gestão Financeira Pessoal

## 1. Visão Geral e Arquitetura

Este banco de dados foi projetado para ser o pilar de um sistema híbrido de gestão de patrimônio, unindo finanças tradicionais (TradFi) e finanças descentralizadas (DeFi). A arquitetura é centrada no usuário (`users`), a partir do qual todas as outras informações são ramificadas.

O modelo é dividido em quatro domínios lógicos principais:

1. **Domínio Central e Usuários**: Gerencia usuários, autenticação e perfis
2. **Domínio de Contabilidade e Finanças Pessoais**: Gerencia contas, transações, obrigações financeiras e snapshots patrimoniais
3. **Domínio de Ativos e Investimentos**: Modela o portfólio de investimentos, ativos e movimentações
4. **Domínio de Automação e Trading**: Estrutura de estratégias, backtests e vaults

---

## 2. Análise Detalhada das Entidades (Tabelas)

### Domínio Central: Usuários

#### Tabela: `users`
**Propósito**: Tabela central do sistema. Armazena informações de identificação, autenticação e perfil de cada usuário.

**Estrutura**:
```sql
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  user_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL DEFAULT NULL,
  last_logout TIMESTAMP NULL DEFAULT NULL,
  user_level INT NOT NULL DEFAULT 0,
  google_id VARCHAR(255) DEFAULT NULL,
  avatar_url VARCHAR(512) DEFAULT NULL,
  PRIMARY KEY (id)
);
```

**Colunas Principais**:
- `id`: (PK) Identificador numérico único
- `user_name`, `email`: Credenciais e informações de contato
- `password_hash`: Senha armazenada de forma segura
- `google_id`: Suporte para login social (OAuth)
- `user_level`: Sistema de permissão (0=convidado, 1=usuário, 5=moderador, 10=editor, 15=gerente, 23=administrador)
- `avatar_url`: URL para imagem de perfil
- `last_login`, `last_logout`: Controle de sessão

---

### Domínio de Contabilidade e Finanças Pessoais

#### Tabela: `institutions`
**Propósito**: Cadastro centralizado de instituições financeiras (bancos, corretoras, exchanges).

**Estrutura**:
```sql
CREATE TABLE institutions (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100) DEFAULT NULL,
  type ENUM('BANK','BROKERAGE','CRYPTO_EXCHANGE','DIGITAL_WALLET','OTHER') NOT NULL,
  country_code VARCHAR(3) NOT NULL DEFAULT 'BRA',
  ispb_code VARCHAR(8) DEFAULT NULL,
  compe_code VARCHAR(3) DEFAULT NULL,
  website_url VARCHAR(500) DEFAULT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_institution_name_country (name, country_code),
  UNIQUE KEY ispb_code (ispb_code)
);
```

**Colunas Principais**:
- `name`: Nome oficial completo da instituição
- `short_name`: Nome fantasia ou abreviado
- `type`: Tipo da instituição (BANK, BROKERAGE, CRYPTO_EXCHANGE, DIGITAL_WALLET, OTHER)
- `country_code`: Código ISO 3166-1 alpha-3 do país
- `ispb_code`: Código ISPB único brasileiro (8 dígitos)
- `compe_code`: Código COMPE (3 dígitos)
- `logo_url`: URL para logomarca da instituição

#### Tabela: `accounts`
**Propósito**: Representa as contas financeiras do usuário (bancárias, cartões, corretoras, carteiras cripto).

**Estrutura**:
```sql
CREATE TABLE accounts (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  institution_id INT DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('CONTA_CORRENTE','POUPANCA','CORRETORA_NACIONAL','CORRETORA_CRIPTO','CARTEIRA_CRIPTO','CARTAO_CREDITO','DINHEIRO_VIVO') NOT NULL,
  institution VARCHAR(255) DEFAULT NULL,
  credit_limit DECIMAL(20,2) DEFAULT 0.00,
  invoice_due_day INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  public_address VARCHAR(255) DEFAULT NULL,
  balance DECIMAL(20,2) DEFAULT NULL,
  icon_url VARCHAR(500) DEFAULT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL ON UPDATE CASCADE
);
```

**Relacionamentos**:
- `user_id` (FK → `users.id`): Conta pertence a um usuário
- `institution_id` (FK → `institutions.id`): Vinculação opcional com instituição cadastrada

**Colunas Principais**:
- `name`: Nome da conta
- `type`: Tipo da conta (CONTA_CORRENTE, CARTAO_CREDITO, CORRETORA_CRIPTO, etc.)
- `institution`: Nome da instituição (campo legado, sendo substituído por institution_id)
- `credit_limit`, `invoice_due_day`: Campos específicos para cartões de crédito
- `public_address`: Endereço público para carteiras cripto
- `balance`: Saldo atual
- `icon_url`: URL para ícone da conta

#### Tabela: `transactions`
**Propósito**: Livro-razão do sistema. Registra transações financeiras (receitas, despesas, transferências).

**Estrutura**:
```sql
CREATE TABLE transactions (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(20,2) NOT NULL,
  transaction_date DATE NOT NULL,
  type ENUM('RECEITA','DESPESA','TRANSFERENCIA') NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  from_account_id INT DEFAULT NULL,
  to_account_id INT DEFAULT NULL,
  status ENUM('EFETIVADO','PENDENTE') NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);
```

**Relacionamentos**:
- `user_id` (FK → `users.id`): Transação pertence a um usuário
- `from_account_id` (FK → `accounts.id`): Conta de origem dos fundos
- `to_account_id` (FK → `accounts.id`): Conta de destino dos fundos

**Lógica de Negócio**:
- `TRANSFERENCIA`: Possui tanto `from_account_id` quanto `to_account_id`
- `DESPESA`: Possui apenas `from_account_id`
- `RECEITA`: Possui apenas `to_account_id`

#### Tabela: `recurring_rules`
**Propósito**: Define regras para criação automática de obrigações financeiras recorrentes.

**Estrutura**:
```sql
CREATE TABLE recurring_rules (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(20,2) NOT NULL,
  type ENUM('PAYABLE','RECEIVABLE') NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  entity_name VARCHAR(255) DEFAULT NULL,
  frequency ENUM('DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL,
  interval_value INT NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Colunas Principais**:
- `frequency`: Frequência da recorrência (DAILY, WEEKLY, MONTHLY, YEARLY)
- `interval_value`: Complementa frequency (ex: MONTHLY + interval_value=2 = a cada 2 meses)
- `start_date`, `end_date`: Período de validade da regra
- `entity_name`: Nome da entidade relacionada à obrigação
- `is_active`: Status ativo/inativo da regra

#### Tabela: `financial_obligations`
**Propósito**: Gerencia contas a pagar e a receber, compromissos financeiros futuros.

**Estrutura**:
```sql
CREATE TABLE financial_obligations (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(20,2) NOT NULL,
  due_date DATE NOT NULL,
  type ENUM('PAYABLE','RECEIVABLE') NOT NULL,
  status ENUM('PENDING','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
  category VARCHAR(100) DEFAULT NULL,
  entity_name VARCHAR(255) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  linked_transaction_id INT DEFAULT NULL,
  recurring_rule_id INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules(id) ON DELETE SET NULL
);
```

**Relacionamentos**:
- `user_id` (FK → `users.id`): Obrigação pertence a um usuário
- `linked_transaction_id` (FK → `transactions.id`): Vincula à transação que liquidou a obrigação
- `recurring_rule_id` (FK → `recurring_rules.id`): Se gerada por regra de recorrência

#### Tabela: `daily_financial_snapshots`
**Propósito**: Armazena snapshots diários detalhados da situação financeira do usuário para análises históricas e dashboards.

**Estrutura**:
```sql
CREATE TABLE daily_financial_snapshots (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  snapshot_date DATE NOT NULL,
  total_net_worth_brl DECIMAL(20,2) NOT NULL,
  total_assets_brl DECIMAL(20,2) NOT NULL,
  total_liabilities_brl DECIMAL(20,2) NOT NULL,
  liquid_assets_brl DECIMAL(20,2) NOT NULL,
  invested_assets_brl DECIMAL(20,2) NOT NULL,
  crypto_portfolio_value_brl DECIMAL(20,2) DEFAULT 0.00,
  stock_portfolio_value_brl DECIMAL(20,2) DEFAULT 0.00,
  fixed_income_value_brl DECIMAL(20,2) DEFAULT 0.00,
  real_estate_funds_value_brl DECIMAL(20,2) DEFAULT 0.00,
  other_investments_value_brl DECIMAL(20,2) DEFAULT 0.00,
  income_last_30_days_brl DECIMAL(20,2) DEFAULT 0.00,
  expenses_last_30_days_brl DECIMAL(20,2) DEFAULT 0.00,
  investments_last_30_days_brl DECIMAL(20,2) DEFAULT 0.00,
  disinvestments_last_30_days_brl DECIMAL(20,2) DEFAULT 0.00,
  asset_class_distribution_json JSON DEFAULT NULL,
  expense_category_distribution_json JSON DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_snapshot_date (user_id, snapshot_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Colunas Principais**:
- `total_net_worth_brl`: Patrimônio líquido consolidado (Ativos - Passivos)
- `total_assets_brl`: Valor total de todos os ativos
- `total_liabilities_brl`: Valor total de todos os passivos (dívidas)
- `liquid_assets_brl`: Ativos líquidos (caixa, conta corrente)
- `invested_assets_brl`: Ativos investidos (ações, cripto, fundos)
- `crypto_portfolio_value_brl`: Valor consolidado do portfólio cripto
- `stock_portfolio_value_brl`: Valor consolidado do portfólio de ações
- `fixed_income_value_brl`: Valor em Renda Fixa e Tesouro
- `real_estate_funds_value_brl`: Valor em FIIs
- `other_investments_value_brl`: Outras classes de investimentos
- `income_last_30_days_brl`: Receitas dos últimos 30 dias
- `expenses_last_30_days_brl`: Despesas dos últimos 30 dias
- `investments_last_30_days_brl`: Aportes dos últimos 30 dias
- `disinvestments_last_30_days_brl`: Resgates dos últimos 30 dias
- `asset_class_distribution_json`: Distribuição por classe de ativo (JSON)
- `expense_category_distribution_json`: Distribuição de despesas por categoria (JSON)

#### Tabela: `net_worth_snapshots_old` (DEPRECIADA)
**Status**: Tabela legada, substituída por `daily_financial_snapshots`. Mantida para compatibilidade histórica.

---

### Domínio de Ativos e Investimentos

#### Tabela: `assets`
**Propósito**: Dicionário global de todos os ativos negociáveis no sistema (criptomoedas, ações, FIIs, etc.).

**Estrutura**:
```sql
CREATE TABLE assets (
  id INT NOT NULL AUTO_INCREMENT,
  symbol VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  asset_class ENUM('CRIPTO','ACAO_BR','ACAO_US','PREVIDENCIA','FUNDO','FII','COE','RENDA_FIXA','TESOURO','COMMODITIES','OUTROS') NOT NULL,
  price_api_identifier VARCHAR(255) DEFAULT NULL,
  contract_address VARCHAR(255) DEFAULT NULL,
  decimals INT DEFAULT 18,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  last_price_usdt DECIMAL(36,18) DEFAULT NULL,
  last_price_brl DECIMAL(36,18) DEFAULT NULL,
  last_price_updated_at DATETIME DEFAULT NULL,
  icon_url VARCHAR(500) DEFAULT NULL,
  av_open DECIMAL(20,8) DEFAULT NULL,
  av_high DECIMAL(20,8) DEFAULT NULL,
  av_low DECIMAL(20,8) DEFAULT NULL,
  av_volume BIGINT DEFAULT NULL,
  av_latest_trading_day DATE DEFAULT NULL,
  av_previous_close DECIMAL(20,8) DEFAULT NULL,
  av_change DECIMAL(20,8) DEFAULT NULL,
  av_change_percent DECIMAL(20,8) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY symbol (symbol),
  KEY idx_assets_av_trading_day (av_latest_trading_day)
);
```

**Colunas Principais**:
- `symbol`: Ticker do ativo (único) - ex: "BTC", "PETR4"
- `name`: Nome completo - ex: "Bitcoin", "Petrobras PN"
- `asset_class`: Classificação (CRIPTO, ACAO_BR, ACAO_US, FII, etc.)
- `price_api_identifier`: Identificador para APIs de preço
- `contract_address`: Endereço do contrato (para tokens)
- `decimals`: Casas decimais do ativo
- `last_price_usdt`, `last_price_brl`: Cache dos últimos preços
- `icon_url`: URL do ícone do ativo
- `av_*`: Campos específicos da Alpha Vantage API:
  - `av_open`: Preço de abertura
  - `av_high`: Preço mais alto do dia
  - `av_low`: Preço mais baixo do dia
  - `av_volume`: Volume negociado
  - `av_latest_trading_day`: Último dia de negociação
  - `av_previous_close`: Fechamento anterior
  - `av_change`: Variação absoluta
  - `av_change_percent`: Variação percentual

#### Tabela: `asset_movements`
**Propósito**: Registra todas as movimentações de ativos do usuário (compras, vendas, transferências).

**Estrutura**:
```sql
CREATE TABLE asset_movements (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  account_id INT NOT NULL,
  asset_id INT NOT NULL,
  movement_type ENUM('COMPRA','VENDA','TRANSFERENCIA_ENTRADA','TRANSFERENCIA_SAIDA','SINCRONIZACAO') NOT NULL,
  movement_date DATETIME NOT NULL,
  quantity DECIMAL(36,18) NOT NULL,
  price_per_unit DECIMAL(36,18) DEFAULT NULL,
  fee DECIMAL(36,18) DEFAULT 0.000000000000000000,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  tx_hash VARCHAR(255) DEFAULT NULL,
  from_address VARCHAR(255) DEFAULT NULL,
  to_address VARCHAR(255) DEFAULT NULL,
  block_number BIGINT DEFAULT NULL,
  gas_fee DECIMAL(36,18) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY tx_hash (tx_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

**Relacionamentos**:
- `user_id` (FK → `users.id`): Movimentação pertence ao usuário
- `account_id` (FK → `accounts.id`): Conta onde ocorreu a movimentação
- `asset_id` (FK → `assets.id`): Ativo movimentado

**Colunas Principais**:
- `movement_type`: Tipo da operação (COMPRA, VENDA, TRANSFERENCIA_ENTRADA, TRANSFERENCIA_SAIDA, SINCRONIZACAO)
- `movement_date`: Data/hora da operação
- `quantity`: Quantidade do ativo movimentado
- `price_per_unit`: Preço unitário na transação
- `fee`: Taxa da operação
- Campos específicos para transações on-chain:
  - `tx_hash`: Hash da transação blockchain
  - `from_address`: Endereço de origem
  - `to_address`: Endereço de destino
  - `block_number`: Número do bloco
  - `gas_fee`: Taxa de gas

#### View: `vw_portfolio_summary`
**Propósito**: Consolida dados de movimentações e ativos para apresentar o portfólio atual do usuário.

**Estrutura**:
```sql
CREATE VIEW vw_portfolio_summary AS
SELECT 
  am.user_id,
  am.account_id,
  am.asset_id,
  a.symbol,
  a.name AS asset_name,
  a.asset_class,
  a.price_api_identifier,
  a.last_price_usdt,
  a.last_price_brl,
  a.last_price_updated_at,
  SUM(CASE WHEN am.movement_type IN ('COMPRA','TRANSFERENCIA_ENTRADA','SINCRONIZACAO') 
           THEN am.quantity ELSE 0 END) AS total_bought,
  SUM(CASE WHEN am.movement_type IN ('VENDA','TRANSFERENCIA_SAIDA') 
           THEN am.quantity ELSE 0 END) AS total_sold,
  SUM(CASE WHEN am.movement_type IN ('COMPRA','TRANSFERENCIA_ENTRADA','SINCRONIZACAO') 
           AND am.price_per_unit IS NOT NULL 
           THEN (am.quantity * am.price_per_unit) ELSE 0 END) AS total_invested,
  SUM(CASE WHEN am.movement_type IN ('COMPRA','TRANSFERENCIA_ENTRADA','SINCRONIZACAO') 
           AND am.price_per_unit IS NOT NULL 
           THEN am.quantity ELSE 0 END) AS weighted_quantity,
  MAX(am.movement_date) AS acquisition_date
FROM asset_movements am
JOIN assets a ON am.asset_id = a.id
GROUP BY am.asset_id, a.symbol, a.name, a.asset_class, a.price_api_identifier, 
         a.last_price_usdt, a.last_price_brl, a.last_price_updated_at, 
         am.user_id, am.account_id
HAVING (total_bought - total_sold) > 0;
```

**Lógica de Negócio**:
- Agrupa movimentações por usuário, conta e ativo
- Calcula `total_bought` (entradas) e `total_sold` (saídas)
- Filtra apenas ativos com posição atual > 0
- Calcula custo total investido e quantidade ponderada para preço médio
- Fornece data da última aquisição

---

### Domínio de Carteiras e Integração Web3

#### Tabela: `wallets`
**Propósito**: Armazena informações de carteiras de criptomoedas (endereços e chaves privadas criptografadas).

**Estrutura**:
```sql
CREATE TABLE wallets (
  id INT NOT NULL AUTO_INCREMENT,
  public_address VARCHAR(255) NOT NULL,
  private_key_encrypted TEXT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY public_address (public_address)
);
```

**Colunas Principais**:
- `public_address`: Endereço público da carteira (único)
- `private_key_encrypted`: Chave privada armazenada de forma segura

#### Tabela: `user_wallets`
**Propósito**: Tabela associativa N:N entre usuários e carteiras.

**Estrutura**:
```sql
CREATE TABLE user_wallets (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  wallet_id INT NOT NULL,
  wallet_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY user_wallet_unique (user_id, wallet_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);
```

**Relacionamentos**:
- `user_id` (FK → `users.id`): Usuário proprietário
- `wallet_id` (FK → `wallets.id`): Carteira associada

**Colunas Principais**:
- `wallet_name`: Nome amigável definido pelo usuário para a carteira

---

### Domínio de Automação e Trading

#### Tabela: `strategies`
**Propósito**: Armazena definições de estratégias de trading criadas pelos usuários.

**Estrutura**:
```sql
CREATE TABLE strategies (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  parameters JSON NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Colunas Principais**:
- `name`, `description`: Identificação da estratégia
- `parameters`: Campo JSON flexível com parâmetros específicos da estratégia

#### Tabela: `backtests`
**Propósito**: Registra execuções de backtests (simulações de estratégias contra dados históricos).

**Estrutura**:
```sql
CREATE TABLE backtests (
  id INT NOT NULL AUTO_INCREMENT,
  strategy_id INT DEFAULT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  initial_balance_usdt DECIMAL(36,18) NOT NULL DEFAULT 0.000000000000000000,
  status ENUM('pending','running','completed','failed') NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (strategy_id) REFERENCES strategies(id)
);
```

**Relacionamentos**:
- `strategy_id` (FK → `strategies.id`): Estratégia sendo testada

**Colunas Principais**:
- `start_date`, `end_date`: Período histórico da simulação
- `initial_balance_usdt`: Capital inicial para o teste
- `status`: Estado da execução (pending, running, completed, failed)

#### Tabela: `backtest_results`
**Propósito**: Armazena resultados e métricas de performance de backtests concluídos.

**Estrutura**:
```sql
CREATE TABLE backtest_results (
  id INT NOT NULL AUTO_INCREMENT,
  backtest_id INT DEFAULT NULL,
  win_rate_percent DECIMAL(5,2) DEFAULT NULL,
  risk_reward_ratio DECIMAL(10,2) DEFAULT NULL,
  total_profit_usdt DECIMAL(36,18) NOT NULL DEFAULT 0.000000000000000000,
  net_pnl_percent DECIMAL(10,2) DEFAULT NULL,
  results_summary JSON DEFAULT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (backtest_id) REFERENCES backtests(id)
);
```

**Relacionamentos**:
- `backtest_id` (FK → `backtests.id`): Vincula ao backtest executado

**Colunas Principais**:
- `win_rate_percent`: Taxa de acerto percentual
- `risk_reward_ratio`: Ratio risco/retorno
- `total_profit_usdt`: Lucro total em USDT
- `net_pnl_percent`: P&L líquido percentual
- `results_summary`: Dados detalhados em JSON

#### Tabela: `strategy_vaults`
**Propósito**: Ponte entre mundo off-chain e on-chain. Registra smart contracts que executam estratégias.

**Estrutura**:
```sql
CREATE TABLE strategy_vaults (
  id INT NOT NULL AUTO_INCREMENT,
  user_wallet_id INT NOT NULL,
  contract_address VARCHAR(255) NOT NULL,
  strategy_name VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY contract_address (contract_address),
  FOREIGN KEY (user_wallet_id) REFERENCES user_wallets(id) ON DELETE CASCADE
);
```

**Relacionamentos**:
- `user_wallet_id` (FK → `user_wallets.id`): Associa à carteira específica do usuário

**Colunas Principais**:
- `contract_address`: Endereço único do smart contract na blockchain
- `strategy_name`: Nome amigável para o Vault

---

## 3. Índices e Constraints Importantes

### Índices de Performance:
- `idx_assets_av_trading_day` na tabela `assets` para otimizar consultas por data de negociação
- `uq_user_snapshot_date` na tabela `daily_financial_snapshots` garante unicidade por usuário/data
- `user_wallet_unique` na tabela `user_wallets` evita duplicação de associações

### Constraints de Integridade:
- Todos os campos `user_id` possuem `ON DELETE CASCADE` para limpeza automática
- Chaves estrangeiras para tabelas de referência usam `ON DELETE SET NULL`
- Campos únicos garantem integridade de dados críticos (símbolos, endereços, etc.)

---

## 4. Evolução e Migrações

### Estruturas Depreciadas:
- `net_worth_snapshots_old`: Substituída por `daily_financial_snapshots` para análises mais detalhadas

### Novos Recursos:
- Integração com APIs de preços (Alpha Vantage, CoinGecko, Finnhub)
- Sistema de instituições financeiras estruturado
- Snapshots financeiros detalhados para dashboards
- Suporte a múltiplas moedas (USDT/BRL)
- Campos específicos para transações blockchain
- Sistema de ícones para melhor UX

---

## 5. Considerações de Segurança e Performance

### Segurança:
- Chaves privadas sempre criptografadas
- Senhas com hash seguro
- Validação de integridade referencial
- Controle de acesso por níveis de usuário

### Performance:
- Índices estratégicos para consultas frequentes
- Campos de cache para preços de ativos
- Views otimizadas para consultas de portfólio
- Estrutura JSON para dados flexíveis sem impacto na performance

Esta documentação representa o estado atual do esquema do banco de dados e deve ser atualizada conforme novas funcionalidades sejam implementadas.