import React, { useState } from 'react';
import PreviewDrawingModal from './PreviewDrawingModal';

/**
 * Opens a drawing in the in-app PreviewDrawingModal (zoom + annotate).
 * Replaces the old "open S3 URL in new tab" flow — raw S3 URLs return
 * AccessDenied because the bucket is private.
 *
 * Props:
 *   drawing         — required. Full drawing object (must include _id, title, version, fileType/fileName).
 *   historyVersion  — optional. Pass to view a past revision from revisionHistory.
 *   className       — pass-through for styling
 *   title           — tooltip
 *   onClick         — extra handler (e.g. stopPropagation). Call e.preventDefault() to suppress the modal.
 *   children        — link contents (icon, label, etc.)
 */
const DrawingFileLink = ({
  drawing,
  historyVersion,
  className = '',
  title,
  onClick,
  children,
}) => {
  const [open, setOpen] = useState(false);

  const handleClick = (e) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    if (!drawing?._id) return;
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={title}
        className={className}
      >
        {children}
      </button>
      {open && (
        <PreviewDrawingModal
          drawing={drawing}
          version={historyVersion}
          isOpen={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default DrawingFileLink;
