# AI Assistant — Prompt Strategy

## System prompt

Owned by [systemPrompt.js](../prompts/systemPrompt.js). Rebuilt every request
with fresh user context. Token budget: ~1500.

Key components:

1. **Identity** — "JJ Studio ERP Assistant", expert co-pilot.
2. **Today's date** — injected so the model can reason about "yesterday", "this week".
3. **Signed-in user context** — name, role, userId, department. The userId is
   **never** trusted as an authorization signal — it's only there so the model
   can phrase responses like "your tasks", not "user X's tasks".
4. **Behavior rules** —
   - Use tools for live data; never fabricate IDs/dates/names.
   - On `not_found`, say so plainly; don't retry with guessed IDs.
   - Respond in user's language (EN / HI / Hinglish).
   - Be terse; use Markdown for scannability.
   - On a permission denial relayed by a tool, courteously decline and don't retry.
   - Refuse write actions in V1.
5. **ERP glossary** — status enums + "what counts as overdue/pending" so the
   model picks the right tool argument without asking.
6. **Caller permissions hint** — top-30 permission strings, informational only.

## Why no separate intent classifier in V1

GPT-4o-mini handles intent + entity extraction + Hindi/Hinglish mixing
natively when given a clear system prompt and well-described tools. A
hand-built classifier in V1 would add:
- another training/maintenance loop,
- latency on every turn,
- a divergence point between "what the classifier picked" and "what the model
  would have picked from tools".

The cost win arrives when query volume is large and ~80% of queries are FAQ-
like — that's V3 territory. By then we'll have the AIMetric / AIToolCall data
to know which prompts to fast-path.

## Model selection heuristic

[promptBuilder.service.js#pickModel](../services/promptBuilder.service.js).
Inputs: message text only. Rules:

- `gpt-4o` if message length > 400 characters.
- `gpt-4o` if matches `\b(summary|summarise|summarize|report|compare|analyse|analyze|breakdown|trend|forecast)\b/i`.
- `gpt-4o` if matches Hindi aggregation tokens `\b(कितने|कुल|रिपोर्ट|सारांश|विश्लेषण)\b`.
- otherwise `gpt-4o-mini`.

Deterministic, zero LLM cost, easy to inspect. V3 will replace with a learned
classifier that also picks tools directly for the top-20% deterministic queries.

## Few-shot

[fewShot.js](../prompts/fewShot.js) — empty in V1. Adding examples adds tokens
to every request; we ship without them, then add as needed when V3 evaluations
identify failure modes.

## Tool descriptions

Each tool's `description` field doubles as a prompt — it teaches the model
*when* to call the tool. Guidelines:

- Start with the action verb ("Get tasks…", "Get full details…").
- Include 2–3 canonical user phrasings ("'my tasks'", "'overdue tasks'", "'kya pending hai'").
- State what the UI does with the result ("UI renders this as a clickable task list").
- Document defaults: "Default 20" prevents the model from passing oversized limits.

The `parameters` JSON Schema is also documentation — `enum` values teach the
model exactly which strings are valid for filters.

## Iteration log

When tuning prompts, append a dated entry below. Avoid silent edits.

| Date | Change | Reason | Effect |
|---|---|---|---|
| 2026-05-26 | Initial V1 prompt | Bootstrap | n/a |
