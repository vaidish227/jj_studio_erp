import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UploadCloud, FileText, FileImage, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { Modal, Button, FormField, Input, Select } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const CATEGORY_OPTIONS = [
  { value: 'client_details', label: 'Client Details' },
  { value: 'documents',      label: 'Documents' },
  { value: 'mom',            label: 'MOM' },
  { value: 'design_files',   label: 'Design Files' },
  { value: 'sop',            label: 'SOP' },
];

// Mirrors the backend whitelist in Document.route.js — server stays the authority.
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
const ALLOWED_EXT_HINT = 'PDF, images, Office documents, CSV, ZIP, DWG/DXF · max 25 MB';
const MAX_BYTES = 25 * 1024 * 1024;

const INITIAL = { name: '', description: '', category: 'documents' };

const formatSize = (n) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

const fileIcon = (file) => {
  if (!file) return UploadCloud;
  if (file.type === 'application/pdf') return FileText;
  if (file.type?.startsWith('image/')) return FileImage;
  if (file.type?.includes('spreadsheet') || file.type?.includes('excel') || file.type === 'text/csv') return FileSpreadsheet;
  return FileText;
};

const isAllowed = (f) => {
  if (ALLOWED_MIME.includes(f.type)) return true;
  const ext = `.${(f.name || '').split('.').pop().toLowerCase()}`;
  return (!f.type || f.type === 'application/octet-stream') && OCTET_STREAM_EXT.includes(ext);
};

/**
 * Manual upload into the project's Document Repository — captures a display
 * name, category and details alongside the file. The backend streams the file
 * to S3 under documents/<projectTrackingId>/<category>/.
 */
const UploadDocumentModal = ({ isOpen, onClose, projectId, defaultCategory, onUploaded }) => {
  const toast = useToast();
  const [form, setForm]               = useState(INITIAL);
  const [file, setFile]               = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errors, setErrors]           = useState({});
  const fileInputRef                  = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...INITIAL, category: defaultCategory || 'documents' });
      setFile(null);
      setErrors({});
    }
  }, [isOpen, defaultCategory]);

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const acceptFile = (f) => {
    if (!f) return;
    if (!isAllowed(f)) {
      setErrors((prev) => ({ ...prev, file: `Unsupported type "${f.type || 'unknown'}". ${ALLOWED_EXT_HINT}` }));
      return;
    }
    if (f.size > MAX_BYTES) {
      setErrors((prev) => ({ ...prev, file: `File is ${formatSize(f.size)}. Max 25 MB.` }));
      return;
    }
    setFile(f);
    setErrors((prev) => ({ ...prev, file: null }));
    // Pre-fill the display name from the filename if the user hasn't typed one.
    setForm((prev) => prev.name.trim()
      ? prev
      : { ...prev, name: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') });
  };

  const onFileInput = (e) => acceptFile(e.target.files?.[0]);
  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Document name is required';
    if (!form.category)    e.category = 'Category is required';
    if (!file)             e.file = `Please choose a file (${ALLOWED_EXT_HINT})`;
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('projectId',   projectId);
      fd.append('name',        form.name.trim());
      fd.append('description', form.description.trim());
      fd.append('category',    form.category);
      fd.append('file', file, file.name);

      const res = await pmsService.uploadProjectDocument(fd);
      toast.success(res?.message || 'Document uploaded');
      onUploaded?.(res?.document);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => { if (isSubmitting) return; onClose(); };

  const Icon = useMemo(() => fileIcon(file), [file]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Document" className="max-w-xl">
      <div className="space-y-4">

        {/* Name + Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Document Name" error={errors.name} required>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Signed Agreement"
            />
          </FormField>
          <FormField label="Category" error={errors.category} required>
            <Select
              value={form.category}
              onChange={(val) => set('category', val)}
              options={CATEGORY_OPTIONS}
            />
          </FormField>
        </div>

        {/* Details */}
        <FormField label="Details" error={errors.description}>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="What is this document? Who shared it, what does it cover?"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none transition-colors"
          />
        </FormField>

        {/* File — drag & drop */}
        <FormField label="File" error={errors.file} required>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-5 cursor-pointer transition-colors
                       ${dragOver
                         ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                         : errors.file
                           ? 'border-[var(--error)]/60 bg-[var(--error)]/5'
                           : 'border-[var(--border)] hover:border-[var(--primary)]/40 bg-[var(--bg)]'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              onChange={onFileInput}
              className="hidden"
            />
            {!file ? (
              <div className="text-center space-y-1">
                <UploadCloud size={28} className="mx-auto text-[var(--text-muted)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Drop file here, or click to browse
                </p>
                <p className="text-xs text-[var(--text-muted)]">{ALLOWED_EXT_HINT}</p>
              </div>
            ) : (
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-[var(--primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{file.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{file.type || 'unknown'} · {formatSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                  title="Remove file"
                >
                  <X size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] hover:underline"
                >
                  Replace
                </button>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[var(--warning)] mt-1.5 inline-flex items-center gap-1">
            <AlertCircle size={11} /> File is stored securely on S3 and shared via expiring links.
          </p>
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            <UploadCloud size={14} /> Upload
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UploadDocumentModal;
