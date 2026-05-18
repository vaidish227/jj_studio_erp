import React from 'react';
import { User } from 'lucide-react';

const TEAM_SLOTS = [
  { field: 'primaryDesigner', label: 'Designer A',   desc: 'Primary designer, client contact' },
  { field: 'designerB',       label: 'Designer B',   desc: 'Site measurements & furniture layout' },
  { field: 'designerC',       label: 'Designer C',   desc: 'AC coordination, technical & automation drawings' },
  { field: 'designerD',       label: 'Designer D',   desc: 'Bathroom & kitchen drawings' },
  { field: 'designerE',       label: 'Designer E',   desc: 'Concept making & 3D renders' },
  { field: 'supervisor',      label: 'Supervisor',   desc: 'Site supervision' },
  { field: 'contractor',      label: 'Contractor',   desc: 'Execution contractor' },
];

const Avatar = ({ name }) => (
  <div className="w-9 h-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-xs font-black text-[var(--primary)] uppercase shrink-0">
    {name?.[0] || <User size={14} />}
  </div>
);

const TeamTab = ({ project }) => {
  if (!project) return null;

  return (
    <div className="space-y-3">
      {TEAM_SLOTS.map(({ field, label, desc }) => {
        const member = project[field];
        return (
          <div
            key={field}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4"
          >
            <Avatar name={member?.name} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
              {member ? (
                <>
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{member.name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{member.email}</p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)] italic">Not assigned</p>
              )}
            </div>
            <p className="hidden lg:block text-xs text-[var(--text-muted)] max-w-xs text-right">{desc}</p>
          </div>
        );
      })}
    </div>
  );
};

export default TeamTab;
