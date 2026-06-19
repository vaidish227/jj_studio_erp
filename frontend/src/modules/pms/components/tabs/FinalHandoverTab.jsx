import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, UploadCloud, FileText, FileSpreadsheet, FileImage, FileArchive,
  File as FileIcon, FolderOpen, Eye, Download, Trash2, X, KeyRound, AlertCircle,
} from 'lucide-react';
import { Button, Modal, Loader, FormField, Input } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../../shared/services/pmsService';
import useFinalHandoverDocs from '../../hooks/useFinalHandoverDocs';

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
  'application/zip', 'application/x-zip-compressed',
  'application/acad', 'application/dwg', 'image/vnd.dwg', 'image/vnd.dxf',
];
const OCTET_STREAM_EXT = ['.dwg', '.dxf', '.zip', '.rar'];
const ACCEPT_ATTR = [...ALLOWED_MIME, ...OCTET_STREAM_EXT].join(',');
const MAX_BYTES = 25 * 1024 * 1024;

const EXT_META = {
  pdf:  { icon: FileText,        bg: 'bg-[var(--error)]/12',       fg: 'text-[var(--error)]' },
  doc:  { icon: FileText,        bg: 'bg-[var(--accent-blue)]/12', fg: 'text-[var(--accent-blue)]' },
  docx: { icon: FileText,        bg: 'bg-[var(--accent-blue)]/12', fg: 'text-[var(--accent-blue)]' },
  xls:  { icon: FileSpreadsheet, bg: 'bg-[var(--success)]/12',     fg: 'text-[var(--success)]' },
  xlsx: { icon: FileSpreadsheet, bg: 'bg-[var(--success)]/12',     fg: 'text-[var(--success)]' },
  csv:  { icon: FileSpreadsheet, bg: 'bg-[var(--success)]/12',     fg: 'text-[var(--success)]' },
  png:  { icon: FileImage,       bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  jpg:  { icon: FileImage,       bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  jpeg: { icon: FileImage,       bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  zip:  { icon: FileArchive,     bg: 'bg-[var(--text-muted)]/12',  fg: 'text-[var(--text-muted)]' },
  default: { icon: FileIcon,     bg: 'bg-[var(--primary)]/12',     fg: 'text-[var(--primary)]' },
};
const metaFor = (ext) => EXT_META[(ext || '').toLowerCase()] || EXT_META.default;

const formatSize = (n) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

const isAllowed = (f) => {
  if (ALLOWED_MIME.includes(f.type)) return true;
  const ext = `.${(f.name || '').split('.').pop().toLowerCase()}`;
  return (!f.type || f.type === 'application/octet-stream') && OCTET_STREAM_EXT.includes(ext);
};

const UploadModal = ({ isOpen, onClose, projectId, onUploaded }) => {
  const toast = useToast();
  const [form, setForm]   = useState({ name: '', description: '' });
  const [file, setFile]   = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) { setForm({ name: '', description: '' }); setFile(null); setErrors({}); }
  }, [isOpen]);

  const acceptFile = (f) => {
    if (!f) return;
    if (!isAllowed(f)) { setErrors((p) => ({ ...p, file: `Unsupported type "${f.type || 'unknown'}".` })); return; }
    if (f.size > MAX_BYTES) { setErrors((p) => ({ ...p, file: `File is ${formatSize(f.size)}. Max 25 MB.` })); return; }
    setFile(f);
    setErrors((p) => ({ ...p, file: null }));
    setForm((p) => p.name.trim() ? p : { ...p, name: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') });
  };

  const handleSubmit = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Document name is required';
    if (!file) e.file = 'Please choose a file';
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('projectId', projectId);
      fd.append('name', form.name.trim());
      fd.append('description', form.description.trim());
      fd.append('file', file, file.name);
      const res = await pmsService.uploadFinalHandoverDoc(fd);
      toast.success(res?.message || 'Document uploaded');
      onUploaded?.(res?.document);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !submitting && onClose()} title="Upload Handover Document" className="max-w-xl">
      <div className="space-y-4">
        <FormField label="Document Name" error={errors.name} required>
          <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Completion Certificate" />
        </FormField>
        <FormField label="Details" error={errors.description}>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            placeholder="What is this handover document?"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] resize-none"
          />
        </FormField>
        <FormField label="File" error={errors.file} required>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-5 cursor-pointer transition-colors
                       ${dragOver ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                         : errors.file ? 'border-[var(--error)]/60 bg-[var(--error)]/5'
                         : 'border-[var(--border)] hover:border-[var(--primary)]/40 bg-[var(--bg)]'}`}
          >
            <input ref={inputRef} type="file" accept={ACCEPT_ATTR} onChange={(e) => acceptFile(e.target.files?.[0])} className="hidden" />
            {!file ? (
              <div className="text-center space-y-1">
                <UploadCloud size={28} className="mx-auto text-[var(--text-muted)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Drop file here, or click to browse</p>
                <p className="text-xs text-[var(--text-muted)]">PDF, images, Office docs, CSV, ZIP, DWG/DXF · max 25 MB</p>
              </div>
            ) : (
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-[var(--primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{file.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{file.type || 'unknown'} · {formatSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10" title="Remove"><X size={14} /></button>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[var(--warning)] mt-1.5 inline-flex items-center gap-1">
            <AlertCircle size={11} /> File is stored securely on S3 and shared via expiring links.
          </p>
        </FormField>
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={() => !submitting && onClose()} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={submitting}><UploadCloud size={14} /> Upload</Button>
        </div>
      </div>
    </Modal>
  );
};

const DocCard = ({ doc, onPreview, onDownload, onDelete }) => {
  const ext = (doc.fileName || doc.fileUrl || '').split('.').pop()?.toLowerCase() || '';
  const meta = metaFor(ext.length <= 5 ? ext : '');
  const Icon = meta.icon;
  return (
    <div className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden transition-all hover:border-[var(--primary)]/40 hover:shadow-md flex flex-col">
      <div className={`relative h-28 flex items-center justify-center ${meta.bg}`}>
        <Icon size={42} className={meta.fg} />
        <PermissionGate permission="final_handover.delete">
          <button
            type="button"
            onClick={() => onDelete(doc)}
            className="absolute top-2 left-2 p-1.5 rounded-lg bg-[var(--surface)]/85 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition-all"
            title="Delete"
          ><Trash2 size={12} /></button>
        </PermissionGate>
      </div>
      <div className="p-3 flex flex-col gap-3 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)] truncate" title={doc.name}>{doc.name}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{formatSize(doc.fileSize) || '—'}</p>
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <button type="button" onClick={() => onPreview(doc)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"><Eye size={12} /> Review</button>
          <button type="button" onClick={() => onDownload(doc)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors"><Download size={12} /> Download</button>
        </div>
      </div>
    </div>
  );
};

const FinalHandoverTab = ({ project }) => {
  const toast = useToast();
  const { docs, isLoading, error, refresh } = useFinalHandoverDocs(project?._id);
  const [uploadOpen, setUploadOpen] = useState(false);

  const openSigned = async (doc, mode) => {
    try {
      const res = mode === 'download'
        ? await pmsService.getFinalHandoverDownloadUrl(doc._id)
        : await pmsService.getFinalHandoverPreviewUrl(doc._id);
      if (!res?.url) throw new Error('No URL returned');
      if (mode === 'download') {
        const a = document.createElement('a');
        a.href = res.url; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        window.open(res.url, '_blank', 'noopener');
      }
    } catch (err) { toast.error(err?.message || 'Could not open the file'); }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    try { await pmsService.deleteFinalHandoverDoc(doc._id); toast.success('Document deleted'); refresh(); }
    catch (err) { toast.error(err?.message || 'Delete failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--success)]/10 flex items-center justify-center shrink-0">
              <KeyRound size={18} className="text-[var(--success)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Final Handover</p>
              <p className="text-sm font-extrabold text-[var(--text-primary)] truncate">{project?.name || 'Project'}</p>
            </div>
          </div>
          <PermissionGate permission="final_handover.upload">
            <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)} disabled={!project?._id}>
              <Upload size={14} /> Upload
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 min-h-[280px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader /></div>
        ) : error ? (
          <p className="text-xs text-[var(--error)] py-8 text-center">Failed to load handover documents.</p>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <FolderOpen size={28} className="text-[var(--text-muted)] mb-2" />
            <p className="text-sm font-bold text-[var(--text-secondary)]">No handover documents</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">Upload completion certificates, warranties, as-built drawings and manuals for the client handover.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {docs.map((doc) => (
              <DocCard
                key={doc._id}
                doc={doc}
                onPreview={(d) => openSigned(d, 'preview')}
                onDownload={(d) => openSigned(d, 'download')}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        projectId={project?._id}
        onUploaded={() => refresh()}
      />
    </div>
  );
};

export default FinalHandoverTab;
