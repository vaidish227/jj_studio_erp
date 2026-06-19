import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, FileImage, Music, Video, X } from 'lucide-react';
import { acceptFor, validateFile, detectKind, formatSize, KIND_CONFIG } from '../utils/mediaKinds';

const KIND_ICON = { image: FileImage, document: FileText, audio: Music, video: Video };

/**
 * Controlled multi-file picker with auto kind detection. The parent owns the
 * `files` array; this renders a dropzone + the selected list. Used inside the
 * create modals (and the standalone upload modal) for the closure modules.
 *
 * @prop {File[]} files
 * @prop {(files: File[]) => void} onChange
 * @prop {string[]} kinds   allowed kinds, e.g. ['image','document'] or ['image','audio','video']
 */
const InlineFilePicker = ({ files = [], onChange, kinds = ['image', 'document'] }) => {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError]       = useState(null);

  const add = (incoming) => {
    const accepted = [];
    let firstError = null;
    for (const f of Array.from(incoming || [])) {
      const { ok, error: err } = validateFile(f, kinds);
      if (ok) accepted.push(f);
      else if (!firstError) firstError = err;
    }
    setError(firstError);
    if (accepted.length) onChange([...files, ...accepted]);
  };

  const removeAt = (i) => onChange(files.filter((_, idx) => idx !== i));

  const hint = kinds.map((k) => KIND_CONFIG[k]?.label || k).join(' · ');

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-4 cursor-pointer transition-colors
                   ${dragOver
                     ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                     : error
                       ? 'border-[var(--error)]/60 bg-[var(--error)]/5'
                       : 'border-[var(--border)] hover:border-[var(--primary)]/40 bg-[var(--bg)]'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptFor(kinds)}
          onChange={(e) => { add(e.target.files); if (inputRef.current) inputRef.current.value = ''; }}
          className="hidden"
        />
        <div className="text-center space-y-0.5">
          <UploadCloud size={24} className="mx-auto text-[var(--text-muted)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Drop files here, or click to browse</p>
          <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>
        </div>
      </div>

      {error && <p className="text-[11px] text-[var(--error)]">{error}</p>}

      {files.length > 0 && (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {files.map((f, i) => {
            const Icon = KIND_ICON[detectKind(f)] || FileText;
            return (
              <div key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-[var(--primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{f.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{formatSize(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                  title="Remove"
                ><X size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InlineFilePicker;
