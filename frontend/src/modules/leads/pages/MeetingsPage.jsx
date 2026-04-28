import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Phone, 
  Plus, 
  CheckCircle2, 
  Users, 
  LayoutGrid, 
  List, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import Badge from '../../../shared/components/Badge/Badge';
import Modal from '../../../shared/components/Modal/Modal';
import DateTimePicker from '../../../shared/components/DateTimePicker/DateTimePicker';
import Select from '../../../shared/components/Select/Select';
import { crmService } from '../../../shared/services/crmService';

const MeetingsPage = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Meeting Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState('');
  const [leads, setLeads] = useState([]);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [meetingType, setMeetingType] = useState('office');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchMeetings = async () => {
    setIsLoading(true);
    try {
      const response = await crmService.getMeetings();
      setMeetings(response.meetings || []);
    } catch (err) {
      setError('Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await crmService.getLeads();
      setLeads(response.leads || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetchLeads();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: meetings.length,
      scheduled: meetings.filter(m => new Date(m.date) >= now).length,
      completed: meetings.filter(m => new Date(m.date) < now).length,
      site: meetings.filter(m => m.type === 'site').length,
    };
  }, [meetings]);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    
    setIsSubmitting(true);
    try {
      await crmService.createMeeting({
        leadId: selectedLead,
        date: `${meetingDate}T${meetingTime}`,
        type: meetingType,
        status: 'Scheduled'
      });
      await fetchMeetings();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calendar Helpers
  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const calendarDays = useMemo(() => {
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);
    const days = [];
    
    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: null });
    }
    
    // Days of current month
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dayMeetings = meetings.filter(m => new Date(m.date).toDateString() === date.toDateString());
      days.push({ day: i, date, meetingCount: dayMeetings.length });
    }
    
    return days;
  }, [currentMonth, meetings]);

  const filteredMeetings = useMemo(() => {
    if (viewMode === 'calendar') {
      return meetings.filter(m => new Date(m.date).toDateString() === selectedDate.toDateString());
    }
    return meetings;
  }, [meetings, viewMode, selectedDate]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p>Loading Meetings Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Meetings</h1>
          <p className="text-[var(--text-secondary)] mt-1">Schedule and manage client meetings</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto px-8">
          <Plus size={18} className="mr-2" />
          Schedule Meeting
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Meetings" value={stats.total} icon={CalendarIcon} color="text-[var(--primary)]" />
        <StatCard label="Scheduled" value={stats.scheduled} icon={Clock} color="text-[var(--accent-blue)]" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} color="text-[var(--success)]" />
        <StatCard label="On-Site" value={stats.site} icon={MapPin} color="text-[var(--warning)]" />
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit">
        <button 
          onClick={() => setViewMode('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'calendar' ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          <LayoutGrid size={16} />
          Calendar View
        </button>
        <button 
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          <List size={16} />
          List View
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Mini Calendar */}
        {viewMode === 'calendar' && (
          <div className="lg:col-span-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors"><ChevronLeft size={18} /></button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors"><ChevronRight size={18} /></button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-bold text-[var(--text-muted)] uppercase mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((d, i) => (
                  <button
                    key={i}
                    disabled={!d.day}
                    onClick={() => d.date && setSelectedDate(d.date)}
                    className={`
                      relative h-12 flex flex-col items-center justify-center rounded-xl transition-all
                      ${!d.day ? 'opacity-0 cursor-default' : 'hover:bg-[var(--primary)]/10'}
                      ${d.date?.toDateString() === selectedDate.toDateString() ? 'bg-[var(--primary)] text-black font-bold' : 'text-[var(--text-primary)]'}
                      ${d.date?.toDateString() === new Date().toDateString() && d.date?.toDateString() !== selectedDate.toDateString() ? 'ring-1 ring-[var(--primary)] ring-inset' : ''}
                    `}
                  >
                    <span>{d.day}</span>
                    {d.meetingCount > 0 && d.date?.toDateString() !== selectedDate.toDateString() && (
                      <span className="mt-1 w-5 h-4 bg-[var(--primary)]/20 text-[var(--primary)] text-[10px] rounded flex items-center justify-center font-bold">
                        {d.meetingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Right: Meetings List */}
        <div className={viewMode === 'calendar' ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <div className="space-y-4">
            {filteredMeetings.length > 0 ? (
              filteredMeetings.map((meeting) => (
                <MeetingCard key={meeting._id} meeting={meeting} onViewDetails={() => navigate(`/crm/leads/${meeting.leadId?._id}`)} />
              ))
            ) : (
              <div className="py-20 text-center bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
                <div className="w-16 h-16 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon size={24} className="text-[var(--text-muted)] opacity-30" />
                </div>
                <p className="text-[var(--text-muted)] font-medium">
                  {viewMode === 'calendar' ? `No meetings scheduled for ${selectedDate.toLocaleDateString()}` : 'No meetings found.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Meeting Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Meeting">
        <form onSubmit={handleCreateMeeting} className="space-y-6">
          <Select 
            label="Select Lead"
            value={selectedLead}
            onChange={setSelectedLead}
            options={leads.map(l => ({ value: l._id, label: l.name }))}
            required
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
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} fullWidth>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting} fullWidth>Confirm & Schedule</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => (
  <Card className="flex items-center justify-between p-6 shadow-sm hover:shadow-md transition-shadow">
    <div>
      <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-black text-[var(--text-primary)]">{value}</p>
    </div>
    <div className={`p-3 rounded-2xl bg-[var(--bg)] ${color}`}>
      <Icon size={24} />
    </div>
  </Card>
);

const MeetingCard = ({ meeting, onViewDetails }) => {
  const lead = meeting.leadId || {};
  const date = new Date(meeting.date);
  
  return (
    <div className="bg-[var(--surface)] border-2 border-[var(--primary)]/10 rounded-2xl p-6 hover:border-[var(--primary)] transition-all group shadow-sm">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-12 h-12 bg-[var(--primary)] rounded-xl flex items-center justify-center text-black shrink-0">
          <CalendarIcon size={24} />
        </div>
        
        <div className="flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">{lead.name || 'Unknown Lead'}</h3>
              <p className="text-sm text-[var(--text-muted)] font-medium">{lead.projectType || 'Interior Project'} - Modern Design</p>
            </div>
            <Badge variant="primary" className="uppercase w-fit bg-[var(--primary)]/10 text-[var(--primary)] border-none font-bold tracking-widest px-4">
              Scheduled
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
            <div className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] font-medium">
              <CalendarIcon size={16} className="text-[var(--text-muted)]" />
              <span>{date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} at {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] font-medium">
              <Clock size={16} className="text-[var(--text-muted)]" />
              <span>1 hour duration</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] font-medium">
              <MapPin size={16} className="text-[var(--text-muted)]" />
              <span>{meeting.type === 'site' ? lead.siteAddress || 'Site Address' : 'JJ Studio - Office'} - {lead.city || 'Location'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] font-medium">
              <Phone size={16} className="text-[var(--text-muted)]" />
              <span>+91 {lead.phone || '0000000000'}</span>
            </div>
          </div>

          <div className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)]">
            <span className="font-bold mr-2">Notes:</span>
            <span className="text-[var(--text-secondary)]">{meeting.notes || 'Meeting to understand client requirements and site measurements.'}</span>
          </div>

          <Button variant="primary" className="w-full justify-center py-3.5 text-sm tracking-wide" onClick={onViewDetails}>
            View Lead Details
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MeetingsPage;
