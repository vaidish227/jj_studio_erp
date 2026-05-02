import React, { useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { AlertTriangle, HelpCircle } from 'lucide-react';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action', 
  message = 'Are you sure you want to proceed?', 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel',
  variant = 'primary', // primary, danger, warning
  isLoading = false,
  showRemarks = false,
  isRemarksMandatory = false,
  remarksPlaceholder = 'Add any remarks or reasons here...'
}) => {
  const [remarks, setRemarks] = useState('');

  const variantStyles = {
    primary: 'bg-indigo-500/10 text-indigo-500',
    danger: 'bg-red-500/10 text-red-500',
    warning: 'bg-amber-500/10 text-amber-500',
  };

  const icon = variant === 'danger' || variant === 'warning' ? <AlertTriangle size={24} /> : <HelpCircle size={24} />;

  const handleConfirm = () => {
    if (showRemarks && isRemarksMandatory && !remarks.trim()) {
      return; // Could add a local error state if needed
    }
    onConfirm(showRemarks ? remarks : undefined);
    if (showRemarks) setRemarks('');
  };

  const isConfirmDisabled = isLoading || (showRemarks && isRemarksMandatory && !remarks.trim());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6 pt-2">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl shrink-0 ${variantStyles[variant]}`}>
            {icon}
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-black text-gray-900 tracking-tight">{title}</h4>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">{message}</p>
          </div>
        </div>

        {showRemarks && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">
              Remarks {isRemarksMandatory ? <span className="text-red-500">(Mandatory)</span> : '(Optional)'}
            </label>
            <textarea
              className="w-full h-24 p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[var(--primary)] transition-all font-medium text-sm resize-none"
              placeholder={remarksPlaceholder}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="flex-1"
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'danger' : 'primary'} 
            onClick={handleConfirm} 
            className="flex-1 font-bold"
            isLoading={isLoading}
            disabled={isConfirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
