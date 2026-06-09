import React, { useState, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import ChecklistItem from './ChecklistItem';

const ChecklistPanel = ({ taskId, checklist = [], onUpdated }) => {
  const toast = useToast();
  const [items, setItems]   = useState(checklist);
  const [toggling, setToggling] = useState(null);

  const completed = items.filter((i) => i.isCompleted).length;
  const pct       = items.length ? Math.round((completed / items.length) * 100) : 0;

  const handleToggle = useCallback(async (idx) => {
    const current = items[idx].isCompleted;
    const next    = !current;

    // Optimistic update
    setItems((prev) => {
      const updated = [...prev];
      updated[idx]  = { ...updated[idx], isCompleted: next, completedAt: next ? new Date() : null };
      return updated;
    });
    setToggling(idx);

    try {
      await pmsService.toggleChecklist(taskId, idx, next);
      onUpdated?.();
    } catch {
      // Rollback on failure
      setItems((prev) => {
        const rolled = [...prev];
        rolled[idx]  = { ...rolled[idx], isCompleted: current, completedAt: null };
        return rolled;
      });
      toast.error('Failed to update checklist item');
    } finally {
      setToggling(null);
    }
  }, [items, taskId, toast, onUpdated]);

  if (!items.length) {
    return (
      <p className="text-xs text-[var(--text-muted)] py-2 px-1">No checklist items for this task.</p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-2 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-[var(--success)]' : 'bg-[var(--primary)]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-black text-[var(--text-secondary)] whitespace-nowrap">
          {pct}%
        </span>
      </div>

      {items.map((item, idx) => (
        <ChecklistItem
          key={idx}
          item={item.item}
          isCompleted={item.isCompleted}
          completedAt={item.completedAt}
          onToggle={() => handleToggle(idx)}
          disabled={toggling !== null}
        />
      ))}
    </div>
  );
};

export default ChecklistPanel;
