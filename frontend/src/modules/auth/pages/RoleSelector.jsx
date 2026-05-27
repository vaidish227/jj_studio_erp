import React from 'react';
import { Shield, Crown, Briefcase, TrendingUp, Calculator, Palette, ClipboardList } from 'lucide-react';

const roles = [
  { id: 'admin',      label: 'Admin',      icon: Shield },
  { id: 'md',         label: 'MD',         icon: Crown },
  { id: 'manager',    label: 'Manager',    icon: Briefcase },
  { id: 'sales',      label: 'Sales',      icon: TrendingUp },
  { id: 'accounts',   label: 'Accounts',   icon: Calculator },
  { id: 'designer',   label: 'Designer',   icon: Palette },
  { id: 'supervisor', label: 'Supervisor', icon: ClipboardList },
];

const RoleSelector = ({ selectedRole, onChange }) => {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-semibold text-[var(--text-primary)] ml-0.5">
        Select Role
      </label>
      <div className="grid grid-cols-4 gap-2">
        {roles.map((role) => {
          const Icon = role.icon;
          const isActive = selectedRole === role.id;

          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onChange(role.id)}
              className={`
                flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border-2 transition-all duration-200
                ${isActive
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-black font-bold shadow-md shadow-[var(--primary)]/20'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] font-semibold leading-none">{role.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RoleSelector;
