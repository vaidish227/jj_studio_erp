import React, { useState, useEffect } from 'react';
import {
  FileText, FileSpreadsheet, FileImage, BookOpen,
  Eye, Download, FileArchive, File as FileIcon,
  ClipboardList, Trash2,
} from 'lucide-react';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import { PdfThumbnail } from '../../../shared/components';

// ─── File-type metadata ───────────────────────────────────────────────────────
const EXT_META = {
  pdf:  { icon: FileText,        tone: '#B65A41' },
  doc:  { icon: FileText,        tone: 'var(--accent-blue)' },
  docx: { icon: FileText,        tone: 'var(--accent-blue)' },
  xls:  { icon: FileSpreadsheet, tone: 'var(--success)' },
  xlsx: { icon: FileSpreadsheet, tone: 'var(--success)' },
  csv:  { icon: FileSpreadsheet, tone: 'var(--success)' },
  png:  { icon: FileImage,       tone: 'var(--accent-teal)' },
  jpg:  { icon: FileImage,       tone: 'var(--accent-teal)' },
  jpeg: { icon: FileImage,       tone: 'var(--accent-teal)' },
  webp: { icon: FileImage,       tone: 'var(--accent-teal)' },
  dwg:  { icon: BookOpen,        tone: 'var(--warning)' },
  dxf:  { icon: BookOpen,        tone: 'var(--warning)' },
  zip:  { icon: FileArchive,     tone: 'var(--text-muted)' },
  mom:  { icon: ClipboardList,   tone: 'var(--primary)' },
  default: { icon: FileIcon,     tone: 'var(--primary)' },
};

export const metaFor = (ext) => EXT_META[(ext || '').toLowerCase()] || EXT_META.default;

// Extensions that can be rendered inline (PDF page thumbnail / image)
const INLINE_PREVIEW_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

/**
 * Shared document card used in both the global Document Repository page and
 * the per-project DocumentsTab. Pass a `getPreviewUrl` thunk that returns a
 * Promise<string|null> — it's called once and cached by the parent page.
 *
 * Props:
 *   doc          — { id, name, ext, size, status, recorded?, momId? }
 *   getPreviewUrl(docId) → Promise<string|null>   (optional — thumbnail fetch)
 *   onPreview(doc)  — called when the card top area or "Preview" is clicked
 *   onDownload(doc) — called when "Download" is clicked
 *   onDelete(doc)   — optional; shows a delete icon (permission-gated)
 */
const DocumentCard = ({ doc, getPreviewUrl, onPreview, onDownload, onDelete }) => {
  const meta = metaFor(doc.ext);
  const Icon = meta.icon;
  const canThumb = !!doc.id && !!getPreviewUrl && INLINE_PREVIEW_EXTS.includes(doc.ext);

  const [thumbUrl, setThumbUrl] = useState(null);
  useEffect(() => {
    if (!canThumb) return undefined;
    let cancelled = false;
    getPreviewUrl(doc.id)
      .then((url) => { if (!cancelled) setThumbUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [doc.id, canThumb, getPreviewUrl]);

  const iconPlate = (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex items-center justify-center">
        <Icon size={22} style={{ color: meta.tone }} />
      </div>
      {doc.ext && (
        <span
          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
          style={{ background: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
        >
          {doc.ext}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="group relative border border-[var(--border)] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[var(--primary)]/40 hover:shadow-md flex flex-col"
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${meta.tone} 12%, var(--surface)) 0%, color-mix(in srgb, ${meta.tone} 3%, var(--surface)) 100%)` }}
    >
      {/* Faint watermark */}
      <Icon
        size={90}
        className="absolute -right-4 -bottom-5 opacity-[0.07] pointer-events-none"
        style={{ color: meta.tone }}
      />

      {/* Visual top — thumbnail or icon plate */}
      <button
        type="button"
        onClick={() => onPreview?.(doc)}
        className="group/plate relative w-full h-28 overflow-hidden"
      >
        {!thumbUrl ? (
          iconPlate
        ) : doc.ext === 'pdf' ? (
          <PdfThumbnail
            url={thumbUrl}
            alt={doc.name}
            className="w-full h-full object-cover object-top bg-white"
            fallback={iconPlate}
          />
        ) : (
          <img src={thumbUrl} alt={doc.name} className="w-full h-full object-cover bg-white" />
        )}

        {doc.status && (
          <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)]/85 text-[var(--text-secondary)] border border-[var(--border)]">
            {doc.status}
          </span>
        )}

        {/* Delete button */}
        {onDelete && !doc.recorded && (
          <PermissionGate permission={['documents.delete', 'projects.delete']} mode="any">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
              className="absolute top-2 left-2 p-1.5 rounded-lg bg-[var(--surface)]/85 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition-all"
              title="Delete document"
            >
              <Trash2 size={12} />
            </button>
          </PermissionGate>
        )}

        {/* Hover preview hint */}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/plate:bg-black/25 transition-colors">
          <span className="opacity-0 group-hover/plate:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] text-[11px] font-bold text-[var(--text-primary)] shadow">
            <Eye size={12} />
            Preview
          </span>
        </span>
      </button>

      {/* Meta + actions */}
      <div className="relative p-3 flex flex-col gap-3 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)] truncate" title={doc.name}>
            {doc.name}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
            {doc.size || '—'}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-auto">
          <button
            type="button"
            onClick={() => onPreview?.(doc)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
          >
            <Eye size={12} />
            Preview
          </button>
          <button
            type="button"
            onClick={() => onDownload?.(doc)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--surface)]/70 text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentCard;
