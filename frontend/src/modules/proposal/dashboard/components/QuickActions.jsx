import React from 'react';
import { PlusCircle, FileText, Users, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../shared/components/Card/Card';

const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    { label: 'Create Proposal', icon: PlusCircle, path: '/proposal', color: 'text-[var(--primary)]', bg: 'bg-[var(--primary)]/10' },
    { label: 'View Templates', icon: FileText, path: '/proposal/templates', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Client List', icon: Users, path: '/proposal/clients', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Pending Approvals', icon: ShieldCheck, path: '/proposal/approval', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <Card className="h-full">
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6">Quick Actions</h3>
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
