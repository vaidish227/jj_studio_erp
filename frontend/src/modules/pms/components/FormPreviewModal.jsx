import React from 'react';
import { Modal } from '../../../shared/components';
import { ClientFormPreviewCard } from './clientFormShared';

// ─── Preview modal ─────────────────────────────────────────────────────────────
// Renders a template the way a client sees it at /forms/:token (read-only,
// branded + themed via the shared ClientFormPreviewCard).
const FormPreviewModal = ({ template, isOpen, onClose }) => {
  if (!template) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Form Preview" className="max-w-2xl">
      <p className="text-xs text-[var(--text-muted)] -mt-1 mb-4">
        This is exactly what your client sees when they open the form link.
      </p>
      <ClientFormPreviewCard template={template} emptyHint="This template has no fields yet." />
    </Modal>
  );
};

export default FormPreviewModal;
