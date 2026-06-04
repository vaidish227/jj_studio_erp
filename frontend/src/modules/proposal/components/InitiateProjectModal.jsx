import React, { useState, useEffect } from 'react';
import { Briefcase, IndianRupee, ArrowRight } from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';
import Input from '../../../shared/components/Input/Input';
import DatePicker from '../../../shared/components/DatePicker/DatePicker';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const defaultName = (proposal) => {
  const client = proposal?.leadId || proposal?.clientId;
  if (!client?.name) return '';
  const type = client.projectType || 'Interior';
  return `${client.name} — ${type} Project`;
};

const defaultBudget = (proposal) => {
  if (!proposal) return '';
  const v = proposal.finalAmount || proposal.totalAmount || 0;
  return v > 0 ? String(v) : '';
};

const InitiateProjectModal = ({ isOpen, onClose, proposal, onSuccess }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    budget: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset / pre-fill when the modal opens or a different proposal is targeted.
  useEffect(() => {
    if (!isOpen) return;
    setForm({
      name:      defaultName(proposal),
      startDate: todayISO(),
      endDate:   '',
      budget:    defaultBudget(proposal),
    });
    setErrors({});
  }, [isOpen, proposal?._id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name || form.name.trim().length < 2) {
      next.name = 'Project name is required (min 2 characters)';
    } else if (form.name.length > 200) {
      next.name = 'Project name is too long';
    }
    if (!form.startDate) next.startDate = 'Start date is required';
    if (!form.endDate)   next.endDate   = 'End date is required';
    if (form.startDate && form.endDate && form.endDate <= form.startDate) {
      next.endDate = 'End date must be after start date';
    }
    const budgetNum = Number(form.budget);
    if (!form.budget || !(budgetNum > 0)) {
      next.budget = 'Budget must be a positive number';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proposal?._id) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await pmsService.initiateFromProposal({
        proposalId:              proposal._id,
        name:                    form.name.trim(),
        startDate:               form.startDate,
        estimatedCompletionDate: form.endDate,
        budget:                  Number(form.budget),
      });
      const project = res?.data?.project || res?.project;
      const trackingId = project?.trackingId || '';
      toast.success(
        trackingId ? `Project ${trackingId} initiated` : 'Project initiated'
      );
      onSuccess?.(project?._id);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || 'Failed to initiate project';
      toast.error(message);
      if (status === 409) {
        // Duplicate — close so the dashboard can re-fetch and reflect the started state.
        onClose?.();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Project Creation Form" className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
            <Briefcase size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">From Proposal</p>
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">
              {proposal?.title || proposal?.leadId?.name || '—'}
            </p>
          </div>
        </div>

        <FormField label="Project Name" required error={errors.name}>
          <Input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Anil Mehta — Residential Project"
            maxLength={200}
            disabled={submitting}
            error={errors.name}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker
            label="Start Date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            required
            disabled={submitting}
            error={errors.startDate}
          />
          <DatePicker
            label="End Date"
            name="endDate"
            value={form.endDate}
            onChange={handleChange}
            min={form.startDate || undefined}
            required
            disabled={submitting}
            error={errors.endDate}
          />
        </div>

        <FormField label="Budget (INR)" required error={errors.budget}>
          <Input
            type="number"
            name="budget"
            value={form.budget}
            onChange={handleChange}
            icon={IndianRupee}
            placeholder="0"
            min={0}
            step="1"
            disabled={submitting}
            error={errors.budget}
          />
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting} className="font-bold">
            {submitting ? 'Initiating…' : (<><ArrowRight size={14} /> Initiate Project</>)}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default InitiateProjectModal;
