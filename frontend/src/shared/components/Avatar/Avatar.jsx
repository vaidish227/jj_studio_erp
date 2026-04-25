import React from 'react';

/**
 * Avatar — circular initials or image avatar.
 * Props: name (string), src (optional image), size (sm|md|lg), className
 */
const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const Avatar = ({ name = '', src, size = 'md', className = '' }) => {
  const sizeClass = sizeMap[size] ?? sizeMap.md;

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold shrink-0 overflow-hidden ${className}`}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};

export default Avatar;
