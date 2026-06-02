import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LeadCard from './LeadCard';
import Button from '../../../shared/components/Button/Button';
import { formatDateFull } from '../../../shared/utils/dateUtils';

const PAGE_SIZE = 25;

// Compact numbered pager with prev/next. Window: first, last, current ±1, ellipsis for gaps.
const Pagination = ({ currentPage, totalPages, onChange }) => {
  const goto = (p) => onChange(Math.min(Math.max(1, p), totalPages));

  const pages = [];
  const add = (p) => { if (!pages.includes(p)) pages.push(p); };
  add(1);
  for (let p = currentPage - 1; p <= currentPage + 1; p += 1) {
    if (p >= 1 && p <= totalPages) add(p);
  }
  add(totalPages);
  pages.sort((a, b) => a - b);

  const withEllipses = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) withEllipses.push('…');
    withEllipses.push(p);
  });

  const btn = 'min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold border transition-colors';
  const inactive = 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]';
  const active = 'border-[var(--primary)] bg-[var(--primary)] text-black';
  const disabled = 'opacity-40 cursor-not-allowed';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => goto(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btn} ${inactive} ${currentPage === 1 ? disabled : ''} flex items-center justify-center`}
        aria-label="Previous page"
      >
        <ChevronLeft size={14} />
      </button>

      {withEllipses.map((item, i) =>
        item === '…' ? (
          <span key={`e-${i}`} className="px-1 text-xs text-[var(--text-muted)]">…</span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => goto(item)}
            className={`${btn} ${item === currentPage ? active : inactive}`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => goto(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btn} ${inactive} ${currentPage === totalPages ? disabled : ''} flex items-center justify-center`}
        aria-label="Next page"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
};

/**
 * Reusable leads list UI — used by all pipeline pages.
 * Paginates client-side at PAGE_SIZE per page, resets to page 1 when the
 * filtered set changes (e.g. user applies a filter).
 */
const LeadListView = ({
  title,
  subtitle,
  leads,
  isLoading,
  error,
  statusSummary,
  onCardClick,
  showAddButton = false,
  emptyMessage = 'No leads found.',
  accentColor = 'var(--primary)',
  refresh,
  headerExtra = null,
}) => {
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever the filtered count changes — otherwise the user
  // could be stranded on page 4 of a list that now only has 2 pages.
  useEffect(() => { setCurrentPage(1); }, [leads.length]);

  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, leads.length);
  const paginated = useMemo(
    () => leads.slice(pageStart, pageEnd),
    [leads, pageStart, pageEnd]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 pl-4" style={{ borderColor: accentColor }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {isLoading ? 'Fetching leads...' : `${leads.length} leads found`}
            {subtitle && <span className="ml-2 text-[var(--text-muted)]">• {subtitle}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {headerExtra}
          {showAddButton && (
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              onClick={() => navigate('/crm/forms/enquiry')}
            >
              <Plus size={18} />
              Add New Enquiry
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
            <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
            <p className="text-sm">Fetching leads...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10 text-[var(--error)] text-sm">{error}</div>
        ) : leads.length > 0 ? (
          paginated.map((lead) => (
            <LeadCard
              key={lead._id || lead.id}
              onClick={onCardClick ? () => onCardClick(lead) : undefined}
              lead={{
                ...lead,
                project: lead.projectType,
                date: formatDateFull(lead.createdAt),
              }}
            />
          ))
        ) : (
          <div className="text-center py-24 bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)]">
            <div className="w-16 h-16 rounded-full bg-[var(--bg)] flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-[var(--text-muted)] opacity-40" />
            </div>
            <p className="text-[var(--text-muted)] text-sm">
              {emptyMessage}
            </p>
            {showAddButton && (
              <Button
                variant="ghost"
                className="mt-4 text-[var(--primary)]"
                onClick={() => navigate('/crm/forms/enquiry')}
              >
                Create your first enquiry
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination footer — only when there's more than a page of results */}
      {!isLoading && leads.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <p className="text-xs font-bold text-[var(--text-muted)]">
            Showing{' '}
            <span className="text-[var(--text-primary)]">{pageStart + 1}</span>
            {'–'}
            <span className="text-[var(--text-primary)]">{pageEnd}</span>{' '}
            of <span className="text-[var(--text-primary)]">{leads.length}</span>
          </p>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
};

export default LeadListView;
