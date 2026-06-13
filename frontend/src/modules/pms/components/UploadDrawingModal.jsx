import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UploadCloud, FileText, FileImage, X, AlertCircle } from 'lucide-react';
import { Modal, Button, FormField, Input, Select } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { DRAWING_TYPE_LABELS } from './DrawingCard';

const DRAWING_TYPE_OPTIONS = [
  { value: '',                 label: 'Select drawing type...' },
  ...Object.entries(DRAWING_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXT_HINT = 'PDF, JPEG, PNG · max 20 MB';
const MAX_BYTES = 20 * 1024 * 1024;

const INITIAL = {
  zoneName:    '',
  title:       '',                                    // a.k.a. Design Name
  description: '',
  drawingType: '',
  revisionNotes: '',
};

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
  return UploadCloud;
};

const UploadDrawingModal = ({ isOpen, onClose, projectId, taskId, onUploaded }) => {
  const toast = useToast();
  const [form, setForm]               = useState(INITIAL);
  const [file, setFile]               = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errors, setErrors]           = useState({});
  const [nextVersion, setNextVersion] = useState(1);
  const fileInputRef                  = useRef(null);

  // Reset when modal opens/closes so reopens are clean.
  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL); setFile(null); setErrors({}); setNextVersion(1);
    }
  }, [isOpen]);

  // Auto-revision: fetch the next version whenever (project, zone, designName)
  // settles. Debounced via a 350ms timer to avoid spamming the API while typing.
  useEffect(() => {
    if (!isOpen || !projectId || !form.title.trim()) {
      setNextVersion(1);
      return;
    }
    const handle = setTimeout(() => {
      pmsService.getNextDrawingVersion({
        projectId,
        zoneName: form.zoneName.trim(),
        title:    form.title.trim(),
      })
        .then((res) => setNextVersion(res?.version || 1))
        .catch(() => setNextVersion(1));
    }, 350);
    return () => clearTimeout(handle);
  }, [isOpen, projectId, form.zoneName, form.title]);

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const acceptFile = (f) => {
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) {
      setErrors((prev) => ({ ...prev, file: `Unsupported type "${f.type || 'unknown'}". Use PDF, JPEG, or PNG.` }));
      return;
    }
    if (f.size > MAX_BYTES) {
      setErrors((prev) => ({ ...prev, file: `File is ${formatSize(f.size)}. Max 20 MB.` }));
      return;
    }
    setFile(f);
    setErrors((prev) => ({ ...prev, file: null }));
  };

  const onFileInput = (e) => acceptFile(e.target.files?.[0]);
  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim())      e.title       = 'Design name is required';
    if (!form.drawingType)       e.drawingType = 'Drawing type is required';
    if (!file)                   e.file        = 'Please choose a file (PDF / JPEG / PNG, max 20 MB)';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('projectId',    projectId);
      if (taskId) fd.append('taskId', taskId);
      fd.append('title',        form.title.trim());
      fd.append('zoneName',     form.zoneName.trim());
      fd.append('description',  form.description.trim());
      fd.append('drawingType',  form.drawingType);
      if (form.revisionNotes.trim()) fd.append('revisionNotes', form.revisionNotes.trim());
      fd.append('file', file, file.name);

      const res = await pmsService.uploadDrawingFile(fd);
      toast.success(res?.message || 'Drawing uploaded');
      onUploaded?.(res?.drawing);
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Drawing Upload" className="max-w-xl">
      <div className="space-y-4">

        {/* Zone + Design Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Zone Name" error={errors.zoneName}>
            <Input
              value={form.zoneName}
              onChange={(e) => set('zoneName', e.target.value)}
              placeholder="e.g. Master Bedroom"
            />
          </FormField>
          <FormField label="Design Name" error={errors.title} required>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. AC Coordination"
            />
          </FormField>
        </div>

        {/* Revision (auto-computed) + Drawing Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Revision">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg
                               bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-sm">
                v{nextVersion}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {nextVersion > 1
                  ? `Auto-set from ${nextVersion - 1} previous upload${nextVersion - 1 === 1 ? '' : 's'}`
                  : 'First upload for this design'}
              </span>
            </div>
          </FormField>
          <FormField label="Drawing Type" error={errors.drawingType} required>
            <Select
              value={form.drawingType}
              onChange={(val) => set('drawingType', val)}
              options={DRAWING_TYPE_OPTIONS}
            />
          </FormField>
        </div>

        {/* Design Description */}
        <FormField label="Design Description" error={errors.description}>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="What's in this drawing? Materials, dimensions, anything the reviewer should know."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none transition-colors"
          />
        </FormField>

        {/* Design File — drag & drop */}
        <FormField label="Design File" error={errors.file} required>
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
              accept={ALLOWED_MIME.join(',')}
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
            <AlertCircle size={11} /> Uploaded file should be in PDF / JPEG / PNG, max 20 MB.
          </p>
        </FormField>

        {/* Revision notes (optional, becomes part of the version history) */}
        {nextVersion > 1 && (
          <FormField label="What changed in this revision?">
            <Input
              value={form.revisionNotes}
              onChange={(e) => set('revisionNotes', e.target.value)}
              placeholder="e.g. updated AC duct routing per client feedback"
            />
          </FormField>
        )}

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

export default UploadDrawingModal;
