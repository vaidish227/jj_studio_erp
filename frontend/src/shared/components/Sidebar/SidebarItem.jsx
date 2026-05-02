import React from 'react';

const SidebarItem = ({
  label,
  id,
  active,
  onSelect,
  depth = 0,
  path
}) => {
  const isActive = active === id;

  // Calculate indentation based on depth
  const indentation = depth === 0 ? 'pl-4' : depth === 1 ? 'pl-12' : 'pl-16';

  return (
    <button
      onClick={() => onSelect(id, path)}
      className={`
        w-full text-left pr-4 py-2.5 text-sm rounded-xl transition-all duration-200
        ${indentation}
        ${isActive
          ? 'bg-gradient-to-r from-[var(--primary)]/30 to-transparent text-[var(--primary)] font-medium'
          : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
        }
      `}
    >
      {label}
    </button>
  );
};

export default SidebarItem;
