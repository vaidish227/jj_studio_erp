import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, Mail, MessageSquare, Save, CheckCircle2 } from 'lucide-react';
import { Modal, Button, FormField, Input, Select } from '../../../shared/components';
import useTaskForm from '../hooks/useTaskForm';
import { TASK_TYPE_CONFIG } from './TaskTypeIcon';
import EmployeePicker from './EmployeePicker';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

// ─── Options ─────────────────────────────────────────────────────────────────
const TASK_TYPE_OPTIONS = [
  { value: '', label: 'Select task type...' },
  ...Object.entries(TASK_TYPE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label })),
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

// ─── Inline contact save panel ────────────────────────────────────────────────
const ContactFillPanel = ({ assignee, notifyMail, notifyWhatsApp, onSaved }) => {
  const toast = useToast();

  const needsEmail  = notifyMail     && !assignee.email;
  const needsPhone  = notifyWhatsApp && !assignee.phone;

  const [emailInput, setEmailInput] = useState(assignee.email  || '');
  const [phoneInput, setPhoneInput] = useState(assignee.phone  || '');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  if (!needsEmail && !needsPhone) return null;

  const handleSave = async () => {
    const payload = {};
    if (needsEmail && emailInput.trim()) payload.email = emailInput.trim();
    if (needsPhone && phoneInput.trim()) {
      const digits = phoneInput.trim().replace(/\D/g, '');
      if (digits.length < 11) {
        toast.error('WhatsApp number must include country code — e.g. +91 9876543210');
        return;
      }
      payload.phone = phoneInput.trim();
    }

    if (!Object.keys(payload).length) {
      toast.error('Please fill in the required contact details.');
      return;
    }

    setSaving(true);
    try {
      const res = await pmsService.updateUserContact(assignee._id, payload);
      toast.success(`Contact info saved for ${assignee.name}`);
      setSaved(true);
      onSaved(res.user); // bubble updated user back to parent
    } catch {
      toast.error('Failed to save contact info');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--warning)]/5 border border-[var(--warning)]/30 rounded-xl p-4 space-y-3">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--warning)]">
        Missing contact info — fill to enable notifications
      </p>

      {needsEmail && (
        <FormField label={`Email for ${assignee.name}`}>
          <Input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="email@example.com"
            disabled={saved}
          />
        </FormField>
      )}

      {needsPhone && (
        <FormField label={`WhatsApp number for ${assignee.name}`}>
          <Input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+91 98765 43210"
            disabled={saved}
          />
        </FormField>
      )}

      {saved ? (
        <div className="flex items-center gap-2 text-[var(--success)] text-xs font-bold">
          <CheckCircle2 size={14} /> Contact info saved successfully
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={handleSave} isLoading={saving}>
          <Save size={13} className="mr-1.5" /> Save Contact Info
        </Button>
      )}
    </div>
  );
};

// ─── Main modal ───────────────────────────────────────────────────────────────
const CreateTaskModal = ({ isOpen, onClose, projectId, onCreated }) => {
  const [selectedAssignee, setSelectedAssignee]   = useState(null);
  const [notifyMail, setNotifyMail]               = useState(false);
  const [notifyWhatsApp, setNotifyWhatsApp]       = useState(false);
  const [projectOptions, setProjectOptions]       = useState([]);
  const [projectsLoading, setProjectsLoading]     = useState(false);

  // Load projects for the selector only when opened without a fixed projectId
  useEffect(() => {
    if (isOpen && !projectId) {
      setProjectsLoading(true);
      pmsService.getAllProjects()
        .then((res) => setProjectOptions(res.projects || []))
        .catch(() => {})
        .finally(() => setProjectsLoading(false));
    }
  }, [isOpen, projectId]);

  const {
    form, setField, setExtField,
    addChecklistItem, updateChecklistItem, removeChecklistItem,
    errors, isSubmitting, submit, reset,
  } = useTaskForm(projectId, (task) => {
    onCreated?.(task);
    onClose();
  });

  const handleAssigneeChange = (user) => {
    setSelectedAssignee(user);
    setField('assignedTo', user?._id || '');
    if (!user) { setNotifyMail(false); setNotifyWhatsApp(false); }
  };

  // When contact info is saved, update the local assignee state so warnings disappear
  const handleContactSaved = (updatedUser) => {
    setSelectedAssignee((prev) => ({ ...prev, ...updatedUser }));
  };

  const handleClose = () => {
    setSelectedAssignee(null);
    setNotifyMail(false);
    setNotifyWhatsApp(false);
    setProjectOptions([]);
    reset();
    onClose();
  };

  const handleSubmit = () => {
    submit({ notifyMail, notifyWhatsApp });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Assign Task" className="max-w-2xl">
      <div className="space-y-4">

        {/* ── Project Selector (only when no projectId prop) ── */}
        {!projectId && (
          <FormField label="Project" error={errors.projectId} required>
            {projectsLoading ? (
              <div className="px-3 py-2 text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-xl bg-[var(--bg)]">
                Loading projects…
              </div>
            ) : (
              <Select
                value={form.projectId}
                onChange={(value) => setField('projectId', value)}
                options={[
                  { value: '', label: 'Select project…' },
                  ...projectOptions.map((p) => ({
                    value: p._id,
                    label: `${p.name} (${p.trackingId})`,
                  })),
                ]}
              />
            )}
          </FormField>
        )}

        {/* ── Task Type ── */}
        <FormField label="Task Type" error={errors.taskType} required>
          <Select
            value={form.taskType}
            onChange={(value) => setField('taskType', value)}
            options={TASK_TYPE_OPTIONS}
          />
        </FormField>

        {/* ── Title ── */}
        <FormField label="Title" error={errors.title} required>
          <Input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="e.g. Prepare AC Duct Layout"
          />
        </FormField>

        {/* ── Assignee + Priority ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Assign To" error={errors.assignedTo}>
            <EmployeePicker
              value={selectedAssignee}
              onChange={handleAssigneeChange}
              placeholder="Select team member..."
            />
          </FormField>
          <FormField label="Priority">
            <Select
              value={form.priority}
              onChange={(value) => setField('priority', value)}
              options={PRIORITY_OPTIONS}
            />
          </FormField>
        </div>

        {/* ── Dates ── */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Date">
            <Input type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
          </FormField>
          <FormField label="Due Date">
            <Input type="date" value={form.dueDate} onChange={(e) => setField('dueDate', e.target.value)} />
          </FormField>
        </div>

        {/* ── Notes ── */}
        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={2}
            placeholder="Additional instructions or context..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none transition-colors"
          />
        </FormField>

        {/* ── Checklist ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Checklist
            </label>
            <button
              type="button"
              onClick={addChecklistItem}
              className="flex items-center gap-1 text-xs text-[var(--primary)] hover:text-[var(--primary)]/70 transition-colors"
            >
              <PlusCircle size={13} /> Add Item
            </button>
          </div>
          {form.checklist.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] py-1.5 px-1">No checklist items yet.</p>
          )}
          <div className="space-y-2">
            {form.checklist.map((cl, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={cl.item}
                  onChange={(e) => updateChecklistItem(idx, e.target.value)}
                  placeholder={`Step ${idx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeChecklistItem(idx)}
                  className="shrink-0 p-1.5 rounded-lg text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── External Coordination ── */}
        <div className="border border-[var(--border)] rounded-xl p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.externalCoordination.isNeeded}
              onChange={(e) => setExtField('isNeeded', e.target.checked)}
              className="w-4 h-4 accent-[var(--primary)]"
            />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              External Coordination Required
            </span>
          </label>
          {form.externalCoordination.isNeeded && (
            <div className="space-y-3 pt-1">
              <FormField label="Vendor ID">
                <Input
                  value={form.externalCoordination.vendorId}
                  onChange={(e) => setExtField('vendorId', e.target.value)}
                  placeholder="Vendor ObjectId"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Quotation URL">
                  <Input
                    value={form.externalCoordination.quotationUrl}
                    onChange={(e) => setExtField('quotationUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </FormField>
                <FormField label="Amount (₹)">
                  <Input
                    type="number"
                    value={form.externalCoordination.amount}
                    onChange={(e) => setExtField('amount', e.target.value)}
                    placeholder="50000"
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>

        {/* ── Notifications (shown when assignee is selected) ── */}
        {selectedAssignee && (
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
              Notify {selectedAssignee.name}
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifyMail}
                  onChange={(e) => setNotifyMail(e.target.checked)}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
                <Mail size={14} className="text-[var(--accent-blue)]" />
                <span className="text-sm text-[var(--text-primary)]">Send Email Notification</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifyWhatsApp}
                  onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
                <MessageSquare size={14} className="text-[var(--success)]" />
                <span className="text-sm text-[var(--text-primary)]">Send WhatsApp Notification</span>
              </label>
            </div>

            {/* Inline contact fill — shown when a notification is ticked but contact is missing */}
            <ContactFillPanel
              assignee={selectedAssignee}
              notifyMail={notifyMail}
              notifyWhatsApp={notifyWhatsApp}
              onSaved={handleContactSaved}
            />
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>Assign Task</Button>
        </div>

      </div>
    </Modal>
  );
};

export default CreateTaskModal;
