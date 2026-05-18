import React from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Modal, Button, FormField, Input, Select } from '../../../shared/components';
import useTaskForm from '../hooks/useTaskForm';
import { TASK_TYPE_CONFIG } from './TaskTypeIcon';

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

const CreateTaskModal = ({ isOpen, onClose, projectId, onCreated }) => {
  const {
    form, setField, setExtField,
    addChecklistItem, updateChecklistItem, removeChecklistItem,
    errors, isSubmitting, submit, reset,
  } = useTaskForm(projectId, (task) => {
    onCreated?.(task);
    onClose();
  });

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Task" className="max-w-2xl">
      <div className="space-y-4">

        <FormField label="Task Type" error={errors.taskType} required>
          <Select
            value={form.taskType}
            onChange={(e) => setField('taskType', e.target.value)}
            options={TASK_TYPE_OPTIONS}
          />
        </FormField>

        <FormField label="Title" error={errors.title} required>
          <Input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="e.g. Prepare AC Duct Layout"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Assigned To (User ID)">
            <Input
              value={form.assignedTo}
              onChange={(e) => setField('assignedTo', e.target.value)}
              placeholder="User ObjectId"
            />
          </FormField>
          <FormField label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => setField('priority', e.target.value)}
              options={PRIORITY_OPTIONS}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Date">
            <Input type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
          </FormField>
          <FormField label="Due Date">
            <Input type="date" value={form.dueDate} onChange={(e) => setField('dueDate', e.target.value)} />
          </FormField>
        </div>

        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={2}
            placeholder="Additional notes..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none transition-colors"
          />
        </FormField>

        {/* Checklist Builder */}
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
              <PlusCircle size={13} />
              Add Item
            </button>
          </div>
          {form.checklist.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] py-2 px-1">No checklist items yet.</p>
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

        {/* External Coordination */}
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

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={submit} isLoading={isSubmitting}>Add Task</Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateTaskModal;
