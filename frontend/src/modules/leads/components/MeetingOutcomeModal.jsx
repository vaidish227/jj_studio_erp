import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, MessageSquare, Calendar } from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';

const INTEREST_OPTIONS = [
  {
    value: true,
    icon: CheckCircle2,
    label: 'Client is Interested',
    sublabel: 'Ready to receive a proposal',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    activeBg: 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-200',
  },
  {
    value: false,
    icon: Clock,
    label: 'Needs Follow-up',
    sublabel: 'Not ready yet — schedule follow-up',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    activeBg: 'bg-amber-100 border-amber-500 ring-2 ring-amber-200',
  },
  {
    value: 'lost',
    icon: XCircle,
    label: 'Not Interested',
    sublabel: 'Mark lead as lost',
    color: 'text-red-500',
    bg: 'bg-red-50 border-red-200',
    activeBg: 'bg-red-100 border-red-500 ring-2 ring-red-200',
  },
];

const MeetingOutcomeModal = ({ isOpen, onClose, meeting, onSave }) => {
  const [clientInterested, setClientInterested] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setClientInterested(null);
    setOutcome('');
    setFollowUpDate('');
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
            Client outcome <span className="text-red-500">*</span>
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
          <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-700 font-medium">
              Saving will move this lead to <strong>Interested</strong> stage — you can create a
              proposal immediately after.
            </p>
          </div>
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
            Save Outcome
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MeetingOutcomeModal;
