import React, { useState } from 'react';
import { Home, Truck, ChefHat, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

const IN_HOUSE_STEPS = [
  'kitchen_detail_elevation',
  'kitchen_3d',
  'kitchen_technical_drawings',
  'kitchen_release_ready',
];

const OUTSOURCED_STEPS = [
  'kitchen_vendor_purchase',
  'kitchen_tentative_quote',
  'kitchen_client_meeting',
  'kitchen_vendor_finalization',
];

const LABELS = {
  kitchen_detail_elevation:   'Detail Elevation',
  kitchen_3d:                 '3D Visualisation',
  kitchen_technical_drawings: 'Technical Drawings',
  kitchen_release_ready:      'Release Ready',
  kitchen_vendor_purchase:    'Vendor via Purchase',
  kitchen_tentative_quote:    'Tentative Quote',
  kitchen_client_meeting:     'Client Meeting',
  kitchen_vendor_finalization:'Vendor Finalisation',
};

/**
 * KitchenRoutingPanel — Phase 2.
 * Shown on the kitchen_drawing task detail page. Persists the routing decision
 * on the task and triggers the workflow engine to spawn the matching child tasks.
 *
 * Idempotent on the backend: re-saving the same routing is a no-op.
 *
 * Props:
 *   - task           — the kitchen_drawing Task doc
 *   - childTasks     — array of all sibling tasks on the project; this component
 *                      filters them to those depending on this task to render the
 *                      "branch timeline"
 *   - onUpdated      — called after a successful save
 */
const KitchenRoutingPanel = ({ task, childTasks = [], onUpdated }) => {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!task || task.taskType !== 'kitchen_drawing') return null;

  const currentRouting = task.routing || null;

  const handleChoose = async (routing) => {
    if (submitting) return;
    if (currentRouting === routing) return;
    setSubmitting(true);
    try {
      const res = await pmsService.updateTask(task._id, { routing });
      const spawned = res?.kitchenSpawn?.spawned ?? 0;
      toast.success(
        spawned > 0
          ? `Routing set to ${routing.replace('_', ' ')} — ${spawned} child task(s) spawned`
          : `Routing set to ${routing.replace('_', ' ')}`
      );
      onUpdated?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to set routing');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute the branch timeline by filtering child tasks belonging to this parent
  const branchTypes = currentRouting === 'in_house'
    ? IN_HOUSE_STEPS
    : currentRouting === 'outsourced'
    ? OUTSOURCED_STEPS
    : [];

  const children = branchTypes
    .map((tt) => childTasks.find((t) => t.taskType === tt))
    .filter(Boolean);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ChefHat size={16} className="text-[var(--warning)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Kitchen Routing</h3>
        {currentRouting && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-md">
            {currentRouting === 'in_house' ? 'IN-HOUSE' : 'OUTSOURCED'}
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Choose how this kitchen will be delivered. Setting routing auto-creates the
        matching child tasks. Child tasks stay blocked until this parent task is approved.
      </p>

      {/* Choice tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RoutingTile
          active={currentRouting === 'in_house'}
          label="In-House"
          icon={<Home size={16} />}
          description="Designer D continues with Detail Elevation → 3D → Technicals → Release Ready"
          onClick={() => handleChoose('in_house')}
          disabled={submitting}
        />
        <RoutingTile
          active={currentRouting === 'outsourced'}
          label="Outsourced"
          icon={<Truck size={16} />}
          description="Send to vendor through Purchase → Tentative Quote → Client Meeting → Finalisation"
          onClick={() => handleChoose('outsourced')}
          disabled={submitting}
        />
      </div>

      {/* Branch timeline */}
      {currentRouting && (
        <div className="pt-3 border-t border-[var(--border)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
            Branch timeline
          </p>
          {children.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No child tasks visible (may be loading).</p>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {children.map((c, i) => (
                <React.Fragment key={c._id}>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md
                      ${c.status === 'approved'
                        ? 'bg-[var(--success)]/12 text-[var(--success)]'
                        : c.status === 'blocked'
                          ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                          : 'bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)]'}
                    `}
                  >
                    {c.status === 'approved' && <CheckCircle2 size={11} />}
                    {LABELS[c.taskType] || c.taskType}
                  </span>
                  {i < children.length - 1 && <ArrowRight size={11} className="text-[var(--text-muted)]" />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RoutingTile = ({ active, label, icon, description, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`text-left p-3 rounded-xl border transition-colors disabled:opacity-50
      ${active
        ? 'border-[var(--primary)] bg-[var(--primary)]/8'
        : 'border-[var(--border)] hover:border-[var(--primary)]/40 bg-[var(--surface)]'}
    `}
  >
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-sm font-bold text-[var(--text-primary)]">{label}</span>
      {active && <CheckCircle2 size={13} className="ml-auto text-[var(--success)]" />}
    </div>
    <p className="text-xs text-[var(--text-muted)]">{description}</p>
  </button>
);

export default KitchenRoutingPanel;
