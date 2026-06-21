import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ProfileDropdown from '../../components/ProfileDropdown/ProfileDropdown';
import NotificationBell from '../../components/NotificationBell/NotificationBell';
import { resolveBreadcrumb } from '../../constants/navigation';

const Navbar = ({
  user = { name: 'Sarah Smith', role: 'Admin' },
  onMenuToggle,
}) => {
  const { pathname } = useLocation();
  const { group, title } = resolveBreadcrumb(pathname);

  return (
    <header className="
      flex items-center gap-3 px-4 sm:px-6 py-3
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

      {/* Page context — shows where you are. When the page sits in a nav group, the
          breadcrumb path already names the page, so we show only that (the page itself
          renders the big hero title). Top-level pages with no group keep a plain title. */}
      <div className="min-w-0">
        {group ? (
          <div className="flex items-center gap-1.5 text-sm leading-tight truncate -tracking-[0.01em]">
            <span className="text-[var(--text-muted)] truncate">{group}</span>
            <span className="text-[var(--text-muted)] opacity-50">/</span>
            <span className="font-bold text-[var(--text-primary)] truncate">{title}</span>
          </div>
        ) : (
          <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight truncate -tracking-[0.01em]">
            {title}
          </h1>
        )}
      </div>

      {/* Spacer — keeps bell + profile pinned right */}
      <div className="flex-1" />

      {/* Notification Bell */}
      <NotificationBell />

      {/* User Profile */}
      <ProfileDropdown user={user} />
    </header>
  );
};

export default Navbar;
