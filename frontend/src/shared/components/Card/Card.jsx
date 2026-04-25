import React from 'react';

/**
 * Generic card wrapper — use for any boxed section.
 * Props: padding, className, children
 */
const Card = ({ children, className = '', padding = 'p-5' }) => {
  return (
    <div
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl ${padding} ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
