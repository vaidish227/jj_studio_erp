import { useNavigate } from 'react-router-dom';
import { Users, Shield, ChevronRight } from 'lucide-react';
import usePermission from '../../../shared/hooks/usePermission';

const SETTINGS_CARDS = [
  {
    id: 'users',
    icon: Users,
    title: 'User Management',
    description: 'Create and manage user accounts, assign roles, and control team access.',
    path: '/settings/users',
    color: '#3A6EA5',
  },
  {
    id: 'roles',
    icon: Shield,
    title: 'Roles & Permissions',
    description: 'Define role permissions, manage module access, and configure what each role can do.',
    path: '/settings/roles-permissions',
    color: '#D4B76C',
  },
];

const SettingsPage = () => {
  const navigate   = useNavigate();
  const canManage  = usePermission('users.manage');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Manage system configuration and access control.
        </p>
      </div>

      {canManage ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SETTINGS_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => navigate(card.path)}
                className="group text-left p-6 bg-[var(--surface)] border-2 border-[var(--border)] hover:border-[var(--primary)] rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${card.color}1A` }}
                  >
                    <Icon size={22} style={{ color: card.color }} />
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-[var(--border)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all mt-1 shrink-0"
                  />
                </div>
                <h2 className="font-bold text-[var(--text-primary)] text-base mb-1.5">
                  {card.title}
                </h2>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-[var(--bg)] rounded-2xl flex items-center justify-center mb-4">
            <Shield size={28} className="text-[var(--text-muted)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">No settings available</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
            Contact an administrator to access system settings.
          </p>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
