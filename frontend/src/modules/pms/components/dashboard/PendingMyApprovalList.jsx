import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, FileText, ClipboardCheck, ShoppingBag, ArrowRight } from 'lucide-react';

/**
 * PendingMyApprovalList â€” items waiting for the current user's sign-off:
 * Drawings (sent_for_approval), Tasks (pending_review), Vendor quotations.
 *
 * Items are sorted oldest-first (worst-aged on top) by the controller.
 */

const KIND_META = {
  drawing: { icon: FileText,       tone: 'text-[var(--primary)]'     },
  task:    { icon: ClipboardCheck, tone: 'text-[var(--accent-blue)]' },
  vendor:  { icon: ShoppingBag,    tone: 'text-[var(--warning)]'     },
};

const ageBadge = (ageMs) => {
  if (!ageMs || ageMs < 0) return { label: 'New', cls: 'bg-[var(--success)]/15 text-[var(--success)]' };
  const hours = Math.floor(ageMs / 3600000);
  if (hours < 1)   return { label: '< 1h', cls: 'bg-[var(--success)]/15 text-[var(--success)]' };
  if (hours < 24)  return { label: `${hours}h`, cls: 'bg-[var(--success)]/15 text-[var(--success)]' };
  const days = Math.floor(hours / 24);
  if (days <= 1)   return { label: '1d', cls: 'bg-[var(--warning)]/15 text-[var(--warning)]' };
  if (days <= 3)   return { label: `${days}d`, cls: 'bg-[var(--warning)]/15 text-[var(--warning)]' };
  return { label: `${days}d`, cls: 'bg-[var(--error)]/15 text-[var(--error)]' };
};

const Item = ({ item }) => {
  const navigate = useNavigate();
  const meta = KIND_META[item.kind] || KIND_META.drawing;
  const Icon = meta.icon;
  const age  = ageBadge(item.ageMs);

  return (
    <button
      type="button"
      onClick={() => item.link && navigate(item.link)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)]/60 transition-colors border-b border-[var(--border)] last:border-b-0"
    >
      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg)] border border-[var(--border)] ${meta.tone}`}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[var(--text-primary)] truncate leading-tight">
          {item.title}
        </p>
        <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
          {item.subtitle || 'â€”'}
        </p>
      </div>
      <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${age.cls}`}>
        {age.label}
      </span>
    </button>
  );
};

const PendingMyApprovalList = ({ items = [] }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Inbox size={16} className="text-[var(--primary)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Pending My Approval</h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {items.length} {items.length === 1 ? 'item' : 'items'} waiting
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox size={28} className="mx-auto text-[var(--text-muted)] opacity-60 mb-2" />
            <p className="text-sm text-[var(--text-muted)]">All caught up.</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Nothing waiting on you.</p>
          </div>
        ) : (
          items.map((it) => <Item key={`${it.kind}-${it._id}`} item={it} />)
        )}
      </div>

      {items.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg)]/40">
          <button
            type="button"
            onClick={() => navigate('/pms/review-design')}
            className="w-full inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
          >
            Open Review Queue <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PendingMyApprovalList;
