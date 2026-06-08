import React, { useState } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { Modal, Button } from '../../../shared/components';
import DatePicker from '../../../shared/components/DatePicker/DatePicker';
import { useToast } from '../../../shared/notifications/ToastProvider';

const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyActionItem = () => ({ description: '', assignee: '', dueDate: '' });

const RecordMoMModal = ({ isOpen, onClose, projectName, initialMoM = null, onSave }) => {
  const toast = useToast();

  const [title, setTitle]                 = useState(initialMoM?.title || '');
  const [date, setDate]                   = useState(initialMoM?.date || todayISO());
  const [attendeesText, setAttendeesText] = useState((initialMoM?.attendees || []).join(', '));
  const [discussion, setDiscussion]       = useState(initialMoM?.discussion || '');
  const [decisions, setDecisions]         = useState(
    initialMoM?.decisions?.length ? initialMoM.decisions : [''],
  );
  const [actionItems, setActionItems]     = useState(
    initialMoM?.actionItems?.length ? initialMoM.actionItems : [emptyActionItem()],
  );
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setDate(todayISO());
    setAttendeesText('');
    setDiscussion('');
    setDecisions(['']);
    setActionItems([emptyActionItem()]);
  };

  const handleClose = () => {
    if (!saving) {
      reset();
      onClose?.();
    }
  };

  const updateDecision = (idx, value) => {
    setDecisions((prev) => prev.map((d, i) => (i === idx ? value : d)));
  };
  const addDecision    = () => setDecisions((prev) => [...prev, '']);
  const removeDecision = (idx) => setDecisions((prev) => prev.filter((_, i) => i !== idx));

  const updateActionItem = (idx, field, value) => {
    setActionItems((prev) => prev.map((ai, i) => (i === idx ? { ...ai, [field]: value } : ai)));
  };
  const addActionItem    = () => setActionItems((prev) => [...prev, emptyActionItem()]);
  const removeActionItem = (idx) => setActionItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Give the MoM a title (e.g. "Kickoff Meeting").');
      return;
    }
    const cleanDecisions   = decisions.map((d) => d.trim()).filter(Boolean);
    const cleanActionItems = actionItems
      .map((ai) => ({
        description: (ai.description || '').trim(),
        assignee:    (ai.assignee || '').trim(),
        dueDate:     (ai.dueDate || '').trim(),
      }))
      .filter((ai) => ai.description);

    if (!discussion.trim() && cleanDecisions.length === 0 && cleanActionItems.length === 0) {
      toast.error('Add a discussion summary, a decision, or an action item.');
      return;
    }

    const attendees = attendeesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      onSave?.({
        title: cleanTitle,
        date,
        attendees,
        discussion: discussion.trim(),
        decisions: cleanDecisions,
        actionItems: cleanActionItems,
      });
      toast.success(initialMoM ? 'MoM updated.' : 'MoM recorded.');
      reset();
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialMoM ? 'Edit Minutes of Meeting' : 'Record Minutes of Meeting'}
      className="!max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {projectName && (
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            For project · <span className="text-[var(--text-primary)]">{projectName}</span>
          </div>
        )}

        {/* Title + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="w-full space-y-1.5">
            <label className="text-sm font-bold text-[var(--text-primary)] ml-1">
              Meeting Title <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kickoff Meeting"
              required
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2.5 px-4 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="w-full space-y-1.5">
            <label className="text-sm font-bold text-[var(--text-primary)] ml-1">
              Meeting Date
            </label>
            <DatePicker
              name="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              icon={Calendar}
              yearRange={{ from: 2020, to: new Date().getFullYear() + 1 }}
            />
          </div>
        </div>

        {/* Attendees */}
        <div className="w-full space-y-1.5">
          <label className="text-sm font-bold text-[var(--text-primary)] ml-1">
            Attendees
          </label>
          <input
            type="text"
            value={attendeesText}
            onChange={(e) => setAttendeesText(e.target.value)}
            placeholder="Comma-separated, e.g. Rahul, Priya, Client"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2.5 px-4 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>

        {/* Discussion Summary */}
        <div className="w-full space-y-1.5">
          <label className="text-sm font-bold text-[var(--text-primary)] ml-1">
            Discussion Summary
          </label>
          <textarea
            value={discussion}
            onChange={(e) => setDiscussion(e.target.value)}
            rows={4}
            placeholder="What was discussed in the meeting…"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3 px-4 text-sm transition-all focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none placeholder:text-[var(--text-muted)] resize-y"
          />
        </div>

        {/* Decisions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-[var(--text-primary)] ml-1">
              Decisions
            </label>
            <button
              type="button"
              onClick={addDecision}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] hover:underline"
            >
              <Plus size={12} /> Add decision
            </button>
          </div>
          {decisions.map((d, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={d}
                onChange={(e) => updateDecision(idx, e.target.value)}
                placeholder={`Decision #${idx + 1}`}
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg py-2 px-3 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              {decisions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDecision(idx)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                  aria-label="Remove decision"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Action Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-[var(--text-primary)] ml-1">
              Action Items
            </label>
            <button
              type="button"
              onClick={addActionItem}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] hover:underline"
            >
              <Plus size={12} /> Add action item
            </button>
          </div>
          {actionItems.map((ai, idx) => (
            <div
              key={idx}
              className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 space-y-2"
            >
              {/* Row 1: description + delete */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ai.description}
                  onChange={(e) => updateActionItem(idx, 'description', e.target.value)}
                  placeholder={`Action #${idx + 1} — what needs doing`}
                  className="flex-1 min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg py-2 px-3 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
                {actionItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeActionItem(idx)}
                    className="shrink-0 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                    aria-label="Remove action item"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Row 2: assignee + due date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={ai.assignee}
                  onChange={(e) => updateActionItem(idx, 'assignee', e.target.value)}
                  placeholder="Assignee"
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-lg py-2 px-3 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
                <DatePicker
                  name={`actionItem-${idx}-dueDate`}
                  value={ai.dueDate}
                  onChange={(e) => updateActionItem(idx, 'dueDate', e.target.value)}
                  placeholder="Due date"
                  icon={Calendar}
                  yearRange={{ from: new Date().getFullYear(), to: new Date().getFullYear() + 2 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : (initialMoM ? 'Save Changes' : 'Save MoM')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RecordMoMModal;
