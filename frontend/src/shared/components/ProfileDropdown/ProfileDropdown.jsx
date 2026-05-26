import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  User, Settings, LogOut, ChevronDown,
  ChevronRight, Users, Key,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../Avatar/Avatar';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useAuth } from '../../context/AuthContext';

// ─── Shared menu item ─────────────────────────────────────────────────────────
const DropItem = ({ icon: Icon, label, onClick, variant = 'default', rightIcon: RightIcon, dark = false }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium
      transition-colors duration-150 rounded-xl
      ${variant === 'danger'
        ? 'text-[var(--error)] hover:bg-[var(--error)]/10'
        : dark
          ? 'hover:bg-[var(--sidebar-hover)]'
          : 'text-[var(--text-primary)] hover:bg-[var(--bg)]'
      }
    `}
    style={variant !== 'danger' && dark ? { color: 'var(--sidebar-text)' } : {}}
  >
    {Icon && (
      <Icon
        size={18}
        className={variant === 'danger' ? 'text-[var(--error)]' : dark ? 'opacity-60' : 'text-[var(--text-muted)]'}
        style={variant !== 'danger' && dark ? { color: 'var(--sidebar-text-muted)' } : {}}
      />
    )}
    <span className="flex-1 text-left">{label}</span>
    {RightIcon && <RightIcon size={14} className="opacity-50 shrink-0" />}
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────
const ProfileDropdown = ({
  user,
  showDetails = true,
  position    = 'right',
  side        = 'bottom',
  variant     = 'navbar',
  usePortal   = false,
}) => {
  const [isOpen,        setIsOpen]        = useState(false);
  const [settingsOpen,  setSettingsOpen]  = useState(false);
  const [portalPos,     setPortalPos]     = useState({ bottom: 0, left: 0 });

  const wrapperRef   = useRef(null);
  const triggerRef   = useRef(null);
  const panelRef     = useRef(null);
  const submenuTimer = useRef(null);
  const navigate     = useNavigate();
  const { logout }   = useAuth();
  const isSidebar    = variant === 'sidebar';
  const dark         = usePortal; // portal = collapsed sidebar = dark theme

  // ── Outside-click ──────────────────────────────────────────────────────────
  useClickOutside(wrapperRef, () => {
    if (!usePortal) { setIsOpen(false); setSettingsOpen(false); }
  });

  useEffect(() => {
    if (!usePortal) return;
    const handler = (e) => {
      const inWrapper = wrapperRef.current?.contains(e.target);
      const inPanel   = panelRef.current?.contains(e.target);
      if (!inWrapper && !inPanel) { setIsOpen(false); setSettingsOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [usePortal]);

  // ── Non-portal position helpers ────────────────────────────────────────────
  const positionClass = { right: 'right-0', left: 'left-0', center: 'left-1/2 -translate-x-1/2' }[position] ?? 'right-0';
  const sideClass     = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  // ── Trigger styles ─────────────────────────────────────────────────────────
  const triggerHover  = isSidebar ? 'hover:bg-[var(--sidebar-hover)]' : 'hover:bg-[var(--bg)]';
  const triggerActive = isSidebar ? 'bg-[var(--sidebar-hover)]'       : 'bg-[var(--bg)]';
  const nameColor     = isSidebar ? 'text-[var(--sidebar-text)]'      : 'text-[var(--text-primary)]';
  const roleColor     = isSidebar ? 'text-[var(--sidebar-text-muted)]': 'text-[var(--text-muted)]';

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleToggle = () => {
    if (usePortal && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPortalPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left });
    }
    setIsOpen((p) => !p);
  };

  const handleLogout = () => { logout(); setIsOpen(false); setSettingsOpen(false); };
  const handleNav    = (path) => { navigate(path); setIsOpen(false); setSettingsOpen(false); };
  const openSubmenu  = () => { clearTimeout(submenuTimer.current); setSettingsOpen(true); };
  const closeSubmenu = () => { submenuTimer.current = setTimeout(() => setSettingsOpen(false), 150); };

  // ── Dropdown panel ─────────────────────────────────────────────────────────
  const panel = (
    <div
      ref={panelRef}
      className={`
        ${usePortal
          ? 'fixed z-[99999]'
          : `absolute z-50 ${positionClass} ${sideClass}`
        }
        min-w-[200px] rounded-2xl shadow-xl p-1.5
        animate-in fade-in zoom-in-95 duration-100
        border
      `}
      style={
        usePortal
          ? { bottom: portalPos.bottom, left: portalPos.left,
              backgroundColor: 'var(--sidebar-bg)',
              borderColor: 'var(--sidebar-hover)' }
          : { backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)' }
      }
    >
      <DropItem icon={User} label="Profile" onClick={() => handleNav('/profile')} dark={dark} />

      {!isSidebar && (
        <div className="relative" onMouseEnter={openSubmenu} onMouseLeave={closeSubmenu}>
          <DropItem icon={Settings} label="Settings" rightIcon={ChevronRight} onClick={() => handleNav('/settings/users')} dark={dark} />
          {settingsOpen && (
            <div
              className="absolute right-full top-0 z-[60] min-w-[210px] rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150 p-1.5 border"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              onMouseEnter={openSubmenu}
              onMouseLeave={closeSubmenu}
            >
              <div className="px-3 pt-2 pb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Settings</p>
              </div>
              <DropItem icon={Users} label="User Management"     onClick={() => handleNav('/settings/users')} />
              <DropItem icon={Key}   label="Roles & Permissions" onClick={() => handleNav('/settings/roles-permissions')} />
            </div>
          )}
        </div>
      )}

      <div className="my-1 mx-2 border-t" style={{ borderColor: dark ? 'var(--sidebar-hover)' : 'var(--border)' }} />
      <DropItem icon={LogOut} label="Logout" onClick={handleLogout} variant="danger" dark={dark} />
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={wrapperRef}>

      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className={`
          flex items-center rounded-xl w-full transition-all duration-200
          ${showDetails ? 'gap-2.5 px-2.5 py-2' : 'justify-center p-2'}
          ${triggerHover} ${isOpen ? triggerActive : ''}
        `}
      >
        <Avatar name={user.name} size="sm" className="bg-[var(--primary)] text-black shrink-0" />
        {showDetails && (
          <>
            <div className="text-left hidden sm:block">
              <p className={`text-sm font-semibold ${nameColor} leading-tight whitespace-nowrap`}>{user.name}</p>
              <p className={`text-xs ${roleColor} capitalize`}>{user.role}</p>
            </div>
            <ChevronDown
              size={14}
              className={`${roleColor} hidden sm:block transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {/* Panel */}
      {isOpen && (usePortal ? ReactDOM.createPortal(panel, document.body) : panel)}
    </div>
  );
};

export default ProfileDropdown;
