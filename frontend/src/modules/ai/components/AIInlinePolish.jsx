import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import { useAuth } from '../../../shared/context/AuthContext';
import { polishText } from '../services/aiService';
import { useToast } from '../../../shared/notifications/ToastProvider';

/**
 * AIInlinePolish — a small "AI" button + editable suggestion preview for
 * refining a single text field in place (rewrite professionally, meaning kept).
 *
 * Generalized from the original RecordMOMModal discussion-summary polish so any
 * textarea/notes field can reuse the exact same flow.
 *
 *   <AIInlinePolish value={notes} onAccept={(t) => setNotes(t)} />
 *
 * Renders only the trigger button by default; once the user clicks it, the
 * suggestion preview appears beneath wherever you place <AIInlinePolish.Preview/>.
 * For the common case, use the all-in-one default: it renders the button, and
 * the preview directly below it.
 *
 * Self-gates on the `ai.chat` permission — renders nothing if the user lacks it.
 */
const AIInlinePolish = ({
  value,
  onAccept,
  label = 'AI',
  acceptLabel = 'Replace text',
  emptyMessage = 'Write something first, then let AI refine it.',
  rows = 5,
  disabled = false,
  className = '',
}) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [isPolishing, setIsPolishing] = useState(false);
  const [suggestion, setSuggestion] = useState(null); // string | null → preview visible when non-null

  if (!hasPermission('ai.chat')) return null;

  const handlePolish = async () => {
    const text = (value || '').trim();
    if (!text) {
      toast.error(emptyMessage);
      return;
    }
    setIsPolishing(true);
    try {
      const res = await polishText(text);
      const polished = (res?.polishedText || '').trim();
      if (!polished) {
        toast.error('AI could not refine this text.');
        return;
      }
      setSuggestion(polished);
    } catch (err) {
      toast.error(err?.message || 'AI polish failed.');
    } finally {
      setIsPolishing(false);
    }
  };

  const accept = () => {
    onAccept?.(suggestion);
    setSuggestion(null);
  };
  const discard = () => setSuggestion(null);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handlePolish}
        disabled={disabled || isPolishing || !(value || '').trim()}
        title="Rewrite professionally with AI"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPolishing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {isPolishing ? 'Refining…' : label}
      </button>

      {suggestion !== null && (
        <div className="mt-3 p-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-black uppercase tracking-wider text-[var(--primary)]">
            <Sparkles size={13} />
            AI suggestion · editable
          </div>
          <textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            rows={rows}
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--primary)] resize-y"
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={discard}>
              Discard
            </Button>
            <Button type="button" variant="primary" onClick={accept}>
              {acceptLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInlinePolish;
