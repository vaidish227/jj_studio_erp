import React, { useState } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { useToast } from '../../../shared/notifications/ToastProvider';
import useDesignComments from '../hooks/useDesignComments';

const TYPE_LABELS = {
  review_note:       { label: 'Review Note',      color: 'var(--warning)' },
  revision_request:  { label: 'Revision Request', color: 'var(--error)' },
  designer_response: { label: 'Designer Response', color: 'var(--accent-green)' },
  general:           { label: 'Comment',           color: 'var(--accent-blue)' },
};

const ROLE_COLOR = {
  designer:   '#9B59B6',
  manager:    '#4A8F7C',
  md:         '#3A6EA5',
  supervisor: '#E67E22',
  admin:      '#D93025',
};

const fmt = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

const DesignCommentThread = ({ drawingId }) => {
  const toast = useToast();
  const { comments, isLoading, isPosting, error, addComment } = useDesignComments(drawingId);

  const [content, setContent]         = useState('');
  const [commentType, setCommentType] = useState('general');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    const result = await addComment({ content: content.trim(), commentType });
    if (result.ok) {
      setContent('');
      toast.success('Comment added');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
        <MessageCircle size={13} className="text-[var(--accent-blue)]" />
        <span className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
          Review Thread
        </span>
        {!isLoading && (
          <span className="text-[10px] font-bold text-[var(--text-muted)] ml-auto">
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : error ? (
        <p className="text-xs text-[var(--error)] text-center py-3">{error}</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">No comments yet. Start the review discussion.</p>
      ) : (
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {comments.map((c) => {
            const typeCfg = TYPE_LABELS[c.commentType] || TYPE_LABELS.general;
            const roleClr = ROLE_COLOR[c.authorId?.role] || 'var(--text-muted)';
            return (
              <div key={c._id} className="flex gap-2.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5"
                  style={{ background: `color-mix(in srgb, ${roleClr} 15%, transparent)`, color: roleClr }}
                >
                  {(c.authorId?.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {c.authorId?.name || 'Unknown'}
                    </span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        color:      typeCfg.color,
                        background: `color-mix(in srgb, ${typeCfg.color} 12%, transparent)`,
                      }}
                    >
                      {typeCfg.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">{fmt(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-snug whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <select
            value={commentType}
            onChange={(e) => setCommentType(e.target.value)}
            className="text-xs border border-[var(--border)] rounded-lg px-2 py-1.5
                       bg-[var(--surface)] text-[var(--text-secondary)] focus:outline-none
                       focus:border-[var(--primary)] shrink-0"
          >
            <option value="general">Comment</option>
            <option value="review_note">Review Note</option>
            <option value="revision_request">Revision Request</option>
            <option value="designer_response">Designer Response</option>
          </select>
        </div>
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="flex-1 text-sm border border-[var(--border)] rounded-lg px-3 py-2
                       bg-[var(--surface)] text-[var(--text-primary)] resize-none
                       placeholder:text-[var(--text-muted)] focus:outline-none
                       focus:border-[var(--primary)] transition-colors"
          />
          <button
            type="submit"
            disabled={!content.trim() || isPosting}
            className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center
                       self-end disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
          >
            {isPosting
              ? <Loader2 size={14} className="animate-spin text-black" />
              : <Send size={14} className="text-black" />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DesignCommentThread;
