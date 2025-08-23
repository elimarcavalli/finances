import React from 'react';
import { ThemeIcon } from '@mantine/core';
import {
  IconBuildingBank,
  IconCurrencyBitcoin,
  IconCash,
  IconCreditCard,
  IconPigMoney,
  IconCoins,
  IconChartPie,
  IconWallet
} from '@tabler/icons-react';

export function AccountIcon({ type, size = 'md', ...props }) {
  const getIcon = () => {
    switch (type) {
      case 'CONTA_CORRENTE':
        return <IconBuildingBank size={20} />;
      case 'CARTEIRA_CRIPTO':
        return <IconCurrencyBitcoin size={20} />;
      case 'DINHEIRO_VIVO':
        return <IconCash size={20} />;
      case 'CARTAO_CREDITO':
        return <IconCreditCard size={20} />;
      case 'POUPANCA':
        return <IconPigMoney size={20} />;
      case 'INVESTIMENTO':
        return <IconChartPie size={20} />;
      case 'CONTA_DIGITAL':
        return <IconCoins size={20} />;
      default:
        return <IconWallet size={20} />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'CONTA_CORRENTE':
        return 'blue';
      case 'CARTEIRA_CRIPTO':
        return 'orange';
      case 'DINHEIRO_VIVO':
        return 'green';
      case 'CARTAO_CREDITO':
        return 'red';
      case 'POUPANCA':
        return 'teal';
      case 'INVESTIMENTO':
        return 'violet';
      case 'CONTA_DIGITAL':
        return 'cyan';
      default:
        return 'gray';
    }
  };

  return (
    <ThemeIcon
      size={size}
      color={getColor()}
      variant="light"
      {...props}
    >
      {getIcon()}
    </ThemeIcon>
  );
}