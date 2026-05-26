import React from 'react';
import { BookOpen, BookX } from 'lucide-react';

/**
 * Tiny pill under an assistant message showing whether RAG ran and how many
 * sources it returned. Lets the user see at a glance whether the answer was
 * grounded in the KB or came from the model's general knowledge.
 *
 * Skipped entirely when ragRan is undefined (e.g. a freshly-loaded historical
 * conversation that predates V2.1).
 */
const RagStatusPill = ({ ragRan, ragHits, hasCitations }) => {
  if (ragRan === undefined) return null;

  // When we have citations, the SourcesPanel already shows count — keep this
  // pill minimal to avoid duplication.
  if (hasCitations) return null;

  if (!ragRan) {
    return (
      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted,#A0A0A0)]/70">
        <BookX className="w-2.5 h-2.5" />
        <span>knowledge base not searched (missing permission)</span>
      </div>
    );
  }

  if ((ragHits || 0) === 0) {
    return (
      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted,#A0A0A0)]">
        <BookOpen className="w-2.5 h-2.5" />
        <span>0 KB sources matched · answered from model knowledge</span>
      </div>
    );
  }
  return null;
};

export default RagStatusPill;
