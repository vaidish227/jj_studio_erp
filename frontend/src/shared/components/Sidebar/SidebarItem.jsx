import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

// ── Label flyout portalled into document.body ────────────────────────────────
const CollapsedLabel = ({ label, icon: Icon, isActive, onSelect, id, path, onClose, top }) =>
  ReactDOM.createPortal(
    <div
      style={{ top, left: 72, backgroundColor: 'var(--sidebar-bg)' }}
      className="fixed z-[99999] rounded-2xl shadow-2xl overflow-hidden
                 border border-[var(--sidebar-hover)]"
      onMouseEnter={onClose.cancel}
      onMouseLeave={onClose.schedule}
    >
      <button
        onClick={() => { onSelect(id, path); onClose.now(); }}
        className="flex items-center gap-3 px-4 py-3 text-sm font-semibold
                   whitespace-nowrap min-w-[140px] transition-colors duration-150"
        style={{ color: isActive ? 'var(--primary)' : 'var(--sidebar-text)' }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {Icon && <Icon size={16} className="shrink-0" />}
        {label}
      </button>
    </div>,
    document.body
  );

const SidebarItem = ({
  label,
  id,
  icon: Icon,
  active,
  onSelect,
  depth = 0,
  path,
  collapsed = false,
}) => {
  const isActive = active === id;

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

  // ── COLLAPSED depth-0 icon-only mode ─────────────────────────────────────
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
            onClick={() => onSelect(id, path)}
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

        {flyoutOpen && (
          <CollapsedLabel
            label={label}
            icon={Icon}
            isActive={isActive}
            onSelect={onSelect}
            id={id}
            path={path}
            onClose={flyoutControls}
            top={flyoutTop}
          />
        )}
      </>
    );
  }

  // ── EXPANDED / child items ────────────────────────────────────────────────
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
