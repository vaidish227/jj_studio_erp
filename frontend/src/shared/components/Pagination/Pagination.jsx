import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ currentPage, totalPages, onChange }) => {
  if (!totalPages || totalPages <= 1) return null;

  const goto = (p) => onChange(Math.min(Math.max(1, p), totalPages));

  // Build the visible page list with ellipses
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

export default Pagination;
