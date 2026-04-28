import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, Building2,
  Maximize2, IndianRupee, FileText, Calendar,
  MessageSquare, UserPlus, Send, Loader2, AlertCircle,
  Clock, User, Star, CheckCircle2, XCircle, StickyNote,
  Activity, Bell
} from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import Select from '../../../shared/components/Select/Select';
import Modal from '../../../shared/components/Modal/Modal';
import DateTimePicker from '../../../shared/components/DateTimePicker/DateTimePicker';
import useLeadDetails from '../hooks/useLeadDetails';
import { crmService } from '../../../shared/services/crmService';

/* ─────────────────────────── helpers ─────────────────────────── */

const STATUS_OPTIONS = [
  { value: 'new',           label: 'New' },
  { value: 'contacted',     label: 'Contacted' },
  { value: 'meeting_done',  label: 'Meeting Done' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'converted',     label: 'Converted' },
  { value: 'lost',          label: 'Lost' },
];

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
];

const priorityColors = {
  high:   'text-[var(--error)]   bg-[var(--error)]/10   border-[var(--error)]/20',
  medium: 'text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/20',
  low:    'text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20',
};

const statusColors = {
  new:           'text-[var(--primary)]  bg-[var(--primary)]/10',
  contacted:     'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10',
  meeting_done:  'text-[var(--accent-teal)] bg-[var(--accent-teal)]/10',
  proposal_sent: 'text-[var(--warning)] bg-[var(--warning)]/10',
  converted:     'text-[var(--success)] bg-[var(--success)]/10',
  lost:          'text-[var(--error)]   bg-[var(--error)]/10',
};

/* ─────────────────────────── sub-components ─────────────────────────── */

const DetailRow = ({ label, value, icon: Icon }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{label}</p>
    <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
      {Icon && <Icon size={15} className="text-[var(--text-muted)] shrink-0" />}
      <span className="text-sm">{value || '—'}</span>
    </div>
  </div>
);

const TabButton = ({ id, label, activeTab, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`
      relative px-5 py-3 text-sm font-semibold transition-all whitespace-nowrap
      ${activeTab === id
        ? 'text-[var(--primary)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}
    `}
  >
    {label}
    {activeTab === id && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] rounded-full" />
    )}
  </button>
);

/* ─────────────────────────── main page ─────────────────────────── */

const LeadDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lead, isLoading, error, updateStatus, updateLead } = useLeadDetails(id);

  const [activeTab, setActiveTab] = useState('basic');
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [note, setNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  /* ── Loading / Error states ── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p className="text-sm">Loading lead profile...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-5">
        <div className="w-16 h-16 bg-[var(--error)]/10 text-[var(--error)] rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Lead Not Found</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {error?.toString() || "The lead you are looking for doesn't exist."}
        </p>
        <Button variant="outline" onClick={() => navigate('/crm/new-leads')}>
          Back to Leads
        </Button>
      </div>
    );
  }

  /* ── Actions ── */
  const handleScheduleMeeting = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      await crmService.createMeeting({
        leadId: id,
        date: meetingDate,
        time: meetingTime,
        type: 'Office Meeting',
        status: 'Scheduled',
      });
      await updateStatus('contacted');
      setIsMeetingModalOpen(false);
    } catch {
      setActionError('Failed to schedule meeting. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkLost = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      await updateStatus('lost');
      if (note.trim()) await updateLead({ notes: note });
      setIsLostModalOpen(false);
      navigate('/crm/new-leads');
    } catch {
      setActionError('Failed to update lead. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkConverted = async () => {
    navigate('/crm/forms/client-info', { state: { leadId: id, ...lead } });
  };

  const handlePriorityChange = async (val) => {
    await updateLead({ priority: val });
  };

  const handleStatusChange = async (val) => {
    await updateStatus(val);
  };

  /* ── Derived values ── */
  const priorityClass = priorityColors[lead.priority] || priorityColors.medium;
  const statusClass   = statusColors[lead.status] || '';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-2 sm:px-0">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-muted)] transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{lead.name}</h1>
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusClass}`}>
                {lead.status?.replace('_', ' ')}
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${priorityClass}`}>
                {(lead.priority || 'medium').toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Lead #{id?.slice(-6).toUpperCase()} •{' '}
              {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Body Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Tabs ── */}
        <div className="lg:col-span-2 space-y-0">
          {/* Tab Bar */}
          <div className="flex items-center gap-0 border-b border-[var(--border)] overflow-x-auto">
            {['basic', 'notes', 'timeline', 'followups', 'proposal'].map((tab) => (
              <TabButton key={tab} id={tab} label={tab.charAt(0).toUpperCase() + tab.slice(1)} activeTab={activeTab} onClick={setActiveTab} />
            ))}
          </div>

          {/* Tab Content */}
          <Card className="rounded-t-none shadow-sm border-t-0" padding="p-8">

            {/* BASIC */}
            {activeTab === 'basic' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <DetailRow label="Name"         value={lead.name}                    icon={User} />
                  <DetailRow label="Email"        value={lead.email}                   icon={Mail} />
                  <DetailRow label="Phone"        value={lead.phone}                   icon={Phone} />
                  <DetailRow label="Spouse Name"  value={lead.spouse?.name}            icon={User} />
                  <DetailRow label="Spouse Phone" value={lead.spouse?.phone}           icon={Phone} />
                  <DetailRow label="City"         value={lead.city}                    icon={MapPin} />
                  <DetailRow label="Referred By"  value={lead.referredBy}              icon={Star} />
                  <DetailRow label="Project Type" value={lead.projectType}             icon={Building2} />
                  <DetailRow label="Area"         value={lead.area ? `${lead.area} sq ft` : null} icon={Maximize2} />
                  <DetailRow label="Budget"       value={lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : null} icon={IndianRupee} />
                </div>
                {lead.siteAddress && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Site Address</p>
                    <div className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)]">
                      {lead.siteAddress}
                    </div>
                  </div>
                )}
                {lead.notes && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Notes</p>
                    <div className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)]">
                      {lead.notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NOTES */}
            {activeTab === 'notes' && (
              <div className="space-y-5">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Add a Note</p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write a note about this lead..."
                  rows={5}
                  className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                />
                <Button
                  variant="primary"
                  onClick={async () => {
                    if (!note.trim()) return;
                    await updateLead({ notes: note });
                    setNote('');
                  }}
                >
                  <StickyNote size={16} />
                  Save Note
                </Button>
                {lead.notes && (
                  <div className="mt-6 space-y-2">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Existing Note</p>
                    <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)]">
                      {lead.notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TIMELINE */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">Activity Timeline</p>
                <div className="relative space-y-6 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-[var(--border)]">
                  {[
                    { icon: Activity, color: 'var(--primary)', label: 'Lead Created', desc: `Enquiry submitted on ${lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN') : '—'}` },
                    lead.status !== 'new' && { icon: Phone, color: 'var(--accent-blue)', label: 'Lead Contacted', desc: 'Status updated to Contacted' },
                    (lead.status === 'meeting_done' || lead.status === 'proposal_sent' || lead.status === 'converted') && { icon: Calendar, color: 'var(--accent-teal)', label: 'Meeting Done', desc: 'Meeting completed with client' },
                    (lead.status === 'proposal_sent' || lead.status === 'converted') && { icon: FileText, color: 'var(--warning)', label: 'Proposal Sent', desc: 'Proposal sent to client' },
                    lead.status === 'converted' && { icon: CheckCircle2, color: 'var(--success)', label: 'Lead Converted', desc: 'Successfully converted to client' },
                    lead.status === 'lost' && { icon: XCircle, color: 'var(--error)', label: 'Lead Lost', desc: 'Lead marked as lost' },
                  ].filter(Boolean).map((event, i) => (
                    <div key={i} className="flex items-start gap-4 pl-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10" style={{ background: `color-mix(in srgb, ${event.color} 15%, transparent)`, color: event.color }}>
                        <event.icon size={16} />
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{event.label}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{event.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FOLLOWUPS */}
            {activeTab === 'followups' && (
              <div className="space-y-5">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Follow-up Schedule</p>
                <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
                  <Bell size={40} className="mb-4 opacity-20" />
                  <p className="text-sm">No follow-ups scheduled yet.</p>
                  <Button variant="ghost" className="mt-4 text-[var(--primary)]" onClick={() => setIsMeetingModalOpen(true)}>
                    Schedule a meeting
                  </Button>
                </div>
              </div>
            )}

            {/* PROPOSAL */}
            {activeTab === 'proposal' && (
              <div className="space-y-5">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Proposal</p>
                <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
                  <FileText size={40} className="mb-4 opacity-20" />
                  <p className="text-sm">No proposal created yet.</p>
                  <Button
                    variant="primary"
                    className="mt-4"
                    onClick={async () => {
                      await updateStatus('proposal_sent');
                    }}
                  >
                    Mark Proposal Sent
                  </Button>
                </div>
              </div>
            )}

          </Card>
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="space-y-5">

          {/* Quick Info */}
          <Card padding="p-5" className="shadow-sm space-y-5">
            <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-3">Quick Info</p>

            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</p>
              <Select
                value={lead.status || 'new'}
                onChange={handleStatusChange}
                options={STATUS_OPTIONS}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Priority</p>
              <Select
                value={lead.priority || 'medium'}
                onChange={handlePriorityChange}
                options={PRIORITY_OPTIONS}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Enquiry Date</p>
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] font-semibold">
                <Clock size={14} className="text-[var(--text-muted)]" />
                {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN') : '—'}
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card padding="p-5" className="shadow-sm space-y-3">
            <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-3">Actions</p>

            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => setIsMeetingModalOpen(true)}
            >
              <Calendar size={17} />
              Schedule Meeting
            </Button>

            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={() => window.open(`https://wa.me/91${lead.phone?.replace(/\D/g, '')}`, '_blank')}
            >
              <MessageSquare size={17} />
              Send WhatsApp
            </Button>

            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={handleMarkConverted}
              disabled={lead.status === 'converted'}
            >
              <UserPlus size={17} />
              Convert to Client
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-center text-[var(--error)] hover:bg-[var(--error)]/5"
              onClick={() => setIsLostModalOpen(true)}
              disabled={lead.status === 'lost' || lead.status === 'converted'}
            >
              <XCircle size={17} />
              Mark as Lost
            </Button>
          </Card>

        </div>
      </div>

      {/* ── Schedule Meeting Modal ── */}
      <Modal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        title="Schedule Meeting"
      >
        <form onSubmit={handleScheduleMeeting} className="space-y-6">
          <div className="p-4 bg-[var(--primary)]/10 rounded-xl border border-[var(--primary)]/20">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Scheduling a meeting for <span className="font-bold">{lead.name}</span>
            </p>
          </div>
          <DateTimePicker
            label="Meeting Date & Time"
            dateValue={meetingDate}
            timeValue={meetingTime}
            onDateChange={setMeetingDate}
            onTimeChange={setMeetingTime}
            required
          />
          {actionError && (
            <p className="text-xs text-[var(--error)] font-medium">{actionError}</p>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" type="button" onClick={() => setIsMeetingModalOpen(false)} fullWidth>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={actionLoading} fullWidth>Confirm Meeting</Button>
          </div>
        </form>
      </Modal>

      {/* ── Mark Lost Modal ── */}
      <Modal
        isOpen={isLostModalOpen}
        onClose={() => setIsLostModalOpen(false)}
        title="Mark as Lost"
      >
        <form onSubmit={handleMarkLost} className="space-y-5">
          <div className="p-4 bg-[var(--error)]/10 rounded-xl border border-[var(--error)]/20">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Are you sure you want to mark <span className="font-bold">{lead.name}</span> as lost?
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Reason (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why was this lead lost?"
              rows={3}
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--error)] resize-none"
            />
          </div>
          {actionError && (
            <p className="text-xs text-[var(--error)] font-medium">{actionError}</p>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" type="button" onClick={() => setIsLostModalOpen(false)} fullWidth>Cancel</Button>
            <Button variant="danger" type="submit" isLoading={actionLoading} fullWidth>Confirm Lost</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default LeadDetailsPage;
