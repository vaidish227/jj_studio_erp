import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import conversationsService from '../services/conversationsService';

const FeedbackButtons = ({ messageId }) => {
  const [rating, setRating] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const send = async (val) => {
    if (submitting || rating === val) return;
    setSubmitting(true);
    try {
      await conversationsService.feedback(messageId, val);
      setRating(val);
    } catch (_e) {
      // silent — feedback shouldn't block the user
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-1 pl-1">
      <button
        type="button"
        onClick={() => send(1)}
        className={`p-1 rounded transition-colors ${
          rating === 1
            ? 'bg-[var(--accent-teal,#4A8F7C)]/10 text-[var(--accent-teal,#4A8F7C)]'
            : 'text-[var(--text-muted,#A0A0A0)] hover:bg-[var(--bg,#F8F7F3)]'
        }`}
        aria-label="Helpful"
        title="Helpful"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => send(-1)}
        className={`p-1 rounded transition-colors ${
          rating === -1
            ? 'bg-red-50 text-red-600'
            : 'text-[var(--text-muted,#A0A0A0)] hover:bg-[var(--bg,#F8F7F3)]'
        }`}
        aria-label="Not helpful"
        title="Not helpful"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
};

export default FeedbackButtons;
