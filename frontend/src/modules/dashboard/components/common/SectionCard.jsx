// SectionCard — shared panel wrapper with a colored uppercase title, optional
// leading icon and a right-aligned action slot. Mirrors the MD Dashboard look so
// every analytics surface across the app reads consistently.
const SectionCard = ({ title, icon: Icon, action, color = 'var(--primary)', className = '', children }) => (
  <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 h-full flex flex-col transition-all hover:shadow-sm ${className}`}>
    <div className="flex items-center justify-between mb-4 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon size={15} style={{ color }} className="shrink-0" />}
        <h3 className="text-sm font-black uppercase tracking-wider truncate" style={{ color }}>{title}</h3>
      </div>
      {action}
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

export default SectionCard;
