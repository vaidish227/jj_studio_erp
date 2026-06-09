import React from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Phone,
  RotateCcw,
  FileText,
  Mail,
  MessageSquare,
  Users,
} from 'lucide-react';
import Badge from '../../../shared/components/Badge/Badge';
import Button from '../../../shared/components/Button/Button';
import Select from '../../../shared/components/Select/Select';
import usePermission from '../../../shared/hooks/usePermission';

export const statusVariants = {
  scheduled:   'primary',
  rescheduled: 'warning',
  completed:   'success',
  cancelled:   'error',
};

const channelIcons = (a) => (
  <span className="inline-flex items-center gap-1 ml-1">
    {a.notifyEmail !== false && a.email && <Mail size={10} className="text-[var(--text-muted)]" />}
    {a.notifyWhatsApp !== false && a.phone && <MessageSquare size={10} className="text-[var(--text-muted)]" />}
  </span>
);

export const MeetingAttendeesSummary = ({ meeting }) => {
  const internal = meeting?.attendees?.internal || [];
  const client = meeting?.attendees?.client || [];
  const total = internal.length + client.length;
  if (total === 0) return null;

  return (
    <details className="group/att rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-4 py-2.5 text-sm open:py-3">
      <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <div className="w-7 h-7 rounded-lg bg-[var(--surface)] flex items-center justify-center text-[var(--primary)]">
            <Users size={14} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">{total} Attendee{total === 1 ? '' : 's'}</span>
          <span className="text-[10px] text-[var(--text-muted)] font-medium">
            {client.length} client • {internal.length} team
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest group-open/att:hidden">Show</span>
        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest hidden group-open/att:inline">Hide</span>
      </summary>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-[var(--border)]">
        {client.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Client Side</p>
            {client.map((c, i) => (
              <p key={`c-${i}`} className="text-xs text-[var(--text-primary)] flex items-center">
                <span className="font-semibold">{c.name}</span>
                {c.relation && c.relation !== 'lead' && (
                  <span className="ml-1 text-[10px] text-[var(--text-muted)] capitalize">({c.relation.replace('_', ' ')})</span>
                )}
                {channelIcons(c)}
              </p>
            ))}
          </div>
        )}
        {internal.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Internal Team</p>
            {internal.map((a, i) => (
              <p key={`i-${i}`} className="text-xs text-[var(--text-primary)] flex items-center">
                <span className="font-semibold">{a.name || a.userId?.name || 'Team member'}</span>
                {a.role && <span className="ml-1 text-[10px] text-[var(--text-muted)] capitalize">({a.role})</span>}
                {channelIcons(a)}
              </p>
            ))}
          </div>
        )}
      </div>
    </details>
  );
};

const MeetingCard = ({ meeting, onViewDetails, onStatusChange, onReschedule, onRecordMOM }) => {
  const lead = meeting.leadId || {};
  const date = new Date(meeting.date);
  const hasMOM = !!meeting.mom?.recordedAt;
  const isCompleted = meeting.status === 'completed';
  // Status change, reschedule and MOM are CRM writes — hidden for read-only roles.
  const canUpdate = usePermission('crm.update');

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300 group shadow-sm">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-11 h-11 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center text-[var(--primary)] shrink-0 group-hover:bg-[var(--primary)] group-hover:text-black transition-all duration-500">
          <CalendarIcon size={22} strokeWidth={2.5} />
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors duration-300 tracking-tight">{lead.name || 'Unknown Lead'}</h3>
              <p className="text-xs text-[var(--text-muted)] font-semibold mt-0.5">{lead.projectType || 'Interior Project'} • {lead.city || 'Location'}</p>
            </div>
            <Badge
              variant={statusVariants[meeting.status] || 'default'}
              className="uppercase text-[10px] font-black tracking-[0.1em] px-3 py-1 rounded-full border-none whitespace-nowrap"
            >
              {meeting.status || 'scheduled'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-xs">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
              <CalendarIcon size={13} className="text-[var(--text-muted)] shrink-0" />
              <span>{date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} at {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
              <Clock size={13} className="text-[var(--text-muted)] shrink-0" />
              <span>{meeting.durationMinutes || 60} min duration</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium min-w-0">
              <MapPin size={13} className="text-[var(--text-muted)] shrink-0" />
              <span className="truncate">{meeting.type === 'site'
                ? (typeof lead.siteAddress === 'object'
                    ? lead.siteAddress?.fullAddress || lead.siteAddress?.city || 'Site Address'
                    : lead.siteAddress || 'Site Address')
                : 'JJ Studio - Office'}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
              <Phone size={13} className="text-[var(--text-muted)] shrink-0" />
              <span>+91 {lead.phone || '0000000000'}</span>
            </div>
          </div>

          <div className="px-3 py-2.5 bg-[var(--bg)] rounded-lg border border-[var(--border)] text-xs text-[var(--text-primary)] relative overflow-hidden group-hover:border-[var(--primary)]/30 transition-colors">
            <div className="absolute top-0 left-0 w-0.5 h-full bg-[var(--primary)] opacity-30"></div>
            <span className="font-bold text-[var(--primary)] uppercase text-[9px] tracking-wider block mb-0.5">Meeting Notes</span>
            <span className="text-[var(--text-secondary)] leading-relaxed line-clamp-2">{meeting.notes || 'Meeting to understand client requirements and site measurements.'}</span>
          </div>

          <MeetingAttendeesSummary meeting={meeting} />

          {hasMOM && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-emerald-700 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <FileText size={12} /> Minutes of Meeting
                </span>
                <span className="text-[10px] text-emerald-700/70 font-medium">
                  {new Date(meeting.mom.recordedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {meeting.mom.discussionSummary && (
                <p className="text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-2">
                  {meeting.mom.discussionSummary}
                </p>
              )}
              <div className="flex items-center gap-4 text-[11px] font-bold text-emerald-700">
                <span>{(meeting.mom.attendees?.staff?.length || 0) + (meeting.mom.attendees?.clients?.length || 0)} attendees</span>
                <span>•</span>
                <span>{meeting.mom.decisions?.length || 0} decisions</span>
                <span>•</span>
                <span>{meeting.mom.actionItems?.length || 0} action items</span>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-2 pt-1 items-stretch">
            {canUpdate && (
              <>
                <Select
                  value={meeting.status || 'scheduled'}
                  onChange={(value) => onStatusChange(meeting._id, value)}
                  options={[
                    { value: 'scheduled',   label: 'Scheduled' },
                    { value: 'rescheduled', label: 'Rescheduled' },
                    { value: 'completed',   label: 'Completed' },
                    { value: 'cancelled',   label: 'Cancelled' },
                  ]}
                  className="lg:w-44"
                />
                {meeting.status !== 'completed' && meeting.status !== 'cancelled' && (
                  <Button variant="outline" size="sm" className="justify-center text-xs font-bold" onClick={() => onReschedule(meeting)}>
                    <RotateCcw size={14} className="mr-1.5" />
                    Reschedule
                  </Button>
                )}
                {isCompleted && onRecordMOM && (
                  <Button
                    variant={hasMOM ? 'outline' : 'secondary'}
                    size="sm"
                    className="justify-center text-xs font-bold"
                    onClick={() => onRecordMOM(meeting)}
                  >
                    <FileText size={14} className="mr-1.5" />
                    {hasMOM ? 'View / Edit MOM' : 'Record MOM'}
                  </Button>
                )}
              </>
            )}
            <Button variant="primary" size="sm" className="lg:ml-auto justify-center text-xs font-bold" onClick={onViewDetails}>
              View Lead Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingCard;
