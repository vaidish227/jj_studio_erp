import { useEffect, useMemo, useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { pmsService } from '../../../../shared/services/pmsService';
import { ModalShell } from './sheetCells';

/**
 * SelectTemplateModal — pick the workflow template that drives THIS project's
 * master sheet from a dropdown of every active template. Project-specific:
 * the global templates and other projects are never modified.
 *
 * Two situations share this modal:
 *   - No template yet (fresh project) — selecting one seeds the sheet.
 *   - Template already applied — switching deletes the template-spawned rows
 *     and rebuilds from the new template (backend refuses once work started,
 *     drawings attached, or the plan is effective).
 */
const SelectTemplateModal = ({ open, currentTemplate, onClose, onConfirm, busy }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedId('');
    setLoading(true);
    pmsService.listWorkflowTemplates()
      .then((res) => {
        const list = (res?.templates || (Array.isArray(res) ? res : []))
          .filter((t) => t.isActive !== false);
        setTemplates(list);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [open]);

  const selected = useMemo(
    () => templates.find((t) => String(t._id) === selectedId) || null,
    [templates, selectedId]
  );

  if (!open) return null;

  const hasCurrent  = !!currentTemplate?.baseTemplateId;
  const currentId   = String(currentTemplate?.baseTemplateId || '');
  const canConfirm  = !!selectedId && selectedId !== currentId && !busy;

  const optionLabel = (t) => {
    const ph = t.phaseCount ?? (Array.isArray(t.phases) ? t.phases.length : null);
    const tk = t.taskCount  ?? (Array.isArray(t.tasks)  ? t.tasks.length  : null);
    const meta = [
      t.projectType || 'Any',
      ph != null ? `${ph} phase${ph !== 1 ? 's' : ''}` : null,
      tk != null ? `${tk} task${tk !== 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' · ');
    const flags = [
      t.isDefault ? 'Default' : null,
      String(t._id) === currentId ? 'Current' : null,
    ].filter(Boolean).join(', ');
    return `${t.name} — ${meta}${flags ? ` (${flags})` : ''}`;
  };

  return (
    <ModalShell
      title="Select Master Sheet Template"
      subtitle="Applies to this project only — the global templates and other projects stay unchanged."
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={!canConfirm}
            onClick={() => onConfirm(selectedId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />}
            <Layers size={12} /> Apply Template
          </button>
        </>
      )}
    >
      {hasCurrent ? (
        <div className="text-[11px] text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-2.5 mb-3 leading-snug">
          Rows created by the current template will be <strong>deleted and rebuilt</strong> from
          the new template. Rows you added manually are kept. This is blocked once any
          template task has started, has drawings, or the plan is effective.
        </div>
      ) : (
        <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg p-2.5 mb-3 leading-snug">
          This project has no template yet — selecting one will fill the master sheet with
          its phases and tasks. You can still add, edit, re-assign and remove rows afterwards;
          those changes affect <strong>this project only</strong>.
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-3">
          <Loader2 size={14} className="animate-spin" /> Loading templates…
        </div>
      )}

      {!loading && templates.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] py-3">No active workflow templates found.</p>
      )}

      {!loading && templates.length > 0 && (
        <>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
            Template
          </label>
          <select
            value={selectedId}
            disabled={busy}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-2.5 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)] disabled:opacity-50"
          >
            <option value="">— Choose a template —</option>
            {templates.map((t) => (
              <option key={String(t._id)} value={String(t._id)} disabled={String(t._id) === currentId}>
                {optionLabel(t)}
              </option>
            ))}
          </select>

          {/* Details of the highlighted template */}
          {selected && (
            <div className="mt-3 border border-[var(--border)] rounded-lg p-3 bg-[var(--bg)]/60">
              <div className="flex items-center gap-2 flex-wrap">
                <Layers size={13} className="text-[var(--primary)] shrink-0" />
                <span className="text-xs font-bold text-[var(--text-primary)]">{selected.name}</span>
                {selected.isDefault && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-[var(--success)] bg-[var(--success)]/10 px-1.5 py-0.5 rounded">Default</span>
                )}
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                  {selected.projectType || 'Any'}
                </span>
              </div>
              {selected.description && (
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{selected.description}</p>
              )}
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
};

export default SelectTemplateModal;
