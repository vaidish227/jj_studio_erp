import React from 'react';
import {
  PlusCircle,
  FileText,
  Users,
  ShieldCheck,
  ChevronRight,
  Send,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../shared/components/Card/Card';

const QuickActions = ({ pendingCount = 0, esignCount = 0 }) => {
  const navigate = useNavigate();

  // Secondary actions — shown as a list under the featured CTA. A `badge` value
  // shows a live count chip on the right so the user can spot what needs attention
  // without leaving the dashboard.
  const actions = [
    {
      label: 'Manager Approval',
      description: 'Review and decide on pending proposals',
      icon: ShieldCheck,
      path: '/proposal/list?milestone=pending_approval',
      color: 'text-[var(--warning)]',
      bg: 'bg-[var(--warning)]/10',
      badge: pendingCount,
      badgeTone: 'bg-[var(--warning)]/15 text-[var(--warning)]',
    },
    {
      label: 'Sent & eSign Track',
      description: 'Follow proposals after dispatch',
      icon: Send,
      path: '/proposal/list?milestone=sent',
      color: 'text-[var(--accent-blue)]',
      bg: 'bg-[var(--accent-blue)]/10',
      badge: esignCount,
      badgeTone: 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
    },
    {
      label: 'Quotation Templates',
      description: 'Manage reusable proposal templates',
      icon: FileText,
      path: '/proposal/templates',
      color: 'text-[var(--accent-teal)]',
      bg: 'bg-[var(--accent-teal)]/10',
    },
    {
      label: 'Draft Proposals',
      description: 'Leads ready for a proposal',
      icon: Users,
      path: '/proposal/clients',
      color: 'text-[var(--primary)]',
      bg: 'bg-[var(--primary)]/10',
    },
  ];

  return (
    <Card padding="p-0" className="overflow-hidden border-none shadow-xl shadow-black/5 bg-[var(--surface)]">
      {/* Header */}
      <div className="p-5 border-b border-[var(--border)]">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Quick Actions</h3>
        <p className="text-[10px] text-[var(--text-muted)] font-bold mt-1 uppercase tracking-widest">Jump straight into work</p>
      </div>

      {/* Featured CTA — light, clean. Soft cream background with a gold accent on
          the icon and a subtle gold border-glow on hover. Reads as primary
          without being visually heavy. */}
      <div className="p-5">
        <button
          onClick={() => navigate('/proposal/create')}
          className="relative w-full rounded-2xl overflow-hidden p-5 flex items-center justify-between
                     bg-gradient-to-br from-[var(--primary)]/8 via-[var(--surface)] to-[var(--surface)]
                     text-[var(--text-primary)]
                     border border-[var(--primary)]/20
                     shadow-[0_4px_12px_-4px_rgba(0,0,0,0.06)]
                     hover:border-[var(--primary)]/50
                     hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1),0_0_0_3px_var(--primary)/0.08]
                     hover:-translate-y-0.5 transition-all duration-300 group"
        >
          {/* very faint corner glow so it doesn't read as a flat box */}
          <span
            aria-hidden
            className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-[var(--primary)]/10 blur-2xl
                       group-hover:bg-[var(--primary)]/20 transition-colors duration-300"
          />

          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary)] text-black flex items-center justify-center
                            shadow-md shadow-[var(--primary)]/30
                            group-hover:scale-105 group-hover:rotate-3 transition-transform duration-300">
              <PlusCircle size={22} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <p className="text-[13px] font-black uppercase tracking-[0.12em] leading-none text-[var(--text-primary)]">
                Create Proposal
              </p>
              <p className="text-[11px] font-medium text-[var(--text-muted)] mt-1.5 leading-tight">
                Start a new quotation from scratch
              </p>
            </div>
          </div>

          <ChevronRight
            size={18}
            className="relative text-[var(--primary)] opacity-70
                       group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300"
          />
        </button>
      </div>

      {/* Secondary actions list */}
      <div className="px-5 pb-5 space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const hasBadge = action.badge !== undefined && action.badge > 0;
          return (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 transition-all group text-left"
            >
              <div className={`w-10 h-10 rounded-xl ${action.bg} ${action.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors leading-tight">
                  {action.label}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-medium truncate mt-0.5">
                  {action.description}
                </p>
              </div>
              {hasBadge && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${action.badgeTone} shrink-0`}>
                  {action.badge}
                </span>
              )}
              <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default QuickActions;
