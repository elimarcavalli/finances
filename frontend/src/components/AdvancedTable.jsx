import React, { useState, useCallback, useMemo, Fragment } from 'react';
import {
  Table,
  ScrollArea,
  UnstyledButton,
  Group,
  Text,
  ActionIcon,
  Popover,
  TextInput,
  Menu,
  RangeSlider,
  Button,
  Center,
  Card,
  Pagination,
  Select,
  Title
} from '@mantine/core';
import {
  IconFilter,
  IconSortAscending,
  IconSortDescending,
  IconX
} from '@tabler/icons-react';
import '../styles/AdvancedTable.css';

export function AdvancedTable({ 
  data = [], 
  columns = [], 
  footerCalculations = null,
  emptyStateText = "Nenhum dado encontrado",
  emptyStateDescription = "",
  title = "",
  pagination = false,
  pageSize: initialPageSize = 25
}) {
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({});
  const [openedPopovers, setOpenedPopovers] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Inicializar filtros baseado nas colunas
  const initializeFilters = useCallback(() => {
    const initialFilters = {};
    columns.forEach(column => {
      if (column.filterable) {
        switch (column.filterType) {
          case 'text':
            initialFilters[column.accessor] = '';
            break;
          case 'select':
            initialFilters[column.accessor] = column.multiSelect ? [] : '';
            break;
          case 'range':
            initialFilters[column.accessor] = [0, 0];
            break;
          default:
            break;
        }
      }
    });
    return initialFilters;
  }, [columns]);

  // Inicializar filtros uma vez
  React.useEffect(() => {
    const initialFilters = initializeFilters();
    setFilters(initialFilters);
  }, [initializeFilters]);

  // Função de ordenação
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Função de aplicação de filtros
  const applyFilters = useCallback((rawData) => {
    return rawData.filter(row => {
      return columns.every(column => {
        if (!column.filterable || !filters[column.accessor]) return true;

        const cellValue = row[column.accessor];
        const filterValue = filters[column.accessor];

        switch (column.filterType) {
          case 'text':
            if (!filterValue) return true;
            const searchTerm = filterValue.toLowerCase();
            const cellText = (cellValue || '').toString().toLowerCase();
            return cellText.includes(searchTerm);

          case 'select':
            if (column.multiSelect) {
              if (!filterValue || filterValue.length === 0) return true;
              return filterValue.includes(cellValue);
            } else {
              if (!filterValue) return true;
              return cellValue === filterValue;
            }

          case 'range':
            const [min, max] = filterValue;
            if (max === 0) return true;
            const numValue = Number(cellValue) || 0;
            return numValue >= min && numValue <= max;

          default:
            return true;
        }
      });
    });
  }, [filters, columns]);

  // Dados filtrados e ordenados
  const processedData = useMemo(() => {
    const filtered = applyFilters(data);
    
    if (!sortField) return filtered;

    return filtered.sort((a, b) => {
      const aValue = a[sortField] || 0;
      const bValue = b[sortField] || 0;
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [data, sortField, sortDirection, applyFilters]);

  // Dados paginados
  const paginatedData = useMemo(() => {
    if (!pagination) return processedData;
    
    return processedData.slice((page - 1) * pageSize, page * pageSize);
  }, [processedData, page, pageSize, pagination]);

  // Limpar filtros
  const clearFilters = () => {
    const clearedFilters = initializeFilters();
    setFilters(clearedFilters);
    setOpenedPopovers({});
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => {
      if (Array.isArray(value)) {
        // Para arrays de range
        if (value.length === 2 && typeof value[0] === 'number') {
          return value[0] > 0 || value[1] > 0;
        }
        // Para arrays de seleção múltipla
        return value.length > 0;
      }
      return value !== '' && value !== null && value !== undefined;
    });
  }, [filters]);

  // Calcular valores máximos para filtros de range
  const getMaxValueForRange = useCallback((accessor) => {
    return Math.max(...data.map(row => Number(row[accessor]) || 0), 0);
  }, [data]);

  // Componente de filtro de texto
  const TextFilterMenu = ({ column }) => {
    const isOpen = openedPopovers[column.accessor] || false;
    
    const togglePopover = (e) => {
      e.stopPropagation();
      setOpenedPopovers(prev => ({ ...prev, [column.accessor]: !prev[column.accessor] }));
    };

    const closePopover = () => {
      setOpenedPopovers(prev => ({ ...prev, [column.accessor]: false }));
    };

    return (
      <Popover 
        width={200} 
        position="bottom-start" 
        withArrow 
        shadow="md"
        opened={isOpen}
        onChange={(opened) => {
          if (!opened) {
            setOpenedPopovers(prev => ({ ...prev, [column.accessor]: false }));
          }
        }}
      >
        <Popover.Target>
          <ActionIcon 
            variant="subtle" 
            size="sm"
            onClick={togglePopover}
            color={filters[column.accessor] ? 'blue' : 'gray'}
          >
            <IconFilter size={12} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <div style={{ padding: '4px' }}>
            <TextInput
              placeholder={column.filterPlaceholder || 'Filtrar...'}
              value={filters[column.accessor] || ''}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, [column.accessor]: e.target.value }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  closePopover();
                  e.target.blur();
                }
              }}
              size="xs"
              autoFocus
              rightSection={
                filters[column.accessor] && (
                  <ActionIcon 
                    key={`clear-filter-${column.accessor}`}
                    size="xs" 
                    onClick={() => setFilters(prev => ({ ...prev, [column.accessor]: '' }))}
                  >
                    <IconX size={10} />
                  </ActionIcon>
                )
              }
            />
          </div>
        </Popover.Dropdown>
      </Popover>
    );
  };

  // Componente de filtro de select
  const SelectFilterMenu = ({ column }) => {
    const currentValue = filters[column.accessor];
    const hasFilter = column.multiSelect ? 
      (currentValue && currentValue.length > 0) : 
      (currentValue !== '' && currentValue !== null);

    const handleSingleSelect = (value) => {
      setFilters(prev => ({ ...prev, [column.accessor]: value }));
    };

    const handleMultiSelect = (value) => {
      setFilters(prev => {
        const currentArray = prev[column.accessor] || [];
        const newArray = currentArray.includes(value) 
          ? currentArray.filter(v => v !== value)
          : [...currentArray, value];
        return { ...prev, [column.accessor]: newArray };
      });
    };

    const clearFilter = () => {
      setFilters(prev => ({ 
        ...prev, 
        [column.accessor]: column.multiSelect ? [] : '' 
      }));
    };

    return (
      <Menu shadow="md" width={column.multiSelect ? 300 : 250}>
        <Menu.Target>
          <ActionIcon 
            variant="subtle" 
            size="sm"
            onClick={(e) => e.stopPropagation()}
            color={hasFilter ? 'blue' : 'gray'}
          >
            <IconFilter size={12} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
          <Menu.Item 
            onClick={clearFilter}
            rightSection={!hasFilter ? '✓' : ''}
          >
            Todas
          </Menu.Item>
          {column.filterOptions?.map((option) => {
            const isSelected = column.multiSelect ? 
              (currentValue && currentValue.includes(option.value)) :
              (currentValue === option.value);
            
            return (
              <Menu.Item 
                key={option.value}
                onClick={() => column.multiSelect ? 
                  handleMultiSelect(option.value) : 
                  handleSingleSelect(option.value)
                }
                rightSection={isSelected ? '✓' : ''}
              >
                {option.label}
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    );
  };

  // Componente de filtro de range
  const RangeFilterMenu = ({ column }) => {
    const maxValue = getMaxValueForRange(column.accessor);
    const [localRange, setLocalRange] = useState(filters[column.accessor] || [0, maxValue]);

    React.useEffect(() => {
      if (maxValue > 0 && (!filters[column.accessor] || filters[column.accessor][1] === 0)) {
        const newRange = [0, maxValue];
        setFilters(prev => ({ ...prev, [column.accessor]: newRange }));
        setLocalRange(newRange);
      }
    }, [maxValue, column.accessor]);

    return (
      <Popover width={300} position="bottom-start" withArrow shadow="md">
        <Popover.Target>
          <ActionIcon 
            variant="subtle" 
            size="sm"
            onClick={(e) => e.stopPropagation()}
            color={(filters[column.accessor] && (filters[column.accessor][0] > 0 || filters[column.accessor][1] < maxValue)) ? 'blue' : 'gray'}
          >
            <IconFilter size={12} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <div style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
            <Text size="xs" mb="xs">{column.header}</Text>
            <RangeSlider
              value={localRange}
              onChange={setLocalRange}
              onChangeEnd={(value) => setFilters(prev => ({ ...prev, [column.accessor]: value }))}
              min={0}
              max={maxValue}
              step={maxValue / 100}
              formatLabel={(value) => column.formatLabel ? column.formatLabel(value) : value}
              size="sm"
            />
            <Group justify="space-between" mt="xs">
              <Text key={`range-min-${column.accessor}`} size="xs">{column.formatLabel ? column.formatLabel(localRange[0]) : localRange[0]}</Text>
              <Text key={`range-max-${column.accessor}`} size="xs">{column.formatLabel ? column.formatLabel(localRange[1]) : localRange[1]}</Text>
            </Group>
            <Group justify="space-between" mt="xs">
              <Button 
                size="xs" 
                variant="light"
                onClick={() => {
                  setLocalRange([0, maxValue]);
                  setFilters(prev => ({ ...prev, [column.accessor]: [0, maxValue] }));
                }}
              >
                Limpar
              </Button>
            </Group>
          </div>
        </Popover.Dropdown>
      </Popover>
    );
  };

  // Componente de cabeçalho ordenável
  const SortableHeader = ({ column, children }) => {
    const renderFilter = () => {
      if (!column.filterable) return null;

      switch (column.filterType) {
        case 'text':
          return <TextFilterMenu column={column} />;
        case 'select':
          return <SelectFilterMenu column={column} />;
        case 'range':
          return <RangeFilterMenu column={column} />;
        default:
          return null;
      }
    };

    const filterElement = renderFilter();
    
    return (
      <Group gap="xs" justify="flex-start" style={{ width: '100%' }}>
        {filterElement && (
          <Fragment key={`filter-wrapper-${column.accessor}`}>
            {filterElement}
          </Fragment>
        )}
        {column.sortable ? (
          <UnstyledButton 
            key={`sort-button-${column.accessor}`} 
            onClick={() => handleSort(column.accessor)} 
            style={{ flex: 1, textAlign: 'left' }}
          >
            <Group gap="xs">
              <Text fw={500} size="sm">{children}</Text>
              {sortField === column.accessor && (
                sortDirection === 'asc' ? 
                  <IconSortAscending key={`asc-${column.accessor}`} size={12} /> : 
                  <IconSortDescending key={`desc-${column.accessor}`} size={12} />
              )}
            </Group>
          </UnstyledButton>
        ) : (
          <Text 
            key={`header-text-${column.accessor}`} 
            fw={500} 
            size="sm" 
            style={{ flex: 1 }}
          >
            {children}
          </Text>
        )}
      </Group>
    );
  };

  // Renderizar célula
  const renderCell = (row, column) => {
    if (column.render) {
      return column.render(row);
    }
    
    const value = row[column.accessor];
    return <Text size="sm">{value}</Text>;
  };

  // Calcular valores do rodapé
  const footerValues = useMemo(() => {
    if (!footerCalculations) return {};
    
    const values = {};
    Object.keys(footerCalculations).forEach(key => {
      if (typeof footerCalculations[key] === 'function') {
        values[key] = footerCalculations[key](processedData);
      }
    });
    return values;
  }, [footerCalculations, processedData]);

  // Reset page quando filtros mudarem
  React.useEffect(() => {
    setPage(1);
  }, [filters]);

  return (
    <Card withBorder radius="lg" p={13} className="advanced-table-container">
      {title && (
        <Card.Section key="table-title" withBorder inheritPadding py="md">
          <Title order={4}>{title}</Title>
        </Card.Section>
      )}
      
      {/* Cabeçalho fixo com indicador de filtros ativos */}
      {hasActiveFilters && (
        <Card.Section key="active-filters" p="xs" >
          <Group justify="center">
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Filtros ativos: {processedData.length} de {data.length} registros
              </Text>
              <Button 
                variant="light" 
                size="xs"
                onClick={clearFilters}
              >
                Limpar Filtros
              </Button>
            </Group>
          </Group>
        </Card.Section>
      )}

      <div className="advanced-table-content" style={{ position: 'relative' }}>
        <ScrollArea className="advanced-table-scroll">
          <Table striped highlightOnHover>
          <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#404040ff' }}> 
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th key={column.accessor} ta={column.align || 'left'}>
                  <SortableHeader column={column}>
                    {column.header}
                  </SortableHeader>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(pagination ? paginatedData : processedData).length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Center>
                    <div>
                      <Text c="dimmed" fw={500}>{emptyStateText}</Text>
                      {emptyStateDescription && (
                        <Text key="empty-description" c="dimmed" size="sm" mt="xs">
                          {emptyStateDescription}
                        </Text>
                      )}
                    </div>
                  </Center>
                </Table.Td>
              </Table.Tr>
            ) : (
              (pagination ? paginatedData : processedData).map((row, index) => (
                <Table.Tr key={row.id || index}>
                  {columns.map((column) => (
                    <Table.Td key={column.accessor} ta={column.align || 'left'}>
                      {renderCell(row, column)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
          </Table>
        </ScrollArea>
        
        {/* Rodapé fixo fora do ScrollArea */}
        {footerCalculations && (
          <div key="table-footer" className="advanced-table-footer">
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  {columns.map((column) => (
                    <Table.Td key={column.accessor} ta={column.align || 'left'} style={{ border: 'none', padding: '8px' }}>
                      {footerValues[column.accessor] ? (
                        <Text key={`footer-value-${column.accessor}`} size="sm" fw={600}>
                          {typeof footerValues[column.accessor] === 'function' 
                            ? footerValues[column.accessor]() 
                            : footerValues[column.accessor]}
                        </Text>
                      ) : (column.accessor === columns[0].accessor ? (
                        <Text key={`footer-count-${column.accessor}`} size="sm" fw={600}>
                          {processedData.length} registros
                        </Text>
                      ) : null)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {pagination && processedData.length > 0 && (
        <Card.Section key="pagination-section" withBorder inheritPadding py="xs">
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Text size="sm" c="dimmed">
                Registros por página:
              </Text>
              <Select
                value={pageSize.toString()}
                onChange={(value) => {
                  setPageSize(parseInt(value));
                  setPage(1);
                }}
                data={[
                  { value: '5', label: '5' },
                  { value: '10', label: '10' },
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' }
                ]}
                w={80}
                size="xs"
              />
              <Text size="sm" c="dimmed">
                Exibindo {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, processedData.length)} de {processedData.length} registros
              </Text>
            </Group>
            <Pagination
              total={Math.ceil(processedData.length / pageSize)}
              value={page}
              onChange={setPage}
              size="sm"
            />
          </Group>
        </Card.Section>
      )}
    </Card>
  );
}