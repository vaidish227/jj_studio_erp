import { Menu } from 'lucide-react';
import ProfileDropdown from '../../components/ProfileDropdown/ProfileDropdown';
import NotificationBell from '../../components/NotificationBell/NotificationBell';

const Navbar = ({
  user = { name: 'Sarah Smith', role: 'Admin' },
  onMenuToggle,
}) => (
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

    {/* Spacer — keeps bell + profile pinned right */}
    <div className="flex-1" />

    {/* Notification Bell */}
    <NotificationBell />

    {/* User Profile */}
    <ProfileDropdown user={user} />
  </header>
);

export default Navbar;
