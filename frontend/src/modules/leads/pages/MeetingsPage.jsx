import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import Badge from '../../../shared/components/Badge/Badge';
import Modal from '../../../shared/components/Modal/Modal';
import DateTimePicker from '../../../shared/components/DateTimePicker/DateTimePicker';
import Select from '../../../shared/components/Select/Select';
import { crmService } from '../../../shared/services/crmService';
import { DashboardCard, SearchInput, ViewToggle } from '../../../shared/components';

const POLL_INTERVAL_MS = 30000;

const statusVariants = {
  scheduled: 'primary',
  completed: 'success',
  cancelled: 'error',
};

const MeetingsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navbarQuery = searchParams.get('q') || '';
  const [localSearch, setLocalSearch] = useState('');
  const [viewMode, setViewMode] = useState('calendar');
  const [statusFilter, setStatusFilter] = useState('all');
  const [meetings, setMeetings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedLead, setSelectedLead] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [meetingType, setMeetingType] = useState('office');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingStatus, setMeetingStatus] = useState('scheduled');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

const fetchData = useCallback(async (isInitialLoad = false) => {
  if (isInitialLoad) setIsLoading(true); // only first time
  setError('');

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
    setError('Failed to load meetings dashboard.');
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

  const searchTerm = `${navbarQuery} ${localSearch}`.trim().toLowerCase();

  const filteredMeetingsByStatus = useMemo(() => {
    if (statusFilter === 'all') return meetings;
    return meetings.filter((meeting) => meeting.status === statusFilter);
  }, [meetings, statusFilter]);

  const searchedMeetings = useMemo(() => {
    return filteredMeetingsByStatus.filter((meeting) => {
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
  }, [filteredMeetingsByStatus, searchTerm]);

  const stats = useMemo(() => ({
    total: meetings.length,
    scheduled: meetings.filter((meeting) => meeting.status === 'scheduled').length,
    completed: meetings.filter((meeting) => meeting.status === 'completed').length,
    cancelled: meetings.filter((meeting) => meeting.status === 'cancelled').length,
    site: meetings.filter((meeting) => meeting.type === 'site').length,
  }), [meetings]);

  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const calendarDays = useMemo(() => {
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);
    const days = [];

    for (let i = 0; i < firstDay; i += 1) {
      days.push({ day: null, date: null });
    }

    for (let i = 1; i <= totalDays; i += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dayMeetings = searchedMeetings.filter(
        (meeting) => new Date(meeting.date).toDateString() === date.toDateString()
      );
      days.push({ day: i, date, meetingCount: dayMeetings.length });
    }

    return days;
  }, [currentMonth, searchedMeetings]);

  const visibleMeetings = useMemo(() => {
    if (viewMode === 'calendar') {
      return searchedMeetings.filter(
        (meeting) => new Date(meeting.date).toDateString() === selectedDate.toDateString()
      );
    }

    return searchedMeetings;
  }, [searchedMeetings, selectedDate, viewMode]);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    setIsSubmitting(true);
    setActionError('');

    try {
      await crmService.createMeeting({
        leadId: selectedLead,
        date: `${meetingDate}T${meetingTime}`,
        type: meetingType,
        notes: meetingNotes,
        status: meetingStatus,
      });

      setSelectedLead('');
      setMeetingType('office');
      setMeetingNotes('');
      setMeetingStatus('scheduled');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setActionError(err || 'Failed to schedule meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (meetingId, status) => {
    try {
      await crmService.updateMeeting(meetingId, { status });
      fetchData();
    } catch {
      setActionError('Failed to update meeting status.');
    }
  };

  const handleReschedule = (meeting) => {
    setSelectedMeeting(meeting);
    const meetingDateObj = new Date(meeting.date);
    setMeetingDate(meetingDateObj.toISOString().split('T')[0]);
    setMeetingTime(meetingDateObj.toTimeString().slice(0, 5));
    setMeetingType(meeting.type || 'office');
    setMeetingNotes(meeting.notes || '');
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMeeting) return;

    setIsSubmitting(true);
    setActionError('');

    try {
      await crmService.updateMeeting(selectedMeeting._id, {
        date: `${meetingDate}T${meetingTime}`,
        type: meetingType,
        notes: meetingNotes,
        status: 'scheduled',
      });

      setSelectedMeeting(null);
      setMeetingDate(new Date().toISOString().split('T')[0]);
      setMeetingTime('10:00');
      setMeetingType('office');
      setMeetingNotes('');
      setIsRescheduleModalOpen(false);
      fetchData();
    } catch (err) {
      setActionError(err?.message || 'Failed to reschedule meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p>Loading meetings dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {(error || actionError) && (
        <div className="space-y-3">
          {error && (
            <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)] animate-in fade-in duration-300">
              {error}
            </div>
          )}
          {actionError && (
            <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)] animate-in fade-in duration-300">
              {actionError}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-6">
        {/* Header Row: Title on Left, Search + Toggle on Right */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Meetings</h1>
            <p className="text-[var(--text-secondary)] font-medium">Schedule and manage client meetings in realtime.</p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
            <SearchInput 
              value={localSearch} 
              onChange={setLocalSearch} 
              placeholder="Search meetings..." 
              className="w-full md:w-72"
            />
            <ViewToggle 
              view={viewMode} 
              onViewChange={setViewMode} 
            />
            <Button variant="primary" onClick={() => setIsModalOpen(true)} className="w-full md:w-auto px-6 whitespace-nowrap">
              <Plus size={18} />
              Schedule Meeting
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <DashboardCard title="Total Meetings" value={stats.total} icon={CalendarIcon} iconBg="bg-[var(--primary)]/10" compact />
          <DashboardCard title="Scheduled" value={stats.scheduled} icon={Clock} iconBg="bg-[var(--accent-blue)]/10" compact />
          <DashboardCard title="Completed" value={stats.completed} icon={CheckCircle2} iconBg="bg-[var(--success)]/10" compact />
          <DashboardCard title="Cancelled" value={stats.cancelled} icon={XCircle} iconBg="bg-[var(--error)]/10" compact />
          <DashboardCard title="On-Site" value={stats.site} icon={MapPin} iconBg="bg-[var(--warning)]/10" compact />
        </div>
      </div>

      <div className="flex items-center gap-2 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${statusFilter === 'all' ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter('scheduled')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${statusFilter === 'scheduled' ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          <Clock size={14} />
          Scheduled
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${statusFilter === 'completed' ? 'bg-[var(--success)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          <CheckCircle2 size={14} />
          Completed
        </button>
        <button
          onClick={() => setStatusFilter('cancelled')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${statusFilter === 'cancelled' ? 'bg-[var(--error)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          <XCircle size={14} />
          Cancelled
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {viewMode === 'calendar' && (
          <div className="lg:col-span-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                    className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                    className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-bold text-[var(--text-muted)] uppercase mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <button
                    key={index}
                    disabled={!day.day}
                    onClick={() => day.date && setSelectedDate(day.date)}
                    className={`
                      relative h-12 flex flex-col items-center justify-center rounded-xl transition-all
                      ${!day.day ? 'opacity-0 cursor-default' : 'hover:bg-[var(--primary)]/10'}
                      ${day.date?.toDateString() === selectedDate.toDateString() ? 'bg-[var(--primary)] text-black font-bold' : 'text-[var(--text-primary)]'}
                    `}
                  >
                    <span>{day.day}</span>
                    {day.meetingCount > 0 && day.date?.toDateString() !== selectedDate.toDateString() && (
                      <span className="mt-1 w-5 h-4 bg-[var(--primary)]/20 text-[var(--primary)] text-[10px] rounded flex items-center justify-center font-bold">
                        {day.meetingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        <div className={viewMode === 'calendar' ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <div className="space-y-4">
            {visibleMeetings.length ? visibleMeetings.map((meeting) => (
              <MeetingCard
                key={meeting._id}
                meeting={meeting}
                onViewDetails={() => navigate(`/crm/leads/${meeting.leadId?._id}`)}
                onStatusChange={handleStatusUpdate}
                onReschedule={handleReschedule}
              />
            )) : (
              <div className="py-20 text-center bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
                <div className="w-16 h-16 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon size={24} className="text-[var(--text-muted)] opacity-30" />
                </div>
                <p className="text-[var(--text-muted)] font-medium">
                  No meetings match the current search or date.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Meeting">
        <form onSubmit={handleCreateMeeting} className="space-y-6">
          <Select
            label="Select Lead"
            value={selectedLead}
            onChange={setSelectedLead}
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
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => setIsRescheduleModalOpen(false)} fullWidth>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting} fullWidth>Confirm Reschedule</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};


const MeetingCard = ({ meeting, onViewDetails, onStatusChange, onReschedule }) => {
  const lead = meeting.leadId || {};
  const date = new Date(meeting.date);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--primary)] hover:shadow-xl hover:shadow-[var(--primary)]/5 transition-all duration-300 group shadow-sm">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-14 h-14 bg-[var(--primary)]/10 rounded-2xl flex items-center justify-center text-[var(--primary)] shrink-0 group-hover:bg-[var(--primary)] group-hover:text-black transition-all duration-500 group-hover:rotate-6">
          <CalendarIcon size={28} strokeWidth={2.5} />
        </div>

        <div className="flex-1 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors duration-300 tracking-tight">{lead.name || 'Unknown Lead'}</h3>
              <p className="text-sm text-[var(--text-muted)] font-semibold mt-0.5">{lead.projectType || 'Interior Project'} • {lead.city || 'Location'}</p>
            </div>
            <Badge 
              variant={statusVariants[meeting.status] || 'default'} 
              className="uppercase text-[10px] font-black tracking-[0.1em] px-4 py-1.5 rounded-full border-none shadow-sm"
            >
              {meeting.status || 'scheduled'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
            <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
                <CalendarIcon size={16} />
              </div>
              <span>{date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} at {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
                <Clock size={16} />
              </div>
              <span>{meeting.durationMinutes || 60} min duration</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
                <MapPin size={16} />
              </div>
              <span>{meeting.type === 'site' ? lead.siteAddress || 'Site Address' : 'JJ Studio - Office'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
                <Phone size={16} />
              </div>
              <span>+91 {lead.phone || '0000000000'}</span>
            </div>
          </div>

          <div className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] relative overflow-hidden group-hover:border-[var(--primary)]/30 transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--primary)] opacity-20"></div>
            <span className="font-bold text-[var(--primary)] uppercase text-[10px] tracking-wider block mb-1">Meeting Notes</span>
            <span className="text-[var(--text-secondary)] leading-relaxed">{meeting.notes || 'Meeting to understand client requirements and site measurements.'}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 pt-2">
            <Select
              value={meeting.status || 'scheduled'}
              onChange={(value) => onStatusChange(meeting._id, value)}
              options={[
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              className="lg:w-64"
            />
            {meeting.status !== 'completed' && meeting.status !== 'cancelled' && (
              <Button variant="secondary" className="w-full justify-center py-3.5 text-sm font-bold tracking-tight bg-[var(--bg)] hover:bg-[var(--primary)]/5" onClick={() => onReschedule(meeting)}>
                <RotateCcw size={16} className="mr-2" />
                Reschedule
              </Button>
            )}
            <Button variant="primary" className="w-full justify-center py-3.5 text-sm font-bold tracking-tight shadow-md hover:shadow-lg" onClick={onViewDetails}>
              View Lead Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingsPage;
