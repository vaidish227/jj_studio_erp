import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Plus,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../../shared/components/Button/Button';
import Modal from '../../../shared/components/Modal/Modal';
import DateTimePicker from '../../../shared/components/DateTimePicker/DateTimePicker';
import Select from '../../../shared/components/Select/Select';
import { crmService } from '../../../shared/services/crmService';
import { Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';
import AskAIButton from '../../ai/components/AskAIButton';
import { resolveEntry } from '../../ai/aiEntryPoints';
import RecordMOMModal from '../components/RecordMOMModal';
import MeetingOutcomeModal from '../components/MeetingOutcomeModal';
import AttendeesEditor from '../../../shared/components/AttendeesEditor/AttendeesEditor';
import MeetingCard from '../components/MeetingCard';
import {
  EMPTY_ATTENDEES,
  seedClientAttendeesForLead,
  hydrateAttendeesFromMeeting,
} from '../utils/attendees';

const POLL_INTERVAL_MS = 30000;

// Compact clickable stat — half the height of DashboardCard, still acts as a
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

const MeetingsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const navbarQuery = searchParams.get('q') || '';
  const [meetings, setMeetings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isMOMModalOpen, setIsMOMModalOpen] = useState(false);
  const [momMeeting, setMomMeeting] = useState(null);
  const [outcomeModalMeeting, setOutcomeModalMeeting] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedLead, setSelectedLead] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState(() => {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    return `${String(nextHour.getHours()).padStart(2, '0')}:00`;
  });
  const [meetingType, setMeetingType] = useState('office');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingStatus, setMeetingStatus] = useState('scheduled');
  const [attendees, setAttendees] = useState(EMPTY_ATTENDEES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Stat-card quick filter: 'all' | 'scheduled' | 'rescheduled' | 'completed' | 'cancelled' | 'site'
  const [statCardFilter, setStatCardFilter] = useState('all');

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('crm', 'meetings');

  const fetchData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true); // only first time
    
    try {
      const [meetingsRes, leadsRes] = await Promise.all([
        crmService.getMeetings(),
        crmService.getLeads({ limit: 100 }),
      ]);

      setMeetings(
        (meetingsRes.meetings || []).sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        )
      );
      setLeads(leadsRes.leads || []);
    } catch {
      toast.error('Failed to load meetings dashboard.');
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true); // initial load with loader

    const intervalId = setInterval(() => {
      fetchData(false); // silent refresh
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Apply navbar search to filters
const searchTerm = navbarQuery.toLowerCase();

  // Apply reusable filter system
  const filteredMeetings = useMemo(() => {
    // Combine navbar search with filter system
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

    // Apply stat-card quick filter
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

  const visibleMeetings = filteredMeetings;

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    setIsSubmitting(true);

    const meetingDateTime = new Date(`${meetingDate}T${meetingTime}:00`);
    const now = new Date();
    
    if (meetingDateTime < now) {
      toast.error('Cannot schedule a meeting in the past.');
      setIsSubmitting(false);
      return;
    }

    try {
      await crmService.createMeeting({
        leadId: selectedLead,
        date: `${meetingDate}T${meetingTime}:00`,
        type: meetingType,
        notes: meetingNotes,
        attendees,
      });
      toast.success('Meeting scheduled successfully!');
      fetchData();
      setIsModalOpen(false);
      // Reset form
      setSelectedLead('');
      setMeetingNotes('');
      setAttendees(EMPTY_ATTENDEES);
    } catch (err) {
      toast.error(err?.message || 'Failed to schedule meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (meetingId, status) => {
    // When marking complete, capture the outcome via modal instead of silently flipping status
    if (status === 'completed') {
      const meeting = meetings.find((m) => m._id === meetingId);
      if (meeting) {
        setOutcomeModalMeeting(meeting);
        return;
      }
    }

    try {
      await crmService.updateMeeting(meetingId, { status });
      toast.success('Status updated successfully');
      fetchData();
    } catch {
      toast.error('Failed to update meeting status.');
    }
  };

  const handleMeetingOutcome = async (meetingId, outcomeData, markLost = false) => {
    try {
      await crmService.completeMeeting(meetingId, outcomeData);
      if (markLost) {
        const meeting = meetings.find((m) => m._id === meetingId);
        if (meeting?.leadId?._id) {
          await crmService.updateClientStatus(meeting.leadId._id, {
            status: 'lost',
            lifecycleStage: 'lost',
          });
        }
      }
      toast.success('Meeting outcome saved');
      fetchData();
    } catch (err) {
      toast.error(err?.message || 'Failed to save outcome.');
      throw err;
    }
  };

  const handleOpenMOM = (meeting) => {
    setMomMeeting(meeting);
    setIsMOMModalOpen(true);
  };

  const handleReschedule = (meeting) => {
    setSelectedMeeting(meeting);
    const meetingDateObj = new Date(meeting.date);
    setMeetingDate(meetingDateObj.toISOString().split('T')[0]);
    setMeetingTime(meetingDateObj.toTimeString().slice(0, 5));
    setMeetingType(meeting.type || 'office');
    setMeetingNotes(meeting.notes || '');
    const hydrated = hydrateAttendeesFromMeeting(meeting);
    // If a meeting was scheduled before this feature existed, seed the lead row
    if (hydrated.client.length === 0 && meeting.leadId?.name) {
      hydrated.client = seedClientAttendeesForLead(meeting.leadId);
    }
    setAttendees(hydrated);
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMeeting) return;

    setIsSubmitting(true);

    const meetingDateTime = new Date(`${meetingDate}T${meetingTime}:00`);
    const now = new Date();
    
    if (meetingDateTime < now) {
      toast.error('Cannot reschedule a meeting to the past.');
      setIsSubmitting(false);
      return;
    }

    try {
      await crmService.updateMeeting(selectedMeeting._id, {
        date: `${meetingDate}T${meetingTime}`,
        type: meetingType,
        notes: meetingNotes,
        status: 'rescheduled',
        rescheduledFrom: selectedMeeting.date,
        attendees,
      });

      setSelectedMeeting(null);
      setMeetingDate(new Date().toISOString().split('T')[0]);
      setMeetingTime(() => {
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        return `${String(nextHour.getHours()).padStart(2, '0')}:00`;
      });
      setMeetingType('office');
      setMeetingNotes('');
      setAttendees(EMPTY_ATTENDEES);
      setIsRescheduleModalOpen(false);
      toast.success('Meeting rescheduled successfully!');
      fetchData();
    } catch (err) {
      toast.error(err?.message || 'Failed to reschedule meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Loader label="Syncing your schedule..." />;
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Meetings</h1>
          <p className="text-[var(--text-secondary)] font-medium">Schedule and manage client meetings in realtime.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
          <AskAIButton label="Ask AI" variant="soft" actions={resolveEntry('meetings').actions} />
          <Link
            to="/crm/meetings/calendar"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--border)] text-sm font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors w-full md:w-auto justify-center"
          >
            <CalendarDays size={16} />
            Calendar View
          </Link>
          <Button variant="primary" onClick={() => setIsModalOpen(true)} className="w-full md:w-auto px-6 whitespace-nowrap">
            <Plus size={18} />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Advanced Filter System — inline because only 4 controls fit easily */}
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

      {/* Stat chips — clickable quick filters (compact one-row tiles) */}
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
            onViewDetails={() => navigate(`/crm/leads/${meeting.leadId?._id}`)}
            onStatusChange={handleStatusUpdate}
            onReschedule={handleReschedule}
            onRecordMOM={handleOpenMOM}
          />
        )) : (
          <div className="py-20 text-center bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
            <div className="w-16 h-16 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon size={24} className="text-[var(--text-muted)] opacity-30" />
            </div>
            <p className="text-[var(--text-muted)] font-medium">
              No meetings match the current search.
            </p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Meeting">
        <form onSubmit={handleCreateMeeting} className="space-y-6">
          <Select
            label="Select Lead"
            value={selectedLead}
            onChange={(leadId) => {
              setSelectedLead(leadId);
              const pickedLead = leads.find((l) => l._id === leadId);
              setAttendees({ internal: [], client: seedClientAttendeesForLead(pickedLead) });
            }}
            options={leads.map((lead) => ({ value: lead._id, label: `${lead.name} • ${lead.phone}` }))}
          />
          <DateTimePicker
            label="Date & Time"
            dateValue={meetingDate}
            timeValue={meetingTime}
            onDateChange={setMeetingDate}
            onTimeChange={setMeetingTime}
            required
          />
          <Select
            label="Meeting Type"
            value={meetingType}
            onChange={setMeetingType}
            options={[
              { value: 'office', label: 'Office Meeting' },
              { value: 'site', label: 'Site Visit' },
              { value: 'call', label: 'Phone Call' },
            ]}
          />
          <Select
            label="Meeting Status"
            value={meetingStatus}
            onChange={setMeetingStatus}
            options={[
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <textarea
            value={meetingNotes}
            onChange={(e) => setMeetingNotes(e.target.value)}
            rows={3}
            placeholder="Meeting notes or agenda"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
          <AttendeesEditor
            lead={leads.find((l) => l._id === selectedLead) || null}
            value={attendees}
            onChange={setAttendees}
          />
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} fullWidth>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting} fullWidth>Confirm & Schedule</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isRescheduleModalOpen} onClose={() => setIsRescheduleModalOpen(false)} title="Reschedule Meeting">
        <form onSubmit={handleRescheduleSubmit} className="space-y-6">
          {selectedMeeting && (
            <div className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
              <p className="text-sm text-[var(--text-muted)]">Rescheduling meeting with</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{selectedMeeting.leadId?.name || 'Unknown Lead'}</p>
              <p className="text-sm text-[var(--text-secondary)]">{selectedMeeting.leadId?.phone ? `+91 ${selectedMeeting.leadId.phone}` : ''}</p>
            </div>
          )}
          <DateTimePicker
            label="New Date & Time"
            dateValue={meetingDate}
            timeValue={meetingTime}
            onDateChange={setMeetingDate}
            onTimeChange={setMeetingTime}
            required
          />
          <Select
            label="Meeting Type"
            value={meetingType}
            onChange={setMeetingType}
            options={[
              { value: 'office', label: 'Office Meeting' },
              { value: 'site', label: 'Site Visit' },
              { value: 'call', label: 'Phone Call' },
            ]}
          />
          <textarea
            value={meetingNotes}
            onChange={(e) => setMeetingNotes(e.target.value)}
            rows={3}
            placeholder="Reason for rescheduling or updated notes"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
          <AttendeesEditor
            lead={selectedMeeting?.leadId || null}
            value={attendees}
            onChange={setAttendees}
          />
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => setIsRescheduleModalOpen(false)} fullWidth>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting} fullWidth>Confirm Reschedule</Button>
          </div>
        </form>
      </Modal>

      <MeetingOutcomeModal
        isOpen={Boolean(outcomeModalMeeting)}
        onClose={() => setOutcomeModalMeeting(null)}
        meeting={outcomeModalMeeting}
        onSave={handleMeetingOutcome}
        onRecordMOM={(meeting) => {
          // After outcome saved, refetch to get the now-completed meeting (with status=completed)
          // so RecordMOMModal's completion gate passes.
          fetchData().then?.(() => {});
          setMomMeeting({ ...meeting, status: 'completed' });
          setIsMOMModalOpen(true);
        }}
      />

      <RecordMOMModal
        isOpen={isMOMModalOpen}
        onClose={() => { setIsMOMModalOpen(false); setMomMeeting(null); }}
        meeting={momMeeting}
        onSaved={fetchData}
      />
    </div>
  );
};
export default MeetingsPage;
