import React, { useEffect, useState } from 'react';
import { FileText, Loader2, AlertCircle, Maximize2 } from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import DrawingStatusBadge from './DrawingStatusBadge';
import PreviewDrawingModal from './PreviewDrawingModal';

const isPdf = (drawing) => {
  const t = (drawing?.fileType || '').toLowerCase();
  if (t.includes('pdf')) return true;
  const name = (drawing?.fileName || '').toLowerCase();
  return name.endsWith('.pdf');
};

const isImage = (drawing) => {
  const t = (drawing?.fileType || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  const name = (drawing?.fileName || '').toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name);
};

/**
 * Drawing thumbnail. Fills its parent by default (w-full h-full) — pass
 * `className` to override or constrain (e.g. "w-40 h-40" for standalone use).
 *
 * Props:
 *   drawing      — required
 *   className    — outer button classes (sizing)
 *   compact      — true to hide the status badge + shrink the hover hint (mosaic tiles)
 *   overlay      — extra React node rendered on top (e.g. "+N more" badge)
 */
const DrawingPreviewThumb = ({
  drawing,
  className = 'w-40 h-40',
  compact = false,
  overlay = null,
}) => {
  const [url, setUrl]      = useState(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr]      = useState(null);
  const [open, setOpen]    = useState(false);

  const pdf = isPdf(drawing);
  const img = isImage(drawing);

  useEffect(() => {
    if (!drawing?._id || !img) { setLoad(false); return; }
    let cancelled = false;
    setLoad(true);
    pmsService.getDrawingPreviewUrl(drawing._id)
      .then((r) => { if (!cancelled) setUrl(r?.url || null); })
      .catch((e) => { if (!cancelled) setErr(e?.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoad(false); });
    return () => { cancelled = true; };
  }, [drawing?._id, img]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`group relative ${className} overflow-hidden border border-[var(--border)]
                   bg-[var(--bg)] hover:border-[var(--primary)]/50 transition-all shrink-0
                   flex items-center justify-center`}
        title={`Preview ${drawing.title}`}
      >
        {/* Body */}
        {img && loading && (
          <Loader2 size={18} className="text-[var(--text-muted)] animate-spin" />
        )}
        {img && !loading && url && (
          <img
            src={url}
            alt={drawing.title}
            className="w-full h-full object-cover"
            onError={() => setErr('Failed to render')}
          />
        )}
        {img && err && (
          <div className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
            <AlertCircle size={16} />
            {!compact && <span className="text-[10px]">Preview unavailable</span>}
          </div>
        )}
        {pdf && (
          <div className="flex flex-col items-center gap-1 text-[var(--accent-blue)]">
            <FileText size={compact ? 20 : 28} strokeWidth={1.5} />
            <span className="text-[10px] font-black uppercase tracking-wider">PDF</span>
          </div>
        )}
        {!pdf && !img && (
          <div className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
            <FileText size={compact ? 20 : 26} strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {(drawing.fileType || 'file').split('/').pop().slice(0, 6)}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all
                        flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className={`rounded-md bg-white/95 font-bold text-[var(--text-primary)]
                          flex items-center gap-1 ${compact ? 'p-1' : 'px-2 py-1 text-[10px]'}`}>
            <Maximize2 size={compact ? 12 : 11} />
            {!compact && 'Preview'}
          </div>
        </div>

        {/* Status pill (top-left) — hidden in compact mosaic tiles */}
        {!compact && (
          <div className="absolute top-1.5 left-1.5">
            <DrawingStatusBadge status={drawing.status} />
          </div>
        )}

        {/* Extra overlay (e.g. "+N more") */}
        {overlay}
      </button>

      {open && (
        <PreviewDrawingModal
          drawing={drawing}
          isOpen={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default DrawingPreviewThumb;
