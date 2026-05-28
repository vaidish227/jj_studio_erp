import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n) => String(n).padStart(2, '0');

// Parse 'YYYY-MM-DD' into a local Date (avoid the UTC drift of `new Date(str)`)
const parseISO = (str) => {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
};

// Format a Date as 'YYYY-MM-DD' using LOCAL parts (matches what users see)
const formatISO = (date) => {
  if (!date) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const formatHuman = (date) => {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const sameDay = (a, b) =>
  a && b
  && a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const clampDateToRange = (date, min, max) => {
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
};

/**
 * DatePicker — fast in-page calendar that replaces native <input type="date">.
 *
 * API matches the project's <Input> component as closely as possible so swaps
 * are trivial. onChange fires a synthetic { target: { name, value } } event
 * (value is 'YYYY-MM-DD'), so existing form handlers keep working unchanged.
 *
 * Why this exists: native date pickers force ~40 clicks to reach a 1985 DOB.
 * This picker has a Year dropdown that gets you there in one click.
 */
const DatePicker = ({
  label,
  name,
  value = '',
  onChange,
  icon: Icon = CalendarIcon,
  placeholder = 'Select date',
  min,           // 'YYYY-MM-DD'
  max,           // 'YYYY-MM-DD'
  yearRange,     // { from: number, to: number } — defaults to today ± 50 years
  required = false,
  disabled = false,
  error,
  className = '',
}) => {
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);
  // viewMonth is a Date pointing at the FIRST of the visible month
  const initialDate = parseISO(value) || new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  // Re-sync the view when `value` changes externally (e.g. form reset)
  useEffect(() => {
    const d = parseISO(value);
    if (d) {
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value]);

  // ─── Close on outside click + Escape ──────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedDate = parseISO(value);
  const minDate = parseISO(min);
  const maxDate = parseISO(max);

  // Year dropdown range — defaults to current year ± 50
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const from = yearRange?.from ?? currentYear - 50;
    const to = yearRange?.to ?? currentYear + 50;
    const out = [];
    for (let y = to; y >= from; y -= 1) out.push(y);
    return out;
  }, [yearRange]);

  // ─── Build the visible day grid for `viewMonth` ──────────────────────
  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Trailing days from previous month (greyed)
    for (let i = firstWeekday - 1; i >= 0; i -= 1) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      cells.push({ date: d, inMonth: false });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i += 1) {
      cells.push({ date: new Date(year, month, i), inMonth: true });
    }
    // Leading days from next month so the grid is always 6 rows
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date: next, inMonth: false });
    }
    return cells;
  }, [viewMonth]);

  // ─── Navigation handlers ──────────────────────────────────────────────
  const goPrev = () => setViewMonth(
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
  );
  const goNext = () => setViewMonth(
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
  );
  const goToday = () => {
    const today = new Date();
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };
  const onMonthChange = (e) => {
    setViewMonth(new Date(viewMonth.getFullYear(), Number(e.target.value), 1));
  };
  const onYearChange = (e) => {
    setViewMonth(new Date(Number(e.target.value), viewMonth.getMonth(), 1));
  };

  // ─── Pick a day ────────────────────────────────────────────────────────
  const pick = (date) => {
    if (!clampDateToRange(date, minDate, maxDate)) return;
    if (onChange) {
      onChange({ target: { name, value: formatISO(date) } });
    }
    setOpen(false);
  };

  const today = new Date();

  // Smart alignment: if the trigger sits in the right half of the viewport,
  // anchor the popover to the right so it doesn't overflow off-screen.
  const [alignRight, setAlignRight] = useState(false);
  useEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setAlignRight(rect.left + 320 > window.innerWidth);
  }, [open]);

  // ─── Trigger styling matches <Input> ──────────────────────────────────
  const triggerBase = `
    w-full bg-[var(--surface)] border rounded-xl py-3 pr-4 transition-all duration-200
    text-left flex items-center gap-2
    focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]
    ${Icon ? 'pl-12' : 'pl-4'}
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
          <span className={`flex-1 ${selectedDate ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
            {selectedDate ? formatHuman(selectedDate) : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`text-[var(--text-muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Popover calendar */}
        {open && !disabled && (
          <div
            className={`
              absolute z-50 top-full mt-1.5 w-[300px] bg-[var(--surface)]
              border border-[var(--border)] rounded-xl shadow-2xl shadow-black/15 p-3
              ${alignRight ? 'right-0' : 'left-0'}
            `}
          >
            {/* Header: month + year dropdowns + nav */}
            <div className="flex items-center gap-1.5 mb-3">
              <select
                value={viewMonth.getMonth()}
                onChange={onMonthChange}
                className="flex-1 min-w-0 px-2 py-1.5 text-sm font-bold bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={viewMonth.getFullYear()}
                onChange={onYearChange}
                className="w-20 px-2 py-1.5 text-sm font-bold bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={goPrev}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--primary)] transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--primary)] transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday row */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-1"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid (6 rows × 7 cols) */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarCells.map(({ date, inMonth }, i) => {
                const isSelected = sameDay(date, selectedDate);
                const isToday = sameDay(date, today);
                const inRange = clampDateToRange(date, minDate, maxDate);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => inRange && pick(date)}
                    disabled={!inRange}
                    className={`
                      h-8 rounded-md text-xs font-semibold transition-colors
                      ${!inRange ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}
                      ${isSelected
                        ? 'bg-[var(--primary)] text-black hover:bg-[var(--primary)]'
                        : isToday
                          ? 'border border-[var(--primary)]/60 text-[var(--primary)] hover:bg-[var(--primary)]/10'
                          : inMonth
                            ? 'text-[var(--text-primary)] hover:bg-[var(--primary)]/10'
                            : 'text-[var(--text-muted)]/50 hover:bg-[var(--bg)]'}
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={goToday}
                className="text-xs font-bold text-[var(--primary)] hover:underline"
              >
                Today
              </button>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => {
                    if (onChange) onChange({ target: { name, value: '' } });
                    setOpen(false);
                  }}
                  className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--error)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
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

export default DatePicker;
