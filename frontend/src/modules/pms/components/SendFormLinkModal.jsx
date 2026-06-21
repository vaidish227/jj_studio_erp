import React, { useState } from 'react';
import { Mail, MessageCircle, Copy, Check, Send } from 'lucide-react';
import { Button, Modal } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * SendFormLinkModal — send a form link to the client via Email and/or WhatsApp.
 *
 * Props:
 *   isOpen          — boolean
 *   onClose()       — close handler
 *   formLink        — the ClientFormLink object { _id, token, templateId.title, projectId.name }
 *   defaultEmail    — pre-fill from project client email (optional)
 *   defaultPhone    — pre-fill from project client phone (optional)
 */
const SendFormLinkModal = ({ isOpen, onClose, formLink, defaultEmail = '', defaultPhone = '' }) => {
  const toast = useToast();
  const [email,    setEmail]    = useState(defaultEmail);
  const [phone,    setPhone]    = useState(defaultPhone);
  const [message,  setMessage]  = useState('');
  const [channels, setChannels] = useState({ email: !!defaultEmail, whatsapp: !!defaultPhone });
  const [sending,  setSending]  = useState(false);
  const [copied,   setCopied]   = useState(false);

  const appUrl  = window.location.origin;
  const formUrl = formLink ? `${appUrl}/forms/${formLink.token}` : '';

  const toggleChannel = (ch) => setChannels((prev) => ({ ...prev, [ch]: !prev[ch] }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleSend = async () => {
    if (!channels.email && !channels.whatsapp) {
      toast.error('Select at least one channel (Email or WhatsApp)');
      return;
    }
    if (channels.email && !email.trim()) {
      toast.error('Enter a recipient email address');
      return;
    }
    if (channels.whatsapp && !phone.trim()) {
      toast.error('Enter a recipient phone number');
      return;
    }

    setSending(true);
    try {
      const payload = {
        message: message.trim() || undefined,
        email:   channels.email   ? email.trim()   : undefined,
        phone:   channels.whatsapp ? phone.trim()   : undefined,
      };
      const res = await pmsService.sendFormLink(formLink._id, payload);
      // apiClient unwraps to response.data, so the payload sits directly on res.
      toast.success(res?.message || 'Form link sent!');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const formTitle   = formLink?.templateId?.title || 'Client Form';
  const projectName = formLink?.projectId?.name   || '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Form to Client" className="max-w-lg">
      <div className="space-y-4">

        {/* Form info summary */}
        <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-3">
          <p className="text-xs font-bold text-[var(--text-primary)]">{formTitle}</p>
          {projectName && (
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Project: {projectName}</p>
          )}
        </div>

        {/* Shareable link */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
            Form Link
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] truncate font-mono">
              {formUrl}
            </div>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors shrink-0"
            >
              {copied ? <Check size={13} className="text-[var(--success)]" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Channel selection */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Send Via
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleChannel('email')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                channels.email
                  ? 'bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/40 text-[var(--accent-blue)]'
                  : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)]'
              }`}
            >
              <Mail size={14} />
              Email
            </button>
            <button
              type="button"
              onClick={() => toggleChannel('whatsapp')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                channels.whatsapp
                  ? 'bg-[var(--success)]/10 border-[var(--success)]/40 text-[var(--success)]'
                  : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)]'
              }`}
            >
              <MessageCircle size={14} />
              WhatsApp
            </button>
          </div>
        </div>

        {/* Email input */}
        {channels.email && (
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Email Address <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
            />
          </div>
        )}

        {/* Phone input */}
        {channels.whatsapp && (
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">
              WhatsApp Number <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Include country code, e.g. +91</p>
          </div>
        )}

        {/* Optional message */}
        {(channels.email || channels.whatsapp) && (
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Custom Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Leave blank to use the default message…"
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50 resize-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={sending || (!channels.email && !channels.whatsapp)}
          >
            <Send size={14} />
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SendFormLinkModal;
