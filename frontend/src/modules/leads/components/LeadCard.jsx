import { useNavigate } from 'react-router-dom';
import { Phone, MapPin, CalendarDays, Building2, ChevronRight } from 'lucide-react';
import Avatar from '../../../shared/components/Avatar/Avatar';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';

const priorityConfig = {
  high:   { label: 'High',   dot: 'bg-[var(--error)]',   text: 'text-[var(--error)]',   ring: 'border-[var(--error)]/25 bg-[var(--error)]/10' },
  medium: { label: 'Medium', dot: 'bg-[var(--warning)]', text: 'text-[var(--warning)]', ring: 'border-[var(--warning)]/25 bg-[var(--warning)]/10' },
  low:    { label: 'Low',    dot: 'bg-[var(--success)]', text: 'text-[var(--success)]', ring: 'border-[var(--success)]/25 bg-[var(--success)]/10' },
};

// Pill chip — matches the meta chips used on the Projects grid cards.
const Chip = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold
                   text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)]">
    <Icon size={11} className="text-[var(--text-muted)]" />
    {children}
  </span>
);

const LeadCard = ({ lead, onClick }) => {
  const navigate = useNavigate();
  const { _id, id, name, phone, city, project, date, status = 'new', priority = 'medium', trackingId } = lead;
  const prio = priorityConfig[priority] ?? priorityConfig.medium;

  const handleCardClick = () => {
    if (onClick) onClick();
    else navigate(`/crm/leads/${_id || id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl
                 px-5 py-4 cursor-pointer transition-all duration-200
                 hover:-translate-y-0.5 hover:border-[var(--primary)]/40
                 hover:shadow-[0_12px_30px_-16px_rgba(212,183,108,0.5)]
                 flex flex-col lg:flex-row lg:items-center gap-4"
    >
      {/* Identity — avatar + name + tracking + phone */}
      <div className="flex items-center gap-3.5 min-w-0 lg:w-72 shrink-0">
        <Avatar
          name={name}
          size="lg"
          className="bg-gradient-to-br from-[var(--primary)]/25 to-[var(--primary)]/5
                     text-[var(--primary)] font-black shrink-0 ring-1 ring-[var(--primary)]/15 self-center"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[15px] font-bold text-[var(--text-primary)] truncate
                          group-hover:text-[var(--primary)] transition-colors">
              {name}
            </p>
            {trackingId && (
              <span className="text-[10px] font-black bg-[var(--primary)]/10 text-[var(--primary)]
                               px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                {trackingId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
            <Phone size={12} className="shrink-0" />
            <span className="truncate">{phone || '—'}</span>
          </div>
        </div>
      </div>

      {/* Meta chips — location + project type */}
      <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
        {city && <Chip icon={MapPin}>{city}</Chip>}
        {project && <Chip icon={Building2}>{project}</Chip>}
      </div>

      {/* Right rail — date, status, priority, affordance */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] whitespace-nowrap">
          <CalendarDays size={13} className="shrink-0" />
          <span>{date}</span>
        </div>

        <StatusBadge value={status} type="status" />

        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border ${prio.ring} ${prio.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
          {prio.label}
        </span>

        <ChevronRight
          size={16}
          className="text-[var(--text-muted)] -mr-1 hidden lg:block
                     group-hover:translate-x-0.5 group-hover:text-[var(--primary)] transition-all duration-200"
        />
      </div>
    </div>
  );
};

export default LeadCard;
