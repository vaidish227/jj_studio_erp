import { useNavigate } from 'react-router-dom';
import { Phone, MapPin, CalendarDays, Building2 } from 'lucide-react';
import Avatar from '../../../shared/components/Avatar/Avatar';
import Badge from '../../../shared/components/Badge/Badge';

const priorityConfig = {
  high:   { label: 'High Priority',   dot: 'bg-[var(--error)]',   text: 'text-[var(--error)]' },
  medium: { label: 'Medium Priority', dot: 'bg-[var(--warning)]', text: 'text-[var(--warning)]' },
  low:    { label: 'Low Priority',    dot: 'bg-[var(--success)]', text: 'text-[var(--success)]' },
};

const LeadCard = ({ lead, onMenuClick }) => {
  const navigate = useNavigate();
  const { _id, id, name, phone, city, project, date, status = 'NEW', priority = 'medium' } = lead;
  const prio = priorityConfig[priority] ?? priorityConfig.medium;

  const handleCardClick = () => {
    navigate(`/crm/leads/${_id || id}`);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="
        bg-[var(--surface)] border border-[var(--border)] rounded-2xl
        px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4
        hover:shadow-md hover:shadow-black/5 transition-all duration-200
        cursor-pointer group
      "
    >
      {/* Avatar */}
      <Avatar
        name={name}
        size="lg"
        className="bg-[var(--primary)]/20 text-[var(--primary)] font-bold shrink-0 self-start sm:self-center"
      />

      {/* Name / Phone / City */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-base font-bold text-[var(--text-primary)]">{name}</p>
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
          <Phone size={13} className="shrink-0" />
          <span>{phone}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
          <MapPin size={13} className="shrink-0" />
          <span>{city}</span>
        </div>
      </div>

      {/* Project box */}
      <div className="flex items-center gap-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 sm:w-56 shrink-0">
        <Building2 size={18} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-sm text-[var(--text-secondary)] leading-snug line-clamp-2">{project}</span>
      </div>

      {/* Date + Status */}
      <div className="flex flex-col items-start sm:items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
          <CalendarDays size={14} className="shrink-0" />
          <span>{date}</span>
        </div>
        <span className="text-xs font-semibold border border-[var(--primary)]/50 text-[var(--primary)] rounded-full px-3 py-0.5">
          {status}
        </span>
      </div>

      {/* Priority + Menu */}
      <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${prio.text}`}>
          <span>{prio.label}</span>
          <span className={`w-2 h-2 rounded-full ${prio.dot}`} />
        </div>
      </div>
    </div>
  );
};

export default LeadCard;
