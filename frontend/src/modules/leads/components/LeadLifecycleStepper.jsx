import React from 'react';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';

// Maps detailed internal lifecycleStage values to the 5 visible pipeline steps.
// Payment/Project/Converted collapse into the final "Converted" step because
// in this studio's flow, receiving the advance simultaneously converts the
// client and initiates the project.
const STAGE_TO_STEP = {
  enquiry: 0,
  client_info_pending: 0,
  meeting_scheduled: 1,
  thank_you_sent: 1,
  kit: 1,
  followup_due: 1,
  show_project: 2,
  interested: 2,
  proposal_sent: 3,
  advance_received: 4,
  project_moved: 4,
  project_started: 4,
  converted: 4,
  lost: -1, // special — renders red
};

const STEPS = [
  { label: 'Enquiry',    sublabel: 'Lead registered' },
  { label: 'Meeting',    sublabel: 'Scheduled & conducted' },
  { label: 'Interested', sublabel: 'Client interest confirmed' },
  { label: 'Proposal',   sublabel: 'Sent & under review' },
  { label: 'Converted',  sublabel: 'Advance received • Project initiated' },
];

const LeadLifecycleStepper = ({ lifecycleStage, status }) => {
  const isLost = status === 'lost' || lifecycleStage === 'lost';
  const currentStep = isLost ? -1 : (STAGE_TO_STEP[lifecycleStage] ?? 0);
  // The terminal "Converted" step can never satisfy `currentStep > idx`, so it
  // would stay stuck as "current". When the lead has actually converted, mark
  // the final step as complete instead.
  const isConverted = status === 'converted' || lifecycleStage === 'converted';

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-start min-w-max gap-0">
        {STEPS.map((step, idx) => {
          const isDone = currentStep > idx || (currentStep === idx && isConverted);
          const isCurrent = currentStep === idx && !isDone;

          return (
            <React.Fragment key={step.label}>
              {/* Step node */}
              <div className="flex flex-col items-center gap-1.5 w-28">
                {/* Icon */}
                <div
                  className={[
                    'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ring-2',
                    isDone
                      ? 'bg-[var(--primary)] text-white ring-[var(--primary)]/20'
                      : isCurrent
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30'
                      : isLost
                      ? 'bg-red-50 text-red-400 ring-red-100'
                      : 'bg-[var(--surface)] text-[var(--text-muted)] ring-[var(--border)]',
                  ].join(' ')}
                >
                  {isLost ? (
                    <XCircle size={18} />
                  ) : isDone ? (
                    <CheckCircle2 size={18} />
                  ) : isCurrent ? (
                    <Circle size={18} className="fill-[var(--primary)]/20" />
                  ) : (
                    <Circle size={18} />
                  )}
                </div>

                {/* Labels */}
                <div className="text-center">
                  <p
                    className={[
                      'text-xs font-bold leading-tight',
                      isDone || isCurrent
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)]',
                    ].join(' ')}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                    {step.sublabel}
                  </p>
                </div>
              </div>

              {/* Connector line (not after last step) */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 mt-4 mx-1">
                  <div
                    className={[
                      'h-0.5 w-full transition-all duration-500',
                      currentStep > idx
                        ? 'bg-[var(--primary)]'
                        : 'bg-[var(--border)]',
                    ].join(' ')}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Lost lead badge */}
      {isLost && (
        <div className="mt-3 flex items-center gap-2 text-red-500">
          <XCircle size={14} />
          <span className="text-xs font-bold">Lead marked as lost</span>
        </div>
      )}
    </div>
  );
};

export default LeadLifecycleStepper;
