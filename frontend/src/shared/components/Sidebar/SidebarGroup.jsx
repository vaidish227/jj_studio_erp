import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import SidebarItem from './SidebarItem';

// ── Flyout portalled into document.body — escapes sidebar stacking context ───
const CollapsedFlyout = ({ label, children, active, onSelect, onClose, top }) => {
  const clampedTop = Math.min(top, window.innerHeight - (children.length * 40 + 60));

  return ReactDOM.createPortal(
    <div
      style={{ top: clampedTop, left: 72, backgroundColor: 'var(--sidebar-bg)' }}
      className="fixed z-[99999] min-w-[190px] max-w-[230px]
                 rounded-2xl shadow-2xl overflow-hidden
                 border border-[var(--sidebar-hover)]"
      onMouseEnter={onClose.cancel}
      onMouseLeave={onClose.schedule}
    >
      {/* Group label header */}
      <div className="px-4 pt-3 pb-2 border-b border-[var(--sidebar-hover)]">
        <p className="text-[10px] font-black uppercase tracking-widest"
           style={{ color: 'var(--primary)' }}>
          {label}
        </p>
      </div>

      {/* Child items */}
      <div className="py-1.5 px-1.5 space-y-0.5">
        {children.map((child) => (
          <button
            key={child.id}
            onClick={() => { onSelect(child.id, child.path); onClose.now(); }}
            className="w-full text-left px-3 py-2 text-sm rounded-xl transition-colors duration-150"
            style={{
              color: active === child.id ? 'var(--primary)' : 'var(--sidebar-text)',
              backgroundColor: active === child.id ? 'rgba(var(--primary-rgb, 212 183 108) / 0.15)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (active !== child.id) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            }}
            onMouseLeave={(e) => {
              if (active !== child.id) e.currentTarget.style.backgroundColor = 'transparent';
              else e.currentTarget.style.backgroundColor = 'rgba(212, 183, 108, 0.15)';
            }}
          >
            {child.label}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
};

const SidebarGroup = ({
  item,
  active,
  expanded,
  onToggle,
  onSelect,
  depth = 0,
  collapsed = false,
}) => {
  const { id, label, icon: Icon, children, path } = item;
  const isExpanded = expanded.includes(id);

  const hasActiveChild = (items) =>
    items.some((child) => {
      if (child.id === active) return true;
      if (child.children) return hasActiveChild(child.children);
      return false;
    });

  const isGroupActive = hasActiveChild(children || []);
  const isActive = active === id || isGroupActive;
  const indentation = depth === 0 ? 'px-4' : depth === 1 ? 'pl-8 pr-4' : 'pl-12 pr-4';

  useEffect(() => {
    if (isGroupActive && !isExpanded) onToggle(id);
  }, [isGroupActive, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flyout state ──────────────────────────────────────────────────────────
  const iconRef    = useRef(null);
  const closeTimer = useRef(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutTop,  setFlyoutTop]  = useState(0);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const flyoutControls = {
    cancel:   () => clearTimeout(closeTimer.current),
    schedule: () => { closeTimer.current = setTimeout(() => setFlyoutOpen(false), 150); },
    now:      () => { clearTimeout(closeTimer.current); setFlyoutOpen(false); },
  };

  const openFlyout = () => {
    clearTimeout(closeTimer.current);
    if (iconRef.current) {
      setFlyoutTop(iconRef.current.getBoundingClientRect().top);
    }
    setFlyoutOpen(true);
  };

  // ── COLLAPSED icon-only ───────────────────────────────────────────────────
  if (collapsed && depth === 0) {
    return (
      <>
        <div
          className="flex justify-center mb-1"
          onMouseEnter={openFlyout}
          onMouseLeave={flyoutControls.schedule}
        >
          <button
            ref={iconRef}
            onClick={() => {
              if (children?.length) onSelect(children[0].id, children[0].path);
              else if (path) onSelect(id, path);
            }}
            className={`
              relative w-10 h-10 flex items-center justify-center rounded-xl
              transition-all duration-200
              ${isActive
                ? 'text-[var(--primary)]'
                : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
              }
            `}
            style={isActive ? { backgroundColor: 'rgba(212,183,108,0.15)' } : {}}
          >
            {isActive && (
              <span className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-1 h-[60%] bg-[var(--primary)] rounded-r-md" />
            )}
            {Icon && <Icon size={20} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />}
          </button>
        </div>

        {flyoutOpen && children?.length > 0 && (
          <CollapsedFlyout
            label={label}
            children={children}
            active={active}
            onSelect={onSelect}
            onClose={flyoutControls}
            top={flyoutTop}
          />
        )}
      </>
    );
  }

  // ── EXPANDED mode ─────────────────────────────────────────────────────────
  return (
    <div className={`mb-1 transition-colors duration-200 ${isExpanded || isGroupActive ? 'bg-[var(--sidebar-hover)]/40 rounded-2xl py-1' : ''}`}>
      <button
        onClick={() => (children ? onToggle(id) : onSelect(id, path))}
        className={`
          relative w-full flex items-center gap-3 py-3 rounded-xl text-sm font-medium
          transition-all duration-150 ${indentation}
          ${isActive || isExpanded
            ? 'text-[var(--primary)]'
            : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
          }
        `}
      >
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
            {children.map((child) =>
              child.children ? (
                <SidebarGroup
                  key={child.id}
                  item={child}
                  active={active}
                  expanded={expanded}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  depth={depth + 1}
                  collapsed={false}
                />
              ) : (
                <SidebarItem
                  key={child.id}
                  {...child}
                  active={active}
                  onSelect={onSelect}
                  depth={depth + 1}
                  collapsed={false}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarGroup;
