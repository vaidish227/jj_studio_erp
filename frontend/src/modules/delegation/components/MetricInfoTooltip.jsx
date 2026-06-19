import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Info, X, ChevronDown } from 'lucide-react';

// MetricInfoTooltip — contextual-help affordance for the Delegation dashboard.
// A hidden circular "i" that fades in on hover (desktop) and is always shown on
// touch devices / Guided Mode; click / tap / Enter / Space opens a popover with
// the full explanation. Scoped to the delegation module — does NOT touch any
// shared dashboard component.
//
// The popover is positioned with `fixed` coordinates measured from the icon and
// CLAMPED inside the viewport's safe area (below the top navbar, clear of every
// edge). This guarantees the full text is always visible regardless of where the
// card sits — left/right edges, the cramped middle band, or a short window — so
// it can never slip under the sidebar or get cut off by the header.
//
// Props:
//   help       — a record from delegationDashboardHelp.js (required)
//   overlay    — true: float the icon at the card's top-right corner (KPI tiles
//                & summary chips). false (default): render inline (chart headers).
//   alwaysShow — Guided Mode: keep the icon visible regardless of hover.

const MARGIN = 12; // min gap from any viewport edge
const TOP_SAFE = 72; // keep clear of the fixed top navbar
const GAP = 8; // gap between the icon and the popover

const Field = ({ label, children }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
    <p className="text-[12px] text-[var(--text-secondary)] leading-snug mt-0.5">{children}</p>
  </div>
);

const MetricInfoTooltip = ({ help, overlay = false, alwaysShow = false }) => {
  const [open, setOpen] = useState(false);
  const [showInterpret, setShowInterpret] = useState(false);
  const [coords, setCoords] = useState(null); // { left, top } in viewport px
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const dialogId = useId();

  // Compute a fully-on-screen fixed position from the icon + measured popover
  // size. Prefers below/right of the icon, flips and then clamps so nothing ever
  // overflows the safe area.
  const reposition = useCallback(() => {
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: anchor to the icon on whichever side has more room, then clamp.
    let left = r.left < vw / 2 ? r.left : r.right - pw;
    left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - pw - MARGIN));

    // Vertical: prefer below; flip above if it overflows the bottom; clamp into
    // [TOP_SAFE, bottom] so a tall popover in a short window stays fully visible.
    let top = r.bottom + GAP;
    if (top + ph > vh - MARGIN) {
      const above = r.top - ph - GAP;
      top = above >= TOP_SAFE ? above : Math.max(TOP_SAFE, vh - ph - MARGIN);
    }
    setCoords({ left, top });
  }, []);

  // Measure & place before paint whenever the popover opens or its content
  // height changes (interpret toggle). Recompute on scroll/resize while open.
  // `coords` is intentionally left as-is on close: the popover unmounts, and on
  // the next open reposition() runs synchronously before paint, so a stale value
  // can never be painted.
  useLayoutEffect(() => {
    if (!open) return undefined;
    reposition();
    const onMove = () => reposition();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, showInterpret, reposition]);

  // Close on outside click / Escape while open. Escape returns focus to the icon.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!help) return null;

  const visible = alwaysShow || open;
  // Hidden at rest; revealed on hover of the parent `.group`, on keyboard focus,
  // and always on coarse-pointer (touch) devices so taps are possible.
  const visibilityCls = visible
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100';

  return (
    <span
      ref={wrapRef}
      className={`${overlay ? 'absolute top-2 right-2 z-20' : 'relative inline-flex'} leading-none`}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={`${help.title} — more information`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`w-5 h-5 rounded-full border flex items-center justify-center shadow-sm transition-all duration-200 bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--primary-active)] hover:border-[var(--primary-active)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${visibilityCls}`}
      >
        <Info size={11} strokeWidth={2.5} />
      </button>

      {open && (
        <div
          ref={popRef}
          id={dialogId}
          role="dialog"
          aria-label={help.title}
          style={{
            left: coords ? `${coords.left}px` : 0,
            top: coords ? `${coords.top}px` : 0,
            // Hidden until measured so it never flashes at the wrong spot.
            visibility: coords ? 'visible' : 'hidden',
          }}
          className="fixed w-72 max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-6rem)] overflow-y-auto z-[60] cursor-default text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-3.5 space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[13px] font-extrabold text-[var(--text-primary)] leading-tight">{help.title}</h4>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0 -mt-0.5 -mr-0.5"
            >
              <X size={13} />
            </button>
          </div>

          {help.whatItShows && <Field label="What it shows">{help.whatItShows}</Field>}

          {help.calculation && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">How it's calculated</p>
              <p className="text-[11px] font-mono text-[var(--text-secondary)] leading-snug mt-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5">
                {help.calculation}
              </p>
            </div>
          )}

          {help.whyItMatters && <Field label="Why it matters">{help.whyItMatters}</Field>}
          {help.recommendation && <Field label="Recommended action">{help.recommendation}</Field>}
          {help.example && <Field label="Example">{help.example}</Field>}

          {Array.isArray(help.interpret) && help.interpret.length > 0 && (
            <div className="pt-1.5 border-t border-[var(--border)]">
              <button
                type="button"
                aria-expanded={showInterpret}
                onClick={() => setShowInterpret((s) => !s)}
                className="flex items-center gap-1 text-[11px] font-bold text-[var(--primary-active)] hover:underline"
              >
                <ChevronDown size={12} className={`transition-transform ${showInterpret ? 'rotate-180' : ''}`} />
                How to interpret
              </button>
              {showInterpret && (
                <ul className="mt-1.5 space-y-1">
                  {help.interpret.map((line) => (
                    <li key={line} className="text-[11px] text-[var(--text-secondary)] leading-snug flex gap-1.5">
                      <span className="text-[var(--primary-active)] shrink-0">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </span>
  );
};

export default MetricInfoTooltip;
