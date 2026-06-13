import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Square } from 'lucide-react';

const ChecklistCard = ({ checklist }) => {
  const navigate = useNavigate();
  if (!checklist) return null;
  const onOpen = () => checklist.url && navigate(checklist.url);

  const progress = checklist.progress;
  const pct = progress ? progress.percent : 0;

  return (
    <div className="bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left mb-1.5"
      >
        <div className="text-sm font-medium text-[var(--text,#2E2E2E)] truncate">{checklist.taskTitle}</div>
        {progress && (
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted,#A0A0A0)] mb-1">
              <span>{progress.done}/{progress.total} done</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-[var(--bg,#F8F7F3)] rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ width: `${pct}%`, background: 'var(--primary,#D4B76C)' }}
              />
            </div>
          </div>
        )}
      </button>

      <div className="flex flex-col gap-0.5 mt-2 max-h-48 overflow-y-auto custom-scrollbar">
        {(checklist.items || []).map((it) => (
          <div key={it.index} className="flex items-start gap-1.5 text-xs">
            {it.isCompleted ? (
              <CheckSquare className="w-3.5 h-3.5 text-[var(--accent-teal,#4A8F7C)] mt-0.5 flex-shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 text-[var(--text-muted,#A0A0A0)] mt-0.5 flex-shrink-0" />
            )}
            <span className={it.isCompleted ? 'line-through text-[var(--text-muted,#A0A0A0)]' : 'text-[var(--text,#2E2E2E)]'}>
              {it.item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChecklistCard;
