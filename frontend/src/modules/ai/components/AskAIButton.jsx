import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useAIChat } from '../context/AIChatContext';

/**
 * AskAIButton — a contextual entry point into the AI chat drawer.
 *
 * Drop it anywhere on a form/page to let the user kick off an AI flow with a
 * pre-seeded, context-aware prompt. On click it opens the chat drawer and
 * `send()`s the prompt — write tools still route through the normal
 * ActionConfirmCard confirmation gate, so this introduces no new write path.
 *
 * Two shapes:
 *   • Single action — pass `prompt` (+ optional `label`).
 *       <AskAIButton prompt="Summarize this project" label="Summarize" />
 *   • Menu of actions — pass `actions: [{ label, prompt, icon? }]`.
 *       <AskAIButton label="Ask AI" actions={[
 *         { label: 'Schedule a meeting', prompt: `Schedule a meeting with ${name}` },
 *         { label: 'Add a follow-up',    prompt: `Add a follow-up for ${name}` },
 *       ]} />
 *
 * Self-gates on the `ai.chat` permission — renders nothing if the user lacks it.
 */
const AskAIButton = ({
  prompt,
  actions,
  label = 'Ask AI',
  size = 'md',
  variant = 'soft', // 'soft' (tinted) | 'solid' (gold) | 'ghost'
  className = '',
  disabled = false,
  title,
}) => {
  const { hasPermission } = useAuth();
  const { open, send, streaming } = useAIChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef(null);

  const items = Array.isArray(actions) ? actions.filter(Boolean) : null;
  const hasMenu = items && items.length > 0;

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Demo feature flag — hides every "Ask AI" / "Draft with AI" / "Summarize"
  // entry-point button across the app.
  if (import.meta.env.VITE_ENABLE_AI !== 'true') return null;
  if (!hasPermission('ai.chat')) return null;

  const fire = (text) => {
    const value = (text || '').trim();
    if (!value) return;
    open();
    send(value);
    setMenuOpen(false);
  };

  const handleClick = () => {
    if (hasMenu) {
      setMenuOpen((o) => !o);
    } else {
      fire(prompt);
    }
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
  };
  const variants = {
    soft: 'text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20',
    solid: 'text-black bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-sm',
    ghost: 'text-[var(--primary)] hover:bg-[var(--primary)]/10',
  };
  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || streaming}
        title={title || (hasMenu ? `${label} — AI suggestions` : label)}
        className={`inline-flex items-center font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizes[size] ?? sizes.md} ${variants[variant] ?? variants.soft} ${className}`}
      >
        <Sparkles size={iconSize} />
        {label}
        {hasMenu && <ChevronDown size={iconSize - 1} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />}
      </button>

      {hasMenu && menuOpen && (
        <div className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/10 py-1.5 animate-in fade-in zoom-in-95 duration-100">
          <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            AI can help with
          </p>
          {items.map((item, idx) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={`${item.label}-${idx}`}
                type="button"
                onClick={() => fire(item.prompt)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors"
              >
                {ItemIcon ? <ItemIcon size={15} className="shrink-0" /> : <Sparkles size={14} className="shrink-0 text-[var(--primary)]" />}
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AskAIButton;
