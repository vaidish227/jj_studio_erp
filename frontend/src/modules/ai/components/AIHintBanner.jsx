import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';

const STORAGE_PREFIX = 'ai-hint-dismissed:';

/**
 * AIHintBanner — a subtle, dismissible "AI can help here" strip that teaches
 * users what the assistant can do on the current page. Shows once per user per
 * page (dismissal persisted in localStorage under a stable `id`).
 *
 *   <AIHintBanner
 *     id="proposal-create"
 *     title="AI can draft this proposal for you"
 *     examples={['Draft from the lead’s requirements', 'Apply a saved template']}
 *   />
 *
 * Optionally pass `action` (a node, e.g. an <AskAIButton/>) to render a CTA on
 * the right. Self-gates on the `ai.chat` permission.
 */
const AIHintBanner = ({ id, title, examples = [], action = null, className = '' }) => {
  const { hasPermission } = useAuth();
  const storageKey = `${STORAGE_PREFIX}${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; }
  });

  // Demo feature flag — hides the "AI can help here" banner.
  if (import.meta.env.VITE_ENABLE_AI !== 'true') return null;
  if (!hasPermission('ai.chat') || dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(storageKey, 'true'); } catch { /* non-fatal */ }
    setDismissed(true);
  };

  return (
    <div className={`relative flex items-start gap-3 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/5 px-4 py-3 ${className}`}>
      <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-[var(--primary)]/15 text-[var(--primary)]">
        <Sparkles size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
        {examples.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {examples.map((ex, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-full bg-[var(--surface)] border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]"
              >
                {ex}
              </span>
            ))}
          </div>
        )}
      </div>

      {action && <div className="shrink-0 self-center">{action}</div>}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
      >
        <X size={15} />
      </button>
    </div>
  );
};

export default AIHintBanner;
