import MetricInfoTooltip from '../MetricInfoTooltip';

// ChartCard — consistent surface/border framing + header for every dashboard
// panel, so the charts and lists share one visual rhythm. `action` renders on
// the right of the header (e.g. a count badge or legend hint). When `info` (a
// help record) is provided, a hover-revealed "i" appears beside the action and
// opens a contextual-help popover; `guided` forces it visible (Guided Mode).
const ChartCard = ({ icon: Icon, title, action, info, guided = false, className = '', bodyClassName = '', children }) => (
  <div className={`group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col ${className}`}>
    <div className="flex items-center justify-between gap-2 mb-4">
      <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
        {Icon && <Icon size={16} className="text-[var(--primary-active)]" />}
        {title}
      </h3>
      <div className="flex items-center gap-2 shrink-0">
        {action}
        {info && <MetricInfoTooltip help={info} alwaysShow={guided} />}
      </div>
    </div>
    <div className={`flex-1 ${bodyClassName}`}>{children}</div>
  </div>
);

export default ChartCard;
