import React from 'react';
import { Shield, Palette, User } from 'lucide-react';

const roles = [
  { id: 'admin', label: 'Admin', icon: Shield },
  { id: 'designer', label: 'Designer', icon: Palette },
  { id: 'user', label: 'User', icon: User },
];

const RoleSelector = ({ selectedRole, onChange }) => {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-semibold text-[var(--text-primary)] ml-0.5">
        Select Role
      </label>
      <div className="flex gap-3">
        {roles.map((role) => {
          const Icon = role.icon;
          const isActive = selectedRole === role.id;
          
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onChange(role.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all duration-200
                ${isActive 
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-black font-bold shadow-md shadow-[var(--primary)]/20' 
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-sm">{role.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RoleSelector;
