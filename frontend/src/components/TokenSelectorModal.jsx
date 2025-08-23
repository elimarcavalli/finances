import React, { useState, useMemo } from 'react';
import {
  Modal,
  TextInput,
  ScrollArea,
  Stack,
  Group,
  Avatar,
  Text,
  UnstyledButton,
  Badge,
  Divider,
  Box
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { POLYGON_TOKENS, TOKEN_CATEGORIES } from '../utils/tokenConstants';

export function TokenSelectorModal({ isOpen, onClose, onTokenSelect }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar tokens baseado na busca
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return POLYGON_TOKENS;
    }

    const query = searchQuery.toLowerCase().trim();
    return POLYGON_TOKENS.filter(token =>
      token.name.toLowerCase().includes(query) ||
      token.symbol.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Agrupar tokens por categoria
  const tokensByCategory = useMemo(() => {
    const grouped = {};
    
    filteredTokens.forEach(token => {
      if (!grouped[token.category]) {
        grouped[token.category] = [];
      }
      grouped[token.category].push(token);
    });

    return grouped;
  }, [filteredTokens]);

  // Função para lidar com seleção de token
  const handleTokenSelect = (token) => {
    onTokenSelect(token);
    onClose();
    setSearchQuery(''); // Limpar busca para próxima abertura
  };

  // Obter label da categoria
  const getCategoryLabel = (categoryValue) => {
    const category = TOKEN_CATEGORIES.find(cat => cat.value === categoryValue);
    return category ? category.label : categoryValue;
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Selecionar Ativo"
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
      radius="md"
      styles={{
        title: {
          fontSize: '1.25rem',
          fontWeight: 600
        }
      }}
    >
      <Stack gap="md">
        {/* Barra de Pesquisa */}
        <TextInput
          placeholder="Pesquisar por nome, símbolo ou endereço..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          autoFocus
          variant="filled"
          radius="md"
        />

        {/* Lista de Tokens */}
        <ScrollArea h={400} offsetScrollbars>
          <Stack gap="xs">
            {Object.keys(tokensByCategory).length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                Nenhum token encontrado
              </Text>
            ) : (
              Object.entries(tokensByCategory).map(([category, tokens]) => (
                <Box key={category}>
                  {/* Header da Categoria */}
                  <Group mb="xs">
                    <Badge variant="light" size="sm">
                      {getCategoryLabel(category)}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {tokens.length} token{tokens.length !== 1 ? 's' : ''}
                    </Text>
                  </Group>

                  {/* Tokens da Categoria */}
                  <Stack gap={4} mb="md">
                    {tokens.map((token) => (
                      <UnstyledButton
                        key={token.address}
                        onClick={() => handleTokenSelect(token)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid var(--mantine-color-gray-3)',
                          backgroundColor: 'transparent',
                          transition: 'all 0.2s ease'
                        }}
                        styles={{
                          root: {
                            '&:hover': {
                              backgroundColor: 'var(--mantine-color-gray-0)',
                              borderColor: 'var(--mantine-color-blue-4)',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                            }
                          }
                        }}
                      >
                        <Group gap="md" wrap="nowrap">
                          {/* Logo do Token */}
                          <Avatar
                            src={token.logoURI}
                            alt={token.symbol}
                            size="sm"
                            radius="xl"
                          >
                            {token.symbol.slice(0, 2)}
                          </Avatar>

                          {/* Informações do Token */}
                          <Box style={{ flex: 1 }}>
                            <Group justify="space-between" align="center">
                              <Box>
                                <Text fw={500} size="sm">
                                  {token.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {token.symbol}
                                </Text>
                              </Box>
                              <Badge
                                variant="dot"
                                color="blue"
                                size="sm"
                              >
                                Polygon
                              </Badge>
                            </Group>
                          </Box>
                        </Group>
                      </UnstyledButton>
                    ))}
                  </Stack>

                  {/* Divisor entre categorias */}
                  {Object.keys(tokensByCategory).indexOf(category) < 
                   Object.keys(tokensByCategory).length - 1 && (
                    <Divider my="sm" />
                  )}
                </Box>
              ))
            )}
          </Stack>
        </ScrollArea>

        {/* Footer com informações */}
        <Box
          p="xs"
          style={{
            backgroundColor: 'var(--mantine-color-gray-0)',
            borderRadius: '6px',
            border: '1px solid var(--mantine-color-gray-2)'
          }}
        >
          <Text size="xs" c="dimmed" ta="center">
            {filteredTokens.length} de {POLYGON_TOKENS.length} tokens • Polygon Mainnet
          </Text>
        </Box>
      </Stack>
    </Modal>
  );
}