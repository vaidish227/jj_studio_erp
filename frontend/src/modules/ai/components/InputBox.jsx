import React, { useEffect, useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import { useAIChat } from '../context/AIChatContext';

const MAX_CHARS = 4000;

const InputBox = () => {
  const { send, streaming, stop, error } = useAIChat();
  const [text, setText] = useState('');
  const taRef = useRef(null);

  useEffect(() => {
    if (!streaming) taRef.current?.focus();
  }, [streaming]);

  const onSubmit = () => {
    const t = text.trim();
    if (!t || streaming) return;
    send(t);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Auto-grow textarea
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = 'auto';
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + 'px';
  }, [text]);

  return (
    <div className="border-t border-[var(--border,#e5e5e5)] px-3 py-2.5 bg-[var(--surface,#ffffff)]">
      {error && (
        <div className="mb-2 text-[11px] text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded">
          {error}
        </div>
      )}
      <div className="flex items-end gap-2 bg-[var(--bg,#F8F7F3)] rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--primary,#D4B76C)]/30">
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={onKeyDown}
          placeholder={streaming ? 'Generating response…' : 'Ask anything about your tasks, projects, deadlines…'}
          disabled={streaming}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--text,#2E2E2E)] placeholder:text-[var(--text-muted,#A0A0A0)] outline-none max-h-40 leading-relaxed"
        />
        {streaming ? (
          <button
            type="button"
            onClick={stop}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--text,#2E2E2E)] text-white flex items-center justify-center hover:bg-black transition-colors"
            aria-label="Stop"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5" fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!text.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--primary, #D4B76C)', color: '#1f1f1f' }}
            aria-label="Send"
            title="Send (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="text-[10px] text-[var(--text-muted,#A0A0A0)] mt-1 px-1 flex justify-between">
        <span>Enter to send · Shift+Enter for newline</span>
        <span>{text.length}/{MAX_CHARS}</span>
      </div>
    </div>
  );
};

export default InputBox;
