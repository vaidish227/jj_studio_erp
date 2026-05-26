import React, { useEffect } from 'react';
import { MessageSquare, Plus, X } from 'lucide-react';
import { useAIChat } from '../context/AIChatContext';
import MessageList from './MessageList';
import InputBox from './InputBox';
import ConversationSidebar from './ConversationSidebar';

const ChatPanel = () => {
  const {
    isOpen, close,
    startNewConversation,
    refreshConversations,
    streaming,
  } = useAIChat();

  useEffect(() => {
    if (isOpen) refreshConversations();
  }, [isOpen, refreshConversations]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        onClick={close}
        className="fixed inset-0 z-40 bg-black/30 sm:hidden"
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-label="AI Assistant"
        className="fixed top-0 right-0 z-40 h-screen w-full sm:w-[440px] xl:w-[520px] bg-white shadow-2xl flex flex-col border-l border-[var(--border,#e5e5e5)]"
        style={{ backgroundColor: 'var(--surface, #ffffff)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border,#e5e5e5)]">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--primary, #D4B76C), #B8965A)' }}
            >
              <MessageSquare className="w-4 h-4 text-[#1f1f1f]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--text,#2E2E2E)] text-sm">JJ Studio AI</div>
              <div className="text-[11px] text-[var(--text-muted,#A0A0A0)]">
                {streaming ? 'Thinking…' : 'Ready'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startNewConversation}
              className="p-1.5 rounded-lg hover:bg-[var(--bg,#F8F7F3)] transition-colors"
              title="New conversation"
              aria-label="New conversation"
            >
              <Plus className="w-4 h-4 text-[var(--text-muted,#A0A0A0)]" />
            </button>
            <button
              type="button"
              onClick={close}
              className="p-1.5 rounded-lg hover:bg-[var(--bg,#F8F7F3)] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-[var(--text-muted,#A0A0A0)]" />
            </button>
          </div>
        </div>

        {/* Body — sidebar + chat */}
        <div className="flex flex-1 min-h-0">
          <ConversationSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <MessageList />
            <InputBox />
          </div>
        </div>
      </aside>
    </>
  );
};

export default ChatPanel;
