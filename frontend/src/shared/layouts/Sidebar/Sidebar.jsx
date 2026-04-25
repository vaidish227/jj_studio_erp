import React, { useState } from 'react';
import {
  LayoutDashboard, Users, UserCheck, Briefcase,
  CheckSquare, BarChart2, Settings,
  ChevronDown, ChevronUp, X,
} from 'lucide-react';
import Avatar from '../../components/Avatar/Avatar';

// ─── Navigation Config ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'crm', label: 'CRM', icon: Users,
    children: [
      { id: 'new-leads',   label: 'New Leads' },
      { id: 'contacted',   label: 'Contacted' },
      { id: 'meetings',    label: 'Meetings' },
      { id: 'follow-ups',  label: 'Follow-ups' },
      { id: 'qualified',   label: 'Qualified (KIT)' },
      { id: 'proposal',    label: 'Proposal' },
      { id: 'converted',   label: 'Converted' },
      { id: 'lost-leads',  label: 'Lost Leads' },
    ],
  },
  { id: 'clients',  label: 'Clients',  icon: UserCheck, children: [] },
  { id: 'projects', label: 'Projects', icon: Briefcase },
  { id: 'tasks',    label: 'Tasks',    icon: CheckSquare },
  { id: 'reports',  label: 'Reports',  icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ─── Sub Item ─────────────────────────────────────────────────────────────────
const SubItem = ({ item, active, onSelect }) => {
  const isActive = active === item.id;
  return (
    <button
      onClick={() => onSelect(item.id)}
      className={`
        w-full text-left pl-12 pr-4 py-2.5 text-sm rounded-xl transition-all duration-200
        ${isActive
          ? 'bg-gradient-to-r from-[var(--primary)]/30 to-transparent text-[var(--primary)] font-medium'
          : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
        }
      `}
    >
      {item.label}
    </button>
  );
};

// ─── Nav Item ─────────────────────────────────────────────────────────────────
const NavItem = ({ item, active, expanded, onSelect, onToggle }) => {
  const Icon = item.icon;
  const hasChildren = item.children?.length > 0;
  
  // Check if this group contains the active item
  const isGroupActive = hasChildren && item.children.some((child) => child.id === active);
  
  // The header is 'active' (gold text, border) if it's explicitly selected, or if a child is selected.
  // In many CRM designs, if it's expanded, the header also gets highlighted. Let's highlight it if active or expanded.
  const isActive = active === item.id || isGroupActive;
  const isExpanded = expanded.includes(item.id);

  // We show the group background box if it's expanded OR if it's active.
  const showGroupStyling = hasChildren && (isExpanded || isGroupActive);

  return (
    <div className={`mb-1 transition-colors duration-200 ${showGroupStyling ? 'bg-[var(--sidebar-hover)]/40 rounded-2xl py-1' : ''}`}>
      <button
        onClick={() => hasChildren ? onToggle(item.id) : onSelect(item.id)}
        className={`
          relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
          transition-all duration-150
          ${isActive || (hasChildren && isExpanded)
            ? 'text-[var(--primary)]'
            : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
          }
        `}
      >
        {/* Active Left Border for the group header */}
        {(isActive || (hasChildren && isExpanded)) && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[60%] bg-[var(--primary)] rounded-r-md" />
        )}
        
        <Icon size={20} strokeWidth={(isActive || (hasChildren && isExpanded)) ? 2 : 1.5} className="shrink-0" />
        <span className="flex-1 text-left text-[15px]">{item.label}</span>
        
        {hasChildren && (
          <div className="shrink-0">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div className="mt-1 mb-1 px-2 space-y-0.5">
          {item.children.map((child) => (
            <SubItem key={child.id} item={child} active={active} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = ({
  activeItem,
  onSelect,
  isMobileOpen = false,
  onMobileClose,
  user = { name: 'Sarah Smith', role: 'Admin' },
}) => {
  const [expanded, setExpanded] = useState(['crm']);

  const handleToggle = (id) =>
    setExpanded((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const handleSelect = (id) => {
    onSelect(id);
    onMobileClose?.(); // close drawer on mobile after selection
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
        {/* Close button — only on mobile */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)]"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={activeItem}
            expanded={expanded}
            onSelect={handleSelect}
            onToggle={handleToggle}
          />
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
      {/* ── DESKTOP: always visible ── */}
      <div className="hidden lg:flex w-64 shrink-0 min-h-screen">
        {sidebarContent}
      </div>

      {/* ── MOBILE: overlay drawer ── */}
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden
          ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onMobileClose}
      />
      {/* Drawer */}
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
