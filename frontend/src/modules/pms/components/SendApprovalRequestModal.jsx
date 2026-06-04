import React, { useState, useEffect, useMemo } from 'react';
import { Send, MessageCircle, Mail, Copy, Check } from 'lucide-react';
import { Modal, Button, FormField, Input } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import { getLeadDesigner } from '../utils/teamHelpers';

/**
 * SendApprovalRequestModal — Phase 3a.
 *
 * Lets the PM "send for client approval" without copy-pasting from another tool.
 * Pre-fills WhatsApp + mail message templates from the approval type + project.
 *
 * Channels supported:
 *   - WhatsApp: opens `whatsapp://send` deep-link with pre-filled message
 *   - Mail:    opens `mailto:` with subject + body
 *   - Copy:    copy message to clipboard for manual sending
 *
 * After dispatch we don't auto-flip the approval status — the PM still has to
 * record "obtained" once the client actually responds. This modal is a
 * communication helper, not an automation step.
 */

const TYPE_LABELS = {
  furniture_layout:    'Furniture Layout',
  ac:                  'AC Layout',
  automation:          'Automation Design',
  kitchen:             'Kitchen Design',
  bathroom_material:   'Bathroom Material Selection',
  cp_fittings:         'CP Fittings',
  wall_floor_material: 'Wall & Floor Material',
};

const buildMessage = ({ project, type, client }) => {
  const label = TYPE_LABELS[type] || type;
  const projectName = project?.name || 'your project';
  const trackingId = project?.trackingId || '';
  const clientName = client?.name || 'Sir/Ma\'am';
  const designer = getLeadDesigner(project)?.name || 'our team';

  return {
    subject: `Approval needed: ${label} — ${projectName}`,
    body:
      `Dear ${clientName},\n\n` +
      `We are seeking your formal approval on the *${label}* for your project ${projectName}${trackingId ? ` (${trackingId})` : ''}.\n\n` +
      `Kindly review the attached design / drawings shared earlier and confirm your approval at the earliest so we can proceed with the next stage of work.\n\n` +
      `If you have any questions or need clarification, please reach out to ${designer} or reply to this message.\n\n` +
      `Thank you,\n` +
      `JJ Studio`,
  };
};

const SendApprovalRequestModal = ({ project, approvalType, isOpen, onClose }) => {
  const toast = useToast();
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingClient, setLoadingClient] = useState(false);

  // Pre-fill from client + template on open
  useEffect(() => {
    if (!isOpen) return;
    const client = project?.clientId;
    const { subject: s, body: b } = buildMessage({ project, type: approvalType, client });
    setSubject(s);
    setMessage(b);
    if (client && typeof client === 'object') {
      setClientPhone(client.phone || '');
      setClientEmail(client.email || '');
    } else if (project?.clientId) {
      // clientId not populated — fetch it lazily
      setLoadingClient(true);
      // Best effort: assume project includes basic client info; otherwise leave blank
      setLoadingClient(false);
    }
    setCopied(false);
  }, [isOpen, approvalType, project?._id]);

  const waNumber = useMemo(() => (clientPhone || '').replace(/\D/g, ''), [clientPhone]);

  const handleWhatsApp = () => {
    if (!waNumber) {
      toast.error('Add a client WhatsApp number first');
      return;
    }
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleMail = () => {
    if (!clientEmail) {
      toast.error('Add a client email first');
      return;
    }
    const url = `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = url;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success('Message copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Send approval request: ${TYPE_LABELS[approvalType] || approvalType}`} className="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">
          This opens WhatsApp or your mail client with the message pre-filled. Once the client
          confirms, come back and click <strong>Mark Obtained</strong> on the row to record it.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Client WhatsApp">
            <Input
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </FormField>
          <FormField label="Client Email">
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </FormField>
        </div>

        <FormField label="Subject (mail)">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </FormField>

        <FormField label="Message">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none font-mono leading-relaxed"
          />
        </FormField>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <><Check size={13} className="mr-1.5" /> Copied</> : <><Copy size={13} className="mr-1.5" /> Copy</>}
          </Button>
          <Button variant="outline" onClick={handleMail}>
            <Mail size={13} className="mr-1.5" /> Send Email
          </Button>
          <Button onClick={handleWhatsApp}>
            <MessageCircle size={13} className="mr-1.5" /> Send WhatsApp
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SendApprovalRequestModal;
