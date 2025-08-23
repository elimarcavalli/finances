import React, { useState } from 'react';
import {
  UnstyledButton,
  Group,
  Avatar,
  Text,
  Box,
  ActionIcon,
  Stack
} from '@mantine/core';
import { IconChevronDown, IconX } from '@tabler/icons-react';
import { TokenSelectorModal } from './TokenSelectorModal';

export function TokenInput({ value, onChange, placeholder = "Selecionar um token", ...props }) {
  const [modalOpened, setModalOpened] = useState(false);

  const handleTokenSelect = (token) => {
    onChange(token);
    setModalOpened(false);
  };

  const handleClear = (event) => {
    event.stopPropagation();
    onChange(null);
  };

  const handleClick = () => {
    setModalOpened(true);
  };

  return (
    <Box>
      <UnstyledButton
        onClick={handleClick}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: value ? '2px solid var(--mantine-color-blue-4)' : '1px solid var(--mantine-color-gray-4)',
          borderRadius: '8px',
          backgroundColor: value ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-gray-1)',
          transition: 'all 0.2s ease',
          minHeight: '42px',
          boxShadow: value ? '0 2px 4px rgba(59, 130, 246, 0.1)' : 'none'
        }}
        styles={{
          root: {
            '&:hover': {
              borderColor: value ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-blue-4)',
              backgroundColor: value ? 'var(--mantine-color-blue-1)' : 'var(--mantine-color-gray-0)',
              transform: 'translateY(-1px)',
              boxShadow: value ? '0 4px 8px rgba(59, 130, 246, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.1)'
            },
            '&:focus': {
              borderColor: 'var(--mantine-color-blue-6)',
              outline: 'none',
              boxShadow: '0 0 0 3px var(--mantine-color-blue-1)'
            }
          }
        }}
        {...props}
      >
        {value ? (
          // Token selecionado
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Avatar
                src={value.logoURI}
                alt={value.symbol}
                size={24}
                radius="xl"
              >
                {value.symbol.slice(0, 2)}
              </Avatar>
              <Stack gap={0}>
                <Text size="sm" fw={500}>
                  {value.symbol}
                </Text>
                <Text size="xs" c="dimmed" truncate style={{ maxWidth: '200px' }}>
                  {value.name}
                </Text>
              </Stack>
            </Group>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={handleClear}
              style={{ flexShrink: 0 }}
            >
              <IconX size={14} />
            </ActionIcon>
          </Group>
        ) : (
          // Estado vazio
          <Group justify="space-between" wrap="nowrap">
            <Text c="dimmed" size="sm">
              {placeholder}
            </Text>
            <IconChevronDown size={16} color="var(--mantine-color-gray-6)" />
          </Group>
        )}
      </UnstyledButton>

      <TokenSelectorModal
        isOpen={modalOpened}
        onClose={() => setModalOpened(false)}
        onTokenSelect={handleTokenSelect}
      />
    </Box>
  );
}