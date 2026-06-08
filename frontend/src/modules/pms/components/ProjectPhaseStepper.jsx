import React, { useMemo } from 'react';
import { Check } from 'lucide-react';

// Fallback — used only when the project has no workflow template attached
// (legacy projects created before the template picker shipped).
const DEFAULT_PHASES = [
  { key: 'kickoff',     label: 'Kickoff'     },
  { key: 'layout',      label: 'Layout'      },
  { key: 'design',      label: 'Design'      },
  { key: 'procurement', label: 'Procurement' },
  { key: 'release',     label: 'Release'     },
  { key: 'execution',   label: 'Execution'   },
  { key: 'handover',    label: 'Handover'    },
];

/**
 * ProjectPhaseStepper — sticky horizontal stepper showing where the project sits
 * in its workflow's phase progression.
 *
 * Phase list is read from `project.workflowTemplateId.phases` so a project
 * built from a custom template (e.g. "Villa Premium" with a "Vastu" phase)
 * displays its own flow. Falls back to the canonical 7-phase list for legacy
 * projects with no template attached.
 */
const STATUS_FALLBACK = {
  design_phase:    'design',
  execution_phase: 'execution',
  handover:        'handover',
  completed:       'handover',
};

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, '_');

const ProjectPhaseStepper = ({ project, className = '' }) => {
  // Prefer template phases over the hardcoded fallback. Sort by `order` so
  // re-ordered phases render correctly.
  const phases = useMemo(() => {
    const tplPhases = project?.workflowTemplateId?.phases;
    if (Array.isArray(tplPhases) && tplPhases.length > 0) {
      return [...tplPhases]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((p) => ({
          key:   slugify(p.name),
          label: String(p.name || '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        }));
    }
    return DEFAULT_PHASES;
  }, [project]);

  if (!project) return null;

  const currentPhase = project.phase || STATUS_FALLBACK[project.status] || phases[0]?.key || 'kickoff';
  const currentIdx = Math.max(0, phases.findIndex((p) => p.key === currentPhase));

  return (
    <div
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl
                  p-3 lg:p-4 overflow-x-auto ${className}`}
    >
      <div className="flex items-center gap-1 min-w-max">
        {phases.map((phase, idx) => {
          const isDone    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture  = idx > currentIdx;

          return (
            <React.Fragment key={`${phase.key}-${idx}`}>
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors
                  ${isDone    ? 'bg-[var(--success)]/10 text-[var(--success)]'        : ''}
                  ${isCurrent ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-bold' : ''}
                  ${isFuture  ? 'text-[var(--text-muted)]'                              : ''}
                `}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black
                    ${isDone    ? 'bg-[var(--success)] text-white'        : ''}
                    ${isCurrent ? 'bg-[var(--primary)] text-white'        : ''}
                    ${isFuture  ? 'bg-[var(--border)] text-[var(--text-muted)]' : ''}
                  `}
                >
                  {isDone ? <Check size={11} strokeWidth={3} /> : idx + 1}
                </div>
                <span className="text-xs uppercase tracking-wider">{phase.label}</span>
              </div>

              {idx < phases.length - 1 && (
                <div
                  className={`h-px w-6 shrink-0 transition-colors
                    ${idx < currentIdx ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectPhaseStepper;
