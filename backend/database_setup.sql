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
    balance DECIMAL(20, 8) DEFAULT 0.00,
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
    asset_class ENUM('CRIPTO', 'ACAO_BR', 'ACAO_EUA', 'RENDA_FIXA', 'FUNDO_IMOBILIARIO', 'MOEDA_FIDUCIARIA') NOT NULL,
    price_api_identifier VARCHAR(255), -- Ex: 'bitcoin' (ID do CoinGecko para cotação)
    contract_address VARCHAR(255), -- Endereço do contrato para tokens ERC-20
    decimals INT DEFAULT 18, -- Decimais do token (padrão 18 para ERC-20)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Posições (O que o usuário possui, onde e quanto)
CREATE TABLE IF NOT EXISTS asset_holdings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    asset_id INT NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    average_buy_price DECIMAL(20, 8),
    acquisition_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Tabela de Contas a Receber
CREATE TABLE IF NOT EXISTS accounts_receivable (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    debtor_name VARCHAR(255),
    total_amount DECIMAL(20, 2) NOT NULL,
    due_date DATE,
    status ENUM('PENDENTE', 'PAGO', 'ATRASADO') NOT NULL DEFAULT 'PENDENTE',
    expected_account_id INT, -- Conta onde se espera receber o valor
    linked_transaction_id INT NULL, -- ID da transação de receita quando for pago
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (expected_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (linked_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);