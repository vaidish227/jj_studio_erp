import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, PenTool, CreditCard } from 'lucide-react';

const STATUS_BADGE = {
  draft:              { label: 'Draft',            className: 'bg-gray-100 text-gray-700' },
  pending_approval:   { label: 'Pending approval', className: 'bg-amber-50 text-amber-700' },
  revision_requested: { label: 'Revision',         className: 'bg-orange-50 text-orange-700' },
  manager_approved:   { label: 'Approved',         className: 'bg-emerald-50 text-emerald-700' },
  sent:               { label: 'Sent',             className: 'bg-blue-50 text-blue-700' },
  esign_received:     { label: 'eSign in',         className: 'bg-teal-50 text-teal-700' },
  payment_received:   { label: 'Paid',             className: 'bg-green-50 text-green-700' },
  project_ready:      { label: 'Project ready',    className: 'bg-violet-50 text-violet-700' },
  rejected:           { label: 'Rejected',         className: 'bg-rose-50 text-rose-700' },
  project_started:    { label: 'Project started',  className: 'bg-emerald-100 text-emerald-800' },
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const badgeFor = (status) =>
  STATUS_BADGE[status] || { label: status, className: 'bg-gray-100 text-gray-700' };

function DetailCard({ p }) {
  const navigate = useNavigate();
  const badge = badgeFor(p.status);
  const signed = p.esign?.status === 'received';
  const paid = p.payment?.status === 'received';
  return (
    <div className="bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--text,#2E2E2E)] truncate">{p.title}</div>
          {p.lead?.name && (
            <div className="text-[11px] text-[var(--text-muted,#A0A0A0)] mt-0.5">
              {p.lead.name}{p.lead.trackingId ? ` · ${p.lead.trackingId}` : ''}
            </div>
          )}
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[11px] flex-shrink-0 ${badge.className}`}>{badge.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-[var(--text-muted,#A0A0A0)]">Subtotal {inr(p.subtotal)}</span>
        <span className="text-[var(--text-muted,#A0A0A0)]">GST {inr(p.gst)}</span>
        <span className="font-medium text-[var(--text,#2E2E2E)]">Final {inr(p.finalAmount)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${signed ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
          <PenTool className="w-3 h-3" /> {signed ? 'eSigned' : 'eSign pending'}
        </span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${paid ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          <CreditCard className="w-3 h-3" /> {paid ? `Paid ${inr(p.payment.amount)}` : 'Payment pending'}
        </span>
      </div>

      {Array.isArray(p.lineItems) && p.lineItems.length > 0 && (
        <div className="border-t border-[var(--border,#eee)] pt-1.5 flex flex-col gap-0.5">
          {p.lineItems.slice(0, 12).map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[var(--text,#2E2E2E)] truncate">{it.name || 'Item'}</span>
              {it.amount != null && <span className="text-[var(--text-muted,#A0A0A0)] flex-shrink-0">{inr(it.amount)}</span>}
            </div>
          ))}
          {p.lineItems.length > 12 && (
            <div className="text-[10px] text-[var(--text-muted,#A0A0A0)]">+{p.lineItems.length - 12} more</div>
          )}
        </div>
      )}

      {p.url && (
        <button
          type="button"
          onClick={() => navigate(p.url)}
          className="self-start inline-flex items-center gap-1 text-[11px] font-medium text-[var(--primary,#D4B76C)] hover:underline"
        >
          Open proposal <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

const ProposalCard = ({ items, total, viewAllUrl, mode }) => {
  const navigate = useNavigate();
  if (!items?.length) return null;

  if (mode === 'details') {
    return <DetailCard p={items[0]} />;
  }

  const hasMore = typeof total === 'number' && total > items.length && !!viewAllUrl;
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((p) => {
        const badge = badgeFor(p.status);
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => p.url && navigate(p.url)}
            className="text-left bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 hover:border-[var(--primary,#D4B76C)] transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--text-muted,#A0A0A0)] flex-shrink-0" />
                  <span className="text-sm font-medium text-[var(--text,#2E2E2E)] truncate">{p.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                  {p.leadName && <span className="text-[var(--text-muted,#A0A0A0)]">{p.leadName}</span>}
                  {p.finalAmount > 0 && <span className="text-[var(--text-muted,#A0A0A0)]">{inr(p.finalAmount)}</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
            </div>
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => navigate(viewAllUrl)}
          className="text-left bg-[var(--bg,#F8F7F3)] border border-dashed border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 hover:border-[var(--primary,#D4B76C)] hover:bg-white transition-colors group inline-flex items-center justify-between gap-2"
        >
          <span className="text-xs font-medium text-[var(--primary,#D4B76C)]">View all {total} proposals</span>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] group-hover:text-[var(--primary,#D4B76C)] transition-colors" />
        </button>
      )}
    </div>
  );
};

export default ProposalCard;
