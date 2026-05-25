import React from 'react';

const DesignerStatCard = ({ icon: Icon, label, value, color = 'var(--primary)', sub }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-start gap-3">
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <Icon size={18} style={{ color }} />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-black text-[var(--text-primary)] leading-none">{value ?? '—'}</p>
      <p className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  </div>
);

export default DesignerStatCard;
