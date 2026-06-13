/**
 * Seed the AI knowledge base with a small set of starter documents.
 * Idempotent — safe to re-run; existing matches (same title + content) are
 * skipped automatically by ingestion.service.
 *
 * Usage:
 *   node backend/scripts/seed-ai-documents.js
 *   node backend/scripts/seed-ai-documents.js --reset    (archives existing seeds first)
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const { connectDb } = require("../src/config/db");
const ingestion = require("../src/modules/ai/services/ingestion.service");
const AIDocument = require("../src/modules/ai/models/AIDocument.model");

const RESET = process.argv.includes("--reset");

const DOCS = [
  {
    title: "PMS Task Lifecycle",
    source: "JJ Studio / PMS SOP",
    sourceType: "sop",
    ownerScope: { type: "public" },
    body: `# PMS Task Lifecycle

Every task in the PMS module moves through a well-defined set of statuses. Understanding the
expected transitions is essential for designers, supervisors, and reviewers.

## Statuses

- **not_started** — The task has been created and assigned, but the assignee has not begun work.
- **in_progress** — The assignee is actively working on the task.
- **pending_review** — The designer has submitted their work and is waiting for an internal reviewer
  (typically the PM, PC, or MD).
- **revision_requested** — The reviewer has asked for changes. The task returns to the designer
  with revisionInstructions and a revisionDeadline.
- **pending_client_approval** — Internal review is complete; the client must now approve.
- **approved** — All approvals obtained. Drawings can be released to site.
- **released_to_site** — Drawings have been handed to the site / contractor team.
- **completed** — All work is done and the deliverable is closed.
- **on_hold** — Work is paused. holdReason must be set.

## Definitions

- A task is **pending** if its status is in {not_started, in_progress, revision_requested}.
- A task is **overdue** if dueDate is in the past AND status is not in {completed, approved, released_to_site}.
- A task is **awaiting review** if its status is in {pending_review, pending_client_approval}.

## Transitions
- Designer → submits → pending_review
- Reviewer → approves → approved (or pending_client_approval if client sign-off needed)
- Reviewer → requests revision → revision_requested → designer resumes
- Approved + site-ready → released_to_site → completed`,
  },

  {
    title: "Client Approvals Checklist",
    source: "JJ Studio / Project Operations",
    sourceType: "sop",
    ownerScope: { type: "public" },
    body: `# Client Approvals Checklist

Every residential project requires six mandatory client sign-offs. These are tracked on the
Project document under clientApprovals[] with one entry per type.

## Mandatory approval types

1. **ac** — AC coordination quotation and drawing.
2. **automation** — Home automation scope and quotation.
3. **kitchen** — Kitchen layout, material, and quotation.
4. **bathroom_material** — Bathroom tiles, sanitaryware, and finishes.
5. **cp_fittings** — Chrome-plated fittings (taps, showers, etc.).
6. **wall_floor_material** — General wall and floor material selection.

## Status values per approval

- **pending** — Awaiting client response.
- **obtained** — Client has approved. obtainedAt is set.
- **not_applicable** — Skipped for this project (commercial scope, partial fit-out, etc.).

A project should not be released to execution_phase until all six entries are either obtained
or marked not_applicable. Use the project summary tool to see at-a-glance progress.`,
  },

  {
    title: "Designer Daily Workflow",
    source: "JJ Studio / Design Department",
    sourceType: "manual",
    ownerScope: { type: "role", value: "designer" },
    body: `# Designer Daily Workflow

This is the recommended start-of-day routine for designers (Designer B, C, D, E) working in
the PMS module.

## Morning

1. Open the AI assistant and ask "Show my dashboard" to see today's snapshot:
   - tasks assigned to you, grouped by status
   - upcoming deadlines (next 14 days)
   - any overdue items

2. Resolve overdue items first. If a deadline genuinely cannot be met, update the task
   with a delayReason and inform your supervisor.

3. Open tasks in **revision_requested** status — the reviewer's revisionInstructions
   field tells you exactly what to change.

## During work

- Use the embedded checklist on each task. Tick items as you complete them. The checklist
  is auto-populated based on taskType (kitchen_drawing, technical_drawing, etc.).
- Upload drawings via the Drawings tab. Drawings are versioned automatically.

## End of day

- Submit completed tasks for review. This moves them to **pending_review** and notifies
  the supervisor via mail + WhatsApp.
- Anything blocked should be set to **on_hold** with a holdReason — never leave a blocker
  silent.`,
  },

  {
    title: "Drawing Release Process",
    source: "JJ Studio / Drawing Management",
    sourceType: "sop",
    ownerScope: { type: "public" },
    body: `# Drawing Release Process

Drawings flow through their own lifecycle once a task reaches approved status.

## Statuses

- **draft** — Designer is preparing the drawing. Multiple revisions are normal.
- **sent_for_approval** — Drawing is uploaded and awaiting reviewer sign-off.
- **approved** — Internal approval obtained.
- **revision_requested** — Revision requested with notes. Revision history is preserved.
- **released_to_site** — Drawing has been handed to the site/execution team.

## Who can do what

- **Designers** upload drawings and respond to revision requests.
- **Reviewers (PM/PC/MD)** approve, request revisions, and release to site.
- **Site/Contractor** receives released drawings.

## Versioning

Every upload increments the version number. The previous version is retained in revisionHistory[]
with the original fileUrl, uploadedBy, and uploadedAt. You can always trace back to any earlier
state of a drawing.

## Release rule

A drawing cannot be released_to_site unless its parent task is in status approved (or
released_to_site already). The Drawing controller enforces this.`,
  },

  {
    title: "AI Assistant — Capabilities and Limits",
    source: "JJ Studio / AI",
    sourceType: "faq",
    ownerScope: { type: "public" },
    body: `# AI Assistant — Capabilities and Limits

## What the assistant CAN do today

- Answer questions about your tasks (pending, overdue, by status, by priority).
- Show details for a specific task, including checklist progress.
- Summarize a project's status, team, task counts, and client approval progress.
- Show your personal dashboard — workload, upcoming deadlines, active projects.
- Answer queries in English, Hindi, or Hinglish.
- Respect your role and permissions — you only see what you are entitled to see.

## What the assistant CANNOT do yet

- Perform writes. The current version is read-only. Asking it to "mark a task done", "approve",
  "reassign", "send a mail", or "delete" anything will get a polite refusal with a pointer to the
  relevant ERP screen.
- See content outside your permission scope. If you ask about HR data and you have no HR
  permission, the tool will deny the request and the AI will relay that politely.

## Conversation memory

The assistant remembers the last ~10 messages of the current conversation. It does NOT
remember anything across conversations unless you've explicitly told it (via the user-facts API)
or until the nightly summarizer runs and extracts durable preferences from your chats.

## How to phrase queries

Be specific where you can. "Show my overdue tasks" is faster and more accurate than
"what's going on". For task or project lookups, paste the ID (PRJ-2025-XXXX) when possible.`,
  },
];

async function main() {
  await connectDb();

  if (RESET) {
    console.log("[seed-docs] --reset: archiving previously-seeded docs by title …");
    const titles = DOCS.map((d) => d.title);
    await AIDocument.updateMany(
      { title: { $in: titles }, status: { $ne: "archived" } },
      { $set: { status: "archived" } }
    );
  }

  let ingested = 0, skipped = 0;
  for (const doc of DOCS) {
    try {
      const result = await ingestion.ingestDocument(doc);
      if (result.skipped) {
        console.log(`[seed-docs] skipped (unchanged): ${doc.title}`);
        skipped++;
      } else {
        console.log(`[seed-docs] ingested ${result.chunkCount} chunks: ${doc.title}`);
        ingested++;
      }
    } catch (err) {
      console.error(`[seed-docs] FAILED on "${doc.title}":`, err.message);
    }
  }
  console.log(`[seed-docs] done — ingested ${ingested}, skipped ${skipped}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed-docs] fatal:", err);
  process.exit(1);
});
