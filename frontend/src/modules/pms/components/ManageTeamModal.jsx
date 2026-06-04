import React, { useState, useEffect } from 'react';
import {
  Star, Ruler, Settings2, Droplets, Layers,
  HardHat, Wrench, Check,
} from 'lucide-react';
import { Modal, Button } from '../../../shared/components';
import EmployeePicker from './EmployeePicker';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

// ─── Slot definitions ────────────────────────────────────────────────────────
const SLOTS = [
  {
    field: 'primaryDesigner',
    label: 'Lead Designer',
    desc: 'Primary designer & client contact',
    roles: ['designer', 'manager', 'admin', 'md'],
    icon: Star,
    color: 'text-[var(--primary)]',
  },
  {
    field: 'designerB',
    label: 'Furniture & Measurements',
    desc: 'Site measurements & furniture layout',
    roles: ['designer'],
    icon: Ruler,
    color: 'text-blue-600',
  },
  {
    field: 'designerC',
    label: 'Technical Drawings',
    desc: 'AC, technical & automation',
    roles: ['designer'],
    icon: Settings2,
    color: 'text-indigo-600',
  },
  {
    field: 'designerD',
    label: 'Bathroom & Kitchen',
    desc: 'Bathroom & kitchen drawings',
    roles: ['designer'],
    icon: Droplets,
    color: 'text-cyan-600',
  },
  {
    field: 'designerE',
    label: 'Concept & 3D',
    desc: 'Concept & 3D renders',
    roles: ['designer'],
    icon: Layers,
    color: 'text-purple-600',
  },
  {
    field: 'supervisor',
    label: 'Site Supervisor',
    desc: 'On-site supervision',
    roles: ['supervisor', 'manager'],
    icon: HardHat,
    color: 'text-amber-600',
  },
  {
    field: 'contractor',
    label: 'Contractor',
    desc: 'Execution contractor',
    roles: ['designer', 'supervisor', 'manager', 'admin', 'md'],
    icon: Wrench,
    color: 'text-slate-600',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
const ManageTeamModal = ({ isOpen, onClose, project, onSaved }) => {
  const toast = useToast();
  const [draft, setDraft]     = useState({});
  const [saving, setSaving]   = useState(false);

  // Seed draft whenever modal opens
  useEffect(() => {
    if (isOpen && project) {
      const init = {};
      SLOTS.forEach(({ field }) => { init[field] = project[field] || null; });
      setDraft(init);
    }
  }, [isOpen, project]);

  const filledCount = SLOTS.filter(({ field }) => draft[field]).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      SLOTS.forEach(({ field }) => { payload[field] = draft[field]?._id || ''; });
      await pmsService.updateTeam(project._id, payload);
      toast.success('Team saved successfully');
      onSaved?.();
      onClose();
    } catch {
      toast.error('Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  const allFilled = filledCount === SLOTS.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Project Team"
      className="max-w-2xl"
    >
      {/* Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text-primary)]">{filledCount}</span>
            {' '}of {SLOTS.length} roles assigned
          </span>
          {allFilled && (
            <span className="flex items-center gap-1 text-xs font-bold text-[var(--success)]">
              <Check size={13} /> Team complete
            </span>
          )}
        </div>
        <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
            style={{ width: `${(filledCount / SLOTS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Role list */}
      <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {SLOTS.map(({ field, label, desc, roles, icon: Icon, color }) => (
          <div
            key={field}
            className="flex flex-col sm:flex-row sm:items-center gap-3 py-3"
          >
            <div className="flex items-start gap-3 sm:w-1/2 min-w-0">
              <Icon size={18} strokeWidth={2} className={`${color} shrink-0 mt-0.5`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                  {label}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                  {desc}
                </p>
              </div>
            </div>

            <div className="sm:flex-1 sm:max-w-[260px] sm:ml-auto w-full">
              <EmployeePicker
                value={draft[field] || null}
                onChange={(user) => setDraft((prev) => ({ ...prev, [field]: user }))}
                placeholder="Assign person..."
                filterRoles={roles}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-[var(--border)]">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} isLoading={saving}>
          <Check size={14} className="mr-1.5" /> Save Team
        </Button>
      </div>
    </Modal>
  );
};

export default ManageTeamModal;
export { SLOTS };
