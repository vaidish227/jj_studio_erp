import React, { useState, useEffect } from 'react';
import {
  Star, Ruler, Settings2, Droplets, Layers,
  HardHat, Wrench, Users, Check,
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
    color: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    accent: 'border-l-[var(--primary)]',
  },
  {
    field: 'designerB',
    label: 'Furniture & Measurements',
    desc: 'Site measurements & furniture layout',
    roles: ['designer'],
    icon: Ruler,
    color: 'bg-blue-100 text-blue-600',
    accent: 'border-l-blue-400',
  },
  {
    field: 'designerC',
    label: 'Technical Drawings',
    desc: 'AC coordination, technical & automation',
    roles: ['designer'],
    icon: Settings2,
    color: 'bg-indigo-100 text-indigo-600',
    accent: 'border-l-indigo-400',
  },
  {
    field: 'designerD',
    label: 'Bathroom & Kitchen',
    desc: 'Bathroom & kitchen drawings',
    roles: ['designer'],
    icon: Droplets,
    color: 'bg-cyan-100 text-cyan-600',
    accent: 'border-l-cyan-400',
  },
  {
    field: 'designerE',
    label: 'Concept & 3D',
    desc: 'Concept making & 3D renders',
    roles: ['designer'],
    icon: Layers,
    color: 'bg-purple-100 text-purple-600',
    accent: 'border-l-purple-400',
  },
  {
    field: 'supervisor',
    label: 'Site Supervisor',
    desc: 'On-site supervision & execution oversight',
    roles: ['supervisor', 'manager'],
    icon: HardHat,
    color: 'bg-amber-100 text-amber-600',
    accent: 'border-l-amber-400',
  },
  {
    field: 'contractor',
    label: 'Contractor',
    desc: 'Execution contractor on site',
    roles: ['designer', 'supervisor', 'manager', 'admin', 'md'],
    icon: Wrench,
    color: 'bg-slate-100 text-slate-600',
    accent: 'border-l-slate-400',
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Project Team"
      className="max-w-3xl"
    >
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              <span className="font-bold text-[var(--text-primary)]">{filledCount}</span>
              {' '}of {SLOTS.length} slots filled
            </span>
          </div>
          {filledCount === SLOTS.length && (
            <span className="flex items-center gap-1 text-xs font-bold text-[var(--success)]">
              <Check size={13} /> Full team assigned
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
            style={{ width: `${(filledCount / SLOTS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Slot grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SLOTS.map(({ field, label, desc, roles, icon: Icon, color, accent }) => (
          <div
            key={field}
            className={`border border-[var(--border)] border-l-4 ${accent} rounded-xl p-4 space-y-3 bg-[var(--bg)]`}
          >
            {/* Slot header */}
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{label}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>

            {/* Picker */}
            <EmployeePicker
              value={draft[field] || null}
              onChange={(user) => setDraft((prev) => ({ ...prev, [field]: user }))}
              placeholder={`Select ${label}...`}
              filterRoles={roles}
            />
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-5 mt-5 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">
          Changes apply only when you click Save.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            <Check size={14} className="mr-1.5" /> Save Team
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManageTeamModal;
export { SLOTS };
