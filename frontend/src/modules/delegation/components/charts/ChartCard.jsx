// ChartCard — consistent surface/border framing + header for every dashboard
// panel, so the charts and lists share one visual rhythm. `action` renders on
// the right of the header (e.g. a count badge or legend hint).
const ChartCard = ({ icon: Icon, title, action, className = '', bodyClassName = '', children }) => (
  <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col ${className}`}>
    <div className="flex items-center justify-between gap-2 mb-4">
      <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
        {Icon && <Icon size={16} className="text-[var(--primary-active)]" />}
        {title}
      </h3>
      {action}
    </div>
    <div className={`flex-1 ${bodyClassName}`}>{children}</div>
  </div>
);

export default ChartCard;
