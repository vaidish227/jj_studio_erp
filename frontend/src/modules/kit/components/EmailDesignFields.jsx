import React, { useRef, useState } from 'react';
import { Upload, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';

const fieldClass = 'w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors';
const labelClass = 'block text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5';

// A hex value paired with a native colour swatch. The text box stays editable/clearable
// (empty = inherit for per-template overrides); the swatch falls back to black when blank.
const ColorField = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 shrink-0 rounded-lg border border-[var(--border)] bg-transparent cursor-pointer p-0.5"
        title="Pick a colour"
      />
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '#000000'}
        className={`${fieldClass} flex-1`}
      />
    </div>
  </div>
);

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2.5 cursor-pointer">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
    <span className="text-sm font-bold text-[var(--text-secondary)]">{label}</span>
  </label>
);

/**
 * EmailDesignFields — the shared form for the branded-email frame, used by both
 * the global Email Branding card and the per-template Email Design panel.
 *
 * @param {Object}  design          the email-design object being edited
 * @param {Function} onChange       (patch) => void — merge a partial change
 * @param {boolean} includeToggles  show the Show header / Show footer toggles (global only)
 * @param {boolean} inheritNote     show "leave blank to inherit global" hints (per-template)
 */
const EmailDesignFields = ({ design = {}, onChange, includeToggles = false, inheritNote = false }) => {
  const toast = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const set = (patch) => onChange(patch);

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await kitService.uploadTemplateMedia(fd);
      // apiClient normally unwraps to the response body ({ data: {key,url} }), but be
      // tolerant of either shape so the logo always lands in form state.
      const payload = res?.data?.data || res?.data || res || {};
      const url = payload.url || '';
      const key = payload.key || '';
      if (!url) { toast.error('Upload returned no URL'); return; }
      set({ logoUrl: url, logoKey: key });
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err?.message || 'Logo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const ph = (val) => (inheritNote ? `Inherit (${val})` : val);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ColorField label="Header color" value={design.headerColor} onChange={(v) => set({ headerColor: v })} placeholder={ph('#1f2937')} />
        <ColorField label="Header text color" value={design.headerTextColor} onChange={(v) => set({ headerTextColor: v })} placeholder={ph('#ffffff')} />
      </div>

      <div>
        <label className={labelClass}>Brand text</label>
        <input className={fieldClass} value={design.brandText || ''} onChange={(e) => set({ brandText: e.target.value })} placeholder={ph('JJ Studio')} />
        <p className="text-[11px] text-[var(--text-muted)] mt-1">Shown in the header when no logo is set.</p>
      </div>

      {/* Logo */}
      <div>
        <label className={labelClass}>Header logo (optional)</label>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center overflow-hidden">
            {design.logoUrl
              ? <img src={design.logoUrl} alt="logo" className="max-w-full max-h-full object-contain" />
              : <ImageIcon size={20} className="text-[var(--text-muted)] opacity-40" />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="px-4 py-2">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {design.logoUrl ? 'Replace' : 'Upload'}
          </Button>
          {design.logoUrl && (
            <button type="button" onClick={() => set({ logoUrl: '', logoKey: '' })} title="Remove logo"
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-1">A logo replaces the brand text in the header. PNG with transparency works best.</p>
      </div>

      {/* Body / accent */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ColorField label="Body text color" value={design.bodyTextColor} onChange={(v) => set({ bodyTextColor: v })} placeholder={ph('#333333')} />
        <ColorField label="Link / accent" value={design.accentColor} onChange={(v) => set({ accentColor: v })} placeholder={ph('#1f2937')} />
        <ColorField label="Background" value={design.bgColor} onChange={(v) => set({ bgColor: v })} placeholder={ph('#ffffff')} />
      </div>

      {/* Footer */}
      <div>
        <label className={labelClass}>Footer text</label>
        <input className={fieldClass} value={design.footerText || ''} onChange={(e) => set({ footerText: e.target.value })}
          placeholder={ph('© {{year}} JJ Studio. All rights reserved.')} />
        <p className="text-[11px] text-[var(--text-muted)] mt-1">Use <code>{'{{year}}'}</code> for the current year.</p>
      </div>

      {includeToggles && (
        <div className="flex flex-wrap items-center gap-6 pt-1">
          <Toggle checked={design.showHeader !== false} onChange={(v) => set({ showHeader: v })} label="Show header" />
          <Toggle checked={design.showFooter !== false} onChange={(v) => set({ showFooter: v })} label="Show footer" />
        </div>
      )}
    </div>
  );
};

export default EmailDesignFields;
