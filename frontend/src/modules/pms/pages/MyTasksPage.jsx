import React, { useState, useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import { Loader } from '../../../shared/components';
import TaskCard from '../components/TaskCard';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { TASK_TYPE_CONFIG } from '../components/TaskTypeIcon';

const MyTasksPage = () => {
  const toast = useToast();
  const [tasks, setTasks]         = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion]     = useState(0);

  useEffect(() => {
    let cancelled = false;
    pmsService.getMyTasks()
      .then((res) => { if (!cancelled) setTasks(res.tasks || []); })
      .catch(() => { if (!cancelled) toast.error('Failed to load tasks'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    setIsLoading(true);
    setVersion((v) => v + 1);
  };

  // Group by taskType
  const grouped = tasks.reduce((acc, t) => {
    const k = t.taskType || 'other';
    if (!acc[k]) acc[k] = [];
    acc[k].push(t);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
          <CheckSquare size={20} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">My Tasks</h1>
          <p className="text-xs text-[var(--text-muted)]">{tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <CheckSquare size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">No tasks assigned to you.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([type, typeTasks]) => {
            const cfg = TASK_TYPE_CONFIG[type];
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  {cfg && (
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${cfg.bg}`}>
                      <cfg.Icon size={12} className={cfg.color} />
                    </div>
                  )}
                  <h2 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
                    {cfg?.label || type}
                  </h2>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] ml-auto">
                    {typeTasks.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {typeTasks.map((task) => (
                    <TaskCard key={task._id} task={task} onUpdated={refresh} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyTasksPage;
