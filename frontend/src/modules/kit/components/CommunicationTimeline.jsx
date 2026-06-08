import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Mail, Bell, Loader2, CheckCheck, Check, AlertTriangle, Eye, Zap } from 'lucide-react';
import { kitService } from '../../../shared/services/kitService';

// Channel → icon + accent.
const CHANNEL_META = {
  email:        { icon: Mail,          color: 'var(--primary)' },
  whatsapp:     { icon: MessageCircle, color: 'var(--accent-blue, #3A6EA5)' },
  notification: { icon: Bell,          color: 'var(--warning)' },
};

// Status → label + icon + color.
const STATUS_META = {
  queued:    { label: 'Queued',    icon: Check,        color: 'var(--text-muted)' },
  sent:      { label: 'Sent',      icon: Check,        color: 'var(--text-secondary)' },
  delivered: { label: 'Delivered', icon: CheckCheck,   color: 'var(--accent-blue, #3A6EA5)' },
  read:      { label: 'Read',      icon: Eye,          color: 'var(--success, #27AE60)' },
  replied:   { label: 'Replied',   icon: CheckCheck,   color: 'var(--success, #27AE60)' },
  failed:    { label: 'Failed',    icon: AlertTriangle,color: 'var(--error)' },
  bounced:   { label: 'Bounced',   icon: AlertTriangle,color: 'var(--error)' },
};

const fmt = (d) => {
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      hour12: true, timeZone: 'Asia/Kolkata',
    }).format(new Date(d));
  } catch { return ''; }
};

/**
 * CommunicationTimeline — unified Sent/Delivered/Read/Failed feed for one entity.
 * Embeddable: <CommunicationTimeline entityType="lead" entityId={id} />
 */
const CommunicationTimeline = ({ entityType, entityId }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTimeline = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true); setError(null);
    try {
      const res = await kitService.getTimeline(entityType, entityId);
      setItems(res?.data?.items || []);
    } catch (err) {
      setError(err?.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
        <Loader2 size={24} className="animate-spin opacity-30" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-[var(--error)] py-6 text-center">{error}</p>;
  }
  if (!items.length) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <MessageCircle size={28} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm font-medium">No communications yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((it) => {
        const ch = CHANNEL_META[it.channel] || CHANNEL_META.notification;
        const st = STATUS_META[it.status] || STATUS_META.sent;
        const ChIcon = ch.icon;
        const StIcon = st.icon;
        return (
          <div key={`${it.source}-${it.id}`} className="flex gap-3 py-3 border-b border-[var(--border)] last:border-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${ch.color} 14%, transparent)`, color: ch.color }}>
              <ChIcon size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {it.title && <span className="font-bold text-[var(--text-primary)] text-sm truncate">{it.title}</span>}
                {it.module === 'kit' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--warning)]/10 text-[var(--warning)] text-[10px] font-black uppercase tracking-wide">
                    <Zap size={10} /> KIT
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: st.color }}>
                  <StIcon size={13} /> {st.label}
                </span>
              </div>
              {it.preview && <p className="text-sm text-[var(--text-secondary)] mt-0.5 line-clamp-2">{it.preview}</p>}
              {it.error && <p className="text-xs text-[var(--error)] mt-0.5">{it.error}</p>}
              <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                <span>{fmt(it.at)}</span>
                {it.to && <><span>·</span><span className="truncate">{it.to}</span></>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CommunicationTimeline;
