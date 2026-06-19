import { useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, FileSpreadsheet, X } from 'lucide-react';

// Mirrors the backend multer fileFilter (delegation.route.js): 20 MB single-file
// cap, PDF / image / office-doc MIME types. We validate client-side for instant
// feedback; the server remains the authoritative gate.
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv';
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const fmtSize = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const iconFor = (file) => {
  const t = file.type || '';
  if (t.startsWith('image/')) return ImageIcon;
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv')) return FileSpreadsheet;
  return FileText;
};

/* Drag-and-drop + click-to-browse upload zone. Files are *staged* here — the
   parent uploads them via the existing POST /:id/attachments flow after the
   delegation is created (the API has no create-with-attachments variant). */
const AttachmentDropzone = ({ files, onAdd, onRemove, disabled = false }) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const pick = (list) => {
    if (disabled) return;
    onAdd(Array.from(list || []));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer?.files);
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full rounded-2xl border-2 border-dashed px-4 py-8 flex flex-col items-center justify-center gap-2 text-center transition-all duration-200 ${
          dragging
            ? 'border-[var(--primary)] bg-[var(--primary)]/5'
            : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--bg)]'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-black shadow-sm"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-active))' }}
        >
          <UploadCloud size={22} />
        </span>
        <span className="text-sm font-semibold text-[var(--text-secondary)]">
          Drag &amp; drop files here, or <span className="text-[var(--primary-active)]">click to upload</span>
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          PDF, images, Word, Excel, CSV or text — up to 20&nbsp;MB each
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
      />

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => {
            const Icon = iconFor(f);
            return (
              <li
                key={`${f.name}-${f.size}-${i}`}
                className="flex items-center gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2"
              >
                <Icon size={16} className="text-[var(--text-muted)] shrink-0" />
                <span className="flex-1 min-w-0 truncate text-sm text-[var(--text-secondary)] font-medium">{f.name}</span>
                <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">{fmtSize(f.size)}</span>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => onRemove(i)}
                    className="text-[var(--text-muted)] hover:text-[var(--error)] shrink-0"
                  >
                    <X size={15} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AttachmentDropzone;
