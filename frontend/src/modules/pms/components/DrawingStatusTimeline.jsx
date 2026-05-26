import React from 'react';
import { Check, Clock, Send, XCircle, Rocket } from 'lucide-react';

const STEPS = [
  { key: 'draft',             label: 'Draft',       Icon: Clock   },
  { key: 'sent_for_approval', label: 'In Review',   Icon: Send    },
  { key: 'approved',          label: 'Approved',    Icon: Check   },
  { key: 'released_to_site',  label: 'Released',    Icon: Rocket  },
];

const STATUS_COLORS = {
  draft:             'var(--text-muted)',
  sent_for_approval: 'var(--warning)',
  approved:          'var(--accent-green)',
  rejected:          'var(--error)',
  released_to_site:  'var(--primary)',
};

const DrawingStatusTimeline = ({ status }) => {
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-1.5">
        <XCircle size={13} className="text-[var(--error)]" />
        <span className="text-xs font-semibold text-[var(--error)]">Revision Required</span>
      </div>
    );
  }

  const activeIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, idx) => {
        const done    = idx < activeIdx;
        const active  = idx === activeIdx;
        const color   = active ? STATUS_COLORS[status] || 'var(--primary)' : done ? 'var(--accent-green)' : 'var(--border)';
        const textCls = active
          ? 'text-[var(--text-primary)] font-semibold'
          : done
          ? 'text-[var(--text-muted)]'
          : 'text-[var(--border)]';

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1.5px solid ${color}` }}
              >
                <step.Icon size={10} style={{ color }} />
              </div>
              <span className={`text-[9px] mt-0.5 ${textCls} hidden sm:block`}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className="h-px flex-1 mt-[-10px]"
                style={{ background: done ? 'var(--accent-green)' : 'var(--border)' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default DrawingStatusTimeline;
