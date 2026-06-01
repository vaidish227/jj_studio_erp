import React, { useState } from 'react';
import { Modal, Button, FormField, Input } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import AIInlinePolish from '../../ai/components/AIInlinePolish';

const ReviseDrawingModal = ({ isOpen, onClose, drawing, onRevised }) => {
  const toast = useToast();
  const [fileUrl, setFileUrl]           = useState('');
  const [fileName, setFileName]         = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmitting, setSubmitting]   = useState(false);
  const [error, setError]               = useState('');

  if (!drawing) return null;

  const handleSubmit = async () => {
    if (!fileUrl.trim()) { setError('File URL is required'); return; }
    setSubmitting(true);
    try {
      await pmsService.reviseDrawing(drawing._id, {
        fileUrl:      fileUrl.trim(),
        fileName:     fileName.trim() || undefined,
        revisionNotes: revisionNotes.trim() || undefined,
      });
      toast.success(`Drawing revised to v${drawing.version + 1}`);
      setFileUrl('');
      setFileName('');
      setRevisionNotes('');
      setError('');
      onRevised?.();
      onClose();
    } catch (err) {
      toast.error(err || 'Failed to revise drawing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFileUrl(''); setFileName(''); setRevisionNotes(''); setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Revise Drawing">
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">Revising</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{drawing.title}</p>
          <p className="text-xs text-[var(--text-muted)]">Current version: v{drawing.version}</p>
        </div>

        <FormField label="New File URL" error={error} required>
          <Input
            value={fileUrl}
            onChange={(e) => { setFileUrl(e.target.value); setError(''); }}
            placeholder="https://drive.google.com/... or cloud URL"
          />
        </FormField>

        <FormField label="File Name">
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="AC-Layout-v2.pdf"
          />
        </FormField>

        <FormField label="Revision Notes">
          <textarea
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            rows={3}
            placeholder="Describe what changed in this revision..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none transition-colors"
          />
          <div className="mt-2">
            <AIInlinePolish
              value={revisionNotes}
              onAccept={(t) => setRevisionNotes(t)}
              acceptLabel="Use this"
              emptyMessage="Write the notes first, then let AI refine them."
              rows={3}
            />
          </div>
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>Submit Revision</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReviseDrawingModal;
