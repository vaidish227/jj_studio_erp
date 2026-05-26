import React, { useRef } from 'react';
import { User, Sparkles, AlertCircle } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import FeedbackButtons from './FeedbackButtons';
import SourcesPanel from './SourcesPanel';
import RagStatusPill from './RagStatusPill';

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const sourcesRef = useRef(null);

  const onCitationClick = (n) => sourcesRef.current?.highlight?.(n);

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isUser ? 'bg-[var(--bg,#F8F7F3)]' : ''
        }`}
        style={
          isUser
            ? {}
            : { background: 'linear-gradient(135deg, var(--primary, #D4B76C), #B8965A)' }
        }
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-[var(--text-muted,#A0A0A0)]" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-[#1f1f1f]" />
        )}
      </div>

      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-[var(--primary,#D4B76C)] text-[#1f1f1f] rounded-br-sm'
              : isError
              ? 'bg-red-50 text-red-800 border border-red-100 rounded-bl-sm'
              : 'bg-[var(--bg,#F8F7F3)] text-[var(--text,#2E2E2E)] rounded-bl-sm'
          }`}
        >
          {isError && (
            <div className="flex items-center gap-1 mb-1 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> Error
            </div>
          )}
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <div className="prose-sm">
              <MarkdownRenderer onCitationClick={onCitationClick}>
                {message.content || (message.status === 'streaming' ? '…' : '')}
              </MarkdownRenderer>
              {message.status === 'streaming' && (
                <span className="inline-block w-1.5 h-3 ml-0.5 bg-[var(--text,#2E2E2E)] animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {!isUser && message.citations?.length > 0 && (
          <SourcesPanel ref={sourcesRef} citations={message.citations} />
        )}

        {!isUser && (
          <RagStatusPill
            ragRan={message.ragRan}
            ragHits={message.ragHits}
            hasCitations={message.citations?.length > 0}
          />
        )}

        {!isUser && message.status === 'done' && message.id && !String(message.id).startsWith('draft-') && (
          <FeedbackButtons messageId={message.id} />
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
