import { useState, useRef } from 'react';
import {
  User, Settings, LogOut, ChevronDown,
  ChevronRight, Users, Key,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../Avatar/Avatar';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useAuth } from '../../context/AuthContext';

// ─── Shared menu item ────────────────────────────────────────────────────────
const DropItem = ({ icon: Icon, label, onClick, variant = 'default', rightIcon: RightIcon }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-150 rounded-xl ${
      variant === 'danger'
        ? 'text-[var(--error)] hover:bg-[var(--error)]/5'
        : 'text-[var(--text-primary)] hover:bg-[var(--bg)]'
    }`}
  >
    {Icon && (
      <Icon
        size={18}
        className={variant === 'danger' ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}
      />
    )}
    <span className="flex-1 text-left">{label}</span>
    {RightIcon && <RightIcon size={14} className="text-[var(--text-muted)] shrink-0" />}
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────
const ProfileDropdown = ({
  user,
  showDetails = true,
  position = 'right',
  side = 'bottom',
  variant = 'navbar',
}) => {
  const [isOpen, setIsOpen]         = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownRef  = useRef(null);
  const submenuTimer = useRef(null);
  const navigate     = useNavigate();
  const { logout }   = useAuth();
  const isSidebar    = variant === 'sidebar';

  useClickOutside(dropdownRef, () => {
    setIsOpen(false);
    setSettingsOpen(false);
  });

  // ─── Position helpers ────────────────────────────────────────────────────
  const positionClass = {
    right:  'right-0',
    left:   'left-0',
    center: 'left-1/2 -translate-x-1/2',
  }[position] ?? 'right-0';

  const sideClass = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  // ─── Trigger button styles (sidebar vs navbar) ───────────────────────────
  const triggerHover  = isSidebar ? 'hover:bg-[var(--sidebar-hover)]' : 'hover:bg-[var(--bg)]';
  const triggerActive = isSidebar ? 'bg-[var(--sidebar-hover)]'       : 'bg-[var(--bg)]';
  const nameColor     = isSidebar ? 'text-[var(--sidebar-text)]'      : 'text-[var(--text-primary)]';
  const roleColor     = isSidebar ? 'text-[var(--sidebar-text-muted)]': 'text-[var(--text-muted)]';

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleLogout = () => {
    logout();
    setIsOpen(false);
    setSettingsOpen(false);
  };

  const handleNav = (path) => {
    navigate(path);
    setIsOpen(false);
    setSettingsOpen(false);
  };

  // Debounced submenu — gives the mouse 150 ms to travel into the flyout
  const openSubmenu = () => {
    clearTimeout(submenuTimer.current);
    setSettingsOpen(true);
  };

  const scheduleClose = () => {
    submenuTimer.current = setTimeout(() => setSettingsOpen(false), 150);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── Trigger ── */}
      <button
        onClick={() => setIsOpen((p) => !p)}
        className={`
          flex items-center gap-2.5 px-2.5 py-2 rounded-xl w-full
          ${triggerHover} transition-all duration-200
          ${isOpen ? triggerActive : ''}
        `}
      >
        <Avatar name={user.name} size="sm" className="bg-[var(--primary)] text-black shrink-0" />
        {showDetails && (
          <>
            <div className="text-left hidden sm:block">
              <p className={`text-sm font-semibold ${nameColor} leading-tight whitespace-nowrap`}>
                {user.name}
              </p>
              <p className={`text-xs ${roleColor} capitalize`}>{user.role}</p>
            </div>
            <ChevronDown
              size={14}
              className={`${roleColor} hidden sm:block transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {/* ── Dropdown panel ────────────────────────────────────────────────── */}
      {/* NOTE: no overflow-hidden here — it would clip the Settings flyout submenu */}
      {isOpen && (
        <div className={`
          absolute z-50 min-w-[200px]
          bg-[var(--surface)] border border-[var(--border)]
          rounded-2xl shadow-xl shadow-black/10
          animate-in fade-in zoom-in-95 duration-100
          p-1.5
          ${positionClass} ${sideClass}
        `}>

          {/* Profile */}
          <DropItem
            icon={User}
            label="Profile"
            onClick={() => handleNav('/profile')}
          />

          {/* Settings — flyout submenu in navbar only (sidebar uses its own nav submenu) */}
          {!isSidebar && (
            <div
              className="relative"
              onMouseEnter={openSubmenu}
              onMouseLeave={scheduleClose}
            >
              {/* Settings row */}
              <DropItem
                icon={Settings}
                label="Settings"
                rightIcon={ChevronRight}
                onClick={() => handleNav('/settings/users')}
              />

              {/* Flyout — appears to the LEFT; right: 100% relative to this container */}
              {settingsOpen && (
                <div
                  className="absolute right-full top-0 z-[60] min-w-[210px] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl shadow-black/10 overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150 p-1.5"
                  onMouseEnter={openSubmenu}
                  onMouseLeave={scheduleClose}
                >
                  <div className="px-3 pt-2 pb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Settings
                    </p>
                  </div>
                  <DropItem
                    icon={Users}
                    label="User Management"
                    onClick={() => handleNav('/settings/users')}
                  />
                  <DropItem
                    icon={Key}
                    label="Roles & Permissions"
                    onClick={() => handleNav('/settings/roles')}
                  />
                </div>
              )}
            </div>
          )}

          {/* Divider + Logout */}
          <div className="my-1 mx-2 border-t border-[var(--border)]" />
          <DropItem
            icon={LogOut}
            label="Logout"
            onClick={handleLogout}
            variant="danger"
          />

        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
