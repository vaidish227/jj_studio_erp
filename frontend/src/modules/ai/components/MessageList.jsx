import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useAIChat } from '../context/AIChatContext';
import MessageBubble from './MessageBubble';
import ToolMessage from './ToolMessage';

const STARTERS = [
  'Show my pending tasks',
  'What is overdue?',
  'My dashboard summary',
  'मेरे काम क्या हैं',
];

const MessageList = () => {
  const { messages, streaming, send } = useAIChat();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streaming]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3">
      {isEmpty && (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'linear-gradient(135deg, var(--primary, #D4B76C), #B8965A)' }}
          >
            <Sparkles className="w-6 h-6 text-[#1f1f1f]" />
          </div>
          <div className="text-sm font-semibold text-[var(--text,#2E2E2E)] mb-1">
            JJ Studio AI Assistant
          </div>
          <div className="text-xs text-[var(--text-muted,#A0A0A0)] mb-4 max-w-xs">
            Ask about your tasks, projects, checklists, deadlines, or get a quick summary.
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {STARTERS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--border,#e5e5e5)] hover:bg-[var(--bg,#F8F7F3)] text-[var(--text,#2E2E2E)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m) => {
        if (m.role === 'tool' || m.role === 'tool_pending') {
          return <ToolMessage key={m.id} message={m} />;
        }
        return <MessageBubble key={m.id} message={m} />;
      })}

      <div ref={endRef} />
    </div>
  );
};

export default MessageList;
