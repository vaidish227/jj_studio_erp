import React, { useEffect, useState } from 'react';
import {
  Users as UsersIcon,
  FileText,
  CheckCircle2,
  ListChecks,
  Plus,
  X,
  Trash2,
  Calendar,
  Loader2,
} from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import EmployeePicker from '../../pms/components/EmployeePicker';
import useAssignableUsers from '../../pms/hooks/useAssignableUsers';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const emptyAction = () => ({ description: '', assignedTo: null, dueDate: '' });

const sectionHeader = (Icon, title, accent) => (
  <div className="flex items-center gap-2.5 mb-3">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
      <Icon size={16} />
    </div>
    <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">{title}</h3>
  </div>
);

const RecordMOMModal = ({ isOpen, onClose, meeting, onSaved }) => {
  const toast = useToast();
  const { users } = useAssignableUsers();

  const [staffIds, setStaffIds] = useState([]);
  const [clientAttendeeInput, setClientAttendeeInput] = useState('');
  const [clientAttendees, setClientAttendees] = useState([]);
  const [discussionSummary, setDiscussionSummary] = useState('');
  const [decisionInput, setDecisionInput] = useState('');
  const [decisions, setDecisions] = useState([]);
  const [actionItems, setActionItems] = useState([emptyAction()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffPickerKey, setStaffPickerKey] = useState(0); // reset EmployeePicker after each add

  // Hydrate from existing MOM if present
  useEffect(() => {
    if (!isOpen) return;
    const mom = meeting?.mom;
    if (mom) {
      setStaffIds((mom.attendees?.staff || []).map((s) => (typeof s === 'string' ? s : s._id)));
      setClientAttendees(Array.isArray(mom.attendees?.clients) ? mom.attendees.clients : []);
      setDiscussionSummary(mom.discussionSummary || '');
      setDecisions(Array.isArray(mom.decisions) ? mom.decisions : []);
      setActionItems(
        (mom.actionItems || []).length
          ? mom.actionItems.map((a) => ({
              description: a.description || '',
              assignedTo: a.assignedTo
                ? (typeof a.assignedTo === 'string' ? { _id: a.assignedTo } : a.assignedTo)
                : null,
              dueDate: a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : '',
            }))
          : [emptyAction()]
      );
    } else {
      setStaffIds([]);
      setClientAttendees([]);
      setDiscussionSummary('');
      setDecisions([]);
      setActionItems([emptyAction()]);
    }
    setClientAttendeeInput('');
    setDecisionInput('');
  }, [isOpen, meeting]);

  const selectedStaff = users.filter((u) => staffIds.includes(u._id));

  const addStaff = (user) => {
    if (!user) return;
    setStaffIds((prev) => (prev.includes(user._id) ? prev : [...prev, user._id]));
    setStaffPickerKey((k) => k + 1);
  };
  const removeStaff = (id) => setStaffIds((prev) => prev.filter((x) => x !== id));

  const addClientAttendee = () => {
    const name = clientAttendeeInput.trim();
    if (!name) return;
    if (clientAttendees.includes(name)) return;
    setClientAttendees((prev) => [...prev, name]);
    setClientAttendeeInput('');
  };

  const addDecision = () => {
    const d = decisionInput.trim();
    if (!d) return;
    setDecisions((prev) => [...prev, d]);
    setDecisionInput('');
  };

  const updateActionItem = (idx, patch) => {
    setActionItems((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const removeActionItem = (idx) => {
    setActionItems((prev) => (prev.length === 1 ? [emptyAction()] : prev.filter((_, i) => i !== idx)));
  };

  const handleSubmit = async () => {
    if (!meeting?._id) return;

    const cleanedActions = actionItems
      .map((a) => ({
        description: (a.description || '').trim(),
        assignedTo: a.assignedTo?._id || null,
        dueDate: a.dueDate || null,
      }))
      .filter((a) => a.description);

    if (!discussionSummary.trim() && !decisions.length && !cleanedActions.length) {
      toast.error('Capture at least a discussion summary, decision, or action item.');
      return;
    }

    setIsSubmitting(true);
    try {
      await crmService.recordMOM(meeting._id, {
        attendees: { staff: staffIds, clients: clientAttendees },
        discussionSummary: discussionSummary.trim(),
        decisions,
        actionItems: cleanedActions,
      });
      const followupsCreated = cleanedActions.filter((a) => a.dueDate).length;
      toast.success(
        `MOM saved.${followupsCreated ? ` Created ${followupsCreated} follow-up${followupsCreated === 1 ? '' : 's'}.` : ''}`
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed to save MOM.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const lead = meeting?.leadId || {};
  const hasExisting = !!meeting?.mom?.recordedAt;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title={hasExisting ? 'Update Minutes of Meeting' : 'Record Minutes of Meeting'}
      className="max-w-3xl"
    >
      {/* Meeting context strip */}
      {meeting && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[var(--primary)]">For Meeting</p>
            <p className="font-bold text-[var(--text-primary)]">{lead.name || 'Unknown client'}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {meeting.date ? new Date(meeting.date).toLocaleString('en-IN') : '—'} • {meeting.type || 'office'}
            </p>
          </div>
          {hasExisting && (
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              Editing existing MOM
            </span>
          )}
        </div>
      )}

      <div className="space-y-7">
        {/* Attendees */}
        <section>
          {sectionHeader(UsersIcon, 'Attendees', 'bg-indigo-100 text-indigo-700')}

          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-[var(--text-muted)] mb-1.5">Staff (JJ Studio)</p>
              <EmployeePicker
                key={staffPickerKey}
                value={null}
                onChange={addStaff}
                placeholder="Add staff member..."
              />
              {selectedStaff.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedStaff.map((u) => (
                    <span
                      key={u._id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold"
                    >
                      {u.name}
                      <button
                        type="button"
                        onClick={() => removeStaff(u._id)}
                        className="hover:bg-[var(--primary)]/20 rounded-full p-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-[var(--text-muted)] mb-1.5">Client Side</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientAttendeeInput}
                  onChange={(e) => setClientAttendeeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addClientAttendee();
                    }
                  }}
                  placeholder="e.g. Ratan Tata"
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--primary)]"
                />
                <Button type="button" variant="outline" onClick={addClientAttendee}>
                  <Plus size={14} />
                </Button>
              </div>
              {clientAttendees.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {clientAttendees.map((name, idx) => (
                    <span
                      key={`${name}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setClientAttendees((prev) => prev.filter((_, i) => i !== idx))}
                        className="hover:bg-emerald-200 rounded-full p-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Discussion Summary */}
        <section>
          {sectionHeader(FileText, 'Discussion Summary', 'bg-amber-100 text-amber-700')}
          <textarea
            value={discussionSummary}
            onChange={(e) => setDiscussionSummary(e.target.value)}
            rows={5}
            placeholder="What was discussed during the meeting…"
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--primary)] resize-y"
          />
        </section>

        {/* Decisions */}
        <section>
          {sectionHeader(CheckCircle2, 'Key Decisions', 'bg-emerald-100 text-emerald-700')}
          <div className="flex gap-2">
            <input
              type="text"
              value={decisionInput}
              onChange={(e) => setDecisionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDecision();
                }
              }}
              placeholder="e.g. Approved modular kitchen scope at ₹4.5L"
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
            <Button type="button" variant="outline" onClick={addDecision}>
              <Plus size={14} />
              Add
            </Button>
          </div>
          {decisions.length > 0 && (
            <ul className="mt-3 space-y-2">
              {decisions.map((d, idx) => (
                <li
                  key={`${d}-${idx}`}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm"
                >
                  <CheckCircle2 size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                  <span className="flex-1 text-[var(--text-primary)]">{d}</span>
                  <button
                    type="button"
                    onClick={() => setDecisions((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-emerald-700 hover:text-rose-700"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Action Items */}
        <section>
          {sectionHeader(ListChecks, 'Action Items', 'bg-rose-100 text-rose-700')}
          <p className="text-xs text-[var(--text-muted)] -mt-2 mb-3">
            Items with a due date will auto-create a follow-up in the assignee's task queue.
          </p>

          <div className="space-y-3">
            {actionItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] space-y-3"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateActionItem(idx, { description: e.target.value })}
                    placeholder={`Action item #${idx + 1} — what needs to be done?`}
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeActionItem(idx)}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">Assignee</p>
                    <EmployeePicker
                      value={item.assignedTo}
                      onChange={(user) => updateActionItem(idx, { assignedTo: user })}
                      placeholder="Owner"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">Due Date</p>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={(e) => updateActionItem(idx, { dueDate: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setActionItems((prev) => [...prev, emptyAction()])}
            className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--border)] text-sm font-bold text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Add another action item
          </button>
        </section>

        {/* Action bar */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving
              </>
            ) : (
              <>
                <FileText size={14} />
                {hasExisting ? 'Update MOM' : 'Save MOM'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RecordMOMModal;
