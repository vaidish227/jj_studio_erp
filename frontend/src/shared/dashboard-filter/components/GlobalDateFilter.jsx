import { useEffect, useRef, useState } from 'react';
import { Calendar, CalendarRange, ChevronDown, Check } from 'lucide-react';
import DatePicker from '../../components/DatePicker/DatePicker';
import { DATE_PRESETS, formatRangeLabel } from '../dateRangePresets';

/**
 * Global date controls for dashboards — two adjacent controls:
 *
 *   [ 📅 Last 30 Days ▾ ]   [ 🗓 Custom Range ]
 *
 *   • Preset dropdown — the 6 presets only.
 *   • Custom Range — separate button + popover (From / To / Apply / Clear).
 *
 * When a custom range is active the preset button shows the formatted range
 * ("01 Jun – 10 Jun") plus a small "Custom" pill, and the Custom Range button
 * is highlighted.
 *
 * Emits { preset } or { preset:'custom', from, to } via onChange — generic across
 * dashboards. `defaultRange` is the range to revert to when Clear is pressed.
 */
const GlobalDateFilter = ({ value, onChange, defaultRange = { preset: 'last_30_days' }, disabled = false }) => {
  const [presetOpen, setPresetOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(value?.preset === 'custom' ? value.from : '');
  const [to, setTo] = useState(value?.preset === 'custom' ? value.to : '');
  const rootRef = useRef(null);

  const isCustom = value?.preset === 'custom';
  const activeId = value?.preset;
  const customValid = from && to && from <= to;

  // Close both popovers on outside click + Escape.
  useEffect(() => {
    if (!presetOpen && !customOpen) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPresetOpen(false);
        setCustomOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setPresetOpen(false); setCustomOpen(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [presetOpen, customOpen]);

  const togglePreset = () => { setPresetOpen((o) => !o); setCustomOpen(false); };
  const toggleCustom = () => { setCustomOpen((o) => !o); setPresetOpen(false); };

  const pickPreset = (id) => {
    onChange?.({ preset: id });
    setPresetOpen(false);
  };

  const applyCustom = () => {
    if (!customValid) return;
    onChange?.({ preset: 'custom', from, to });
    setCustomOpen(false);
  };

  // Clear the inputs and, if a custom range is currently active, revert to the default.
  const clearCustom = () => {
    setFrom('');
    setTo('');
    if (isCustom) onChange?.({ ...defaultRange });
    setCustomOpen(false);
  };

  return (
    <div ref={rootRef} className="flex items-center gap-2">
      {/* ── Preset control ─────────────────────────────────────────── */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && togglePreset()}
          aria-haspopup="listbox"
          aria-expanded={presetOpen}
          className="flex items-center gap-2 text-sm font-semibold bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 outline-none focus:border-[var(--primary)] hover:border-[var(--primary)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Calendar size={15} className="text-[var(--text-muted)]" />
          <span className="text-[var(--text-primary)] whitespace-nowrap">{formatRangeLabel(value)}</span>
          {isCustom && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[var(--primary)]/15 text-[var(--primary)]">
              Custom
            </span>
          )}
          <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${presetOpen ? 'rotate-180' : ''}`} />
        </button>

        {presetOpen && (
          <div
            role="listbox"
            className="absolute right-0 mt-2 w-64 max-w-[92vw] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg z-50 p-2"
          >
            <p className="px-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Quick ranges</p>
            <div className="grid grid-cols-2 gap-1">
              {DATE_PRESETS.map((p) => {
                const active = activeId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pickPreset(p.id)}
                    className={`flex items-center justify-between gap-1 px-2.5 py-1.5 text-[13px] font-medium rounded-lg border transition-colors ${
                      active
                        ? 'bg-[var(--primary)]/12 text-[var(--primary)] border-[var(--primary)]/30'
                        : 'text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="truncate">{p.label}</span>
                    {active && <Check size={13} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Custom Range control ───────────────────────────────────── */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && toggleCustom()}
          aria-haspopup="dialog"
          aria-expanded={customOpen}
          className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-3 py-2 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border ${
            isCustom
              ? 'bg-[var(--primary)]/12 border-[var(--primary)]/40 text-[var(--primary)]'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)]/50'
          }`}
        >
          <CalendarRange size={15} />
          <span className="whitespace-nowrap">Custom Range</span>
        </button>

        {customOpen && (
          <div
            role="dialog"
            aria-label="Custom date range"
            className="absolute right-0 mt-2 w-72 max-w-[92vw] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg z-50 p-3"
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1">From</label>
                <DatePicker name="from" icon={null} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Start" max={to || undefined} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1">To</label>
                <DatePicker name="to" icon={null} value={to} onChange={(e) => setTo(e.target.value)} placeholder="End" min={from || undefined} />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={applyCustom}
                disabled={!customValid}
                className="flex-1 px-3 py-1.5 text-[13px] font-bold bg-[var(--primary)] text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={clearCustom}
                className="px-3 py-1.5 text-[13px] font-bold bg-[var(--bg)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalDateFilter;
