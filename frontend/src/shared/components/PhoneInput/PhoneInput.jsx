import React, { useState } from 'react';
import { Phone } from 'lucide-react';

/**
 * PhoneInput — themed mobile/WhatsApp field with a fixed country code prefix.
 *
 * Visual: matches the shared `Input` (same border-radius, focus ring, error
 * state). A neutral `+91` chip sits on the left so the user only types the
 * 10-digit local number; the value emitted upward is the full E.164 form
 * (`+919876543210`) so the API and DB get consistent, country-tagged data.
 *
 * API mirrors `<Input>` so it's a drop-in replacement:
 *   <PhoneInput
 *     label="Contact Number"
 *     name="contactMobile"
 *     value={formData.contactMobile}
 *     onChange={handleChange}
 *     error={errors.contactMobile}
 *     required
 *   />
 *
 * Backwards-compatible: a `value` prop may be bare digits ("9876543210") or
 * already-prefixed ("+919876543210"); both display as 10 digits in the field.
 */

// Strip a possible country-code prefix and any non-digit junk, then cap at 10.
const stripToLocal = (raw, code) => {
  if (!raw) return '';
  let s = String(raw).replace(/\D/g, '');
  // If the string starts with the country code's digits (e.g. "91" for +91),
  // strip them so we display the bare local number.
  const codeDigits = code.replace(/\D/g, '');
  if (codeDigits && s.startsWith(codeDigits) && s.length > codeDigits.length) {
    s = s.slice(codeDigits.length);
  }
  return s.slice(0, 10);
};

const PhoneInput = ({
  label,
  name,
  value = '',
  onChange,
  onBlur,
  error,
  placeholder = '10-digit mobile',
  required = false,
  disabled = false,
  countryCode = '+91',
  className = '',
}) => {
  const [touched, setTouched] = useState(false);

  // Always show just the 10-digit local number; the prefix is rendered separately.
  const localDigits = stripToLocal(value, countryCode);

  const emit = (digits) => {
    if (!onChange) return;
    // Emit the full E.164 string so the backend gets country-tagged data;
    // empty input emits '' (no spurious "+91") so optional fields stay empty.
    const next = digits ? `${countryCode}${digits}` : '';
    onChange({ target: { name, value: next } });
  };

  const handleChange = (e) => {
    emit(e.target.value.replace(/\D/g, '').slice(0, 10));
  };

  const handleBlur = (e) => {
    setTouched(true);
    if (onBlur) onBlur(e);
  };

  // Quiet inline hint when the user typed a partial number — only shown after
  // they've left the field and only if the parent hasn't supplied its own error.
  const showLengthHint =
    !error &&
    touched &&
    localDigits.length > 0 &&
    localDigits.length < 10;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--text-secondary)] ml-1">
          {label}
          {required && <span className="text-[var(--error)] ml-0.5">*</span>}
        </label>
      )}

      <div
        className={`
          relative group flex items-stretch bg-[var(--surface)] border rounded-xl overflow-hidden transition-all duration-200
          focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)]
          ${error ? 'border-[var(--error)] focus-within:border-[var(--error)] focus-within:ring-[var(--error)]' : 'border-[var(--border)]'}
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        {/* Country-code prefix chip */}
        <div className="flex items-center gap-1.5 px-3 bg-[var(--bg)] border-r border-[var(--border)] text-[var(--text-secondary)] text-sm font-bold select-none">
          <Phone size={14} className="text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
          {countryCode}
        </div>

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          name={name}
          value={localDigits}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={10}
          className={`
            flex-1 bg-transparent py-3 px-3 text-sm text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)] outline-none
            ${className}
          `}
        />
      </div>

      {error ? (
        <p className="text-xs text-[var(--error)] ml-1 font-medium animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      ) : showLengthHint ? (
        <p className="text-xs text-[var(--warning)] ml-1 font-medium animate-in fade-in slide-in-from-top-1">
          Must be 10 digits
        </p>
      ) : null}
    </div>
  );
};

export default PhoneInput;
