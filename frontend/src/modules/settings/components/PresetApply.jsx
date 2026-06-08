import React, { useState, useMemo } from 'react';
import { LayoutTemplate, ChevronDown, Plus, RefreshCw, ChevronLeft, Check } from 'lucide-react';

// "Apply template" control for the role editor. Operates on the draft only —
// Add (union) or Replace (overwrite draft). Never saves; the Save bar handles that.
const PresetApply = ({ presets = [], draftPermissions = [], isWildcard = false, onApply }) => {
  const [open, setOpen]       = useState(false);
  const [active, setActive]   = useState(null); // preset being previewed

  const draftSet = useMemo(() => new Set(draftPermissions), [draftPermissions]);

  const diff = useMemo(() => {
    if (!active) return null;
    const perms = active.permissions || [];
    const newOnes = perms.filter((p) => !draftSet.has(p));
    return { total: perms.length, newCount: newOnes.length, already: perms.length - newOnes.length, newOnes };
  }, [active, draftSet]);

  const close = () => { setOpen(false); setActive(null); };

  const apply = (mode) => {
    if (active) onApply(active.permissions, mode);
    close();
  };

  if (!presets.length) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={isWildcard}
        title={isWildcard ? 'Wildcard role — templates not applicable' : 'Apply a role template'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <LayoutTemplate size={13} />Apply template<ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 top-9 z-50 w-[320px] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
            {!active ? (
              <>
                <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg)]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Role Templates</p>
                </div>
                <div className="max-h-[340px] overflow-y-auto py-1">
                  {presets.map((preset) => {
                    const perms = preset.permissions || [];
                    const granted = perms.filter((p) => draftSet.has(p)).length;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setActive(preset)}
                        className="w-full text-left px-3 py-2 hover:bg-[var(--bg)] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{preset.label}</span>
                          <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">{granted}/{perms.length}</span>
                        </div>
                        {preset.description && (
                          <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5 line-clamp-2">{preset.description}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div>
                <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg)] flex items-center gap-2">
                  <button type="button" onClick={() => setActive(null)} className="p-0.5 rounded hover:bg-[var(--border)] text-[var(--text-muted)]">
                    <ChevronLeft size={14} />
                  </button>
                  <p className="text-[12px] font-bold text-[var(--text-primary)] flex-1 truncate">{active.label}</p>
                </div>
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-[var(--primary)] font-bold"><Plus size={11} />{diff.newCount} new</span>
                    <span className="inline-flex items-center gap-1 text-[var(--text-muted)]"><Check size={11} />{diff.already} already granted</span>
                  </div>
                  {diff.newCount > 0 && (
                    <div className="max-h-[140px] overflow-y-auto rounded-lg border border-[var(--border)] p-2 bg-[var(--bg)]">
                      <div className="flex flex-wrap gap-1">
                        {diff.newOnes.map((p) => (
                          <code key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">{p}</code>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => apply('add')}
                      disabled={diff.newCount === 0}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[var(--primary)] text-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={12} />Add {diff.newCount} new
                    </button>
                    <button
                      type="button"
                      onClick={() => apply('replace')}
                      title="Replace the current unsaved draft with this template"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--warning)]/60 hover:text-[var(--warning)] transition-all"
                    >
                      <RefreshCw size={12} />Replace ({diff.total})
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] leading-snug">
                    Changes the draft only — nothing is saved until you click <span className="font-semibold">Save</span>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PresetApply;
