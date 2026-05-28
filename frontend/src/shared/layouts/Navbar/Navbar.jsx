import React from 'react';
import { ChevronDown, Search, Menu } from 'lucide-react';
import Avatar from '../../components/Avatar/Avatar';
import ProfileDropdown from '../../components/ProfileDropdown/ProfileDropdown';
import NotificationBell from '../../components/NotificationBell/NotificationBell';

const Navbar = ({
  user = { name: 'Sarah Smith', role: 'Admin' },
  searchPlaceholder = 'Search leads, clients, projects...',
  searchValue = '',
  onSearch,
  onMenuToggle,
}) => {
  return (
    <header className="
      flex items-center gap-3 px-4 sm:px-6 py-3.5
      bg-[var(--surface)] border-b border-[var(--border)]
      sticky top-0 z-30
    ">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-xl hover:bg-[var(--bg)] transition-colors text-[var(--text-secondary)]"
        aria-label="Toggle menu"
      >
        <Menu size={22} />
      </button>

      {/* Search Bar */}
      <div className="flex-1 max-w-md">
        <div className="relative group">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearch?.(e.target.value)}
            className="
              w-full pl-10 pr-4 py-2.5 text-sm rounded-xl
              bg-[var(--bg)] border border-[var(--border)]
              text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]
              transition-all duration-200
            "
          />
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notification Bell */}
      <NotificationBell />

      {/* User Profile */}
      <ProfileDropdown user={user} />
    </header>
  );
};

export default Navbar;
