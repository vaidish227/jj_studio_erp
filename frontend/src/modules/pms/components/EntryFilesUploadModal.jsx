import React, { useState, useEffect } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { Modal, Button, FormField } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import InlineFilePicker from './InlineFilePicker';
import { uploadGroupedFiles } from '../utils/mediaKinds';

/**
 * Standalone "add more files" modal for an existing entry. Files are auto-routed
 * by kind, so the caller just provides `uploadFn(formData)` (one endpoint that
 * accepts `kind` + `files[]`) — this calls it once per kind group.
 *
 * @prop {string[]} kinds   allowed kinds, e.g. ['image','document'] or ['image','audio','video']
 * @prop {(formData) => Promise} uploadFn
 */
const EntryFilesUploadModal = ({
  isOpen, onClose, title = 'Add Files',
  kinds = ['image', 'document'],
  uploadFn, onUploaded,
}) => {
  const toast = useToast();
  const [files, setFiles]   = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (isOpen) setFiles([]); }, [isOpen]);

  const handleSubmit = async () => {
    if (!files.length) { toast.error('Please choose at least one file.'); return; }
    setSubmitting(true);
    try {
      await uploadGroupedFiles(files, uploadFn);
      toast.success('Files uploaded');
      onUploaded?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => { if (submitting) return; onClose(); };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} className="max-w-xl">
      <div className="space-y-4">
        <FormField label="Files" required>
          <InlineFilePicker files={files} onChange={setFiles} kinds={kinds} />
        </FormField>

        <p className="text-[11px] text-[var(--warning)] inline-flex items-center gap-1">
          <AlertCircle size={11} /> Files are stored securely on S3 and shared via expiring links.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={submitting} disabled={!files.length}>
            <UploadCloud size={14} /> Upload {files.length > 0 ? `(${files.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EntryFilesUploadModal;
