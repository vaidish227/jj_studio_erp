import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Unlink, Code, Palette,
} from 'lucide-react';

// Returns true when the string is rich HTML (TipTap output); legacy plain-text never starts with a block tag.
const isRichHtml = (content) =>
  /^\s*<[a-z]/i.test(String(content || ''));

// Convert a legacy plain-text body (bare newlines) into paragraph HTML so TipTap can render it correctly.
const normalizeLegacyBody = (html) => {
  if (!html || isRichHtml(html)) return html;
  const escaped = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
};

const btnClass = (active) =>
  `p-1.5 rounded-lg transition-colors text-sm font-bold
   ${active
     ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
     : 'text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)]'}`;

const Divider = () => <span className="w-px h-5 bg-[var(--border)] mx-0.5 self-center" />;

const RichEmailEditor = ({ value, onChange, onFocus, onInsertRef, placeholder }) => {
  const [mode, setMode] = useState('rich');
  const [sourceHtml, setSourceHtml] = useState('');
  const colorInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      // StarterKit v3 already bundles Underline and Link.
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false },
      }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || 'Write your email message here...' }),
    ],
    content: normalizeLegacyBody(value || ''),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: () => {
      onFocus?.();
    },
  });

  // Sync incoming value (e.g. when template loads in edit mode) without resetting cursor on every keystroke.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const normalized = normalizeLegacyBody(value || '');
    if (editor.getHTML() !== normalized) {
      editor.commands.setContent(normalized, false);
    }
  }, [value, editor]);

  // Expose insert function to parent so variable chips can insert at TipTap cursor.
  useEffect(() => {
    if (!editor) return;
    onInsertRef?.((token) => {
      editor.chain().focus().insertContent(token).run();
    });
  }, [editor, onInsertRef]);

  const switchToSource = () => {
    setSourceHtml(editor.getHTML());
    setMode('source');
  };

  const switchToRich = () => {
    editor.commands.setContent(sourceHtml, false);
    onChange(sourceHtml);
    setMode('rich');
  };

  const handleSetLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const href = window.prompt('Enter URL', prev);
    if (href === null) return;
    if (!href) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href }).run();
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] focus-within:border-[var(--primary)] transition-colors overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--bg)]">
        {mode === 'rich' ? (
          <>
            {/* Text style */}
            <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}
              className={btnClass(editor?.isActive('bold'))}>
              <Bold size={14} />
            </button>
            <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}
              className={btnClass(editor?.isActive('italic'))}>
              <Italic size={14} />
            </button>
            <button type="button" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={btnClass(editor?.isActive('underline'))}>
              <UnderlineIcon size={14} />
            </button>
            <button type="button" title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}
              className={btnClass(editor?.isActive('strike'))}>
              <Strikethrough size={14} />
            </button>

            <Divider />

            {/* Headings */}
            {[1, 2, 3].map((level) => (
              <button key={level} type="button" title={`Heading ${level}`}
                onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
                className={btnClass(editor?.isActive('heading', { level }))}>
                <span className="text-[11px] font-black">H{level}</span>
              </button>
            ))}
            <button type="button" title="Paragraph"
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={btnClass(!editor?.isActive('heading'))}>
              <span className="text-[11px] font-black">¶</span>
            </button>

            <Divider />

            {/* Lists */}
            <button type="button" title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={btnClass(editor?.isActive('bulletList'))}>
              <List size={14} />
            </button>
            <button type="button" title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={btnClass(editor?.isActive('orderedList'))}>
              <ListOrdered size={14} />
            </button>

            <Divider />

            {/* Alignment */}
            <button type="button" title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={btnClass(editor?.isActive({ textAlign: 'left' }))}>
              <AlignLeft size={14} />
            </button>
            <button type="button" title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={btnClass(editor?.isActive({ textAlign: 'center' }))}>
              <AlignCenter size={14} />
            </button>
            <button type="button" title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={btnClass(editor?.isActive({ textAlign: 'right' }))}>
              <AlignRight size={14} />
            </button>

            <Divider />

            {/* Link */}
            <button type="button" title="Set link" onClick={handleSetLink}
              className={btnClass(editor?.isActive('link'))}>
              <LinkIcon size={14} />
            </button>
            <button type="button" title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}
              disabled={!editor?.isActive('link')}
              className={btnClass(false) + ' disabled:opacity-30'}>
              <Unlink size={14} />
            </button>

            <Divider />

            {/* Text color */}
            <button type="button" title="Text color"
              onClick={() => colorInputRef.current?.click()}
              className={btnClass(false)}>
              <Palette size={14} />
            </button>
            <input
              ref={colorInputRef}
              type="color"
              className="sr-only"
              defaultValue="#333333"
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
          </>
        ) : (
          <span className="text-xs font-bold text-[var(--text-muted)] px-1">HTML Source</span>
        )}

        {/* Source toggle — always visible */}
        <button type="button" title={mode === 'rich' ? 'Edit raw HTML' : 'Back to rich editor'}
          onClick={mode === 'rich' ? switchToSource : switchToRich}
          className={`${btnClass(mode === 'source')} ml-auto flex items-center gap-1 px-2`}>
          <Code size={14} />
          <span className="text-[11px]">{mode === 'rich' ? 'HTML' : 'Rich'}</span>
        </button>
      </div>

      {/* Editor body */}
      {mode === 'rich' ? (
        <div className="tiptap-editor px-4 py-3 min-h-[200px]">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <textarea
          className="w-full px-4 py-3 min-h-[200px] text-sm font-mono text-[var(--text-primary)] bg-[var(--surface)] outline-none resize-y"
          value={sourceHtml}
          onChange={(e) => setSourceHtml(e.target.value)}
          spellCheck={false}
          placeholder="<p>Enter HTML here...</p>"
        />
      )}
    </div>
  );
};

export default RichEmailEditor;
