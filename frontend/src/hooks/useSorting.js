import { useState, useMemo } from 'react';

export function useSorting(initialField = null, initialDirection = 'desc') {
  const [sortField, setSortField] = useState(initialField);
  const [sortDirection, setSortDirection] = useState(initialDirection);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortData = useMemo(() => {
    return (data) => {
      if (!sortField || !data) return data;

      return [...data].sort((a, b) => {
        const aValue = a[sortField] || 0;
        const bValue = b[sortField] || 0;
        
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    };
  }, [sortField, sortDirection]);

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const reset = () => {
    setSortField(initialField);
    setSortDirection(initialDirection);
  };

  return {
    sortField,
    sortDirection,
    handleSort,
    sortData,
    getSortIcon,
    reset
  };
}