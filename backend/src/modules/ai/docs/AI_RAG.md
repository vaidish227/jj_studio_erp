# AI Assistant — RAG (V2)

The V2 RAG layer adds permission-aware semantic search over an internal
knowledge base. The model receives the top-K retrieved chunks as numbered
context and is instructed to cite them inline as `[n]`. The UI renders these
citations as a collapsible sources panel under each assistant message.

## Why RAG (and not just tools)

Tool-calling already handles **live operational data** — your tasks, your
projects, real-time status. RAG handles the **stable corpus** the LLM doesn't
need to memorize:

- SOPs, policies, manuals, FAQ entries
- Workflow definitions and glossary
- Internal documentation

The two layers complement each other. A typical conversation pulls from both:

> User: "I have a kitchen drawing that's blocked — what's the right status?"
>
> Assistant uses `getMyTasks` to find the task, retrieves *PMS Task Lifecycle*
> chunk via RAG to explain status semantics, cites it as `[1]`, and recommends
> setting `on_hold` with a `holdReason`.

## End-to-end flow

```
user message
  │
  ▼
orchestrator
  ├─ rag.retrieve(query, user, k=5)
  │     ├─ embedding.embedOne(query)
  │     ├─ Atlas $vectorSearch on ai_document_chunks
  │     │     filtered by metadata.ownerScopeType / ownerScopeValue
  │     ├─ if hits < k → keyword $text fallback + in-process cosine re-rank
  │     └─ returns [{ chunkId, documentId, score, text, title, source, … }]
  │
  ├─ userFactsService.loadFactsForUser(userId)
  │
  ├─ buildMessages({ ..., retrievedChunks, userFacts })
  │     └─ system prompt gets a "Knowledge base" section + "Known user facts"
  │
  ├─ sse.emit('citations', { citations: [...] })   ← UI renders Sources panel
  │
  ├─ openai.streamChat(...)                         ← tokens stream, [n] markers appear
  │
  ├─ persist citations[] on the final assistant AIMessage
  │
  └─ sse.emit('done', { ..., citationCount })
```

## Permission model

Every `AIDocument` carries `ownerScope`:

| `ownerScope.type` | Visible to                                                            |
|---|---|
| `public`          | every user with `ai.docs.read`                                        |
| `role`            | users whose `user.role` matches `ownerScope.value`                    |
| `dept`            | users whose `user.department` matches `ownerScope.value`              |

`ai.docs.read` gates retrieval itself — users without it never trigger RAG.
The orchestrator skips the embed + search entirely (saves cost). Admins (`*`)
get everything.

`rag.service.buildScopeFilter` materializes the OR-of-buckets filter at query
time. The Atlas vector index has `metadata.ownerScopeType` and
`metadata.ownerScopeValue` declared as filter fields so the filter runs in the
index (cheap).

## Atlas Vector Search setup

The vector index is named `ai_vector_idx` on the `ai_document_chunks`
collection. Definition:

```json
{
  "name": "ai_vector_idx",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      { "type": "vector", "path": "embedding", "numDimensions": 1536, "similarity": "cosine" },
      { "type": "filter", "path": "metadata.ownerScopeType" },
      { "type": "filter", "path": "metadata.ownerScopeValue" },
      { "type": "filter", "path": "documentId" }
    ]
  }
}
```

Create it with:

```bash
node backend/scripts/setup-vector-index.js
```

Requires **Atlas M10 or higher**. Atlas builds the index in the background;
it's ready within ~1–2 minutes for small corpora. The script is idempotent.

### Fallback when the index is unavailable

If `$vectorSearch` throws (e.g. you're on a shared cluster or the index is
still building), `rag.service` automatically falls back to a `$text` search
over the same scoped pool and then re-ranks by cosine similarity in process.
This keeps RAG functional on any tier; performance just degrades past ~50k
chunks.

## Ingestion

```bash
node backend/scripts/seed-ai-documents.js          # 5 starter SOPs
node backend/scripts/seed-ai-documents.js --reset  # archives + re-ingests
```

Or via the admin API:

```http
POST /api/ai/documents
Authorization: Bearer <admin token>
Content-Type: application/json

{
  "title": "Vendor Onboarding Checklist",
  "body": "# Vendor Onboarding\n\n...",
  "source": "JJ Studio / Operations",
  "sourceType": "sop",
  "ownerScope": { "type": "public" }
}
```

The ingestor:
1. Splits on Markdown headings to keep sections together.
2. Packs paragraphs to ~500 tokens with ~60 tokens of overlap.
3. Batches embed calls to OpenAI in groups of 96.
4. Persists chunks with denormalized `metadata.ownerScope*` so the vector
   index can filter without a `$lookup`.
5. Is **idempotent** by `(title + body)` SHA-256 hash. Re-ingesting an
   unchanged doc is a no-op. Changing the body archives the prior version
   and writes a fresh one.

## Chunking decisions

- Target **500 tokens**, overlap **~60 tokens**. Empirically tuned for
  GPT-4o-mini's instruction-following on policy/SOP content.
- Headings (`#`, `##`, `###`) start new chunks — this keeps semantic units
  together and lets us populate `metadata.section` for citation context.
- Oversized paragraphs are split on sentence boundaries.

## Citations

Each retrieved chunk gets a 1-based `n`. The orchestrator emits a `citations`
SSE event before streaming starts so the UI can render the Sources panel
immediately. After the turn ends, the citation list is persisted onto the
final assistant `AIMessage.citations`.

The model is instructed (in the system prompt) to cite as `[n]` only when it
actually draws on a snippet. Hallucinated citations are an explicit prompt
violation — if you observe them in production, tighten the instruction.

## Re-embedding

If you change the embedding model, re-embed without re-chunking:

```http
POST /api/ai/documents/:id/reembed
Authorization: Bearer <ai.docs.manage>
```

Or programmatically:

```js
const ingestion = require('./modules/ai/services/ingestion.service');
await ingestion.reembedDocument(documentId);
```

## What V2 deliberately doesn't do

- **Cross-tenant isolation** — single-tenant ERP.
- **Multi-modal docs** — text only; PDFs need to be pre-extracted to Markdown.
- **Auto-ingest of live ERP data** — task descriptions etc. are accessed via
  tool-calling, not RAG. (Option 3 from the V2 plan is deferred to V3 if
  needed.)
- **Streaming embed updates** — embeddings are computed at ingest time, never
  on the fly during chat.
