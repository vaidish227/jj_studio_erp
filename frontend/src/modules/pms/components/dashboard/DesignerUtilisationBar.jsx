import React from 'react';
import { Users } from 'lucide-react';

/**
 * DesignerUtilisationBar — top-N designers ranked by activeTasks, with a
 * horizontal bar showing their completion rate. Colour band mirrors
 * ProgressRing so values are visually consistent across the app.
 */

const bandColor = (pct) => {
  if (pct >= 100) return 'var(--success)';
  if (pct >= 75)  return 'var(--warning)';
  if (pct >= 50)  return 'var(--primary)';
  if (pct >= 25)  return 'var(--accent-blue)';
  return 'var(--text-muted)';
};

const ROLE_LABEL = {
  primary_designer: 'Primary Designer',
  designer:         'Designer',
  supervisor:       'Supervisor',
  contractor:       'Contractor',
  manager:          'Manager',
  admin:            'Admin',
};

const DesignerUtilisationBar = ({ designers = [] }) => {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 lg:p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Designer Utilisation</h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          {designers.length} active
        </span>
      </div>

      {designers.length === 0 ? (
        <div className="py-10 text-center text-sm text-[var(--text-muted)]">
          No tasks assigned yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {designers.map((u) => {
            const color = bandColor(u.completionRate);
            return (
              <li key={u.userId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-bold text-[var(--text-primary)] truncate">{u.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)] capitalize">
                      {ROLE_LABEL[u.role] || u.role || '—'} · {u.activeTasks} active{u.blockedTasks > 0 ? ` · ${u.blockedTasks} blocked` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold tabular-nums" style={{ color }}>
                    {u.completionRate}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden border border-[var(--border)]">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, u.completionRate)}%`, background: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default DesignerUtilisationBar;
