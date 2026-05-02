import React from 'react';

const Loader = ({ fullPage = false, label = 'Loading...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4',
  };

  const loaderContent = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${sizeClasses[size]} border-[var(--primary)] border-t-transparent rounded-full animate-spin shadow-lg shadow-[var(--primary)]/20`}></div>
      {label && (
        <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-[0.2em] animate-pulse">
          {label}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center">
        {loaderContent}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12 w-full">
      {loaderContent}
    </div>
  );
};

export default Loader;
