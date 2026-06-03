import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Clock, User, AlertTriangle } from 'lucide-react';
import { Button } from '../../../../shared/components';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { useAuth } from '../../../../shared/context/AuthContext';
import { pmsService } from '../../../../shared/services/pmsService';

/**
 * DrawingReleaseTab — Phase 2.
 * Shows all released drawings with their release log and per-recipient ack status.
 *
 * The list is sourced from the project drawings filtered by isReleased=true.
 * For each, we fetch the latest release log via getDrawingReleaseLog.
 */
const DrawingReleaseTab = ({ project }) => {
  const projectId = project?._id;
  const [drawings, setDrawings] = useState([]);
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const dRes = await pmsService.getDrawingsByProject(projectId);
      const released = (dRes.drawings || []).filter((d) => d.isReleased || d.status === 'released_to_site');
      setDrawings(released);

      // Fetch release log for each released drawing
      const logMap = {};
      await Promise.all(
        released.map(async (d) => {
          try {
            const r = await pmsService.getDrawingReleaseLog(d._id);
            logMap[d._id] = r.logs || [];
          } catch (e) {
            logMap[d._id] = [];
          }
        })
      );
      setLogs(logMap);
    } catch (e) {
      setError(e?.message || 'Failed to load release log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  if (!projectId) return null;
  if (error) {
    return (
      <div className="text-center text-sm text-[var(--error)] py-8">
        <AlertTriangle size={18} className="inline mr-2" /> {error}
      </div>
    );
  }
  if (loading) {
    return <p className="text-center text-sm text-[var(--text-muted)] py-8">Loading release log…</p>;
  }
  if (drawings.length === 0) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">No drawings released to site yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drawings.map((d) => (
        <ReleaseRow
          key={d._id}
          drawing={d}
          logs={logs[d._id] || []}
          onAck={load}
        />
      ))}
    </div>
  );
};

const ReleaseRow = ({ drawing, logs, onAck }) => {
  const latest = logs[0] || null;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            v{drawing.version} · {drawing.drawingType}
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{drawing.title}</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--success)] bg-[var(--success)]/10 px-2 py-0.5 rounded-md">
          Released
        </span>
      </div>

      {latest ? (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">
            Released by <span className="font-bold text-[var(--text-primary)]">
              {latest.releasedBy?.name || '—'}
            </span>{' '}
            on {new Date(latest.releasedAt).toLocaleString('en-IN')}
          </p>
          {latest.recipients?.length > 0 ? (
            <div className="space-y-1.5">
              {latest.recipients.map((r) => (
                <RecipientRow key={r._id} recipient={r} logId={latest._id} onAck={onAck} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">No recipients on record.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)] italic">No release log entries yet for this drawing.</p>
      )}
    </div>
  );
};

const RecipientRow = ({ recipient, logId, onAck }) => {
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const isMe = recipient.userId && String(recipient.userId._id || recipient.userId) === String(user?._id);
  const acked = !!recipient.ackedAt;

  const handleAck = async () => {
    setBusy(true);
    try {
      await pmsService.ackDrawingRelease(logId, { recipientId: recipient._id });
      toast.success('Acknowledged');
      onAck?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to ack');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <User size={12} className="text-[var(--text-muted)]" />
      <span className="text-[var(--text-primary)] font-semibold">{recipient.name || recipient.phone || 'Recipient'}</span>
      <span className="text-[var(--text-muted)] text-[10px] uppercase">via {recipient.channel}</span>
      <span className="ml-auto flex items-center gap-2">
        {acked ? (
          <span className="inline-flex items-center gap-1 text-[var(--success)] font-bold">
            <CheckCircle2 size={11} /> Acked {new Date(recipient.ackedAt).toLocaleDateString('en-IN')}
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 text-[var(--warning)] font-bold">
              <Clock size={11} /> Pending
            </span>
            {isMe && (
              <Button size="sm" variant="outline" onClick={handleAck} disabled={busy}>
                Ack
              </Button>
            )}
          </>
        )}
      </span>
    </div>
  );
};

export default DrawingReleaseTab;
