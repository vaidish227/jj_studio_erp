import React from 'react';

const FormField = ({ 
  label, 
  error, 
  children, 
  required,
  className = "" 
}) => {
  return (
    <div className={`w-full space-y-2 ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1 ml-0.5">
          {label}
          {required && <span className="text-[var(--error)]">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-[var(--error)] font-medium ml-0.5">
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;
