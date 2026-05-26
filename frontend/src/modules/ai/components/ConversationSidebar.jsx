import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useAIChat } from '../context/AIChatContext';
import conversationsService from '../services/conversationsService';

const ConversationSidebar = () => {
  const {
    conversations,
    conversationId,
    loadConversation,
    refreshConversations,
    startNewConversation,
  } = useAIChat();
  const [collapsed, setCollapsed] = useState(true); // start collapsed to maximize chat space

  const onDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      await conversationsService.remove(id);
      if (id === conversationId) startNewConversation();
      refreshConversations();
    } catch (_e) { /* surfaced elsewhere */ }
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center border-r border-[var(--border,#e5e5e5)] py-2 bg-[var(--bg,#F8F7F3)]">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand conversations"
          className="p-1.5 rounded-lg hover:bg-white transition-colors"
          title="Show conversations"
        >
          <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)]" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-48 border-r border-[var(--border,#e5e5e5)] bg-[var(--bg,#F8F7F3)] min-h-0">
      <div className="flex items-center justify-between px-2 py-2 border-b border-[var(--border,#e5e5e5)]">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#A0A0A0)] font-medium px-1">
          Conversations
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-white transition-colors"
          aria-label="Collapse"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-[var(--text-muted,#A0A0A0)]" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 && (
          <div className="px-3 py-4 text-xs text-[var(--text-muted,#A0A0A0)]">
            No past chats yet.
          </div>
        )}
        {conversations.map((c) => {
          const active = String(c._id) === String(conversationId);
          return (
            <button
              type="button"
              key={c._id}
              onClick={() => loadConversation(c._id)}
              className={`w-full text-left px-2 py-2 text-xs border-b border-transparent hover:bg-white transition-colors group flex items-center gap-1 ${
                active ? 'bg-white border-[var(--border,#e5e5e5)]' : ''
              }`}
              title={c.title}
            >
              <span className="flex-1 truncate text-[var(--text,#2E2E2E)]">{c.title}</span>
              <span
                onClick={(e) => onDelete(c._id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-[var(--text-muted,#A0A0A0)] hover:text-red-600"
                role="button"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationSidebar;
