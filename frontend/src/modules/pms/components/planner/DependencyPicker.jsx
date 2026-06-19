import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Check } from 'lucide-react';
import { ModalShell } from './sheetCells';

/**
 * DependencyPicker — pick the predecessor tasks a row depends on. A modal with a
 * searchable checkbox list of same-project candidates. Candidates must EXCLUDE
 * the task itself and its descendants/dependents so the UI can never build a
 * cycle (the backend re-validates and rejects cycles regardless).
 *
 * Props:
 *   open, candidates [{ taskId, title, phase }], value (string[] of taskIds),
 *   busy, onClose, onSave(ids)
 */
const DependencyPicker = ({ open, candidates = [], value = [], busy, onClose, onSave }) => {
  const [selected, setSelected] = useState(() => new Set(value.map(String)));
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) { setSelected(new Set((value || []).map(String))); setQuery(''); }
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => String(c.title || '').toLowerCase().includes(q));
  }, [candidates, query]);

  if (!open) return null;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <ModalShell
      title="Dependencies / Predecessors"
      subtitle="This task starts after the selected tasks complete."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => onSave([...selected])} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Save ({selected.size})
          </button>
        </>
      )}
    >
      <div className="relative mb-2">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks…"
          className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
        />
      </div>
      <div className="max-h-64 overflow-y-auto -mx-1 px-1">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)] italic text-center py-6">No eligible tasks.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((c) => {
              const id = String(c.taskId);
              const on = selected.has(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                      on ? 'bg-[var(--primary)]/10 text-[var(--text-primary)]' : 'hover:bg-[var(--bg)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'}`}>
                      {on && <Check size={11} className="text-white" />}
                    </span>
                    <span className="truncate">{c.title || '(untitled)'}</span>
                    {c.phase && <span className="ml-auto text-[10px] text-[var(--text-muted)] capitalize shrink-0">{c.phase}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalShell>
  );
};

export default DependencyPicker;
