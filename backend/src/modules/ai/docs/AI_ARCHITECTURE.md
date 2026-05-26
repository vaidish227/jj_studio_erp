# AI Assistant — Architecture

## Why RAG + tool-calling, not a fine-tuned model

The ERP's data is (a) live, (b) per-user permission-scoped, and (c) churns
quickly (new tasks every minute). Three reasons fine-tuning would be wrong:

1. **Stale snapshots.** A fine-tuned model freezes the world at training time;
   five minutes later it's lying about your task list.
2. **No RBAC layer.** A fine-tuned model has no concept of permissions. Anything
   it saw during training can leak to anyone with chat access.
3. **Cost & lock-in.** Each schema change forces a retrain.

Tool-calling routes every read through the existing authorization layer:
`requirePermission` middleware + per-tool `permission` declaration + per-handler
Mongo scope filter. The LLM never sees data it has no right to see.

V2 layers RAG on top — but only for stable corpora (SOPs, policies, manuals).
Live operational data continues to flow through tool calls.

## Request flow

```
┌─────────────┐
│ React UI    │  user types
│ ChatPanel   │
└──────┬──────┘
       │ fetch POST /api/ai/chat  (Authorization: Bearer)
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Express                                                           │
│   verifyToken           — JWT -> req.user                         │
│   requirePermission     — loads req.permissions, asserts ai.chat  │
│   aiRateLimit           — 20/min/user, in-memory                  │
│   aiAudit               — request-id, start timestamp             │
│   ai.controller         — opens SSE channel                       │
└──────┬───────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ orchestrator.service                                              │
│  1. memory.loadHistory(convId, token-budget)                      │
│  2. promptBuilder.buildMessages(sys, history, newMsg)             │
│  3. openai.streamChat(model, msgs, tools)                         │
│  4. for-await chunk:                                              │
│       - delta.content  → sse.emit('token')                        │
│       - delta.tool_calls → accumulate                              │
│       - finish_reason='tool_calls':                                │
│            for each call:                                          │
│              executor.run(name, args, ctx) ──┐                     │
│              sse.emit('tool_call' / 'tool_result')                 │
│              append tool message; loop                             │
│       - finish_reason='stop' → break                               │
│  5. persist AIMessage rows + AIMetric                              │
│  6. sse.emit('done'); sse.close()                                  │
└──────┬───────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ tools.executor                                                    │
│  1. lookup tool from registry                                     │
│  2. assert ctx.permissions ⊇ tool.permission                      │
│  3. ajv-validate args (strips unknown keys, applies defaults)     │
│  4. run handler under hardTimeoutMs                                │
│  5. sanitize result (cap strings, strip $-ops, drop __proto__)    │
│  6. persist AIToolCall + activityLogger                            │
│  7. return {ok, data, llmSummary, summaryText, uiHint}            │
└──────────────────────────────────────────────────────────────────┘
```

## File map

```
backend/src/modules/ai/
├── config/aiConfig.js                # frozen env + pricing table
├── models/
│   ├── AIConversation.model.js       # conv header
│   ├── AIMessage.model.js            # role-tagged turns
│   ├── AIToolCall.model.js           # per-invocation audit
│   ├── AIMetric.model.js             # tokens / cost / latency per request
│   └── AIFeedback.model.js           # thumbs-up/down on a message
├── controllers/
│   ├── ai.controller.js              # /chat, /health
│   ├── conversation.controller.js    # CRUD + feedback
│   └── admin.controller.js           # /admin/metrics
├── routes/ai.route.js                # /api/ai mount
├── services/
│   ├── openai.service.js             # SDK wrapper (stream/complete/embed/ping)
│   ├── stream.service.js             # SSE helpers (openSseChannel)
│   ├── orchestrator.service.js       # the big loop
│   ├── memory.service.js             # history loader + token-budget fit
│   ├── promptBuilder.service.js      # message assembly + model picker
│   ├── tools.registry.js             # available tools + OpenAI schema export
│   ├── tools.executor.js             # perm-check + ajv + timeout + audit
│   └── cost.service.js               # token → USD
├── tools/                            # one file per tool
│   ├── getMyTasks.tool.js
│   ├── getTaskDetails.tool.js
│   ├── getOverdueTasks.tool.js
│   ├── getChecklist.tool.js
│   ├── getProjectSummary.tool.js
│   └── getDesignerDashboard.tool.js
├── prompts/
│   ├── systemPrompt.js               # builds the system message
│   ├── fewShot.js                    # empty in V1
│   └── toolDescriptions.js           # reserved for V3
├── middleware/
│   ├── aiRateLimit.middleware.js
│   └── aiAudit.middleware.js
├── validators/chat.validator.js
└── utils/
    ├── tokenizer.js                  # token count + history-fit
    ├── sanitize.js                   # tool-output sanitization
    └── loadPermissions.js            # mirrors auth.middleware logic

frontend/src/modules/ai/
├── context/AIChatContext.jsx         # state: open, messages, streaming
├── services/
│   ├── aiService.js                  # fetch + ReadableStream SSE parser
│   └── conversationsService.js       # CRUD via apiClient
└── components/
    ├── ChatLauncher.jsx              # FAB
    ├── ChatPanel.jsx                 # right-side drawer
    ├── ConversationSidebar.jsx
    ├── MessageList.jsx
    ├── MessageBubble.jsx
    ├── MarkdownRenderer.jsx          # react-markdown + remark-gfm
    ├── ToolMessage.jsx               # tool_call lifecycle (pending/ok/error)
    ├── TaskCard.jsx, ProjectCard.jsx, DashboardCard.jsx, ChecklistCard.jsx
    ├── InputBox.jsx
    └── FeedbackButtons.jsx
```

## Streaming protocol

The HTTP response uses standard SSE:

```
event: meta
data: {"conversationId":"...","requestId":"..."}

event: token
data: {"delta":"Hello "}

event: token
data: {"delta":"there. "}

event: tool_call
data: {"id":"call_abc","name":"getMyTasks","args":{"status":"pending"}}

event: tool_result
data: {"id":"call_abc","ok":true,"summaryText":"4 pending tasks","uiHint":"taskList","data":[...]}

event: done
data: {"conversationId":"...","messageId":"...","tokens":1234,"costUsd":0.0021}
```

The browser cannot use native `EventSource` because EventSource doesn't allow
custom headers — and we need `Authorization: Bearer ...`. We use
`fetch` + `response.body.getReader()` + `TextDecoder` to parse the same wire
format. See [aiService.js](../../../../../frontend/src/modules/ai/services/aiService.js).

## Token budget (V1, gpt-4o-mini)

| Slot                | Budget (tokens) |
|--------------------|---------------:|
| System prompt      | 1500           |
| Tool schemas       | 1000           |
| History            | 4000           |
| Response reserve   | 1500           |
| **Working total**  | **8000**       |

V2 reallocates 1500 of history to retrieved RAG chunks.

## V2 / V3 roadmap

- **V2 (5–7 days)**: AIDocument + AIDocumentChunk models with Atlas
  `$vectorSearch` index; ingestion script for SOPs/policies; hybrid retrieval
  with `ownerScope` filter; citation markers `[1]` resolved by the UI; nightly
  AIUserFact summarizer.
- **V3 (5–7 days)**: cheap pre-classifier for the top-20% of queries (FAQ
  cache + deterministic tool routing); multi-agent (analytics sub-agent owns
  aggregation tools); Hindi/typo prompt expansion + few-shot; admin metrics
  React dashboard.
