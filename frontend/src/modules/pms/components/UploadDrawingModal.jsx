import React, { useState } from 'react';
import { Modal, Button, FormField, Input, Select } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { DRAWING_TYPE_LABELS } from './DrawingCard';

const DRAWING_TYPE_OPTIONS = [
  { value: '',                 label: 'Select drawing type...' },
  ...Object.entries(DRAWING_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const INITIAL = {
  title:       '',
  drawingType: '',
  fileUrl:     '',
  fileName:    '',
  revisionNotes: '',
  notes:       '',
};

const UploadDrawingModal = ({ isOpen, onClose, projectId, taskId, onUploaded }) => {
  const toast = useToast();
  const [form, setForm]             = useState(INITIAL);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState({});

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim())   e.title       = 'Title is required';
    if (!form.drawingType)    e.drawingType  = 'Drawing type is required';
    if (!form.fileUrl.trim()) e.fileUrl      = 'File URL is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    try {
      await pmsService.uploadDrawing({
        projectId,
        taskId: taskId || undefined,
        title:        form.title.trim(),
        drawingType:  form.drawingType,
        fileUrl:      form.fileUrl.trim(),
        fileName:     form.fileName.trim() || undefined,
        revisionNotes: form.revisionNotes.trim() || undefined,
        notes:        form.notes.trim() || undefined,
      });
      toast.success('Drawing uploaded successfully');
      setForm(INITIAL);
      onUploaded?.();
      onClose();
    } catch (err) {
      toast.error(err || 'Failed to upload drawing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => { setForm(INITIAL); setErrors({}); onClose(); };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Drawing">
      <div className="space-y-4">

        <FormField label="Title" error={errors.title} required>
          <Input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Master Bedroom — AC Layout v1"
          />
        </FormField>

        <FormField label="Drawing Type" error={errors.drawingType} required>
          <Select
            value={form.drawingType}
            onChange={(val) => set('drawingType', val)}
            options={DRAWING_TYPE_OPTIONS}
          />
        </FormField>

        <FormField label="File URL" error={errors.fileUrl} required>
          <Input
            value={form.fileUrl}
            onChange={(e) => set('fileUrl', e.target.value)}
            placeholder="https://drive.google.com/... or cloud URL"
          />
        </FormField>

        <FormField label="File Name">
          <Input
            value={form.fileName}
            onChange={(e) => set('fileName', e.target.value)}
            placeholder="AC-Layout-MasterBedroom.pdf"
          />
        </FormField>

        <FormField label="Revision Notes">
          <Input
            value={form.revisionNotes}
            onChange={(e) => set('revisionNotes', e.target.value)}
            placeholder="What changed in this version?"
          />
        </FormField>

        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Additional context..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none transition-colors"
          />
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>Upload</Button>
        </div>
      </div>
    </Modal>
  );
};

export default UploadDrawingModal;
