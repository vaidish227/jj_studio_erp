import React from 'react';
import { PlusCircle, FileText, Users, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../shared/components/Card/Card';

const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    { label: 'Create Proposal', icon: PlusCircle, path: '/proposal/create', color: 'text-[var(--primary)]', bg: 'bg-[var(--primary)]/10' },
    { label: 'View Templates', icon: FileText, path: '/proposal/templates', color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
    { label: 'Client List', icon: Users, path: '/proposal/clients', color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
    { label: 'Pending Approvals', icon: ShieldCheck, path: '/proposal/approval', color: 'text-[var(--warning)]', bg: 'bg-[var(--warning)]/10' },
  ];

  return (
    <Card className="h-full">
      <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={idx}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl ${action.bg} ${action.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <Icon size={20} />
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)] text-center group-hover:text-[var(--primary)]">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default QuickActions;
