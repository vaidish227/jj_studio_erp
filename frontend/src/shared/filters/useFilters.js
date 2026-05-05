import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generateApiQuery, getFilterConfig, FILTER_TYPES, SORT_OPTIONS } from './FilterConfig';

/**
 * Reusable hook for managing filter state across the application
 * Handles search params, filter state, and API query generation
 */
const useFilters = (module, entity, initialFilters = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterConfig = getFilterConfig(module, entity);
  
  // Initialize filter state from URL params or defaults
  const [filters, setFilters] = useState(() => {
    const initialState = {
      search: '',
      sort: '',
      status: [],
      category: '',
      dateRange: null,
      priority: '',
      amountRange: null,
      ...initialFilters
    };
    
    // Load from URL params
    const urlState = {};
    for (const [key, value] of searchParams.entries()) {
      if (key === 'status') {
        urlState.status = value.split(',');
      } else if (key === 'dateRange') {
        try {
          urlState.dateRange = JSON.parse(value);
        } catch {
          urlState.dateRange = null;
        }
      } else if (key === 'amountRange') {
        try {
          urlState.amountRange = JSON.parse(value);
        } catch {
          urlState.amountRange = null;
        }
      } else {
        urlState[key] = value;
      }
    }
    
    return { ...initialState, ...urlState };
  });
  
  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && (!Array.isArray(value) || value.length > 0)) {
        if (Array.isArray(value)) {
          params.set(key, value.join(','));
        } else if (typeof value === 'object') {
          params.set(key, JSON.stringify(value));
        } else {
          params.set(key, value);
        }
      }
    });
    
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);
  
  // Update individual filter
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Update multiple filters at once
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);
  
  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({
      search: '',
      sort: '',
      status: [],
      category: '',
      dateRange: null,
      priority: '',
      amountRange: null,
      ...initialFilters
    });
  }, [initialFilters]);
  
  // Clear specific filter
  const clearFilter = useCallback((key) => {
    setFilters(prev => ({ ...prev, [key]: '' }));
  }, []);
  
  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'search') return value !== '';
      if (key === 'sort') return value !== '';
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return value !== null;
      return value !== '';
    });
  }, [filters]);
  
  // Get count of active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'search' && value !== '') count++;
      else if (key === 'sort' && value !== '') count++;
      else if (Array.isArray(value) && value.length > 0) count++;
      else if (typeof value === 'object' && value !== null) count++;
      else if (value !== '') count++;
    });
    return count;
  }, [filters]);
  
  // Generate API query
  const apiQuery = useMemo(() => {
    return generateApiQuery(filters);
  }, [filters]);
  
  // Apply filters to data (client-side filtering)
  const applyFilters = useCallback((data = []) => {
    return data.filter(item => {
      // Search filter
      if (filters.search) {
        const searchFields = filterConfig[FILTER_TYPES.SEARCH]?.fields || ['name'];
        const searchMatch = searchFields.some(field => {
          const value = getNestedValue(item, field);
          return value && value.toString().toLowerCase().includes(filters.search.toLowerCase());
        });
        if (!searchMatch) return false;
      }
      
      // Status filter
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(item.status)) return false;
      }
      
      // Category filter
      if (filters.category) {
        if (item.projectType !== filters.category && item.type !== filters.category) {
          return false;
        }
      }
      
      // Priority filter
      if (filters.priority) {
        if (item.priority !== filters.priority) return false;
      }
      
      // Date range filter
      if (filters.dateRange) {
        const dateField = filterConfig[FILTER_TYPES.DATE_RANGE]?.field || 'createdAt';
        const itemDate = new Date(getNestedValue(item, dateField));
        const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
        const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;
        
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
      }
      
      // Amount range filter
      if (filters.amountRange) {
        const amountField = filterConfig[FILTER_TYPES.AMOUNT]?.field || 'amount';
        const amount = getNestedValue(item, amountField) || 0;
        
        if (filters.amountRange.min && amount < filters.amountRange.min) return false;
        if (filters.amountRange.max && amount > filters.amountRange.max) return false;
      }
      
      return true;
    });
  }, [filters, filterConfig]);
  
  // Sort data
  const sortData = useCallback((data = []) => {
    if (!filters.sort) return data;
    
    const sortOption = Object.values(SORT_OPTIONS).find(
      opt => opt.value === filters.sort
    );
    
    if (!sortOption) return data;
    
    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortOption.field);
      const bValue = getNestedValue(b, sortOption.field);
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOption.direction * aValue.localeCompare(bValue);
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortOption.direction * (aValue.getTime() - bValue.getTime());
      }
      
      if (aValue < bValue) return -sortOption.direction;
      if (aValue > bValue) return sortOption.direction;
      return 0;
    });
  }, [filters.sort]);
  
  return {
    // State
    filters,
    apiQuery,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    
    // Actions
    updateFilter,
    updateFilters,
    clearAllFilters,
    clearFilter,
    
    // Data processing
    applyFilters,
    sortData,
    
    // Combined processing
    process: useCallback((data) => {
      const filtered = applyFilters(data);
      return sortData(filtered);
    }, [applyFilters, sortData])
  };
};

// Helper function to get nested object values
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

export default useFilters;
