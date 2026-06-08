import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MapPin,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';
import MeetingCard from './MeetingCard';

// Compact clickable stat â€” half the height of DashboardCard, still acts as a
// quick filter. Designed so a row of 6 fits comfortably on one line at lg+.
const StatChip = ({ label, value, icon: Icon, iconCls, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border bg-[var(--surface)] transition-all text-left
      ${isActive
        ? 'border-[var(--primary)] shadow-sm shadow-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30'
        : 'border-[var(--border)] hover:border-[var(--primary)]/40'}
    `}
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
      <Icon size={15} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] truncate">{label}</p>
      <p className="text-lg font-black text-[var(--text-primary)] leading-tight">{value}</p>
    </div>
  </button>
);

/**
 * List view body for the unified Meetings page. Owns its own filtering, search
 * and stat-chip quick filters; receives the raw meetings + action handlers from
 * the parent page so data fetching and modals stay shared across views.
 */
const MeetingsListView = ({
  meetings,
  onViewDetails,
  onStatusChange,
  onReschedule,
  onRecordMOM,
}) => {
  const [searchParams] = useSearchParams();
  const navbarQuery = searchParams.get('q') || '';
  const searchTerm = navbarQuery.toLowerCase();

  // Stat-card quick filter: 'all' | 'scheduled' | 'rescheduled' | 'completed' | 'cancelled' | 'site'
  const [statCardFilter, setStatCardFilter] = useState('all');

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process,
  } = useFilters('crm', 'meetings');

  const visibleMeetings = useMemo(() => {
    let processedMeetings = process(meetings);

    if (searchTerm) {
      processedMeetings = processedMeetings.filter((meeting) => {
        const lead = meeting.leadId || {};
        const haystack = [
          lead.name,
          lead.phone,
          lead.projectType,
          lead.city,
          meeting.notes,
          meeting.type,
          meeting.status,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(searchTerm);
      });
    }

    if (statCardFilter === 'site') {
      processedMeetings = processedMeetings.filter((m) => m.type === 'site');
    } else if (statCardFilter !== 'all') {
      processedMeetings = processedMeetings.filter((m) => m.status === statCardFilter);
    }

    return processedMeetings;
  }, [meetings, process, searchTerm, statCardFilter]);

  const stats = useMemo(() => ({
    total: meetings.length,
    scheduled: meetings.filter((meeting) => meeting.status === 'scheduled').length,
    rescheduled: meetings.filter((meeting) => meeting.status === 'rescheduled').length,
    completed: meetings.filter((meeting) => meeting.status === 'completed').length,
    cancelled: meetings.filter((meeting) => meeting.status === 'cancelled').length,
    site: meetings.filter((meeting) => meeting.type === 'site').length,
  }), [meetings]);

  return (
    <div className="space-y-5">
      {/* Advanced Filter System â€” inline because only 4 controls fit easily */}
      <AdvancedFilter
        filters={filters}
        filterConfig={filterConfig}
        updateFilter={updateFilter}
        clearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        showSearch={true}
        compact={false}
        inlineSearch
      />

      {/* Stat chips â€” clickable quick filters (compact one-row tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <StatChip
          label="Total"
          value={stats.total}
          icon={CalendarIcon}
          iconCls="bg-[var(--primary)]/10 text-[var(--primary)]"
          isActive={statCardFilter === 'all'}
          onClick={() => setStatCardFilter('all')}
        />
        <StatChip
          label="Scheduled"
          value={stats.scheduled}
          icon={Clock}
          iconCls="bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
          isActive={statCardFilter === 'scheduled'}
          onClick={() => setStatCardFilter((prev) => (prev === 'scheduled' ? 'all' : 'scheduled'))}
        />
        <StatChip
          label="Rescheduled"
          value={stats.rescheduled}
          icon={RotateCcw}
          iconCls="bg-[var(--warning)]/10 text-[var(--warning)]"
          isActive={statCardFilter === 'rescheduled'}
          onClick={() => setStatCardFilter((prev) => (prev === 'rescheduled' ? 'all' : 'rescheduled'))}
        />
        <StatChip
          label="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          iconCls="bg-[var(--success)]/10 text-[var(--success)]"
          isActive={statCardFilter === 'completed'}
          onClick={() => setStatCardFilter((prev) => (prev === 'completed' ? 'all' : 'completed'))}
        />
        <StatChip
          label="Cancelled"
          value={stats.cancelled}
          icon={XCircle}
          iconCls="bg-[var(--error)]/10 text-[var(--error)]"
          isActive={statCardFilter === 'cancelled'}
          onClick={() => setStatCardFilter((prev) => (prev === 'cancelled' ? 'all' : 'cancelled'))}
        />
        <StatChip
          label="On-Site"
          value={stats.site}
          icon={MapPin}
          iconCls="bg-amber-100 text-amber-700"
          isActive={statCardFilter === 'site'}
          onClick={() => setStatCardFilter((prev) => (prev === 'site' ? 'all' : 'site'))}
        />
      </div>

      <div className="space-y-4">
        {visibleMeetings.length ? visibleMeetings.map((meeting) => (
          <MeetingCard
            key={meeting._id}
            meeting={meeting}
            onViewDetails={() => onViewDetails(meeting)}
            onStatusChange={onStatusChange}
            onReschedule={onReschedule}
            onRecordMOM={onRecordMOM}
          />
        )) : (
          <div className="py-20 text-center bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
            <div className="w-16 h-16 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon size={24} className="text-[var(--text-muted)] opacity-60" />
            </div>
            <p className="text-[var(--text-muted)] font-medium">
              No meetings match the current search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingsListView;
