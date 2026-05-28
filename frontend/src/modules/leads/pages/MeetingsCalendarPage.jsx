import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  Plus,
} from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import Modal from '../../../shared/components/Modal/Modal';
import DateTimePicker from '../../../shared/components/DateTimePicker/DateTimePicker';
import Select from '../../../shared/components/Select/Select';
import { Loader } from '../../../shared/components';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import AttendeesEditor from '../../../shared/components/AttendeesEditor/AttendeesEditor';
import MeetingCard from '../components/MeetingCard';
import RecordMOMModal from '../components/RecordMOMModal';
import MeetingOutcomeModal from '../components/MeetingOutcomeModal';
import {
  EMPTY_ATTENDEES,
  seedClientAttendeesForLead,
  hydrateAttendeesFromMeeting,
} from '../utils/attendees';

const POLL_INTERVAL_MS = 30000;

const sameDay = (a, b) =>
  a && b && new Date(a).toDateString() === new Date(b).toDateString();

const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

const MeetingsCalendarPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [meetings, setMeetings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isMOMModalOpen, setIsMOMModalOpen] = useState(false);
  const [momMeeting, setMomMeeting] = useState(null);
  const [outcomeModalMeeting, setOutcomeModalMeeting] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Schedule form state
  const [selectedLead, setSelectedLead] = useState('');
  const [meetingDate, setMeetingDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
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

  const fetchData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    try {
      const [meetingsRes, leadsRes] = await Promise.all([
        crmService.getMeetings(),
        crmService.getLeads({ limit: 100 }),
      ]);
      setMeetings(
        (meetingsRes.meetings || []).sort((a, b) => new Date(b.date) - new Date(a.date))
      );
      setLeads(leadsRes.leads || []);
    } catch {
      toast.error('Failed to load calendar.');
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData(true);
    const id = setInterval(() => fetchData(false), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // Days grid for the current visible month
  const calendarDays = useMemo(() => {
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);
    const days = [];
    for (let i = 0; i < firstDay; i += 1) days.push({ day: null, date: null });
    for (let i = 1; i <= totalDays; i += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      days.push({ day: i, date });
    }
    return days;
  }, [currentMonth]);

  // Meetings on the selected day, sorted by time ascending
  const dayMeetings = useMemo(() => {
    return meetings
      .filter((m) => sameDay(m.date, selectedDate))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [meetings, selectedDate]);

  // ─── Meeting actions ─────────────────────────────────────────────────
  const handleStatusUpdate = async (meetingId, status) => {
    if (status === 'completed') {
      const m = meetings.find((x) => x._id === meetingId);
      if (m) {
        setOutcomeModalMeeting(m);
        return;
      }
    }
    try {
      await crmService.updateMeeting(meetingId, { status });
      toast.success('Status updated.');
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
      toast.success('Meeting outcome saved.');
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
    const d = new Date(meeting.date);
    setMeetingDate(d.toISOString().split('T')[0]);
    setMeetingTime(d.toTimeString().slice(0, 5));
    setMeetingType(meeting.type || 'office');
    setMeetingNotes(meeting.notes || '');
    const hydrated = hydrateAttendeesFromMeeting(meeting);
    if (hydrated.client.length === 0 && meeting.leadId?.name) {
      hydrated.client = seedClientAttendeesForLead(meeting.leadId);
    }
    setAttendees(hydrated);
    setIsRescheduleModalOpen(true);
  };

  const openScheduleModal = () => {
    setSelectedLead('');
    setMeetingDate(selectedDate.toISOString().split('T')[0]);
    setMeetingType('office');
    setMeetingNotes('');
    setMeetingStatus('scheduled');
    setAttendees(EMPTY_ATTENDEES);
    setIsModalOpen(true);
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    setIsSubmitting(true);
    const dt = new Date(`${meetingDate}T${meetingTime}:00`);
    if (dt < new Date()) {
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
      toast.success('Meeting scheduled.');
      fetchData();
      setIsModalOpen(false);
      setSelectedLead('');
      setMeetingNotes('');
      setAttendees(EMPTY_ATTENDEES);
    } catch (err) {
      toast.error(err?.message || 'Failed to schedule meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMeeting) return;
    setIsSubmitting(true);
    const dt = new Date(`${meetingDate}T${meetingTime}:00`);
    if (dt < new Date()) {
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
      toast.success('Meeting rescheduled.');
      fetchData();
      setIsRescheduleModalOpen(false);
      setSelectedMeeting(null);
      setAttendees(EMPTY_ATTENDEES);
    } catch (err) {
      toast.error(err?.message || 'Failed to reschedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <Loader label="Loading calendar..." />;

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Calendar</h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Month view of every scheduled meeting. Click a day to see its agenda.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
          <Link
            to="/crm/meetings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--border)] text-sm font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors w-full md:w-auto justify-center"
          >
            <ListIcon size={16} />
            List View
          </Link>
          <Button variant="primary" onClick={openScheduleModal} className="w-full md:w-auto px-6 whitespace-nowrap">
            <Plus size={18} />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Full-width calendar */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => { const t = new Date(); setCurrentMonth(t); setSelectedDate(t); }}
              className="px-2.5 py-1 text-xs font-bold rounded-lg hover:bg-[var(--bg)] text-[var(--text-secondary)] transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Day cells — each cell shows the day number + up to 2 meeting previews + "+N more".
            Hovering reveals a popover with the FULL list of meetings for that day. */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const isSelected = sameDay(day.date, selectedDate);
            const isToday = sameDay(day.date, new Date());
            const cellMeetings = day.date
              ? meetings
                  .filter((m) => sameDay(m.date, day.date))
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
              : [];

            // Edge-aware popover alignment: align right at the right edge of the
            // grid (Fri/Sat), left at the left edge (Sun), center elsewhere.
            const col = index % 7;
            const popoverAlign =
              col >= 5 ? 'right-0' :
              col === 0 ? 'left-0' :
              'left-1/2 -translate-x-1/2';

            // Position above the cell for the bottom row(s) so the popover
            // doesn't go off-screen.
            const totalRows = Math.ceil(calendarDays.length / 7);
            const row = Math.floor(index / 7);
            const popoverVertical = row >= totalRows - 1
              ? 'bottom-full mb-1'
              : 'top-full mt-1';

            return (
              <div key={index} className="relative group/cell">
                <button
                  type="button"
                  disabled={!day.day}
                  onClick={() => day.date && setSelectedDate(day.date)}
                  className={`
                    w-full min-h-[96px] p-2 flex flex-col items-start gap-1 rounded-lg border text-left transition-all
                    ${!day.day ? 'opacity-0 cursor-default pointer-events-none border-transparent' : 'hover:border-[var(--primary)]/50'}
                    ${isSelected
                      ? 'bg-[var(--primary)]/10 border-[var(--primary)]'
                      : isToday
                        ? 'border-[var(--primary)]/40 bg-[var(--primary)]/5'
                        : 'border-[var(--border)]'}
                  `}
                >
                  <span className={`text-xs font-bold leading-none ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                    {day.day}
                  </span>
                  {cellMeetings.slice(0, 2).map((m) => (
                    <span
                      key={m._id}
                      className="w-full text-[10px] font-semibold truncate px-1.5 py-0.5 rounded bg-[var(--primary)]/15 text-[var(--primary)]"
                    >
                      {new Date(m.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} {m.leadId?.name || 'Meeting'}
                    </span>
                  ))}
                  {cellMeetings.length > 2 && (
                    <span className="text-[9px] font-bold text-[var(--text-muted)] pl-1.5">
                      +{cellMeetings.length - 2} more
                    </span>
                  )}
                </button>

                {/* Hover popover — full list of meetings for this day */}
                {day.day && cellMeetings.length > 0 && (
                  <div
                    className={`
                      invisible opacity-0 group-hover/cell:visible group-hover/cell:opacity-100
                      absolute z-30 ${popoverVertical} ${popoverAlign} w-72
                      bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/15 p-3
                      transition-opacity duration-150 pointer-events-none
                    `}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                      {day.date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                      <span className="ml-1 text-[var(--text-secondary)]">
                        · {cellMeetings.length} meeting{cellMeetings.length === 1 ? '' : 's'}
                      </span>
                    </p>
                    <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                      {cellMeetings.map((m) => (
                        <li key={m._id} className="flex items-start gap-2 text-xs leading-tight">
                          <span className="font-black text-[var(--primary)] whitespace-nowrap w-14 shrink-0">
                            {new Date(m.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[var(--text-primary)] truncate">
                              {m.leadId?.name || 'Meeting'}
                            </p>
                            <p className="text-[10px] text-[var(--text-muted)] capitalize mt-0.5">
                              {m.type || 'office'} · {m.status || 'scheduled'}
                              {m.leadId?.city ? ` · ${m.leadId.city}` : ''}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Selected day's meetings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </h3>
          <span className="text-xs font-bold text-[var(--text-muted)]">
            {dayMeetings.length} {dayMeetings.length === 1 ? 'meeting' : 'meetings'}
          </span>
        </div>
        {dayMeetings.length ? (
          <div className="space-y-4">
            {dayMeetings.map((meeting) => (
              <MeetingCard
                key={meeting._id}
                meeting={meeting}
                onViewDetails={() => navigate(`/crm/leads/${meeting.leadId?._id}`)}
                onStatusChange={handleStatusUpdate}
                onReschedule={handleReschedule}
                onRecordMOM={handleOpenMOM}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
            <CalendarIcon size={24} className="text-[var(--text-muted)] opacity-30 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)] font-medium">
              No meetings scheduled on this day.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openScheduleModal}>
              <Plus size={14} className="mr-1.5" />
              Schedule for this day
            </Button>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
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

      {/* Reschedule Modal */}
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

export default MeetingsCalendarPage;
