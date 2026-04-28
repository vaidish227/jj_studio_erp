import React from 'react';

const DropdownMenu = ({ children, className = '', position = 'right', side = 'bottom' }) => {
  const positionClasses = {
    right: 'right-0',
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  const sideClasses = {
    bottom: 'top-full mt-2',
    top: 'bottom-full mb-2',
  };

  return (
    <div
      className={`
        absolute z-50
        min-w-[200px] bg-[var(--surface)] border border-[var(--border)]
        rounded-2xl shadow-xl shadow-black/10 overflow-hidden
        animate-in fade-in zoom-in-95 duration-100
        ${positionClasses[position] || positionClasses.right}
        ${sideClasses[side] || sideClasses.bottom}
        ${className}
      `}
    >
      <div className="py-2">
        {children}
      </div>
    </div>
  );
};

export default DropdownMenu;
