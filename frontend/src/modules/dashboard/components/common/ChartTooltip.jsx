// ChartTooltip — themed tooltip for recharts. Pass a `formatter` to format values
// (e.g. currency). Shares the surface/border tokens so charts feel native.
const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      {label !== undefined && (
        <p className="font-bold text-[var(--text-primary)] mb-1">{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--text-secondary)] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.color }} />
          {p.name}: <span className="font-bold text-[var(--text-primary)]">{formatter ? formatter(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default ChartTooltip;
