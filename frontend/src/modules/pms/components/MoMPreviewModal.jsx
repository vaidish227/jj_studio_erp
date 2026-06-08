import React from 'react';
import { Download, Pencil, Trash2, Calendar, Users } from 'lucide-react';
import { Modal, Button } from '../../../shared/components';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
};

const buildMarkdown = (mom, projectName) => {
  const lines = [];
  lines.push(`# Minutes of Meeting — ${mom.title}`);
  if (projectName) lines.push(`**Project:** ${projectName}`);
  lines.push(`**Date:** ${fmtDate(mom.date)}`);
  if (mom.attendees?.length) lines.push(`**Attendees:** ${mom.attendees.join(', ')}`);
  lines.push('');
  if (mom.discussion) {
    lines.push('## Discussion Summary');
    lines.push(mom.discussion);
    lines.push('');
  }
  if (mom.decisions?.length) {
    lines.push('## Decisions');
    mom.decisions.forEach((d) => lines.push(`- ${d}`));
    lines.push('');
  }
  if (mom.actionItems?.length) {
    lines.push('## Action Items');
    mom.actionItems.forEach((ai) => {
      const parts = [`- **${ai.description}**`];
      if (ai.assignee) parts.push(`(Owner: ${ai.assignee})`);
      if (ai.dueDate) parts.push(`(Due: ${fmtDate(ai.dueDate)})`);
      lines.push(parts.join(' '));
    });
    lines.push('');
  }
  return lines.join('\n');
};

const slugify = (s) => String(s || 'mom')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 60);

const MoMPreviewModal = ({ isOpen, onClose, mom, projectName, onEdit, onDelete }) => {
  if (!mom) return null;

  const handleDownload = () => {
    const md = buildMarkdown(mom, projectName);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${slugify(mom.title)}-${mom.date || 'mom'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Minutes of Meeting" className="max-w-2xl">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h3 className="text-lg font-extrabold text-[var(--text-primary)]">{mom.title}</h3>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} />
              {fmtDate(mom.date)}
            </span>
            {mom.attendees?.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={12} />
                {mom.attendees.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Discussion */}
        {mom.discussion && (
          <section>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Discussion Summary
            </p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
              {mom.discussion}
            </p>
          </section>
        )}

        {/* Decisions */}
        {mom.decisions?.length > 0 && (
          <section>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Decisions
            </p>
            <ul className="space-y-1.5">
              {mom.decisions.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                  <span className="text-[var(--primary)] mt-0.5">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Action Items */}
        {mom.actionItems?.length > 0 && (
          <section>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Action Items
            </p>
            <div className="space-y-2">
              {mom.actionItems.map((ai, i) => (
                <div
                  key={i}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3"
                >
                  <p className="text-sm font-bold text-[var(--text-primary)]">{ai.description}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-[var(--text-muted)]">
                    {ai.assignee && <span>Owner: <span className="text-[var(--text-secondary)] font-bold">{ai.assignee}</span></span>}
                    {ai.dueDate  && <span>Due: <span className="text-[var(--text-secondary)] font-bold">{fmtDate(ai.dueDate)}</span></span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button type="button" variant="outline" size="sm" onClick={() => onEdit(mom)}>
                <Pencil size={12} />
                Edit
              </Button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(mom)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
              >
                <Trash2 size={12} />
                Delete
              </button>
            )}
          </div>
          <Button type="button" variant="primary" size="sm" onClick={handleDownload}>
            <Download size={12} />
            Download .md
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MoMPreviewModal;
