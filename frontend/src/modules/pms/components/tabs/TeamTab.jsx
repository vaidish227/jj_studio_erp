import React, { useState } from 'react';
import { Users, UserPlus, Mail } from 'lucide-react';
import { Button } from '../../../../shared/components';
import { useAuth } from '../../../../shared/context/AuthContext';
import ManageTeamModal, { SLOTS } from '../ManageTeamModal';

const ROLE_BADGE = {
  admin:      { label: 'Admin',      cls: 'bg-red-100 text-red-700' },
  md:         { label: 'MD',         cls: 'bg-blue-100 text-blue-700' },
  manager:    { label: 'Manager',    cls: 'bg-indigo-100 text-indigo-700' },
  designer:   { label: 'Designer',   cls: 'bg-[var(--primary)]/10 text-[var(--primary)]' },
  supervisor: { label: 'Supervisor', cls: 'bg-amber-100 text-amber-700' },
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

const EmptySlotCard = ({ slot }) => {
  const Icon = slot.icon;
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-[var(--border)] opacity-40">
      <div className="w-10 h-10 rounded-xl bg-[var(--border)] flex items-center justify-center shrink-0">
        <Icon size={15} className="text-[var(--text-muted)]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--text-muted)]">{slot.label}</p>
        <p className="text-xs text-[var(--text-muted)]">Not assigned</p>
      </div>
    </div>
  );
};

const MemberCard = ({ slot, member }) => {
  const Icon  = slot.icon;
  const badge = ROLE_BADGE[member.role];
  return (
    <div className={`group flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] border-l-4 ${slot.accent} bg-[var(--surface)] transition-shadow hover:shadow-md`}>
      {/* Avatar */}
      <Avatar name={member.name} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-sm font-bold text-[var(--text-primary)] truncate">{member.name}</p>
          {badge && (
            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1">
          <Mail size={10} /> {member.email}
        </p>
      </div>

      {/* Slot badge */}
      <div className="shrink-0 text-right hidden sm:block">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${slot.color}`}>
          <Icon size={11} />
          {slot.label}
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const TeamTab = ({ project, onUpdated }) => {
  const { user }           = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  if (!project) return null;

  const canManage   = ['admin', 'md', 'manager'].includes(user?.role);
  const filledSlots = SLOTS.filter(({ field }) => project[field]);
  const emptySlots  = SLOTS.filter(({ field }) => !project[field]);
  const filledCount = filledSlots.length;

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <Users size={15} className="text-[var(--primary)]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Project Team</p>
            <p className="text-xs text-[var(--text-muted)]">
              {filledCount} of {SLOTS.length} slots filled
            </p>
          </div>
        </div>

        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            <UserPlus size={13} className="mr-1.5" />
            {filledCount === 0 ? 'Build Team' : 'Manage Team'}
          </Button>
        )}
      </div>

      {/* ── Empty state ── */}
      {filledCount === 0 && (
        <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-[var(--border)] rounded-2xl gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
            <Users size={24} className="text-[var(--primary)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-[var(--text-primary)]">No team assigned yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
              {canManage
                ? 'Assign designers, supervisors, and contractors to get started.'
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

      {/* ── Member cards ── */}
      {filledCount > 0 && (
        <div className="space-y-3">
          {/* Assigned */}
          <div className="space-y-2.5">
            {filledSlots.map(({ field, ...slot }) => (
              <MemberCard key={field} slot={slot} member={project[field]} />
            ))}
          </div>

          {/* Empty slots — compact */}
          {emptySlots.length > 0 && (
            <>
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] pt-3 pb-1">
                Unassigned slots
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {emptySlots.map(({ field, ...slot }) => (
                  <EmptySlotCard key={field} slot={slot} />
                ))}
              </div>
            </>
          )}
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
