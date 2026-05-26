import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Tightly-styled markdown renderer for assistant responses.
 * GFM enabled for tables / strikethrough. We deliberately do NOT enable raw HTML
 * to keep prompt-injection blast-radius small.
 */
const MarkdownRenderer = ({ children }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:  (props) => <p className="my-1.5 whitespace-pre-wrap break-words" {...props} />,
        ul: (props) => <ul className="my-1.5 ml-4 list-disc space-y-0.5" {...props} />,
        ol: (props) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5" {...props} />,
        li: (props) => <li className="leading-snug" {...props} />,
        h1: (props) => <h3 className="text-base font-semibold mt-2 mb-1" {...props} />,
        h2: (props) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
        h3: (props) => <h5 className="text-sm font-semibold mt-1.5 mb-1" {...props} />,
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
