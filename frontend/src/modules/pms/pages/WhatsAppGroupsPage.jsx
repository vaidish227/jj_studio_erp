import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Plus, Search, Filter, RefreshCw, Users,
  Send, Settings2, CheckCircle2, AlertCircle, Clock, Trash2,
  ExternalLink, FolderOpen,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import ManageGroupMembersModal from '../components/ManageGroupMembersModal';
import { useNavigate } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_TYPE_CONFIG = {
  main:       { label: 'Main',       accent: '#4A8F7C' },
  drawing:    { label: 'Drawing',    accent: '#3A6EA5' },
  supervision:{ label: 'Supervision',accent: '#4A8F7C' },
  payment:    { label: 'Payment',    accent: '#27AE60' },
  custom:     { label: 'Custom',     accent: '#6B7280' },
};

const SYNC_BADGE = {
  unsynced: { label: 'Not synced',  color: 'bg-[var(--border)] text-[var(--text-muted)]',    icon: Clock },
  synced:   { label: 'Synced',      color: 'bg-[var(--success)]/10 text-[var(--success)]',   icon: CheckCircle2 },
  partial:  { label: 'Partial',     color: 'bg-[var(--warning)]/10 text-[var(--warning)]',   icon: AlertCircle },
  failed:   { label: 'Failed',      color: 'bg-[var(--error)]/10 text-[var(--error)]',       icon: AlertCircle },
};

const GROUP_TYPES   = ['main', 'drawing', 'supervision', 'payment', 'custom'];
const SYNC_STATUSES = ['unsynced', 'synced', 'partial', 'failed'];

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

// ─── Sub-components ───────────────────────────────────────────────────────────

const SyncBadge = ({ syncStatus }) => {
  const cfg  = SYNC_BADGE[syncStatus] || SYNC_BADGE.unsynced;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const MemberAvatars = ({ members, max = 5 }) => {
  if (!members?.length) return <span className="text-[10px] text-[var(--text-muted)] italic">No members</span>;
  const visible  = members.slice(0, max);
  const overflow = members.length - max;
  return (
    <div className="flex items-center">
      {visible.map((m, i) => {
        const init = (m.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          <div
            key={m.phone || i}
            title={m.name || m.phone}
            style={{ marginLeft: i > 0 ? '-6px' : 0, zIndex: max - i }}
            className="relative w-6 h-6 rounded-full bg-[var(--primary)]/10 border-2 border-white flex items-center justify-center text-[7px] font-black text-[var(--primary)]"
          >
            {init}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          style={{ marginLeft: '-6px' }}
          className="relative w-6 h-6 rounded-full bg-[var(--border)] border-2 border-white flex items-center justify-center text-[7px] font-black text-[var(--text-muted)]"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

// ─── Group Card ───────────────────────────────────────────────────────────────

const GroupCard = ({ group, onManageMembers, onSync, onDelete, syncing }) => {
  const navigate = useNavigate();
  const accent   = GROUP_TYPE_CONFIG[group.groupType]?.accent || '#6B7280';

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="p-4">

        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${accent}18`, color: accent }}>
                {GROUP_TYPE_CONFIG[group.groupType]?.label || group.groupType}
              </span>
              <SyncBadge syncStatus={group.syncStatus} />
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">{group.groupName}</p>
          </div>
          <PermissionGate permission="pms.whatsapp.manage">
            <button
              onClick={() => onDelete(group._id)}
              className="p-1.5 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </PermissionGate>
        </div>

        {/* Project link */}
        {group.projectId && (
          <button
            onClick={() => navigate(`/projects/${group.projectId._id || group.projectId}`)}
            className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors mb-3 group"
          >
            <FolderOpen size={10} />
            <span className="truncate group-hover:underline">
              {group.projectId.name || 'View Project'}
            </span>
            <ExternalLink size={9} />
          </button>
        )}

        {/* Members */}
        <div className="flex items-center gap-2 mb-3">
          <MemberAvatars members={group.members} />
          <span className="text-[10px] text-[var(--text-muted)]">
            {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mb-3 flex-wrap">
          <span>{group.messageCount || 0} messages</span>
          {group.lastMessageAt && <span>Last: {fmt(group.lastMessageAt)}</span>}
          <span>Created {fmt(group.createdAt)}</span>
        </div>

        {group.syncErrors?.length > 0 && group.syncStatus !== 'synced' && (
          <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/20">
            <p className="text-[10px] text-[var(--error)]">{group.syncErrors[0]}</p>
          </div>
        )}

        {/* Actions */}
        <PermissionGate permission="pms.whatsapp.manage">
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onManageMembers(group)}>
              <Settings2 size={12} /> Members
            </Button>
            {!group.providerGroupId ? (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-[var(--accent-teal)] border-[var(--accent-teal)]/30"
                onClick={() => onSync(group._id)}
                disabled={syncing === group._id}
              >
                <RefreshCw size={12} className={syncing === group._id ? 'animate-spin' : ''} />
                {syncing === group._id ? 'Creating…' : 'Sync WA'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onSync(group._id)}
                disabled={syncing === group._id}
              >
                <RefreshCw size={12} className={syncing === group._id ? 'animate-spin' : ''} />
                {syncing === group._id ? 'Syncing…' : 'Re-sync'}
              </Button>
            )}
          </div>
        </PermissionGate>
      </div>
    </div>
  );
};

// ─── Stats Bar ────────────────────────────────────────────────────────────────

const StatsBar = ({ groups }) => {
  const total   = groups.length;
  const synced  = groups.filter((g) => g.syncStatus === 'synced').length;
  const partial = groups.filter((g) => g.syncStatus === 'partial' || g.syncStatus === 'failed').length;
  const members = new Set(groups.flatMap((g) => (g.members || []).map((m) => m.phone))).size;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total Groups',      value: total,   color: 'var(--primary)' },
        { label: 'Synced with WA',    value: synced,  color: 'var(--success)' },
        { label: 'Sync Needed',       value: partial, color: 'var(--warning)' },
        { label: 'Unique Members',    value: members, color: 'var(--accent-blue)' },
      ].map((s) => (
        <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3">
          <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const WhatsAppGroupsPage = () => {
  const { success, error: toastError } = useToast();

  const [groups, setGroups]             = useState([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [version, setVersion]           = useState(0);

  const [query, setQuery]               = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterSync, setFilterSync]     = useState('');

  const [managingGroup, setManagingGroup] = useState(null);
  const [syncing, setSyncing]             = useState(null);

  const LIMIT = 18;

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    setPage(1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const params = { page, limit: LIMIT };
    if (filterType) params.groupType  = filterType;
    if (filterSync) params.syncStatus = filterSync;

    pmsService.getAllWhatsAppGroups(params)
      .then((res) => {
        if (!cancelled) {
          const d = res.data?.data || res.data || {};
          setGroups(d.groups || []);
          setTotal(d.total  || 0);
        }
      })
      .catch((err) => {
        if (!cancelled) toastError(err?.response?.data?.message || err.message || 'Failed to load groups');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [version, page, filterType, filterSync]);

  const handleSync = async (groupId) => {
    setSyncing(groupId);
    try {
      const res = await pmsService.syncWhatsAppGroup(groupId);
      const d   = res.data?.data || res.data;
      success(d.syncStatus === 'synced'
        ? `Group synced — ${d.syncedMembers} members`
        : `Partial sync — ${d.errors?.length || 0} error(s)`);
      refresh();
    } catch (e) {
      toastError(e?.response?.data?.message || e.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (groupId) => {
    try {
      await pmsService.deleteWhatsAppGroup(groupId);
      success('Group deleted');
      refresh();
    } catch (e) {
      toastError(e?.response?.data?.message || e.message || 'Failed to delete');
    }
  };

  const handleAddMember = async (memberData) => {
    await pmsService.addWhatsAppGroupMember(managingGroup._id, memberData);
    // Refresh group data
    const res = await pmsService.getWhatsAppGroupById(managingGroup._id);
    const updated = res.data?.data || res.data;
    setManagingGroup(updated);
    setGroups((prev) => prev.map((g) => g._id === updated._id ? updated : g));
  };

  const handleRemoveMember = async (phone) => {
    await pmsService.removeWhatsAppGroupMember(managingGroup._id, phone);
    const res = await pmsService.getWhatsAppGroupById(managingGroup._id);
    const updated = res.data?.data || res.data;
    setManagingGroup(updated);
    setGroups((prev) => prev.map((g) => g._id === updated._id ? updated : g));
  };

  // Client-side name filter (applied on top of server filters)
  const visible = query.trim()
    ? groups.filter((g) =>
        g.groupName.toLowerCase().includes(query.toLowerCase()) ||
        (g.projectId?.name || '').toLowerCase().includes(query.toLowerCase())
      )
    : groups;

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-teal)]/10 flex items-center justify-center">
              <MessageCircle size={16} className="text-[var(--accent-teal)]" />
            </div>
            <h1 className="text-lg font-black text-[var(--text-primary)]">WhatsApp Groups</h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Manage project communication groups across all active projects
          </p>
        </div>
        <Button size="sm" onClick={refresh} variant="outline" className="shrink-0">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      {!isLoading && groups.length > 0 && <StatsBar groups={groups} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <Search size={14} className="text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by group name or project…"
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          >
            <option value="">All types</option>
            {GROUP_TYPES.map((t) => (
              <option key={t} value={t}>{GROUP_TYPE_CONFIG[t]?.label || t}</option>
            ))}
          </select>

          <select
            value={filterSync}
            onChange={(e) => { setFilterSync(e.target.value); setPage(1); }}
            className="px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          >
            <option value="">All sync</option>
            {SYNC_STATUSES.map((s) => (
              <option key={s} value={s}>{SYNC_BADGE[s]?.label || s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader label="Loading groups…" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-teal)]/10 flex items-center justify-center mb-4">
            <MessageCircle size={28} className="text-[var(--accent-teal)]" />
          </div>
          <p className="text-base font-bold text-[var(--text-primary)] mb-2">No groups found</p>
          <p className="text-sm text-[var(--text-muted)] max-w-xs">
            {filterType || filterSync || query
              ? 'Try adjusting your filters.'
              : 'Create WhatsApp groups from within a project\'s communication tab.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((g) => (
              <GroupCard
                key={g._id}
                group={g}
                onManageMembers={setManagingGroup}
                onSync={handleSync}
                onDelete={handleDelete}
                syncing={syncing}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)]">
                Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} groups
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Member Management Modal */}
      <ManageGroupMembersModal
        isOpen={!!managingGroup}
        onClose={() => setManagingGroup(null)}
        group={managingGroup}
        onAddMember={handleAddMember}
        onRemove={handleRemoveMember}
      />
    </div>
  );
};

export default WhatsAppGroupsPage;
