import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { streamChat } from '../services/aiService';
import conversationsService from '../services/conversationsService';

const AIChatContext = createContext(null);

/**
 * AIChatProvider — single source of truth for the chat drawer state.
 *
 * messages structure (in order):
 *   { id, role: 'user' | 'assistant' | 'tool', content, toolCalls?, uiHint?, data?, status? }
 *
 * Streaming model: while an assistant turn is in flight, we maintain a single
 * "draft" assistant message at the tail of `messages` and append token deltas
 * to its content. Tool calls/results are inserted as separate `role:'tool'`
 * entries so the UI can render structured cards inline.
 */
export const AIChatProvider = ({ children }) => {
  const [isOpen, setIsOpen]               = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages]           = useState([]);
  const [streaming, setStreaming]         = useState(false);
  const [error, setError]                 = useState(null);
  const abortRef = useRef(null);

  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const startNewConversation = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  const loadConversation = useCallback(async (id) => {
    if (abortRef.current) abortRef.current.abort();
    setError(null);
    try {
      const { conversation, messages: msgs } = await conversationsService.getOne(id);
      setConversationId(String(conversation._id));
      const adapted = (msgs || [])
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          id: String(m._id),
          role: m.role,
          content: m.content || '',
          toolCalls: m.toolCalls,
          // For write proposals, use the real AIToolCall id (confirmable). Old
          // pre-fix proposals have no actionToolCallId → null, which makes the
          // card render as expired instead of showing dead Confirm/Cancel buttons
          // (the OpenAI call id can't be confirmed). Non-proposal tool messages
          // keep their OpenAI call id unchanged.
          toolCallId: m.uiHint === 'actionProposal' ? (m.actionToolCallId || null) : m.toolCallId,
          uiHint: m.uiHint,
          data: m.uiPayload,
          // Re-hydrate the Confirm/Cancel card's resolved state (done/cancelled/…).
          actionStatus: m.actionStatus,
          actionResultText: m.actionResultText,
          citations: m.citations || [],
          suggestions: m.suggestions || [],
          status: 'done',
          createdAt: m.createdAt,
        }));
      setMessages(adapted);
    } catch (err) {
      setError(err?.message || 'Failed to load conversation');
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const { items } = await conversationsService.list({ limit: 50 });
      setConversations(items || []);
    } catch (_err) {
      // non-fatal
    }
  }, []);

  const send = useCallback((text) => {
    if (!text?.trim() || streaming) return;
    setError(null);

    const userMsg = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      status: 'done',
    };
    const draftAssistantId = `draft-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: draftAssistantId, role: 'assistant', content: '', status: 'streaming' },
    ]);
    setStreaming(true);

    abortRef.current = streamChat({
      message: text,
      conversationId,
      onEvent: (type, payload) => {
        if (type === 'meta' && payload?.conversationId && !conversationId) {
          setConversationId(payload.conversationId);
        } else if (type === 'citations') {
          // Attach citations + RAG status to the draft assistant message so
          // they render alongside the streaming text. `ragRan` is true if the
          // orchestrator actually attempted a retrieval (user has ai.docs.read).
          setMessages((prev) =>
            prev.map((m) =>
              m.id === draftAssistantId
                ? {
                    ...m,
                    citations: payload?.citations || [],
                    ragRan: !!payload?.ragRan,
                    ragHits: payload?.ragHits ?? (payload?.citations?.length || 0),
                  }
                : m
            )
          );
        } else if (type === 'suggestions') {
          // Quick-reply chips parsed out of the assistant text. Attach them
          // to the currently-streaming draft assistant message so the bubble
          // can render clickable buttons under it.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === draftAssistantId
                ? { ...m, suggestions: payload?.items || [] }
                : m
            )
          );
        } else if (type === 'tool_call') {
          setMessages((prev) => [
            ...prev,
            {
              id: `toolcall-${payload.id}`,
              role: 'tool_pending',
              toolCallId: payload.id,
              toolName: payload.name,
              args: payload.args,
              status: 'pending',
            },
          ]);
        } else if (type === 'tool_result') {
          // For write-tool proposals, capture the extra confirmation fields.
          // The role stays as 'tool' but uiHint='actionProposal' tells the UI
          // to render the ConfirmCard instead of a normal result card.
          const isProposal = payload.status === 'pending_confirmation';
          setMessages((prev) =>
            prev.map((m) =>
              m.toolCallId === payload.id && m.role === 'tool_pending'
                ? {
                    ...m,
                    role: 'tool',
                    status: isProposal ? 'pending_confirmation' : (payload.ok ? 'done' : 'error'),
                    ok: payload.ok,
                    error: payload.error,
                    summaryText: payload.summaryText,
                    uiHint: payload.uiHint,
                    data: payload.data,
                    // List-meta for "View all N" deep link (undefined for non-list tools).
                    total: payload.total,
                    viewAllUrl: payload.viewAllUrl,
                    toolName: payload.name || m.toolName,
                    // Write-proposal fields (undefined for read tools)
                    toolCallId: isProposal ? payload.toolCallId : m.toolCallId,
                    proposalDescription: payload.proposalDescription,
                    expiresAt: payload.expiresAt,
                  }
                : m
            )
          );
        }
      },
      onToken: (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === draftAssistantId
              ? { ...m, content: (m.content || '') + delta }
              : m
          )
        );
      },
      onDone: (meta) => {
        if (meta?.conversationId && !conversationId) setConversationId(meta.conversationId);
        if (meta?.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === draftAssistantId
                ? { ...m, id: meta.messageId, status: 'done' }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === draftAssistantId ? { ...m, status: 'done' } : m
            )
          );
        }
        setStreaming(false);
        abortRef.current = null;
        // refresh sidebar in the background
        refreshConversations();
      },
      onError: (err) => {
        const msg = err?.message || (typeof err === 'string' ? err : 'AI request failed');
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === draftAssistantId
              ? { ...m, status: 'error', content: m.content || msg }
              : m
          )
        );
        setStreaming(false);
        abortRef.current = null;
      },
    });
  }, [conversationId, streaming, refreshConversations]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      open, close, toggle,
      conversationId,
      conversations,
      messages,
      streaming,
      error,
      send, stop,
      startNewConversation,
      loadConversation,
      refreshConversations,
    }),
    [isOpen, open, close, toggle, conversationId, conversations, messages, streaming, error, send, stop, startNewConversation, loadConversation, refreshConversations]
  );

  return <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>;
};

export const useAIChat = () => {
  const ctx = useContext(AIChatContext);
  if (!ctx) throw new Error('useAIChat must be used inside <AIChatProvider>');
  return ctx;
};

export default AIChatContext;
