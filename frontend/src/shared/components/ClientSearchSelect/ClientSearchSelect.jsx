import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, User, Loader2 } from 'lucide-react';
import { crmService } from '../../services/crmService';

/**
 * Async client search dropdown.
 * Calls GET /api/clients/get with a search param and lets the user pick a CRMClient.
 *
 * Props:
 *   value        — selected client object (or null)
 *   onChange     — (client) => void
 *   placeholder  — string
 *   className    — extra wrapper class
 */
const ClientSearchSelect = ({ value, onChange, placeholder = 'Search client by name or phone...', className = '' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await crmService.getLeads({ search: term, limit: 10 });
      // API returns { clients } or { leads } — handle both
      const list = res?.clients || res?.leads || [];
      setResults(list);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (client) => {
    onChange(client);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  // Show selected value as a pill, not in the input
  if (value) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 bg-[var(--surface)] border border-[var(--primary)]/40 rounded-xl ${className}`}>
        <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0">
          <User size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)] truncate">{value.name}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">{value.trackingId} · {value.phone}</p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] transition-all text-sm"
        />
        {isLoading && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (query.length >= 2) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.length === 0 && !isLoading && (
            <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              No clients found for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((client) => (
            <button
              key={client._id}
              type="button"
              onClick={() => handleSelect(client)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--primary)]/5 transition-colors text-left border-b border-[var(--border)] last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] text-xs font-bold shrink-0">
                {client.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">{client.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {client.trackingId} · {client.phone} · {client.city || client.projectType || ''}
                </p>
              </div>
              <span className={[
                'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                client.status === 'converted' ? 'bg-emerald-100 text-emerald-700' :
                client.status === 'new' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              ].join(' ')}>
                {client.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientSearchSelect;
