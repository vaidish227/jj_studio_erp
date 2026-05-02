import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  FileImage,
  FileText,
  IndianRupee,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  User,
  UserPlus,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import DateTimePicker from '../../../shared/components/DateTimePicker/DateTimePicker';
import Modal from '../../../shared/components/Modal/Modal';
import Select from '../../../shared/components/Select/Select';
import FormField from '../../../shared/components/FormField/FormField';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import { useCRM } from '../../crm/context/CRMContext';
import useLeadDetails from '../hooks/useLeadDetails';
import useLeadFlow, { lifecycleLabels } from '../../../shared/hooks/useLeadFlow';
import { useLeadStatusManager, LEAD_ACTIONS } from '../../../shared/hooks/useLeadStatusManager';
import { crmService } from '../../../shared/services/crmService';
import { formatDateShort, formatDateTime } from '../../../shared/utils/dateUtils';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader } from '../../../shared/components';

const LIFECYCLE_STEPS = [
  'enquiry',
  'meeting_scheduled',
  'kit',
  'show_project',
  'proposal_sent',
  'converted'
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'In Progress' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'lost', label: 'Lost' },
  { value: 'converted', label: 'Converted' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SHOWCASE_OPTIONS = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'template', label: 'Template' },
  { value: 'link', label: 'Link' },
];


const LeadDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setActiveLead } = useCRM();
  const { lead, isLoading, error, updateStatus, updateLead, refresh } = useLeadDetails(id);
  const { meetings, followups, proposals, timeline, refreshRelatedData, scheduleAutomations } =
    useLeadFlow(id);
  const { transitionStatus } = useLeadStatusManager();

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [meetingType, setMeetingType] = useState('office');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [note, setNote] = useState('');
  const [followupDate, setFollowupDate] = useState(new Date().toISOString().split('T')[0]);
  const [followupNote, setFollowupNote] = useState('');
  const [showcaseType, setShowcaseType] = useState('image');
  const [showcaseTitle, setShowcaseTitle] = useState('');
  const [showcaseUrl, setShowcaseUrl] = useState('');
  const [showcaseNote, setShowcaseNote] = useState('');
  const [siteVisitNote, setSiteVisitNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const projectAssets = lead?.showProject?.assets || [];


  if (isLoading) {
    return <Loader fullPage label="Syncing lead profile..." />;
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

  const runAction = async (work, successMessage) => {
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');

    try {
      await work();
      await Promise.all([refresh(), refreshRelatedData()]);
      if (successMessage) setActionSuccess(successMessage);
    } catch (err) {
      setActionError(err || 'Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleMeeting = async (e) => {
    e.preventDefault();

    // --- Validation: Present or future date only ---
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const selectedDate = new Date(meetingDate);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < now) {
      setActionError('You cannot schedule a meeting in the past.');
      return;
    }

    const isoDate = `${meetingDate}T${meetingTime}`;

    await runAction(async () => {
      await crmService.createMeeting({
        leadId: id,
        date: isoDate,
        type: meetingType,
        notes: meetingNotes,
      });
      scheduleAutomations(id, isoDate);
      await transitionStatus(id, LEAD_ACTIONS.SCHEDULE_MEETING);
      setIsMeetingModalOpen(false);
    }, 'Meeting scheduled and automation timers started.');
  };

  const handleSaveNote = async () => {
    if (!note.trim()) return;

    await runAction(async () => {
      await updateLead({ notes: note });
      setNote('');
    }, 'Lead note saved.');
  };

  const handleCreateFollowup = async () => {
    if (!followupNote.trim()) return;

    // --- Validation: Present or future date only ---
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const selectedDate = new Date(followupDate);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < now) {
      setActionError('Follow-up date cannot be in the past.');
      return;
    }

    await runAction(async () => {
      await crmService.createFollowup({
        leadId: id,
        date: `${followupDate}T10:00`,
        note: followupNote,
        nextFollowupDate: `${followupDate}T10:00`,
      });
      await transitionStatus(id, LEAD_ACTIONS.RECORD_FOLLOWUP);
      setFollowupNote('');
    }, 'Follow-up added to KIT history.');
  };

  const handleShowProject = async () => {
    if (!showcaseTitle.trim() || !showcaseUrl.trim()) {
      setActionError('Asset title and URL are required.');
      return;
    }

    await runAction(async () => {
      await crmService.updateShowProject(id, {
        assets: [
          ...projectAssets,
          {
            type: showcaseType,
            title: showcaseTitle,
            url: showcaseUrl,
            note: showcaseNote,
          },
        ],
        siteVisitPlanned: Boolean(siteVisitNote.trim()),
        siteVisitNote,
      });

      setShowcaseTitle('');
      setShowcaseUrl('');
      setShowcaseNote('');
    }, 'Project showcase updated.');
  };


  const handleOpenClientInfo = () => {
    setActiveLead({
      id,
      _id: id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
    });

    navigate('/crm/forms/client-info', {
      state: {
        leadId: id,
        clientId: lead.clientId || null,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
      },
    });
  };

  const handleConvert = async () => {
    await runAction(async () => {
      await crmService.convertLeadToClient(id);
      await updateStatus('converted');
    }, 'Lead converted successfully.');
  };

  const handleStatusChange = async (value) => {
    await runAction(async () => {
      await updateStatus(value);
    }, 'Lead status updated.');
  };

  const handlePriorityChange = async (value) => {
    await runAction(async () => {
      await updateLead({ priority: value });
    }, 'Lead priority updated.');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-2 sm:px-0">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-muted)] transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{lead.name}</h1>
              <StatusBadge value={lead.status} />
              <StatusBadge value={lead.lifecycleStage} type="lifecycle" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Lead #{id.slice(-6).toUpperCase()} • {formatDateShort(lead.createdAt)}
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-2"><Phone size={14} /> {lead.phone || '—'}</span>
              <span className="inline-flex items-center gap-2"><Mail size={14} /> {lead.email || '—'}</span>
              <span className="inline-flex items-center gap-2"><MapPin size={14} /> {lead.city || '—'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => setIsMeetingModalOpen(true)}>
            <Calendar size={16} />
            Schedule Meeting
          </Button>
          <Button variant="outline" onClick={handleOpenClientInfo}>
            <UserPlus size={16} />
            Client Info
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`https://wa.me/91${lead.phone?.replace(/\D/g, '')}`, '_blank')}
          >
            <MessageSquare size={16} />
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Lifecycle Stepper */}
      <Card className="py-8 px-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[600px] px-8">
          {LIFECYCLE_STEPS.map((step, index) => {
            const isCompleted = LIFECYCLE_STEPS.indexOf(lead.lifecycleStage) >= index || lead.status === 'converted';
            const isActive = lead.lifecycleStage === step;

            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center gap-3 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isCompleted
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-black'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
                    } ${isActive ? 'ring-4 ring-[var(--primary)]/20 scale-110' : ''}`}>
                    {isCompleted ? <CheckCircle2 size={20} /> : <span className="text-xs font-bold">{index + 1}</span>}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${isCompleted ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                    }`}>
                    {lifecycleLabels[step] || step}
                  </span>
                </div>
                {index < LIFECYCLE_STEPS.length - 1 && (
                  <div className="flex-1 h-[2px] bg-[var(--border)] mx-2 mb-6 relative">
                    <div
                      className="absolute inset-0 bg-[var(--primary)] transition-all duration-1000 origin-left"
                      style={{ transform: `scaleX(${isCompleted ? 1 : 0})` }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {(actionError || actionSuccess) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${actionError ? 'bg-[var(--error)]/10 border-[var(--error)]/20 text-[var(--error)]' : 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]'}`}>
          {actionError || actionSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <InfoItem icon={User} label="Client" value={lead.name} />
              <InfoItem icon={Mail} label="Email" value={lead.email} />
              <InfoItem icon={Phone} label="Phone" value={lead.phone} />
              <InfoItem icon={Building2} label="Project Type" value={lead.projectType} />
              <InfoItem icon={IndianRupee} label="Budget" value={lead.budget ? `Rs. ${Number(lead.budget).toLocaleString('en-IN')}` : '—'} />
              <InfoItem icon={MapPin} label="Site Address" value={lead.siteAddress || '—'} />
            </div>
          </Card>

          <Card className="space-y-5">
            <SectionTitle title="KIT Notes & Interaction History" icon={Activity} />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add internal notes, client mood, requirement changes, or call outcomes..."
              rows={4}
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
            />
            <Button variant="primary" onClick={handleSaveNote} isLoading={actionLoading}>
              Save Note
            </Button>

            <div className="space-y-3">
              {(lead.interactionHistory || []).slice().reverse().map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--text-primary)]">{entry.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{entry.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-5">
            <SectionTitle title="Follow-ups" icon={Clock} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="date"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
              <textarea
                value={followupNote}
                onChange={(e) => setFollowupNote(e.target.value)}
                rows={2}
                className="md:col-span-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                placeholder="Add follow-up reminder or KIT interaction"
              />
            </div>
            <Button variant="primary" onClick={handleCreateFollowup} isLoading={actionLoading}>
              <Plus size={16} />
              Add Follow-up
            </Button>

            <div className="space-y-3">
              {followups.length ? followups.map((item) => (
                <div key={item._id} className="rounded-xl border border-[var(--border)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--text-primary)]">{item.note || 'Follow-up recorded'}</p>
                    <StatusBadge value={item.status === 'done' ? 'converted' : 'contacted'} />
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Due on {formatDateShort(item.date)}
                  </p>
                </div>
              )) : (
                <EmptyState text="No follow-ups recorded yet." />
              )}
            </div>
          </Card>

          <Card className="space-y-6">
            <SectionTitle title="Show Project" icon={FileImage} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                value={showcaseType}
                onChange={setShowcaseType}
                options={SHOWCASE_OPTIONS}
                label="Asset Type"
              />
              <FormField label="Asset Title">
                <input
                  value={showcaseTitle}
                  onChange={(e) => setShowcaseTitle(e.target.value)}
                  placeholder="e.g. Living Room Concept"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </FormField>

              <div className="md:col-span-2">
                <FormField label="Asset URL (Image/Video/Template)">
                  <input
                    value={showcaseUrl}
                    onChange={(e) => setShowcaseUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField label="Context or Remarks">
                  <textarea
                    value={showcaseNote}
                    onChange={(e) => setShowcaseNote(e.target.value)}
                    rows={2}
                    placeholder="What should the client focus on?"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                  />
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField label="Site Visit Notes (Optional)">
                  <textarea
                    value={siteVisitNote}
                    onChange={(e) => setSiteVisitNote(e.target.value)}
                    rows={2}
                    placeholder="Details about planned site visit"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                  />
                </FormField>
              </div>
            </div>
            <Button variant="primary" onClick={handleShowProject} isLoading={actionLoading}>
              Save Showcase Step
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectAssets.length ? projectAssets.map((asset, index) => (
                <a
                  key={`${asset.url}-${index}`}
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 hover:border-[var(--primary)] transition-colors"
                >
                  <p className="font-semibold text-[var(--text-primary)]">{asset.title}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{asset.note || lifecycleLabels.show_project}</p>
                  <p className="text-xs text-[var(--primary)] mt-2 uppercase">{asset.type}</p>
                </a>
              )) : (
                <EmptyState text="No project references shared yet." />
              )}
            </div>
          </Card>


          <Card className="space-y-6 overflow-hidden border-none shadow-xl shadow-black/5 bg-[var(--surface)]">
            <div className="flex items-center justify-between">
              <SectionTitle title="Lead Qualification" icon={CheckCircle2} />
              {lead.lifecycleStage === 'interested' && (
                <span className="px-2 py-1 rounded-md bg-[var(--success)]/10 text-[var(--success)] text-[10px] font-black uppercase tracking-widest animate-pulse">
                  Ready for Proposal
                </span>
              )}
            </div>

            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Based on the project showcase and KIT interactions, determine if the client is interested in moving forward with a formal proposal.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                disabled={actionLoading || lead.lifecycleStage === 'interested'}
                onClick={() => runAction(() => transitionStatus(id, LEAD_ACTIONS.MARK_INTERESTED), 'Lead marked as Interested. You can now draft a proposal.')}
                className={`flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group ${lead.lifecycleStage === 'interested'
                    ? 'border-[var(--success)] bg-[var(--success)]/5 cursor-default'
                    : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 cursor-pointer'
                  }`}
              >
                <div className={`p-3 rounded-xl transition-colors ${lead.lifecycleStage === 'interested' ? 'bg-[var(--success)] text-black' : 'bg-[var(--bg)] text-[var(--text-muted)] group-hover:text-[var(--primary)]'
                  }`}>
                  <CheckCircle2 size={24} />
                </div>
                <div className="text-center">
                  <p className={`font-black uppercase tracking-widest text-xs ${lead.lifecycleStage === 'interested' ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'
                    }`}>Interested</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">Handoff to Proposal System</p>
                </div>
              </button>

              <button
                disabled={actionLoading || lead.status === 'lost'}
                onClick={() => runAction(() => transitionStatus(id, LEAD_ACTIONS.MARK_LOST), 'Lead marked as Not Interested (Lost).')}
                className={`flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group ${lead.status === 'lost'
                    ? 'border-[var(--error)] bg-[var(--error)]/5 cursor-default'
                    : 'border-[var(--border)] hover:border-[var(--error)]/30 hover:bg-[var(--error)]/5 cursor-pointer'
                  }`}
              >
                <div className={`p-3 rounded-xl transition-colors ${lead.status === 'lost' ? 'bg-[var(--error)] text-white' : 'bg-[var(--bg)] text-[var(--text-muted)] group-hover:text-[var(--error)]'
                  }`}>
                  <XCircle size={24} />
                </div>
                <div className="text-center">
                  <p className={`font-black uppercase tracking-widest text-xs ${lead.status === 'lost' ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'
                    }`}>Not Interested</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">Mark as Lost / No further action</p>
                </div>
              </button>
            </div>

            {lead.lifecycleStage === 'interested' && (
              <div className="pt-2 animate-in slide-in-from-top duration-500">
                <Button
                  variant="primary"
                  fullWidth
                  className="py-4 shadow-lg shadow-[var(--primary)]/20"
                  onClick={() => navigate(`/proposal/create?leadId=${id}`)}
                >
                  Proceed to Proposal Module
                  <ArrowLeft size={16} className="rotate-180" />
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <SectionTitle title="Lead Controls" icon={Clock} />
            <Select label="Lead Status" value={lead.status || 'new'} onChange={handleStatusChange} options={STATUS_OPTIONS} />
            <Select label="Priority" value={lead.priority || 'medium'} onChange={handlePriorityChange} options={PRIORITY_OPTIONS} />
            <div className="rounded-xl bg-[var(--bg)] border border-[var(--border)] p-4 space-y-2 text-sm">
              <p className="text-[var(--text-muted)]">Current lifecycle stage</p>
              <p className="font-semibold text-[var(--text-primary)]">{lifecycleLabels[lead.lifecycleStage] || lead.lifecycleStage}</p>
            </div>
          </Card>

          <Card className="space-y-4">
            <SectionTitle title="Meetings" icon={Calendar} />
            {meetings.length ? meetings.map((meeting) => (
              <div key={meeting._id} className="rounded-xl border border-[var(--border)] px-4 py-3">
                <p className="font-semibold text-[var(--text-primary)] capitalize">{meeting.type} meeting</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {formatDateTime(meeting.date)}
                </p>
              </div>
            )) : (
              <EmptyState text="No meetings scheduled yet." />
            )}
          </Card>

          <Card className="space-y-4">
            <SectionTitle title="Timeline" icon={Activity} />
            <div className="space-y-3">
              {timeline.length ? timeline.map((item) => (
                <div key={`${item.type}-${item.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                  <p className="font-semibold text-[var(--text-primary)] capitalize">{item.title}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{item.description}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-2">{formatDateTime(item.date)}</p>
                </div>
              )) : (
                <EmptyState text="Timeline entries will appear as the lead moves through the CRM flow." />
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={isMeetingModalOpen} onClose={() => setIsMeetingModalOpen(false)} title="Schedule Meeting">
        <form onSubmit={handleScheduleMeeting} className="space-y-5">
          <Select
            label="Meeting Type"
            value={meetingType}
            onChange={setMeetingType}
            options={[
              { value: 'office', label: 'Office Meeting' },
              { value: 'site', label: 'Site Meeting' },
              { value: 'call', label: 'Phone / Video Call' },
            ]}
          />

          <DateTimePicker
            label="Date & Time"
            dateValue={meetingDate}
            timeValue={meetingTime}
            onDateChange={setMeetingDate}
            onTimeChange={setMeetingTime}
            required
          />

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Meeting Notes</label>
            <textarea
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              placeholder="e.g. Discussing living room concept..."
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" type="button" onClick={() => setIsMeetingModalOpen(false)} fullWidth>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={actionLoading} fullWidth>
              Save Meeting
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const SectionTitle = ({ title, icon: Icon }) => (
  <div className="flex items-center gap-2">
    <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
      <Icon size={18} />
    </div>
    <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
  </div>
);

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
    <div className="mt-2 flex items-start gap-2 text-sm text-[var(--text-primary)]">
      <Icon size={16} className="shrink-0 mt-0.5 text-[var(--text-muted)]" />
      <span>{value || '—'}</span>
    </div>
  </div>
);

const EmptyState = ({ text }) => (
  <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
    {text}
  </div>
);

export default LeadDetailsPage;
