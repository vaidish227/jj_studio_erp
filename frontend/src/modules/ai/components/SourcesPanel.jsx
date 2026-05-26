import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const SOURCE_TYPE_LABEL = {
  sop: 'SOP',
  policy: 'Policy',
  manual: 'Manual',
  faq: 'FAQ',
  note: 'Note',
  other: 'Source',
};

const SourcesPanel = ({ citations = [] }) => {
  const [expanded, setExpanded] = useState(false);
  if (!citations.length) return null;

  return (
    <div className="mt-1.5 text-[11px]">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1 text-[var(--text-muted,#A0A0A0)] hover:text-[var(--text,#2E2E2E)] transition-colors"
      >
        <BookOpen className="w-3 h-3" />
        <span>
          {citations.length} source{citations.length === 1 ? '' : 's'}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1.5 border-l-2 border-[var(--primary,#D4B76C)]/40 pl-2">
          {citations.map((c) => (
            <div key={c.chunkId || c.n} className="leading-snug">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[10px] text-[var(--text-muted,#A0A0A0)] flex-shrink-0">
                  [{c.n}]
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-[var(--text,#2E2E2E)]">{c.title}</span>
                    {c.source && (
                      <span className="text-[var(--text-muted,#A0A0A0)]">· {c.source}</span>
                    )}
                    {c.sourceType && c.sourceType !== 'other' && (
                      <span className="px-1 rounded bg-[var(--bg,#F8F7F3)] text-[10px] text-[var(--text-muted,#A0A0A0)]">
                        {SOURCE_TYPE_LABEL[c.sourceType] || c.sourceType}
                      </span>
                    )}
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[var(--accent-blue,#3A6EA5)]"
                        title="Open source"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  {c.excerpt && (
                    <div className="text-[var(--text-muted,#A0A0A0)] mt-0.5 line-clamp-2">
                      {c.excerpt}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourcesPanel;
