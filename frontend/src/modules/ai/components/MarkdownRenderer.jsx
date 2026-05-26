import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Render bare-text children, transforming `[n]` substrings into clickable
 * citation chips that anchor to the SourcesPanel entry. We split each text
 * node, only treating runs of [digit(,digit)*] as citation markers. Anything
 * else passes through verbatim, preserving spaces and punctuation.
 */
function renderCitations(text, onClick) {
  if (typeof text !== 'string') return text;
  const CITE_RE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  const parts = [];
  let lastIdx = 0;
  let match;
  while ((match = CITE_RE.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    const numbers = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    parts.push(
      <span key={`cite-${match.index}`} className="inline-flex gap-0.5 align-baseline">
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={(e) => { e.preventDefault(); onClick?.(parseInt(n, 10)); }}
            className="inline-flex items-center justify-center min-w-[1.2rem] px-1 py-[1px] rounded-md bg-[var(--primary,#D4B76C)]/15 text-[var(--text,#2E2E2E)] text-[10px] font-mono leading-tight hover:bg-[var(--primary,#D4B76C)]/35 transition-colors"
            aria-label={`Source ${n}`}
            title={`See source ${n}`}
          >
            {n}
          </button>
        ))}
      </span>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length === 0 ? text : parts;
}

function walkChildren(children, onCitationClick) {
  if (children == null) return children;
  if (typeof children === 'string') return renderCitations(children, onCitationClick);
  if (Array.isArray(children)) return children.map((c, i) => (
    <React.Fragment key={i}>{walkChildren(c, onCitationClick)}</React.Fragment>
  ));
  return children;
}

/**
 * Tightly-styled markdown renderer for assistant responses.
 * GFM enabled for tables / strikethrough. We deliberately do NOT enable raw HTML
 * to keep prompt-injection blast-radius small.
 *
 * onCitationClick(n) fires when the user taps a `[n]` chip — wired by the
 * MessageBubble to scroll/highlight the matching SourcesPanel entry.
 */
const MarkdownRenderer = ({ children, onCitationClick }) => {
  const transform = (c) => walkChildren(c, onCitationClick);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:  ({ children: c, ...props }) => <p className="my-1.5 whitespace-pre-wrap break-words" {...props}>{transform(c)}</p>,
        ul: (props) => <ul className="my-1.5 ml-4 list-disc space-y-0.5" {...props} />,
        ol: (props) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5" {...props} />,
        li: ({ children: c, ...props }) => <li className="leading-snug" {...props}>{transform(c)}</li>,
        h1: ({ children: c, ...props }) => <h3 className="text-base font-semibold mt-2 mb-1" {...props}>{transform(c)}</h3>,
        h2: ({ children: c, ...props }) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props}>{transform(c)}</h4>,
        h3: ({ children: c, ...props }) => <h5 className="text-sm font-semibold mt-1.5 mb-1" {...props}>{transform(c)}</h5>,
        a:  (props) => (
          <a
            {...props}
            target={props.href?.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer noopener"
            className="text-[var(--accent-blue,#3A6EA5)] underline"
          />
        ),
        code: ({ inline, className, children: ch, ...rest }) =>
          inline ? (
            <code className="px-1 py-0.5 rounded bg-black/5 text-[12px] font-mono" {...rest}>{ch}</code>
          ) : (
            <pre className="my-2 p-2 rounded-lg bg-[#1f1f1f] text-[#f5f5f5] text-xs overflow-x-auto">
              <code className={className} {...rest}>{ch}</code>
            </pre>
          ),
        table: (props) => (
          <div className="my-2 overflow-x-auto">
            <table className="text-xs border-collapse" {...props} />
          </div>
        ),
        th: (props) => <th className="border border-[var(--border,#e5e5e5)] px-2 py-1 bg-[var(--bg,#F8F7F3)] font-medium text-left" {...props} />,
        td: (props) => <td className="border border-[var(--border,#e5e5e5)] px-2 py-1" {...props} />,
        blockquote: (props) => (
          <blockquote className="my-1.5 pl-3 border-l-2 border-[var(--primary,#D4B76C)] text-[var(--text-muted,#A0A0A0)]" {...props} />
        ),
      }}
    >
      {String(children || '')}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
