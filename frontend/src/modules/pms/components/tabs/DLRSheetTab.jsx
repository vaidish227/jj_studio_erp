import React, { useState, useEffect, useCallback } from 'react';
import { FileText, ExternalLink, RefreshCw, Download, CheckCircle2, Clock, AlertCircle, XCircle, Rocket } from 'lucide-react';
import { pmsService } from '../../../../shared/services/pmsService';
import DrawingStatusBadge from '../DrawingStatusBadge';
import DrawingFileLink from '../DrawingFileLink';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

const SUMMARY_CARDS = [
  { key: 'total',    label: 'Total',    icon: FileText,      color: 'text-[var(--text-secondary)]',  bg: 'bg-[var(--border)]' },
  { key: 'released', label: 'Released', icon: Rocket,        color: 'text-[var(--primary)]',          bg: 'bg-[var(--primary)]/10' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2,  color: 'text-[var(--success)]',          bg: 'bg-[var(--success)]/10' },
  { key: 'pending',  label: 'Pending',  icon: Clock,         color: 'text-[var(--warning)]',          bg: 'bg-[var(--warning)]/10' },
  { key: 'rejected', label: 'Rejected', icon: XCircle,       color: 'text-[var(--error)]',            bg: 'bg-[var(--error)]/10' },
  { key: 'draft',    label: 'Draft',    icon: AlertCircle,   color: 'text-[var(--text-muted)]',       bg: 'bg-[var(--border)]' },
];

const DrawingRow = ({ drawing, serial }) => (
  <tr className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
    <td className="px-3 py-2.5 text-xs text-[var(--text-muted)] font-mono shrink-0">{serial}</td>
    <td className="px-3 py-2.5">
      <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{drawing.title}</p>
      {drawing.taskId && (
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
          Task: {drawing.taskId.title}
        </p>
      )}
    </td>
    <td className="px-3 py-2.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] bg-[var(--border)] px-1.5 py-0.5 rounded">
        v{drawing.version || 1}
      </span>
    </td>
    <td className="px-3 py-2.5">
      <DrawingStatusBadge status={drawing.status} />
    </td>
    <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">
      {drawing.uploadedBy?.name || '—'}
    </td>
    <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">
      {fmt(drawing.approvalDate || drawing.approvedAt)}
    </td>
    <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">
      {fmt(drawing.releasedAt)}
    </td>
    <td className="px-3 py-2.5">
      {drawing.fileUrl ? (
        <DrawingFileLink
          drawing={drawing}
          className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline font-semibold"
        >
          <ExternalLink size={11} />
          View
        </DrawingFileLink>
      ) : (
        <span className="text-[10px] text-[var(--text-muted)]">—</span>
      )}
    </td>
  </tr>
);

const DLRSheetTab = ({ project }) => {
  const [data,      setData]      = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    if (!project?._id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await pmsService.getDLRSheet(project._id);
      setData(res);
    } catch (e) {
      setError(e?.message || 'Failed to load DLR sheet');
    } finally {
      setIsLoading(false);
    }
  }, [project?._id]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <RefreshCw size={14} className="animate-spin" />
          Loading DLR Sheet…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-[var(--error)] text-sm">{error}</div>
    );
  }

  if (!data) return null;

  const { summary, byType } = data;
  const totalDrawings = summary?.total || 0;

  return (
    <div className="space-y-6 print:space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
        <div>
          <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
            Drawing List Register (DLR)
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {project.trackingId} · {project.name} · {totalDrawings} drawing{totalDrawings !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)]
                       text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors"
            title="Print / Save as PDF"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Print header — only visible when printing */}
      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold">Drawing List Register — {project.name}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{project.trackingId} · Printed {new Date().toLocaleDateString('en-IN')}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {SUMMARY_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className={`rounded-xl border border-[var(--border)] p-3 text-center ${bg}`}>
            <Icon size={16} className={`mx-auto mb-1 ${color}`} />
            <p className={`text-lg font-extrabold ${color}`}>{summary?.[key] ?? 0}</p>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {totalDrawings === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <FileText size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No drawings uploaded for this project yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {byType.map(({ type, label, count, drawings }) => (
            <div key={type}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
                  {label}
                </h3>
                <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--border)] px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              </div>

              {/* Table */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[700px]">
                    <thead>
                      <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] w-8">#</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Drawing Title</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] w-16">Ver.</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] w-32">Status</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Designer</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] w-24">Approved</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] w-24">Released</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] w-16">File</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--surface)]">
                      {drawings.map((d, i) => (
                        <DrawingRow key={d._id} drawing={d} serial={i + 1} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DLRSheetTab;
