import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import apiClient from '../../../shared/services/apiClient';
import { useAIChat } from '../context/AIChatContext';

/**
 * Renders an inline "Confirm or Cancel" card for a write-tool proposal.
 *
 * States the card walks through:
 *   pending    → Confirm / Cancel buttons + live countdown until expiry
 *   confirming → spinner while POST /confirm is in flight
 *   done       → green check + the apply() result summary
 *   cancelled  → muted "Cancelled" line
 *   expired    → muted "Expired" line; can't act anymore
 *   error      → red banner with the error message; user can retry
 *
 * The toolCallId comes from the backend's tool_result payload. All state
 * transitions are local to this card — when the user confirms, the next chat
 * turn will see the outcome via natural conversation.
 */
// Persisted AIToolCall lifecycle → local card phase, used to restore the card
// after a conversation reload instead of defaulting back to pending buttons.
const STATUS_TO_PHASE = {
  pending_confirmation: 'pending',
  confirmed_ok: 'done',
  confirmed_error: 'error',
  denied: 'error',
  cancelled: 'cancelled',
  expired: 'expired',
};

function deriveInitialPhase(message) {
  if (message.confirmPhase) return message.confirmPhase;
  const mapped = message.actionStatus && STATUS_TO_PHASE[message.actionStatus];
  if (mapped) return mapped;
  // No resolved status: a live proposal has a usable toolCallId (actionable).
  // A reloaded pre-fix proposal has no real action id → can't act, show expired.
  if (!message.toolCallId) return 'expired';
  return 'pending';
}

const ActionConfirmCard = ({ message }) => {
  // V3 write-tool proposal contract — set by orchestrator/executor.
  const toolCallId = message.toolCallId;
  const description = message.proposalDescription || message.summaryText || 'Proposed action';
  const expiresAt = message.expiresAt ? new Date(message.expiresAt) : null;

  const [phase, setPhase] = useState(() => deriveInitialPhase(message));
  const [result, setResult] = useState(
    message.confirmResult || (message.actionResultText ? { summaryText: message.actionResultText } : null)
  );
  const [error, setError] = useState(
    message.confirmError ||
    ((message.actionStatus === 'confirmed_error' || message.actionStatus === 'denied')
      ? message.actionResultText
      : null)
  );
  const [remainingMs, setRemainingMs] = useState(() => expiresAt ? Math.max(0, expiresAt - new Date()) : null);
  const tickerRef = useRef(null);

  // Persist the resolved outcome onto the message in context so the card keeps
  // its state across unmount/remount (e.g. closing & reopening the chat panel)
  // without a full DB reload. deriveInitialPhase reads message.confirmPhase first.
  const { resolveAction } = useAIChat();
  const persist = (nextPhase, extra) => {
    if (message?.id) resolveAction(message.id, nextPhase, extra || {});
  };

  // Live countdown until expiry
  useEffect(() => {
    if (phase !== 'pending' || !expiresAt) return undefined;
    tickerRef.current = setInterval(() => {
      const left = Math.max(0, expiresAt - new Date());
      setRemainingMs(left);
      if (left <= 0) { setPhase('expired'); persist('expired'); }
    }, 1000);
    return () => clearInterval(tickerRef.current);
  }, [phase, expiresAt]);

  const onConfirm = async () => {
    if (!toolCallId) return;
    setPhase('confirming'); setError(null);
    try {
      const res = await apiClient.post(`/ai/actions/${toolCallId}/confirm`);
      const failed = res?.ok === false;
      setResult(res);
      setPhase(failed ? 'error' : 'done');
      if (failed) {
        const errText = res?.summaryText || res?.error || 'Action failed.';
        setError(errText);
        persist('error', { error: errText });
      } else {
        persist('done', { result: res });
      }
    } catch (e) {
      const errText = e?.message || e?.summaryText || 'Action failed.';
      setError(errText);
      setPhase('error');
      persist('error', { error: errText });
    }
  };

  const onCancel = async () => {
    if (!toolCallId) return;
    setPhase('cancelling');
    try {
      await apiClient.post(`/ai/actions/${toolCallId}/cancel`);
      setPhase('cancelled');
      persist('cancelled');
    } catch (_e) {
      // Worst case: leave it pending so user can retry; backend will auto-expire.
      setPhase('pending');
    }
  };

  const timer = useMemo(() => {
    if (remainingMs == null) return null;
    const s = Math.max(0, Math.floor(remainingMs / 1000));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }, [remainingMs]);

  // Render

  if (phase === 'done') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-emerald-800">
          <div className="font-medium">Done</div>
          <div className="opacity-90 mt-0.5">{result?.summaryText || 'Action completed.'}</div>
        </div>
      </div>
    );
  }
  if (phase === 'cancelled') {
    return (
      <div className="bg-[var(--bg,#F8F7F3)] border border-dashed border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 text-xs text-[var(--text-muted,#A0A0A0)]">
        <X className="w-3.5 h-3.5 inline-block mr-1" /> Cancelled — no changes were made.
      </div>
    );
  }
  if (phase === 'expired') {
    return (
      <div className="bg-[var(--bg,#F8F7F3)] border border-dashed border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 text-xs text-[var(--text-muted,#A0A0A0)]">
        Proposal expired — ask the assistant again if you still need this change.
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <div className="flex items-start gap-2 text-xs text-red-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Failed</div>
            <div className="opacity-90 mt-0.5">{error}</div>
          </div>
        </div>
        <div className="mt-2 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] px-2 py-1 rounded border border-[var(--border,#e5e5e5)] hover:bg-white"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => { setPhase('pending'); setError(null); persist('pending', { error: null }); }}
            className="text-[11px] px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // pending / confirming / cancelling
  const busy = phase === 'confirming' || phase === 'cancelling';
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-xs">
          <div className="font-medium text-amber-900">Action requires confirmation</div>
          <div className="text-[var(--text,#2E2E2E)] mt-1 whitespace-pre-wrap break-words">{description}</div>
          {timer && phase === 'pending' && (
            <div className="text-[10px] text-amber-700 mt-1">Auto-cancels in {timer}</div>
          )}
        </div>
      </div>
      <div className="mt-2 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-[11px] px-2.5 py-1 rounded border border-[var(--border,#e5e5e5)] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {phase === 'cancelling' ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="text-[11px] px-2.5 py-1 rounded inline-flex items-center gap-1 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--primary, #D4B76C)', color: '#1f1f1f' }}
        >
          {phase === 'confirming' ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
          ) : (
            <><Check className="w-3 h-3" /> Confirm</>
          )}
        </button>
      </div>
    </div>
  );
};

export default ActionConfirmCard;
