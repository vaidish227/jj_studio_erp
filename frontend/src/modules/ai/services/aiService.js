// Streaming client for /api/ai/chat.
// We deliberately use fetch + ReadableStream rather than EventSource because
// EventSource cannot send the Authorization header. The wire format matches
// standard SSE (event:/data:/blank-line), so the parser here can be replaced
// with any conformant SSE library later.

import apiClient from '../../../shared/services/apiClient';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * One-shot text polish. Sends raw text to the backend, returns a professionally
 * rewritten version (meaning preserved). Resolves to { ok, polishedText }.
 */
export function polishText(text) {
  return apiClient.post('/ai/polish-text', { text });
}

/**
 * Start a streaming chat request. Returns an object with an `abort` method.
 * Callbacks receive parsed event payloads.
 *
 *   onEvent(type, data) — every event
 *   onToken(delta)      — convenience: only "token" events
 *   onDone(meta)        — fired when "done" is received
 *   onError(err)        — fired on transport error or "error" event
 */
export function streamChat({ message, conversationId, onEvent, onToken, onDone, onError, signal }) {
  const controller = new AbortController();
  const combinedSignal = signal
    ? mergeSignals(signal, controller.signal)
    : controller.signal;

  const token = localStorage.getItem('auth_token') || '';

  fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, conversationId: conversationId || undefined }),
    signal: combinedSignal,
  })
    .then(async (res) => {
      if (!res.ok) {
        let detail = '';
        try { detail = await res.text(); } catch (_e) { /* ignore */ }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error('No response body to stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by a blank line.
        let sepIdx;
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          parseAndDispatch(block, { onEvent, onToken, onDone, onError });
        }
      }
    })
    .catch((err) => {
      if (err?.name === 'AbortError') return;
      onError?.(err);
    });

  return {
    abort: () => controller.abort(),
  };
}

function parseAndDispatch(block, { onEvent, onToken, onDone, onError }) {
  let eventType = 'message';
  const dataLines = [];
  for (const rawLine of block.split('\n')) {
    if (!rawLine || rawLine.startsWith(':')) continue; // comment / heartbeat
    const colonIdx = rawLine.indexOf(':');
    if (colonIdx === -1) continue;
    const field = rawLine.slice(0, colonIdx).trim();
    const val = rawLine.slice(colonIdx + 1).replace(/^ /, '');
    if (field === 'event') eventType = val;
    else if (field === 'data') dataLines.push(val);
  }
  if (dataLines.length === 0) return;

  let payload;
  try { payload = JSON.parse(dataLines.join('\n')); }
  catch { payload = { raw: dataLines.join('\n') }; }

  onEvent?.(eventType, payload);

  if (eventType === 'token' && typeof payload?.delta === 'string') {
    onToken?.(payload.delta);
  } else if (eventType === 'done') {
    onDone?.(payload);
  } else if (eventType === 'error') {
    onError?.(payload);
  }
}

function mergeSignals(a, b) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.any) {
    return AbortSignal.any([a, b]);
  }
  // Fallback for environments without AbortSignal.any
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}

export default { streamChat, polishText };
