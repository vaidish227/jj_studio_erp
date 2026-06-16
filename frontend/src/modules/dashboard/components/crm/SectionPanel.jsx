import { ChevronRight } from 'lucide-react';
import Card from '../../../../shared/components/Card/Card';

const SectionPanel = ({
  title,
  subtitle,
  icon: Icon,
  iconBg = 'bg-[var(--primary)]/10',
  iconColor = 'text-[var(--primary)]',
  actionLabel,
  onAction,
  badge,
  children,
  className = '',
  padding = 'p-5',
}) => {
  return (
    <Card padding={padding} className={`flex flex-col gap-4 h-full ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
            >
              <Icon size={16} className={iconColor} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                {title}
              </h3>
              {badge && (typeof badge === 'string' ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)]">
                  {badge}
                </span>
              ) : (
                badge
              ))}
            </div>
            {subtitle && (
              <p className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] flex items-center gap-0.5 shrink-0"
          >
            {actionLabel}
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">{children}</div>
    </Card>
  );
};

export default SectionPanel;
