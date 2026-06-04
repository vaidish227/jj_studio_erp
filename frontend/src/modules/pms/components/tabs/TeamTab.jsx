import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Users, UserPlus, Mail } from 'lucide-react';
import { Button } from '../../../../shared/components';
import { useAuth } from '../../../../shared/context/AuthContext';
import ManageTeamModal from '../ManageTeamModal';
import { groupAssignmentsByUser } from '../../utils/teamHelpers';

const ROLE_BADGE = {
  admin:      { label: 'Admin',      cls: 'bg-red-100 text-red-700' },
  md:         { label: 'MD',         cls: 'bg-blue-100 text-blue-700' },
  manager:    { label: 'Manager',    cls: 'bg-indigo-100 text-indigo-700' },
  designer:   { label: 'Designer',   cls: 'bg-[var(--primary)]/10 text-[var(--primary)]' },
  supervisor: { label: 'Supervisor', cls: 'bg-amber-100 text-amber-700' },
};

const FallbackIcon = LucideIcons.Users;
const ResponsibilityIcon = ({ name, className, size = 13 }) => {
  const Comp = (name && LucideIcons[name]) || FallbackIcon;
  return <Comp size={size} className={className} />;
};

const Avatar = ({ name, size = 'md' }) => {
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const sz = size === 'lg'
    ? 'w-14 h-14 text-base'
    : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-xl bg-[var(--primary)]/10 flex items-center justify-center font-black text-[var(--primary)] shrink-0`}>
      {initials}
    </div>
  );
};

const PersonCard = ({ user, responsibilities }) => {
  const badge = ROLE_BADGE[user.role];
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <Avatar name={user.name} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-bold text-[var(--text-primary)] truncate">{user.name}</p>
          {badge && (
            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        {user.email && (
          <p className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <Mail size={10} /> {user.email}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {responsibilities.map((r) => (
            <span
              key={r._id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--bg)] border border-[var(--border)] ${r.color || ''}`}
            >
              <ResponsibilityIcon name={r.icon} size={10} />
              {r.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const TeamTab = ({ project, onUpdated }) => {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  if (!project) return null;

  const canManage = ['admin', 'md', 'manager'].includes(user?.role);
  // Each assignment is either a saved responsibility OR a per-project
  // custom work item; both count here.
  const assignments = (project.assignments || []).filter(
    (a) => (a.responsibilityId || a.customName) && (a.users || []).length > 0
  );
  const totalAssignments = assignments.length;
  const peopleRows = groupAssignmentsByUser(project);

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <Users size={15} className="text-[var(--primary)]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Project Team</p>
            <p className="text-xs text-[var(--text-muted)]">
              {totalAssignments} responsibilit{totalAssignments === 1 ? 'y' : 'ies'}, {peopleRows.length} {peopleRows.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
              <UserPlus size={13} className="mr-1.5" />
              {totalAssignments === 0 ? 'Build Team' : 'Manage Team'}
            </Button>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {totalAssignments === 0 && (
        <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-[var(--border)] rounded-2xl gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
            <Users size={24} className="text-[var(--primary)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-[var(--text-primary)]">No team assigned yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
              {canManage
                ? 'Pick the responsibilities this project needs and assign people to each.'
                : 'The project manager will assign team members soon.'}
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <UserPlus size={13} className="mr-1.5" /> Build Team
            </Button>
          )}
        </div>
      )}

      {/* ── By Person — one card per user with chips of their responsibilities ── */}
      {totalAssignments > 0 && (
        <div className="space-y-2.5">
          {peopleRows.map(({ user: u, responsibilities }) => (
            <PersonCard key={u._id} user={u} responsibilities={responsibilities} />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      <ManageTeamModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        project={project}
        onSaved={onUpdated}
      />
    </>
  );
};

export default TeamTab;
