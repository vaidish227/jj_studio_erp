import React from 'react';
import { Search } from 'lucide-react';

const SearchInput = ({ value, onChange, placeholder = "Search...", className = "" }) => {
  return (
    <div className={`relative group ${className}`}>
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-4 py-2.5 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all"
      />
    </div>
  );
};

export default SearchInput;
