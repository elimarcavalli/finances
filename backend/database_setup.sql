-- -- -- Tabela de Posições (O que o usuário possui, onde e quanto)
-- CREATE TABLE IF NOT EXISTS asset_holdings (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     account_id INT NOT NULL,
--     asset_id INT NOT NULL,
--     acquisition_date DATE,
--     quantity DECIMAL(36, 18) NOT NULL,
--     average_buy_price DECIMAL(36, 18),
--     value_brl DECIMAL(36, 18) DEFAULT 0.0 COMMENT 'Valor do ativo em BRL baseado no preço atual';
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--     FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
--     FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
-- );

-- -- ALTER TABLE asset_holdings
-- --     MODIFY quantity DECIMAL(36, 18) NOT NULL;

-- -- ALTER TABLE asset_holdings
-- --     MODIFY average_buy_price DECIMAL(36, 18);

-- -- ALTER TABLE asset_holdings
-- --     MODIFY value_brl DECIMAL(36, 18) DEFAULT 0.0 COMMENT 'Valor do ativo em BRL baseado no preço atual';



-- Tabela de Usuários da Aplicação (já existente, garantir que está assim)
CREATE TABLE users (
  id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_name varchar(100) NOT NULL,
  password_hash varchar(255) NOT NULL,
  email varchar(255) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login timestamp NULL DEFAULT NULL,
  last_logout timestamp NULL DEFAULT NULL,
  user_level int NOT NULL DEFAULT '0' COMMENT 'Níveis de acesso: 0 = convidado, 1 = usuário, 5 = moderador, 10 = editor, 15 = gerente, 23 = administrador',
  google_id varchar(255) DEFAULT NULL,
  avatar_url varchar(512) DEFAULT NULL
)

-- Tabela de Contas (Onde os ativos e o dinheiro vivem)
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('CONTA_CORRENTE', 'POUPANCA', 'CORRETORA_NACIONAL', 'CORRETORA_CRIPTO', 'CARTEIRA_CRIPTO', 'CARTAO_CREDITO', 'DINHEIRO_VIVO') NOT NULL,
    institution VARCHAR(255),
    credit_limit DECIMAL(20, 2) DEFAULT 0.00,
    invoice_due_day INT,
    public_address VARCHAR(255), -- Endereço público para carteiras cripto
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de Ativos (O Dicionário de tudo que pode ser possuído)
CREATE TABLE IF NOT EXISTS assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL UNIQUE, -- Ex: "BTC", "PETR4", "MATIC"
    name VARCHAR(255) NOT NULL, -- Ex: "Bitcoin", "Petrobras PN"
    asset_class ENUM('CRIPTO', 'ACAO_BR', 'ACAO_US', 'FUNDO', 'FII', 'COE', 'RENDA_FIXA', 'TESOURO', 'COMMODITIES', 'OUTROS') NOT NULL,
    price_api_identifier VARCHAR(255), -- Ex: 'bitcoin' (ID do CoinGecko para cotação)
    contract_address VARCHAR(255), -- Endereço do contrato para tokens ERC-20
    decimals INT DEFAULT 18, -- Decimais do token (padrão 18 para ERC-20)
    icon_url VARCHAR(500), -- URL do ícone do ativo (CoinGecko, etc)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);





-- Crie a nova tabela de movimentos de ativos.
CREATE TABLE asset_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    asset_id INT NOT NULL,
    movement_type ENUM('COMPRA', 'VENDA', 'TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SAIDA', 'SINCRONIZACAO') NOT NULL,
    movement_date DATETIME NOT NULL,
    quantity DECIMAL(36, 18) NOT NULL,
    price_per_unit DECIMAL(36, 18) NULL, -- Preço por unidade na moeda da transação
    fee DECIMAL(36, 18) DEFAULT 0.00, -- Taxas da operação
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- ALTER TABLE asset_movements
-- MODIFY quantity DECIMAL(36, 18) NOT NULL;

-- ALTER TABLE asset_movements
-- MODIFY price_per_unit DECIMAL(36, 18) NULL;

-- ALTER TABLE asset_movements
-- MODIFY fee DECIMAL(36, 18) DEFAULT 0.00;

CREATE TABLE net_worth_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    snapshot_date DATE NOT NULL,
    total_net_worth DECIMAL(20, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (user_id, snapshot_date), -- Garante um snapshot por dia por usuário
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de Lançamentos (O Livro-Razão Universal)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    type ENUM('RECEITA', 'DESPESA', 'TRANSFERENCIA') NOT NULL,
    category VARCHAR(100),
    from_account_id INT NULL,
    to_account_id INT NULL,
    status ENUM('EFETIVADO', 'PENDENTE') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Tabela unificada de obrigações financeiras.
CREATE TABLE financial_obligations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    due_date DATE NOT NULL,
    type ENUM('PAYABLE', 'RECEIVABLE') NOT NULL, -- A Pagar ou A Receber
    status ENUM('PENDING', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    category VARCHAR(100),
    entity_name VARCHAR(255), -- Nome do credor ou devedor
    notes TEXT,
    linked_transaction_id INT NULL, -- Conecta à transação quando liquidada
    recurring_rule_id INT NULL, -- Conecta à regra de recorrência que a gerou
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Tabela de regras de recorrência
CREATE TABLE recurring_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    type ENUM('PAYABLE', 'RECEIVABLE') NOT NULL,
    category VARCHAR(100),
    entity_name VARCHAR(255),
    frequency ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY') NOT NULL,
    interval_value INT NOT NULL DEFAULT 1, -- Ex: a cada 2 (interval_value) meses (frequency)
    start_date DATE NOT NULL,
    end_date DATE NULL, -- Se for nulo, a recorrência é infinita
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Relacionamento entre obrigações e regras de recorrência
ALTER TABLE financial_obligations
ADD CONSTRAINT fk_recurring_rule
FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules(id) ON DELETE SET NULL;

ALTER TABLE asset_movements
ADD COLUMN tx_hash VARCHAR(255) NULL UNIQUE,
ADD COLUMN from_address VARCHAR(255) NULL,
ADD COLUMN to_address VARCHAR(255) NULL,
ADD COLUMN block_number BIGINT NULL,
ADD COLUMN gas_fee DECIMAL(36, 18) NULL;

ALTER TABLE assets
ADD COLUMN last_price_usdt DECIMAL(36, 18) NULL,
ADD COLUMN last_price_brl DECIMAL(36, 18) NULL,
ADD COLUMN last_price_updated_at DATETIME NULL;






