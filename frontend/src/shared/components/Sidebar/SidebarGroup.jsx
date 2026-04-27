import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import SidebarItem from './SidebarItem';

const SidebarGroup = ({ 
  item, 
  active, 
  expanded, 
  onToggle, 
  onSelect,
  depth = 0 
}) => {
  const { id, label, icon: Icon, children, path } = item;
  const isExpanded = expanded.includes(id);
  
  // Check if this group or any of its children are active
  const hasActiveChild = (items) => {
    return items.some(child => {
      if (child.id === active) return true;
      if (child.children) return hasActiveChild(child.children);
      return false;
    });
  };

  const isGroupActive = hasActiveChild(children || []);
  const isActive = active === id || isGroupActive;
  
  const indentation = depth === 0 ? 'px-4' : depth === 1 ? 'pl-8 pr-4' : 'pl-12 pr-4';

  // Automatically expand if a child is active
  useEffect(() => {
    if (isGroupActive && !isExpanded) {
      onToggle(id);
    }
  }, [isGroupActive, id]);

  return (
    <div className={`mb-1 transition-colors duration-200 ${isExpanded || isGroupActive ? 'bg-[var(--sidebar-hover)]/40 rounded-2xl py-1' : ''}`}>
      <button
        onClick={() => children ? onToggle(id) : onSelect(id, path)}
        className={`
          relative w-full flex items-center gap-3 py-3 rounded-xl text-sm font-medium
          transition-all duration-150 ${indentation}
          ${isActive || isExpanded
            ? 'text-[var(--primary)]'
            : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
          }
        `}
      >
        {/* Active Left Border for top-level active group */}
        {depth === 0 && (isActive || isExpanded) && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[60%] bg-[var(--primary)] rounded-r-md" />
        )}
        
        {Icon && <Icon size={depth === 0 ? 20 : 18} strokeWidth={(isActive || isExpanded) ? 2 : 1.5} className="shrink-0" />}
        <span className={`flex-1 text-left ${depth === 0 ? 'text-[15px]' : 'text-sm'}`}>{label}</span>
        
        {children && (
          <div className="shrink-0">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      {children && (
        <div className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isExpanded ? 'max-h-[1000px] opacity-100 mt-1 mb-1' : 'max-h-0 opacity-0'}
        `}>
          <div className="px-2 space-y-0.5">
            {children.map((child) => (
              child.children ? (
                <SidebarGroup
                  key={child.id}
                  item={child}
                  active={active}
                  expanded={expanded}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              ) : (
                <SidebarItem
                  key={child.id}
                  {...child}
                  active={active}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarGroup;
