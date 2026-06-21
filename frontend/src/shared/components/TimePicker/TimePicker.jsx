import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock as ClockIcon, ChevronDown } from 'lucide-react';

const POPOVER_WIDTH = 248;
const POPOVER_HEIGHT_ESTIMATE = 150;
const POPOVER_GAP = 6;

const pad2 = (n) => String(n).padStart(2, '0');

// Parse 'HH:mm' (24h) → { hour12, minute, meridiem } or null
const parse24 = (value) => {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const meridiem = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: min, meridiem };
};

// Build 'HH:mm' (24h) from 12h parts — the value all callers/handlers expect.
const to24 = (hour12, minute, meridiem) => {
  let h = hour12 % 12;
  if (meridiem === 'PM') h += 12;
  return `${pad2(h)}:${pad2(minute)}`;
};

// Human label for the trigger, e.g. '01:30 PM'
const formatHuman = (value) => {
  const p = parse24(value);
  if (!p) return '';
  return `${pad2(p.hour12)}:${pad2(p.minute)} ${p.meridiem}`;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12

/**
 * TimePicker — 12-hour time selector with an explicit AM/PM toggle that emits a
 * 24-hour 'HH:mm' string. API mirrors <DatePicker> (synthetic
 * { target: { name, value } } onChange) so it's a drop-in swap for time inputs.
 *
 * Why this exists: native <input type="time"> shows 24h (or locale-dependent
 * AM/PM) and gives no clear AM/PM control. This makes the meridiem explicit.
 */
const TimePicker = ({
  label,
  name,
  value = '',
  onChange,
  icon: Icon = ClockIcon,
  placeholder = 'Select time',
  minuteStep = 5,
  required = false,
  disabled = false,
  error,
  className = '',
}) => {
  const wrapperRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);

  // Current parts come from `value`; fall back to a sensible default for the
  // popover UI when nothing is selected yet (we only fire onChange on interaction).
  const parts = parse24(value) || { hour12: 9, minute: 0, meridiem: 'AM' };

  // Minute options: the stepped list, plus the current minute if it falls off-step
  // (e.g. rescheduling a meeting saved at :13) so we never lose precision.
  const minutes = useMemo(() => {
    const step = Math.min(Math.max(Number(minuteStep) || 5, 1), 30);
    const out = [];
    for (let m = 0; m < 60; m += step) out.push(m);
    if (!out.includes(parts.minute)) out.push(parts.minute);
    return out.sort((a, b) => a - b);
  }, [minuteStep, parts.minute]);

  const emit = (next) => {
    if (onChange) onChange({ target: { name, value: next } });
  };

  const setHour = (h) => emit(to24(h, parts.minute, parts.meridiem));
  const setMinute = (m) => emit(to24(parts.hour12, m, parts.meridiem));
  const setMeridiem = (mer) => emit(to24(parts.hour12, parts.minute, mer));

  // ─── Close on outside click + Escape ──────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e) => {
      const insideTrigger = wrapperRef.current && wrapperRef.current.contains(e.target);
      const insidePopover = popoverRef.current && popoverRef.current.contains(e.target);
      if (!insideTrigger && !insidePopover) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ─── Viewport-aware popover position (portal + fixed, escapes overflow) ──
  const [popoverStyle, setPopoverStyle] = useState(null);
  const recomputePosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const wantsRight = rect.left + POPOVER_WIDTH > vw - 8;
    const left = wantsRight
      ? Math.max(8, rect.right - POPOVER_WIDTH)
      : Math.max(8, rect.left);
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const flipUp = spaceBelow < POPOVER_HEIGHT_ESTIMATE + POPOVER_GAP && spaceAbove > spaceBelow;
    const top = flipUp
      ? Math.max(8, rect.top - POPOVER_GAP - POPOVER_HEIGHT_ESTIMATE)
      : rect.bottom + POPOVER_GAP;
    setPopoverStyle({ position: 'fixed', top, left, width: POPOVER_WIDTH, zIndex: 1000 });
  };

  useLayoutEffect(() => {
    if (!open) { setPopoverStyle(null); return undefined; }
    recomputePosition();
    const onScrollOrResize = () => recomputePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  const selected = parse24(value);

  const selectClass = 'flex-1 min-w-0 px-2 py-2 text-sm font-bold text-center bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] cursor-pointer';

  const triggerBase = `
    w-full bg-[var(--surface)] border rounded-xl transition-all duration-200
    text-left flex items-center gap-2 py-3
    focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]
    ${Icon ? 'pl-12' : 'pl-4'} pr-4
    ${error ? 'border-[var(--error)] focus:ring-[var(--error)]' : 'border-[var(--border)]'}
    ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--primary)]/50'}
  `;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--text-secondary)] ml-1">
          {label}
          {required && <span className="text-[var(--error)] ml-0.5">*</span>}
        </label>
      )}

      <div ref={wrapperRef} className="relative group">
        {Icon && (
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
            open ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] group-focus-within:text-[var(--primary)]'
          }`}>
            <Icon size={20} />
          </div>
        )}

        <button
          type="button"
          name={name}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={`${triggerBase} ${className}`}
        >
          <span className={`flex-1 min-w-0 truncate ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
            {selected ? formatHuman(value) : placeholder}
          </span>
          <ChevronDown size={16} className={`text-[var(--text-muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && !disabled && popoverStyle && createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            data-timepicker-popover=""
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/15 p-3"
          >
            <div className="flex items-center gap-1.5">
              <select
                value={parts.hour12}
                onChange={(e) => setHour(Number(e.target.value))}
                aria-label="Hour"
                className={selectClass}
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{pad2(h)}</option>
                ))}
              </select>
              <span className="font-black text-[var(--text-muted)]">:</span>
              <select
                value={parts.minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                aria-label="Minute"
                className={selectClass}
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>{pad2(m)}</option>
                ))}
              </select>
              <div className="flex flex-col rounded-lg border border-[var(--border)] overflow-hidden shrink-0">
                {['AM', 'PM'].map((mer) => (
                  <button
                    key={mer}
                    type="button"
                    onClick={() => setMeridiem(mer)}
                    className={`px-3 py-1 text-xs font-black transition-colors ${
                      parts.meridiem === mer
                        ? 'bg-[var(--primary)] text-black'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
                    }`}
                  >
                    {mer}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => { emit(to24(parts.hour12, parts.minute, parts.meridiem)); setOpen(false); }}
                className="text-xs font-bold text-[var(--primary)] hover:underline"
              >
                Done
              </button>
              {selected && (
                <button
                  type="button"
                  onClick={() => { emit(''); setOpen(false); }}
                  className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--error)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {error && (
        <p className="text-xs text-[var(--error)] ml-1 font-medium animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
};

export default TimePicker;
