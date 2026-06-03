import React, { useState, useEffect } from 'react';
import { Layers, ChevronRight, ArrowLeft, GitBranch, Lock, Workflow, AlertTriangle } from 'lucide-react';
import { Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import { useAuth } from '../../../shared/context/AuthContext';

/**
 * WorkflowTemplatesPage — Phase 3b read-only viewer.
 *
 * Lists registered WorkflowTemplate documents (e.g. "Residential Full") and
 * lets admins inspect each one — phases, tasks, gates, dependencies.
 *
 * Full editor with graph manipulation is Phase 4. For now, edits happen via
 * the seed scripts.
 */

const APPROVER_BADGE_CLS = {
  client:                'bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]',
  manager:               'bg-[var(--text-muted)]/12 text-[var(--text-muted)]',
  principal_designer:    'bg-[var(--primary)]/12 text-[var(--primary)]',
  principal_and_client:  'bg-[var(--warning)]/12 text-[var(--warning)]',
};

const TemplateDetail = ({ template, onBack }) => {
  // Build a quick lookup: which tasks belong to which phase
  const taskByKey = Object.fromEntries((template.tasks || []).map((t) => [t.key, t]));
  const gateByKey = Object.fromEntries((template.gates || []).map((g) => [g.key, g]));

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
        <ArrowLeft size={12} /> Back to templates
      </button>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Workflow size={18} className="text-[var(--primary)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">{template.name}</h2>
          {template.isDefault && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--success)] bg-[var(--success)]/12 px-1.5 py-0.5 rounded">DEFAULT</span>
          )}
          {!template.isActive && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] px-1.5 py-0.5 rounded">INACTIVE</span>
          )}
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
            {template.projectType || 'Any'} · {template.phases?.length} phases · {template.tasks?.length} tasks · {template.gates?.length} gates
          </span>
        </div>
        {template.description && <p className="text-sm text-[var(--text-secondary)]">{template.description}</p>}
      </div>

      {/* Phases */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Phases</h3>
        <div className="space-y-3">
          {(template.phases || []).map((phase) => (
            <div key={phase.name} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black w-6 h-6 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center">{phase.order}</span>
                <h4 className="text-sm font-bold text-[var(--text-primary)] capitalize">{phase.name}</h4>
              </div>

              {/* Tasks in this phase */}
              {phase.taskKeys?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Tasks</p>
                  <div className="space-y-1.5">
                    {phase.taskKeys.map((key) => {
                      const t = taskByKey[key];
                      if (!t) return null;
                      return (
                        <div key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                            {t.taskType}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.title}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">
                              {t.teamSlot && `slot=${t.teamSlot} · `}
                              day +{t.dayOffsetFromProjectStart || 0}
                              {t.dependsOnKeys?.length > 0 && ` · depends on ${t.dependsOnKeys.join(', ')}`}
                              {t.requiresGateKeys?.length > 0 && ` · blocked by ${t.requiresGateKeys.join(', ')}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Gates in this phase */}
              {phase.gateKeys?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Gates</p>
                  <div className="flex flex-wrap gap-2">
                    {phase.gateKeys.map((key) => {
                      const g = gateByKey[key];
                      if (!g) return null;
                      const badgeCls = APPROVER_BADGE_CLS[g.approverType] || APPROVER_BADGE_CLS.client;
                      return (
                        <span
                          key={key}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${badgeCls}`}
                          title={g.gateType}
                        >
                          <Lock size={9} /> {g.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gates list (full catalogue) */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">All Approval Gates ({template.gates?.length || 0})</h3>
        <div className="space-y-2">
          {(template.gates || []).map((g) => {
            const badgeCls = APPROVER_BADGE_CLS[g.approverType] || APPROVER_BADGE_CLS.client;
            return (
              <div key={g.key} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3 flex-wrap">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${badgeCls}`}>
                  {g.approverType.replace('_', ' ')}
                </span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{g.label}</p>
                <span className="text-[10px] text-[var(--text-muted)]">{g.gateType}</span>
                {g.listensTo && <span className="text-[10px] text-[var(--text-muted)]">listens to <code>{g.listensTo}</code></span>}
                {g.blockedActivities?.length > 0 && (
                  <span className="ml-auto text-[10px] text-[var(--warning)]">
                    blocks: {g.blockedActivities.join(', ')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center py-4 italic">
        Read-only view. Edit templates via <code>backend/src/scripts/seedWorkflowTemplates.js</code>. Full graph editor is Phase 4.
      </p>
    </div>
  );
};

const WorkflowTemplatesPage = () => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const canManage = hasPermission('settings.workflows.manage');

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    pmsService.listWorkflowTemplates()
      .then((res) => setTemplates(res.templates || []))
      .catch((err) => toast.error(err?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [canManage]);

  if (!canManage) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-[var(--warning)]" />
        <p className="text-sm text-[var(--text-muted)]">You need the <code>settings.workflows.manage</code> permission to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader /></div>;
  }

  if (selected) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <TemplateDetail template={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text-primary)]">Workflow Templates</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Read-only viewer. Templates drive what tasks + gates are created when a project is initiated.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No workflow templates registered.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Run <code>node backend/src/scripts/seedWorkflowTemplates.js</code> to seed.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t._id}
              onClick={async () => {
                try {
                  const full = await pmsService.getWorkflowTemplate(t._id);
                  setSelected(full.template);
                } catch (err) { toast.error(err?.message || 'Failed'); }
              }}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 flex items-center gap-3 hover:border-[var(--primary)] transition-colors text-left"
            >
              <Workflow size={20} className="text-[var(--primary)]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{t.name}</h3>
                  {t.isDefault && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--success)] bg-[var(--success)]/12 px-1.5 py-0.5 rounded">DEFAULT</span>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {t.projectType || 'Any'} · {t.phaseCount} phases · {t.taskCount} tasks · {t.gateCount} gates
                  </span>
                </div>
                {t.description && <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{t.description}</p>}
              </div>
              <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowTemplatesPage;
