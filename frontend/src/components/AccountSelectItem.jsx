import React, { forwardRef } from 'react';
import { Group, Text, Badge, Avatar } from '@mantine/core';
import { IconWallet, IconCreditCard, IconBuildingBank, IconCoin } from '@tabler/icons-react';
import { formatCurrency } from '../utils/formatters';

// Função para obter ícone baseado no tipo de conta
const getAccountIcon = (type) => {
  switch (type) {
    case 'CONTA_CORRENTE':
      return <IconBuildingBank size={16} />;
    case 'POUPANCA':
      return <IconBuildingBank size={16} />;
    case 'CARTAO_CREDITO':
      return <IconCreditCard size={16} />;
    case 'CORRETORA_NACIONAL':
      return <IconWallet size={16} />;
    case 'CORRETORA_CRIPTO':
      return <IconCoin size={16} />;
    case 'CARTEIRA_CRIPTO':
      return <IconCoin size={16} />;
    case 'DINHEIRO_VIVO':
      return <IconWallet size={16} />;
    default:
      return <IconWallet size={16} />;
  }
};

// Função para obter cor baseado no tipo de conta
const getAccountColor = (type) => {
  switch (type) {
    case 'CONTA_CORRENTE':
      return 'blue';
    case 'POUPANCA':
      return 'green';
    case 'CARTAO_CREDITO':
      return 'orange';
    case 'CORRETORA_NACIONAL':
      return 'violet';
    case 'CORRETORA_CRIPTO':
      return 'yellow';
    case 'CARTEIRA_CRIPTO':
      return 'cyan';
    case 'DINHEIRO_VIVO':
      return 'gray';
    default:
      return 'blue';
  }
};

// Função para formatar o tipo de conta
const formatAccountType = (type) => {
  const types = {
    'CONTA_CORRENTE': 'Conta Corrente',
    'POUPANCA': 'Poupança',
    'CARTAO_CREDITO': 'Cartão de Crédito',
    'CORRETORA_NACIONAL': 'Corretora Nacional',
    'CORRETORA_CRIPTO': 'Corretora Crypto',
    'CARTEIRA_CRIPTO': 'Carteira Crypto',
    'DINHEIRO_VIVO': 'Dinheiro Vivo'
  };
  return types[type] || type;
};

const AccountSelectItem = forwardRef(({ 
  name, 
  type, 
  balance, 
  institution, 
  icon_url,
  credit_limit,
  ...others 
}, ref) => {
  const accountColor = getAccountColor(type);
  const isCredit = type === 'CARTAO_CREDITO';
  const displayBalance = isCredit ? (credit_limit - Math.abs(balance || 0)) : (balance || 0);
  
  return (
    <div ref={ref} {...others} style={{ padding: '8px 12px' }}>
      <Group noWrap>
        <Avatar 
          src={icon_url} 
          size="md" 
          radius="sm"
          color={accountColor}
          style={{
            border: `1px solid var(--mantine-color-${accountColor}-3)`,
            background: `var(--mantine-color-${accountColor}-0)`
          }}
        >
          {getAccountIcon(type)}
        </Avatar>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group position="apart" noWrap>
            <div>
              <Text size="sm" weight={600} style={{ lineHeight: 1.2 }}>
                {name}
              </Text>
              <Text 
                size="xs" 
                color="dimmed" 
                truncate 
                style={{ maxWidth: '200px' }}
              >
                {institution || formatAccountType(type)}
              </Text>
            </div>
            
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Text 
                size="sm" 
                weight={600} 
                color={displayBalance >= 0 ? 'green' : 'red'}
              >
                R$ {formatCurrency(Math.abs(displayBalance))}
              </Text>
              <Badge 
                size="xs" 
                variant="light" 
                color={accountColor}
              >
                {formatAccountType(type)}
              </Badge>
              {isCredit && credit_limit && (
                <Text size="xs" color="dimmed">
                  Limite: R$ {formatCurrency(credit_limit)}
                </Text>
              )}
            </div>
          </Group>
        </div>
      </Group>
    </div>
  );
});

AccountSelectItem.displayName = 'AccountSelectItem';

export default AccountSelectItem;