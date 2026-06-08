import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, MessageSquare, Calendar, FileText } from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';

const INTEREST_OPTIONS = [
  {
    value: true,
    icon: CheckCircle2,
    label: 'Client is Interested',
    sublabel: 'Ready to receive a proposal',
    color: 'text-[var(--success)]',
    bg: 'bg-[var(--success)]/10 border-[var(--success)]/20',
    activeBg: 'bg-[var(--success)]/20 border-[var(--success)] ring-2 ring-[var(--success)]/30',
  },
  {
    value: false,
    icon: Clock,
    label: 'Needs Follow-up',
    sublabel: 'Not ready yet — schedule follow-up',
    color: 'text-[var(--warning)]',
    bg: 'bg-[var(--warning)]/10 border-[var(--warning)]/20',
    activeBg: 'bg-[var(--warning)]/20 border-[var(--warning)] ring-2 ring-[var(--warning)]/30',
  },
  {
    value: 'lost',
    icon: XCircle,
    label: 'Not Interested',
    sublabel: 'Mark lead as lost',
    color: 'text-[var(--error)]',
    bg: 'bg-[var(--error)]/10 border-[var(--error)]/20',
    activeBg: 'bg-[var(--error)]/20 border-[var(--error)] ring-2 ring-[var(--error)]/30',
  },
];

const MeetingOutcomeModal = ({ isOpen, onClose, meeting, onSave, onRecordMOM }) => {
  const [clientInterested, setClientInterested] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [recordMOMAfter, setRecordMOMAfter] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state whenever the modal opens fresh
  useEffect(() => {
    if (isOpen) {
      setClientInterested(null);
      setOutcome('');
      setFollowUpDate('');
      setRecordMOMAfter(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setClientInterested(null);
    setOutcome('');
    setFollowUpDate('');
    setRecordMOMAfter(false);
    onClose();
  };

  const handleSave = async () => {
    if (clientInterested === null) return;
    setIsSubmitting(true);
    try {
      const payload = {
        outcome,
        clientInterested: clientInterested === 'lost' ? false : clientInterested,
        followUpDate: followUpDate || undefined,
      };
      await onSave(meeting._id, payload, clientInterested === 'lost');

      // If MOM chain requested, hand off to the MOM modal before closing
      if (recordMOMAfter && onRecordMOM) {
        onRecordMOM(meeting);
      }
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const showFollowUp =
    clientInterested === false || clientInterested === 'lost';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Record Meeting Outcome"
      className="max-w-lg"
    >
      <div className="space-y-5">
        {/* Meeting info */}
        {meeting && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
            <Calendar size={16} className="text-[var(--text-muted)] shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-[var(--text-primary)]">
                {meeting.type?.charAt(0).toUpperCase() + meeting.type?.slice(1)} Meeting
              </span>
              <span className="text-[var(--text-muted)] ml-2">
                {meeting.date
                  ? new Date(meeting.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </span>
            </div>
          </div>
        )}

        {/* Interest options */}
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)] mb-3">
            Client outcome <span className="text-[var(--error)]">*</span>
          </p>
          <div className="grid grid-cols-1 gap-2">
            {INTEREST_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = clientInterested === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setClientInterested(opt.value)}
                  className={[
                    'flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-all duration-150',
                    isSelected ? opt.activeBg : opt.bg,
                  ].join(' ')}
                >
                  <Icon size={20} className={opt.color} />
                  <div>
                    <p className={`text-sm font-bold ${opt.color}`}>{opt.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{opt.sublabel}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Outcome notes */}
        <FormField label="Meeting Notes / Outcome">
          <div className="relative">
            <MessageSquare
              size={16}
              className="absolute left-3 top-3 text-[var(--text-muted)]"
            />
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="What was discussed? Client preferences, concerns, next steps..."
              className="w-full pl-9 pr-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] transition-all text-sm min-h-[90px] resize-none"
            />
          </div>
        </FormField>

        {/* Follow-up date (when not interested or lost) */}
        {showFollowUp && (
          <FormField label="Follow-up Date">
            <input
              type="date"
              value={followUpDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] transition-all text-sm"
            />
          </FormField>
        )}

        {/* Interested CTA hint */}
        {clientInterested === true && (
          <div className="flex items-start gap-3 px-4 py-3 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-xl">
            <CheckCircle2 size={16} className="text-[var(--success)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--success)] font-medium">
              Saving will move this lead to <strong>Interested</strong> stage — you can create a
              proposal immediately after.
            </p>
          </div>
        )}

        {/* Record MOM toggle — only if parent supports the chain */}
        {onRecordMOM && (
          <button
            type="button"
            onClick={() => setRecordMOMAfter((v) => !v)}
            className={[
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all',
              recordMOMAfter
                ? 'bg-[var(--primary)]/10 border-[var(--primary)] ring-2 ring-[var(--primary)]/20'
                : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--primary)]/50',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${recordMOMAfter ? 'bg-[var(--primary)] text-black' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
                <FileText size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Record Minutes of Meeting</p>
                <p className="text-xs text-[var(--text-muted)]">Capture attendees, decisions, and action items after saving.</p>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${recordMOMAfter ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${recordMOMAfter ? 'translate-x-4' : ''}`} />
            </div>
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            isLoading={isSubmitting}
            disabled={clientInterested === null}
          >
            {recordMOMAfter ? 'Save & Record MOM' : 'Save Outcome'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MeetingOutcomeModal;
