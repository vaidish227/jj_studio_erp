import { useState, useEffect, useMemo } from 'react';
import { Briefcase, IndianRupee, ArrowRight, ArrowLeft, Sliders, ChevronRight } from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';
import Input from '../../../shared/components/Input/Input';
import DatePicker from '../../../shared/components/DatePicker/DatePicker';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import usePermission from '../../../shared/hooks/usePermission';
import { PERMISSIONS } from '../../../shared/constants/permissions';
import PlanCustomizer from './PlanCustomizer';

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
  const canCustomizePlan = usePermission(PERMISSIONS.PROJECTS_CUSTOMIZE_PLAN);

  const [step, setStep] = useState('basics'); // 'basics' | 'customize'
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    budget: '',
  });
  const [plan, setPlan] = useState(null);
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
    setPlan(null);
    setErrors({});
    setStep('basics');
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

  const projectTypeForPlan = useMemo(() => {
    const client = proposal?.leadId || proposal?.clientId;
    return client?.projectType || 'Residential';
  }, [proposal]);

  // ── Submit handlers ────────────────────────────────────────────────────────
  // Two submit paths share the same network call; difference is whether `plan`
  // is included in the payload. Defense in depth: backend re-checks permission.
  const performInitiate = async (includePlan) => {
    if (!proposal?._id) return;
    setSubmitting(true);
    try {
      const payload = {
        proposalId:              proposal._id,
        name:                    form.name.trim(),
        startDate:               form.startDate,
        estimatedCompletionDate: form.endDate,
        budget:                  Number(form.budget),
      };
      if (includePlan && plan) {
        // Strip __phaseIdx hints only present in fresh drafts; the backend
        // already accepts them but cleaner to omit purely-UI markers.
        payload.customizedPlan = {
          baseTemplateId: plan.baseTemplateId,
          phases: (plan.phases || []).map((p) => ({
            name: p.name, taskKeys: p.taskKeys || [],
          })),
          tasks: (plan.tasks || []).map((t) => {
            const { __phaseIdx, ...rest } = t;
            return { ...rest, __phaseIdx };
          }),
        };
      }
      const res = await pmsService.initiateFromProposal(payload);
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
      if (status === 409) onClose?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickInitiate = (e) => {
    e?.preventDefault?.();
    if (!validate()) return;
    performInitiate(false);
  };

  const handleGoToCustomize = () => {
    if (!validate()) return;
    setStep('customize');
  };

  const handleCustomizeAndInitiate = () => {
    performInitiate(true);
  };

  // Modal width adapts to step — basics is compact, customize needs room.
  const modalClass = step === 'customize' ? 'max-w-6xl' : 'max-w-xl';
  const modalTitle = step === 'customize'
    ? 'Customize Project Plan'
    : 'Project Creation Form';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} className={modalClass}>
      {step === 'basics' && (
        <form onSubmit={handleQuickInitiate} className="space-y-5">
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

          {/* Plan customization hint (visible only to MD/admin). Quietly absent
              for other roles — they get the standard default-template path. */}
          {canCustomizePlan && (
            <div className="p-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 flex items-center gap-3 flex-wrap">
              <Sliders size={16} className="text-[var(--primary)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">Customize plan for this project</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Edit phases, tasks, dates and owners before initiation. Otherwise the default template will be used.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGoToCustomize}
                disabled={submitting}
              >
                Customize <ChevronRight size={14} />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="font-bold">
              {submitting ? 'Initiating…' : (<><ArrowRight size={14} /> Initiate Project</>)}
            </Button>
          </div>
        </form>
      )}

      {step === 'customize' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep('basics')}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
              disabled={submitting}
            >
              <ArrowLeft size={12} /> Back to basics
            </button>
            <div className="text-[11px] text-[var(--text-muted)]">
              Project: <span className="font-bold text-[var(--text-primary)]">{form.name || '—'}</span>
              {' · '}
              Start: <span className="font-bold text-[var(--text-primary)]">{form.startDate || '—'}</span>
            </div>
          </div>

          <PlanCustomizer
            projectType={projectTypeForPlan}
            value={plan}
            onChange={setPlan}
            disabled={submitting}
          />

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setStep('basics')} disabled={submitting}>
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCustomizeAndInitiate}
              disabled={submitting || !plan?.baseTemplateId}
              className="font-bold"
            >
              {submitting ? 'Initiating…' : (<><ArrowRight size={14} /> Initiate with Custom Plan</>)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default InitiateProjectModal;
