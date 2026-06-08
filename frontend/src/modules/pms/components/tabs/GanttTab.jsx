import { useMemo, useState, useRef } from 'react';
import { Calendar, Users, GitBranch } from 'lucide-react';

// Status palette — mirrors TaskStatusBadge / KANBAN_COLUMNS so the Gantt
// reads identically to the Tasks Kanban and badges elsewhere in PMS.
const STATUS_FILL = {
  not_started:             'var(--text-muted)',
  blocked:                 'var(--error)',
  in_progress:             'var(--accent-blue)',
  pending_review:          'var(--warning)',
  revision_requested:      'var(--error)',
  pending_client_approval: 'var(--primary)',
  approved:                'var(--success)',
  released_to_site:        'var(--accent-teal)',
  completed:               'var(--success)',
  on_hold:                 'var(--text-muted)',
};

const STATUS_LABEL = {
  not_started:             'Not Started',
  blocked:                 'Blocked',
  in_progress:             'In Progress',
  pending_review:          'Pending Review',
  revision_requested:      'Revision',
  pending_client_approval: 'Client Approval',
  approved:                'Approved',
  released_to_site:        'Released',
  completed:               'Completed',
  on_hold:                 'On Hold',
};

const ZOOM_LEVELS = {
  day:   { id: 'day',   label: 'Day',   pxPerDay: 32 },
  week:  { id: 'week',  label: 'Week',  pxPerDay: 14 },
  month: { id: 'month', label: 'Month', pxPerDay: 5 },
};

// Phase order matches Project.model.js workflow phase enum.
const PHASE_ORDER = ['kickoff', 'layout', 'design', 'procurement', 'release', 'execution', 'handover'];
const PHASE_LABEL = {
  kickoff:     'Kickoff',
  layout:      'Layout',
  design:      'Design',
  procurement: 'Procurement',
  release:     'Release',
  execution:   'Execution',
  handover:    'Handover',
};

const DAY_MS = 1000 * 60 * 60 * 24;

const ROW_H       = 40;
const PHASE_ROW_H = 32;
const LEFT_W      = 280;
const HEADER_H    = 60;
const BAR_H       = 18;
const BAR_PAD     = (ROW_H - BAR_H) / 2;

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const daysBetween = (a, b) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

const fmtShort = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtFull  = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Resolve a task's planned range using the planner fields first, then top-level
// timeline, then a coarse fallback from dayOffsetFromProjectStart + plannedHours.
const getTaskRange = (task, projectStart) => {
  const ps = toDate(task?.planning?.plannedStartDate);
  const pe = toDate(task?.planning?.plannedEndDate);
  if (ps && pe && pe >= ps) return { start: ps, end: pe };
  const ts = toDate(task?.startDate);
  const td = toDate(task?.dueDate);
  if (ts && td && td >= ts) return { start: ts, end: td };
  if (td && !ts) return { start: addDays(td, -1), end: td };
  if (ts && !td) return { start: ts, end: addDays(ts, 1) };
  if (projectStart && task?.dayOffsetFromProjectStart != null) {
    const start = addDays(projectStart, task.dayOffsetFromProjectStart);
    const len   = Math.max(1, Math.ceil((task?.planning?.plannedHours || 8) / 8));
    return { start, end: addDays(start, len) };
  }
  return null;
};

const getBaselineRange = (task) => {
  const bs = toDate(task?.planning?.baselinePlannedStartDate);
  const be = toDate(task?.planning?.baselinePlannedEndDate);
  return bs && be && be >= bs ? { start: bs, end: be } : null;
};

const phaseSort = (a, b) => {
  const ia = PHASE_ORDER.indexOf(a);
  const ib = PHASE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};

const phaseLabel = (p) => {
  if (!p) return 'Uncategorized';
  if (PHASE_LABEL[p]) return PHASE_LABEL[p];
  return p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const designerName = (task) =>
  task?.assignedTo?.name
  || task?.planning?.designLeadId?.name
  || 'Unassigned';

const GanttTab = ({ project, tasks }) => {
  const [zoom, setZoom]                 = useState('week');
  const [showBaseline, setShowBaseline] = useState(false);
  const [showDeps, setShowDeps]         = useState(true);
  const [hover, setHover]               = useState(null);
  const containerRef                    = useRef(null);

  const pxPerDay = ZOOM_LEVELS[zoom].pxPerDay;

  // Build window + grouped rows in one pass.
  const data = useMemo(() => {
    const projStart = toDate(project?.startDate);
    const projEnd   = toDate(project?.estimatedCompletionDate);

    const scheduled = (tasks || [])
      .map((t) => ({ task: t, range: getTaskRange(t, projStart) }))
      .filter((r) => r.range);

    if (scheduled.length === 0) {
      const start = projStart || startOfDay(new Date());
      const end   = projEnd   || addDays(start, 30);
      return { rows: [], windowStart: start, windowEnd: end, hasData: false };
    }

    let minDate = projStart || scheduled[0].range.start;
    let maxDate = projEnd   || scheduled[0].range.end;
    scheduled.forEach(({ range }) => {
      if (range.start < minDate) minDate = range.start;
      if (range.end   > maxDate) maxDate = range.end;
    });
    minDate = addDays(startOfDay(minDate), -3);
    maxDate = addDays(startOfDay(maxDate),  3);

    const byPhase = new Map();
    scheduled.forEach(({ task, range }) => {
      const key = task.phase || '__unassigned__';
      if (!byPhase.has(key)) byPhase.set(key, []);
      byPhase.get(key).push({ task, range });
    });
    byPhase.forEach((arr) => arr.sort((a, b) => a.range.start - b.range.start));

    const phaseKeys = Array.from(byPhase.keys()).sort((a, b) => {
      if (a === '__unassigned__') return 1;
      if (b === '__unassigned__') return -1;
      return phaseSort(a, b);
    });

    const rows = [];
    phaseKeys.forEach((p) => {
      rows.push({ kind: 'phase', phase: p, count: byPhase.get(p).length });
      byPhase.get(p).forEach(({ task, range }) => rows.push({ kind: 'task', task, range }));
    });

    return { rows, windowStart: minDate, windowEnd: maxDate, hasData: true };
  }, [tasks, project]);

  const totalDays  = Math.max(1, daysBetween(data.windowStart, data.windowEnd));
  const totalWidth = totalDays * pxPerDay;

  // Pre-compute Y per row (phase rows are shorter than task rows).
  const { rowY, totalHeight } = useMemo(() => {
    const ys = [];
    let y = HEADER_H;
    data.rows.forEach((r) => {
      ys.push(y);
      y += (r.kind === 'phase' ? PHASE_ROW_H : ROW_H);
    });
    return { rowY: ys, totalHeight: y };
  }, [data.rows]);

  const today        = startOfDay(new Date());
  const todayInRange = today >= data.windowStart && today <= data.windowEnd;
  const todayX       = todayInRange ? daysBetween(data.windowStart, today) * pxPerDay : null;

  // Month strips + sub-marks (days when zoom=day, weeks when zoom=week, nothing extra for month).
  const headerMarks = useMemo(() => {
    const monthMarks = [];
    const subMarks   = [];

    let monthCursor = new Date(data.windowStart.getFullYear(), data.windowStart.getMonth(), 1);
    while (monthCursor <= data.windowEnd) {
      const next   = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
      const startX = Math.max(0, daysBetween(data.windowStart, monthCursor) * pxPerDay);
      const endX   = Math.min(totalWidth, daysBetween(data.windowStart, next) * pxPerDay);
      monthMarks.push({
        x: startX,
        width: Math.max(0, endX - startX),
        label: monthCursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      });
      monthCursor = next;
    }

    if (zoom === 'day') {
      for (let d = new Date(data.windowStart); d <= data.windowEnd; d = addDays(d, 1)) {
        const x = daysBetween(data.windowStart, d) * pxPerDay;
        subMarks.push({
          x,
          label: String(d.getDate()),
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
        });
      }
    } else if (zoom === 'week') {
      const startDow    = data.windowStart.getDay();
      const offsetToMon = (8 - startDow) % 7;
      let mon = addDays(data.windowStart, offsetToMon);
      while (mon <= data.windowEnd) {
        subMarks.push({
          x: daysBetween(data.windowStart, mon) * pxPerDay,
          label: fmtShort(mon),
          isWeekend: false,
        });
        mon = addDays(mon, 7);
      }
    }
    return { monthMarks, subMarks };
  }, [data, pxPerDay, totalWidth, zoom]);

  // Task id → row index map for dependency arrows.
  const taskIndex = useMemo(() => {
    const map = new Map();
    data.rows.forEach((r, i) => {
      if (r.kind === 'task') map.set(String(r.task._id), { row: i, range: r.range });
    });
    return map;
  }, [data.rows]);

  const depLines = useMemo(() => {
    if (!showDeps) return [];
    const lines = [];
    data.rows.forEach((r, idx) => {
      if (r.kind !== 'task') return;
      (r.task.dependsOn || []).forEach((dep) => {
        const depId    = typeof dep === 'string' ? dep : dep?._id;
        const fromInfo = taskIndex.get(String(depId));
        if (!fromInfo) return;
        const fromY = rowY[fromInfo.row] + ROW_H / 2;
        const fromX = daysBetween(data.windowStart, fromInfo.range.end) * pxPerDay;
        const toY   = rowY[idx] + ROW_H / 2;
        const toX   = daysBetween(data.windowStart, r.range.start) * pxPerDay;
        lines.push({ fromX, fromY, toX, toY, id: `${depId}->${r.task._id}` });
      });
    });
    return lines;
  }, [data, showDeps, taskIndex, pxPerDay, rowY]);

  if (!data.hasData) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 text-center">
        <Calendar size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
        <h3 className="text-sm font-extrabold text-[var(--text-primary)]">No scheduled tasks yet</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
          Tasks need planned start and end dates before they appear on the Gantt. Open the
          Master Plan tab to schedule tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]">
          <Calendar size={14} />
          {fmtFull(data.windowStart)} → {fmtFull(data.windowEnd)}
          <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            {data.rows.filter((r) => r.kind === 'task').length} tasks
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-[var(--bg)] rounded-md p-0.5">
            {Object.values(ZOOM_LEVELS).map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setZoom(z.id)}
                className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded transition-colors
                  ${zoom === z.id
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                {z.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(e) => setShowBaseline(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            Baseline
          </label>
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showDeps}
              onChange={(e) => setShowDeps(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            <GitBranch size={11} />
            Dependencies
          </label>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="relative overflow-x-auto" ref={containerRef}>
          <div className="flex" style={{ width: LEFT_W + totalWidth, minWidth: '100%' }}>
            {/* Sticky left column — task list */}
            <div
              className="sticky left-0 z-20 bg-[var(--surface)] border-r border-[var(--border)]"
              style={{ width: LEFT_W, flexShrink: 0 }}
            >
              <div
                className="border-b border-[var(--border)] bg-[var(--bg)] flex items-end px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                style={{ height: HEADER_H }}
              >
                Task
              </div>
              {data.rows.map((r, i) => r.kind === 'phase' ? (
                <div
                  key={`l-phase-${i}`}
                  className="px-3 flex items-center bg-[var(--bg)] border-b border-[var(--border)]"
                  style={{ height: PHASE_ROW_H }}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                    {phaseLabel(r.phase === '__unassigned__' ? '' : r.phase)}
                  </span>
                  <span className="ml-2 text-[10px] font-bold text-[var(--text-muted)]">{r.count}</span>
                </div>
              ) : (
                <div
                  key={`l-task-${r.task._id}`}
                  className="px-3 flex items-center gap-2 border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors"
                  style={{ height: ROW_H }}
                  title={r.task.title}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_FILL[r.task.status] || STATUS_FILL.not_started }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{r.task.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{designerName(r.task)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right column — SVG timeline */}
            <div style={{ width: totalWidth, position: 'relative' }}>
              <svg width={totalWidth} height={totalHeight} style={{ display: 'block' }}>
                {/* Alternating month bands */}
                {headerMarks.monthMarks.map((m, i) => (
                  i % 2 === 0 ? (
                    <rect
                      key={`mband-${i}`}
                      x={m.x}
                      y={HEADER_H}
                      width={m.width}
                      height={totalHeight - HEADER_H}
                      fill="var(--bg)"
                      opacity={0.4}
                    />
                  ) : null
                ))}

                {/* Header background + divider */}
                <rect x={0} y={0} width={totalWidth} height={HEADER_H} fill="var(--bg)" />
                <line x1={0} y1={HEADER_H} x2={totalWidth} y2={HEADER_H} stroke="var(--border)" strokeWidth={1} />

                {/* Month boundaries (vertical) */}
                {headerMarks.monthMarks.map((m, i) => (
                  <line
                    key={`mline-${i}`}
                    x1={m.x}
                    y1={0}
                    x2={m.x}
                    y2={totalHeight}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                ))}

                {/* Month labels */}
                {headerMarks.monthMarks.map((m, i) => (
                  <text
                    key={`mlbl-${i}`}
                    x={m.x + 6}
                    y={20}
                    fontSize={11}
                    fontWeight={800}
                    fill="var(--text-primary)"
                  >
                    {m.label.toUpperCase()}
                  </text>
                ))}

                {/* Sub-marks (days or weeks) */}
                {headerMarks.subMarks.map((s, i) => (
                  <g key={`sub-${i}`}>
                    <line
                      x1={s.x}
                      y1={HEADER_H - 16}
                      x2={s.x}
                      y2={totalHeight}
                      stroke="var(--border)"
                      strokeWidth={0.5}
                      opacity={s.isWeekend ? 0.55 : 0.3}
                    />
                    <text
                      x={s.x + 3}
                      y={HEADER_H - 6}
                      fontSize={9}
                      fontWeight={600}
                      fill="var(--text-muted)"
                    >
                      {s.label}
                    </text>
                  </g>
                ))}

                {/* Row backgrounds + dividers */}
                {data.rows.map((r, i) => {
                  const y = rowY[i];
                  const h = (r.kind === 'phase' ? PHASE_ROW_H : ROW_H);
                  return (
                    <g key={`row-${i}`}>
                      {r.kind === 'phase' && (
                        <rect x={0} y={y} width={totalWidth} height={h} fill="var(--bg)" opacity={0.6} />
                      )}
                      <line x1={0} y1={y + h} x2={totalWidth} y2={y + h} stroke="var(--border)" strokeWidth={0.5} />
                    </g>
                  );
                })}

                {/* Today line — pill anchored to the top of the header so it
                    never overlaps the month / week / day sub-labels below. */}
                {todayX != null && (
                  <g>
                    <line
                      x1={todayX} y1={HEADER_H}
                      x2={todayX} y2={totalHeight}
                      stroke="var(--accent-blue)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                    <rect x={todayX - 19} y={26} width={38} height={14} rx={3} fill="var(--accent-blue)" />
                    <text
                      x={todayX}
                      y={37}
                      fontSize={9}
                      fontWeight={800}
                      fill="#fff"
                      textAnchor="middle"
                    >
                      TODAY
                    </text>
                  </g>
                )}

                {/* Dependency arrows (drawn behind bars) */}
                {depLines.map((d) => {
                  const midX = d.fromX + 12;
                  return (
                    <g key={d.id} opacity={0.55}>
                      <path
                        d={`M ${d.fromX} ${d.fromY} L ${midX} ${d.fromY} L ${midX} ${d.toY} L ${d.toX - 4} ${d.toY}`}
                        fill="none"
                        stroke="var(--text-muted)"
                        strokeWidth={1}
                      />
                      <polygon
                        points={`${d.toX - 4},${d.toY - 3} ${d.toX},${d.toY} ${d.toX - 4},${d.toY + 3}`}
                        fill="var(--text-muted)"
                      />
                    </g>
                  );
                })}

                {/* Bars */}
                {data.rows.map((r, i) => {
                  if (r.kind !== 'task') return null;
                  const y      = rowY[i];
                  const x1     = daysBetween(data.windowStart, r.range.start) * pxPerDay;
                  const x2     = daysBetween(data.windowStart, r.range.end)   * pxPerDay;
                  const w      = Math.max(2, x2 - x1);
                  const fill   = STATUS_FILL[r.task.status] || STATUS_FILL.not_started;
                  const progress = Math.max(0, Math.min(100, r.task.planning?.progressPercent || 0));
                  const isDone   = ['approved', 'completed', 'released_to_site'].includes(r.task.status);
                  const isOverdue = today > r.range.end && !isDone;
                  const baseline = showBaseline ? getBaselineRange(r.task) : null;

                  return (
                    <g key={`bar-${r.task._id}`}>
                      {baseline && (() => {
                        const bx1 = daysBetween(data.windowStart, baseline.start) * pxPerDay;
                        const bx2 = daysBetween(data.windowStart, baseline.end)   * pxPerDay;
                        return (
                          <rect
                            x={bx1}
                            y={y + BAR_PAD - 3}
                            width={Math.max(2, bx2 - bx1)}
                            height={BAR_H + 6}
                            fill="none"
                            stroke="var(--text-muted)"
                            strokeWidth={1}
                            strokeDasharray="3 2"
                            rx={4}
                            opacity={0.55}
                          />
                        );
                      })()}
                      <rect
                        x={x1} y={y + BAR_PAD}
                        width={w} height={BAR_H}
                        rx={4}
                        fill={fill}
                        opacity={0.18}
                      />
                      {progress > 0 && (
                        <rect
                          x={x1} y={y + BAR_PAD}
                          width={Math.max(0, (w * progress) / 100)}
                          height={BAR_H}
                          rx={4}
                          fill={fill}
                          opacity={0.85}
                        />
                      )}
                      <rect
                        x={x1} y={y + BAR_PAD}
                        width={w} height={BAR_H}
                        rx={4}
                        fill="none"
                        stroke={fill}
                        strokeWidth={1}
                        opacity={0.8}
                      />
                      {/* Overdue: outer dashed ring so the cue is visible even
                          when the bar fill is already red (blocked / revision). */}
                      {isOverdue && (
                        <rect
                          x={x1 - 2} y={y + BAR_PAD - 2}
                          width={w + 4} height={BAR_H + 4}
                          rx={5}
                          fill="none"
                          stroke="var(--error)"
                          strokeWidth={1.5}
                          strokeDasharray="3 2"
                        />
                      )}
                      {w > 60 && (
                        <text
                          x={x1 + 6}
                          y={y + BAR_PAD + BAR_H / 2 + 3}
                          fontSize={10}
                          fontWeight={700}
                          fill="var(--text-primary)"
                          style={{ pointerEvents: 'none' }}
                        >
                          {progress > 0 ? `${progress}%` : (STATUS_LABEL[r.task.status] || '')}
                        </text>
                      )}
                      <rect
                        x={x1 - 2} y={y}
                        width={w + 4} height={ROW_H}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHover({ task: r.task, range: r.range, x: x1 + w / 2, y, isOverdue })}
                        onMouseLeave={() => setHover(null)}
                      />
                    </g>
                  );
                })}
              </svg>

              {hover && (
                <div
                  className="absolute z-30 pointer-events-none bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-3 text-xs"
                  style={{
                    left: Math.max(8, Math.min(hover.x + 8, totalWidth - 252)),
                    top:  hover.y + 28,
                    width: 240,
                  }}
                >
                  <p className="font-extrabold text-[var(--text-primary)] truncate">{hover.task.title}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {fmtShort(hover.range.start)} → {fmtShort(hover.range.end)}
                  </p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest"
                      style={{
                        backgroundColor: 'var(--bg)',
                        color: STATUS_FILL[hover.task.status] || STATUS_FILL.not_started,
                        border: `1px solid ${STATUS_FILL[hover.task.status] || STATUS_FILL.not_started}`,
                      }}
                    >
                      {STATUS_LABEL[hover.task.status] || 'Not Started'}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {hover.task.planning?.progressPercent || 0}%
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5 flex items-center gap-1">
                    <Users size={10} /> {designerName(hover.task)}
                  </p>
                  {hover.isOverdue && (
                    <p className="text-[10px] font-bold text-[var(--error)] mt-1.5 uppercase tracking-widest">
                      Overdue
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend — split into two rows so the meta indicators (Today / Overdue)
            stay visible regardless of viewport width. */}
        <div className="border-t border-[var(--border)] px-4 py-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {Object.entries(STATUS_LABEL).map(([k, l]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: STATUS_FILL[k], opacity: 0.75 }}
                />
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{l}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-0.5 bg-[var(--accent-blue)]" />
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width={14} height={10} aria-hidden="true">
                <rect x={1} y={1} width={12} height={8} rx={2} fill="none" stroke="var(--error)" strokeWidth={1.2} strokeDasharray="3 2" />
              </svg>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Overdue</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttTab;
