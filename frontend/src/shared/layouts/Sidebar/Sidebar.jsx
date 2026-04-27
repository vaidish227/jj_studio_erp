import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import Avatar from '../../components/Avatar/Avatar';
import SidebarGroup from '../../components/Sidebar/SidebarGroup';
import SidebarItem from '../../components/Sidebar/SidebarItem';
import { NAV_ITEMS } from '../../constants/navigation';

const Sidebar = ({
  activeItem,
  onSelect,
  isMobileOpen = false,
  onMobileClose,
  user = { name: 'Sarah Smith', role: 'Admin' },
}) => {
  const [expanded, setExpanded] = useState(['crm', 'forms']);

  const handleToggle = (id) =>
    setExpanded((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const handleSelect = (id, path) => {
    onSelect(id, path);
    onMobileClose?.();
  };

  const sidebarContent = (
    <aside className="flex flex-col w-64 h-full bg-[var(--sidebar-bg)]">
      {/* Logo + Mobile Close */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--sidebar-hover)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center text-black font-black text-sm shrink-0">
            ID
          </div>
          <div>
            <p className="text-[var(--sidebar-text)] font-bold text-sm leading-tight">InteriorDash</p>
            <p className="text-[var(--sidebar-text-muted)] text-xs">CRM System</p>
          </div>
        </div>
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)]"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => (
          item.children ? (
            <SidebarGroup
              key={item.id}
              item={item}
              active={activeItem}
              expanded={expanded}
              onToggle={handleToggle}
              onSelect={handleSelect}
            />
          ) : (
            <SidebarItem
              key={item.id}
              {...item}
              active={activeItem}
              onSelect={handleSelect}
            />
          )
        ))}
      </nav>

      {/* User Profile */}
      <div className="px-3 py-4 border-t border-[var(--sidebar-hover)]">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--sidebar-hover)] transition-colors">
          <Avatar name={user.name} size="sm" className="bg-[var(--primary)] text-black" />
          <div className="flex-1 text-left">
            <p className="text-[var(--sidebar-text)] text-sm font-semibold leading-tight">{user.name}</p>
            <p className="text-[var(--sidebar-text-muted)] text-xs">{user.role}</p>
          </div>
          <ChevronDown size={14} className="text-[var(--sidebar-text-muted)]" />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden lg:flex w-64 shrink-0 min-h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* ── MOBILE ── */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden
          ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onMobileClose}
      />
      <div
        className={`
          fixed top-0 left-0 z-50 h-full w-64 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
