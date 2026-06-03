import React from 'react';
import { Check } from 'lucide-react';

const PHASES = [
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
 * in the workflow engine's phase progression.
 *
 * Falls back gracefully on legacy projects with no `phase` field (engine not run):
 * derives the phase from status so the component still renders.
 */
const STATUS_FALLBACK = {
  design_phase:    'design',
  execution_phase: 'execution',
  handover:        'handover',
  completed:       'handover',
};

const ProjectPhaseStepper = ({ project, className = '' }) => {
  if (!project) return null;

  const currentPhase = project.phase || STATUS_FALLBACK[project.status] || 'kickoff';
  const currentIdx = Math.max(0, PHASES.findIndex((p) => p.key === currentPhase));

  return (
    <div
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl
                  p-3 lg:p-4 overflow-x-auto ${className}`}
    >
      <div className="flex items-center gap-1 min-w-max">
        {PHASES.map((phase, idx) => {
          const isDone    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture  = idx > currentIdx;

          return (
            <React.Fragment key={phase.key}>
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

              {idx < PHASES.length - 1 && (
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
