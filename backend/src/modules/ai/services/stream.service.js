// SSE (Server-Sent Events) helpers. The wire format is the standard
//   event: <name>\n
//   data: <json>\n
//   \n
// On the client we deliberately use fetch + ReadableStream (not the native
// EventSource) because EventSource cannot send custom headers, and we need
// to send Authorization: Bearer.

const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Open an SSE channel on the response. Returns { emit, close, isClosed, onAbort }.
 * Sends an initial comment to flush headers immediately so the client sees
 * the connection open even before the first event.
 */
function openSseChannel(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  res.write(": ok\n\n");

  let closed = false;
  const abortHandlers = [];

  const emit = (type, data) => {
    if (closed) return;
    try {
      const line = `event: ${type}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
      res.write(line);
    } catch {
      closed = true;
    }
  };

  const heartbeat = setInterval(() => {
    if (closed) return;
    try { res.write(": hb\n\n"); } catch { closed = true; }
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    try { res.end(); } catch (_e) { /* socket already gone */ }
  };

  res.on("close", () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    for (const fn of abortHandlers) {
      try { fn(); } catch (_e) { /* ignore */ }
    }
  });

  return {
    emit,
    close,
    isClosed: () => closed,
    onAbort: (fn) => { abortHandlers.push(fn); },
  };
}

module.exports = { openSseChannel };
