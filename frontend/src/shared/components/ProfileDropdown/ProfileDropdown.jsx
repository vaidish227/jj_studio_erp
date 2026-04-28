import React, { useState, useRef } from 'react';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../Avatar/Avatar';
import DropdownMenu from '../Dropdown/DropdownMenu';
import MenuItem from '../Dropdown/MenuItem';
import { useClickOutside } from '../../hooks/useClickOutside';

const ProfileDropdown = ({ user, showDetails = true, position = 'right', side = 'bottom', variant = 'navbar' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const isSidebar = variant === 'sidebar';
  const bgColor = isSidebar ? 'hover:bg-[var(--sidebar-hover)]' : 'hover:bg-[var(--bg)]';
  const activeBgColor = isSidebar ? 'bg-[var(--sidebar-hover)]' : 'bg-[var(--bg)]';
  const nameColor = isSidebar ? 'text-[var(--sidebar-text)]' : 'text-[var(--text-primary)]';
  const roleColor = isSidebar ? 'text-[var(--sidebar-text-muted)]' : 'text-[var(--text-muted)]';

  const handleLogout = () => {
    // Mock logout
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2.5 px-2.5 py-2 rounded-xl w-full
          ${bgColor} transition-all duration-200
          ${isOpen ? activeBgColor : ''}
        `}
      >
        <Avatar name={user.name} size="sm" className="bg-[var(--primary)] text-black shrink-0" />
        {showDetails && (
          <>
            <div className="text-left hidden sm:block">
              <p className={`text-sm font-semibold ${nameColor} leading-tight whitespace-nowrap`}>{user.name}</p>
              <p className={`text-xs ${roleColor}`}>{user.role}</p>
            </div>
            <ChevronDown
              size={14}
              className={`${roleColor} hidden sm:block transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {isOpen && (
        <DropdownMenu position={position} side={side}>
          <MenuItem
            icon={User}
            label="Profile"
            onClick={() => {
              navigate('/profile');
              setIsOpen(false);
            }}
          />
          <MenuItem
            icon={Settings}
            label="Settings"
            onClick={() => {
              navigate('/settings');
              setIsOpen(false);
            }}
          />
          <div className="my-1 border-t border-[var(--border)]" />
          <MenuItem
            icon={LogOut}
            label="Logout"
            variant="danger"
            onClick={handleLogout}
          />
        </DropdownMenu>
      )}
    </div>
  );
};

export default ProfileDropdown;
