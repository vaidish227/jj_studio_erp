import React, { useState } from 'react';
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import Avatar from '../../components/Avatar/Avatar';
import ProfileDropdown from '../../components/ProfileDropdown/ProfileDropdown';
import SidebarGroup from '../../components/Sidebar/SidebarGroup';
import SidebarItem from '../../components/Sidebar/SidebarItem';
import { NAV_ITEMS } from '../../constants/navigation';
import { useAuth } from '../../context/AuthContext';
import LogoImg from '../../../assets/JJ-FINAL-LOGO-PNG.png';

const Sidebar = ({
  activeItem,
  onSelect,
  isMobileOpen = false,
  onMobileClose,
  user: userProp,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [expanded, setExpanded] = useState(['crm', 'forms']);
  const { hasPermission, user: authUser } = useAuth();

  const user = authUser || userProp || { name: 'User', role: 'sales' };

  const handleToggle = (id) =>
    setExpanded((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const handleSelect = (id, path) => {
    onSelect(id, path);
    onMobileClose?.();
  };

  const filterItem = (item) => {
    if (item.roles && Array.isArray(item.roles)) {
      return item.roles.includes(user?.role);
    }
    if (hasPermission('*')) return true;
    if (item.permission) return hasPermission(item.permission);
    return true;
  };

  const filteredNavItems = NAV_ITEMS
    .filter(filterItem)
    .map((item) => {
      if (!item.children) return item;
      const visibleChildren = item.children.filter(filterItem);
      if (visibleChildren.length === 0) return null;
      return { ...item, children: visibleChildren };
    })
    .filter(Boolean);

  const renderSidebar = (collapsed) => (
    <aside
      className={`
        flex flex-col h-full bg-[var(--sidebar-bg)] overflow-hidden
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[70px]' : 'w-64'}
      `}
    >
      {/* ── Header: Logo + Toggle / Mobile-Close ── */}
      {collapsed ? (
        /* Collapsed: logo + toggle stacked & centred — avoids overflow */
        <div className="flex flex-col items-center gap-2 py-3 border-b border-[var(--sidebar-hover)] shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
            <img src={LogoImg} alt="JJ-Studio Logo" className="w-full h-full object-contain" />
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Expand sidebar"
              className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center
                         hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)]
                         transition-colors duration-150"
            >
              <ChevronsRight size={14} />
            </button>
          )}
        </div>
      ) : (
        /* Expanded: logo left, toggle + mobile-close right */
        <div className="flex items-center justify-between px-3 py-[18px] border-b border-[var(--sidebar-hover)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
              <img src={LogoImg} alt="JJ-Studio Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[var(--sidebar-text)] font-bold text-sm leading-tight whitespace-nowrap">JJ-Studio</p>
              <p className="text-[var(--sidebar-text-muted)] text-xs whitespace-nowrap">ERP System</p>
            </div>
          </div>

          {/* Desktop collapse toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center shrink-0
                         hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)]
                         transition-colors duration-150"
            >
              <ChevronsLeft size={14} />
            </button>
          )}

          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                       hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)]
                       transition-colors duration-150"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav
        className={`
          flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden custom-scrollbar
          transition-all duration-300
          ${collapsed ? 'px-[15px]' : 'px-3'}
        `}
      >
        {filteredNavItems.map((item) =>
          item.children ? (
            <SidebarGroup
              key={item.id}
              item={item}
              active={activeItem}
              expanded={expanded}
              onToggle={handleToggle}
              onSelect={handleSelect}
              collapsed={collapsed}
            />
          ) : (
            <SidebarItem
              key={item.id}
              {...item}
              active={activeItem}
              onSelect={handleSelect}
              collapsed={collapsed}
            />
          )
        )}
      </nav>

      {/* ── Profile ── */}
      <div
        className={`
          py-3 border-t border-[var(--sidebar-hover)] shrink-0
          transition-all duration-300
          ${collapsed ? 'flex justify-center' : 'px-3'}
        `}
      >
        <ProfileDropdown
          user={user}
          position={collapsed ? 'left' : 'center'}
          side="top"
          variant="sidebar"
          showDetails={!collapsed}
          usePortal={collapsed}
        />
      </div>
    </aside>
  );

  return (
    <>
      {/* ── DESKTOP ── */}
      <div
        className={`
          hidden lg:block shrink-0 min-h-screen sticky top-0
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[70px]' : 'w-64'}
        `}
      >
        {renderSidebar(isCollapsed)}
      </div>

      {/* ── MOBILE overlay ── */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/50 backdrop-blur-sm
          transition-opacity duration-300 lg:hidden
          ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onMobileClose}
      />

      {/* ── MOBILE drawer (never collapsed) ── */}
      <div
        className={`
          fixed top-0 left-0 z-50 h-full w-64 shadow-2xl
          transition-transform duration-300 ease-in-out lg:hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {renderSidebar(false)}
      </div>
    </>
  );
};

export default Sidebar;
