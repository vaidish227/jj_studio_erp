import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, List as ListIcon, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../shared/components/Button/Button';
import Modal from '../../../shared/components/Modal/Modal';
import DateTimePicker from '../../../shared/components/DateTimePicker/DateTimePicker';
import Select from '../../../shared/components/Select/Select';
import { crmService } from '../../../shared/services/crmService';
import { Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import AskAIButton from '../../ai/components/AskAIButton';
import { resolveEntry } from '../../ai/aiEntryPoints';
import RecordMOMModal from '../components/RecordMOMModal';
import MeetingOutcomeModal from '../components/MeetingOutcomeModal';
import AttendeesEditor from '../../../shared/components/AttendeesEditor/AttendeesEditor';
import MeetingsListView from '../components/MeetingsListView';
import MeetingsCalendarView from '../components/MeetingsCalendarView';
import usePermission from '../../../shared/hooks/usePermission';
import {
  EMPTY_ATTENDEES,
  seedClientAttendeesForLead,
  hydrateAttendeesFromMeeting,
} from '../utils/attendees';

const POLL_INTERVAL_MS = 30000;

// Segmented Calendar / List view switch shown in the page header.
const ViewToggle = ({ view, onChange }) => {
  const options = [
    { key: 'calendar', label: 'Calendar', icon: CalendarDays },
    { key: 'list', label: 'List', icon: ListIcon },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
      {options.map(({ key, label, icon: Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-bold rounded-lg transition-all duration-200 ${
              active
                ? 'bg-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Unified Meetings page — hosts both the List and Calendar views under a single
 * CRM tab with a shared header, one data fetch + poll, and one shared set of
 * Schedule / Reschedule / Outcome / MOM modals. The two views are presentational
 * bodies that receive meetings + action handlers as props.
 */
const MeetingsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // CRM write permissions (coarse — aligned with backend alias model).
  const canCreate = usePermission('crm.create');

  const [view, setView] = useState('calendar'); // default to Calendar
  const [meetings, setMeetings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isMOMModalOpen, setIsMOMModalOpen] = useState(false);
  const [momMeeting, setMomMeeting] = useState(null);
  const [outcomeModalMeeting, setOutcomeModalMeeting] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Schedule / Reschedule form state
  const [selectedLead, setSelectedLead] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
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
    if (isInitialLoad) setIsLoading(true); // only first time
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
      toast.error('Failed to load meetings.');
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData(true); // initial load with loader
    const intervalId = setInterval(() => fetchData(false), POLL_INTERVAL_MS); // silent refresh
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // ─── Shared meeting actions ──────────────────────────────────────────
  const handleViewDetails = (meeting) => navigate(`/crm/leads/${meeting.leadId?._id}`);

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

  // Open the Schedule modal, optionally prefilled to a given day (from the calendar).
  const openScheduleModal = (prefillDate) => {
    setSelectedLead('');
    setMeetingDate(
      (prefillDate instanceof Date ? prefillDate : new Date()).toISOString().split('T')[0]
    );
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

    const meetingDateTime = new Date(`${meetingDate}T${meetingTime}:00`);
    if (meetingDateTime < new Date()) {
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

    const meetingDateTime = new Date(`${meetingDate}T${meetingTime}:00`);
    if (meetingDateTime < new Date()) {
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

  const viewProps = {
    meetings,
    onViewDetails: handleViewDetails,
    onStatusChange: handleStatusUpdate,
    onReschedule: handleReschedule,
    onRecordMOM: handleOpenMOM,
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Meetings</h1>
          <p className="text-[var(--text-secondary)] font-medium">Schedule and manage client meetings in realtime.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
          <AskAIButton label="Ask AI" variant="soft" actions={resolveEntry('meetings').actions} />
          <ViewToggle view={view} onChange={setView} />
          {canCreate && (
            <Button variant="primary" onClick={() => openScheduleModal()} className="w-full md:w-auto px-6 whitespace-nowrap">
              <Plus size={18} />
              Schedule Meeting
            </Button>
          )}
        </div>
      </div>

      {view === 'calendar' ? (
        <MeetingsCalendarView {...viewProps} onScheduleForDay={canCreate ? openScheduleModal : undefined} />
      ) : (
        <MeetingsListView {...viewProps} />
      )}

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
