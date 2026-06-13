import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';

function timeAgo(d) {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  if (Number.isNaN(ms)) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

const ActivityCard = ({ items }) => {
  const navigate = useNavigate();
  if (!items?.length) return null;
  return (
    <div className="flex flex-col gap-0.5 bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-2 py-1.5">
      {items.map((a) => (
        <button
          type="button"
          key={a.id}
          onClick={() => a.url && navigate(a.url)}
          disabled={!a.url}
          className="text-left flex items-start gap-2 px-1.5 py-1 rounded hover:bg-[var(--bg,#F8F7F3)] transition-colors disabled:hover:bg-transparent disabled:cursor-default"
        >
          <Activity className="w-3 h-3 text-[var(--accent-teal,#4A8F7C)] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0 text-[11px]">
            <div className="text-[var(--text,#2E2E2E)] truncate leading-tight">
              <span className="font-medium">{a.actor?.name || 'Someone'}</span>
              {' '}
              <span className="text-[var(--text-muted,#A0A0A0)]">{a.description}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[var(--text-muted,#A0A0A0)]">
              <span>{timeAgo(a.at)}</span>
              {a.project?.trackingId && (
                <>
                  <span>·</span>
                  <span className="font-mono">{a.project.trackingId}</span>
                </>
              )}
              <span>·</span>
              <span>{a.entityType.replace(/_/g, ' ')} · {a.action.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ActivityCard;
