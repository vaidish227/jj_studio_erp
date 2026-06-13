import React, { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAIChat } from '../context/AIChatContext';
import ChatPanel from './ChatPanel';

/**
 * Floating action button + drawer mount point. Permission-gating happens
 * one level up in AppLayout.jsx — by the time we render, the user has ai.chat.
 */
const ChatLauncher = () => {
  const { isOpen, toggle, close, refreshConversations } = useAIChat();

  useEffect(() => {
    if (isOpen) refreshConversations();
  }, [isOpen, refreshConversations]);

  // Close on Escape when the drawer is open
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // Demo feature flag — hides the floating AI button entirely.
  // Placed after hooks to satisfy rules-of-hooks.
  if (import.meta.env.VITE_ENABLE_AI !== 'true') return null;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, var(--primary, #D4B76C), #B8965A)',
          color: '#1f1f1f',
        }}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      <ChatPanel />
    </>
  );
};

export default ChatLauncher;
