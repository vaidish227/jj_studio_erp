import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, ZoomIn, ZoomOut, Maximize2, MousePointer2, Pencil, Square,
  MapPin, Trash2, Eye, MessageSquare, Loader2, AlertCircle, Palette,
  Eraser, Edit2, Save, Undo2, Trash, ArrowLeft, CheckCircle2, GitBranch,
} from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';

// ─── Helpers ───────────────────────────────────────────────────────────────

const isPdfFile = (drawing) => {
  const t = (drawing?.fileType || '').toLowerCase();
  if (t.includes('pdf')) return true;
  const name = (drawing?.fileName || '').toLowerCase();
  return name.endsWith('.pdf');
};

const COLORS = ['#E74C3C', '#F39C12', '#27AE60', '#3498DB', '#9B59B6', '#1A1A2E'];

const STROKE_OPTIONS = [
  { label: 'S', value: 2 },
  { label: 'M', value: 4 },
  { label: 'L', value: 7 },
];

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;
const DRAG_THRESHOLD_PX = 5; // distance below which a "drag" is treated as a click

const fmt = (d) => d
  ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const LABEL_MAX_CHARS = 38;
const truncateForLabel = (s) => {
  const str = String(s || '').replace(/\s+/g, ' ').trim();
  if (str.length <= LABEL_MAX_CHARS) return str;
  return str.slice(0, LABEL_MAX_CHARS - 1) + '…';
};

// ─── Toolbar button ─────────────────────────────────────────────────────────
const ToolButton = ({ active, onClick, title, disabled, children, danger }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed
      ${active
        ? (danger
            ? 'bg-[var(--error)] text-white shadow'
            : 'bg-[var(--primary)] text-black shadow')
        : 'text-white/70 hover:text-white hover:bg-white/10'}`}
  >
    {children}
  </button>
);

// ─── Pin draft popup (used when CREATING a new pin) ────────────────────────
const PinDraftPopup = ({ position, color, onSubmit, onCancel }) => {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className="absolute z-30 bg-[var(--surface)] border border-[var(--border)] rounded-xl
                 shadow-2xl p-3 w-64 space-y-2"
      style={{ left: position.left, top: position.top, transform: 'translate(8px, -50%)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
        <MapPin size={12} style={{ color }} />
        New comment pin
      </div>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe the issue or correction..."
        rows={3}
        className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                   text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1
                   focus:ring-[var(--primary)] resize-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-2 py-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg)]"
        >Cancel</button>
        <button
          type="button"
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={!text.trim()}
          className="text-xs px-3 py-1 rounded-lg bg-[var(--primary)] text-black font-bold
                     hover:opacity-90 disabled:opacity-40"
        >Add</button>
      </div>
    </div>
  );
};

// ─── Pin viewer popup (used when CLICKING an existing pin) ─────────────────
const PinViewerPopup = ({ annotation, position, canEdit, onClose, onSave, onDelete }) => {
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [draft, setDraft] = useState(annotation.comment || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (mode === 'edit') inputRef.current?.focus();
  }, [mode]);

  const handleSave = () => {
    const text = draft.trim();
    if (!text) return;
    onSave(text);
    setMode('view');
  };

  return (
    <div
      className="absolute z-30 bg-[var(--surface)] border border-[var(--border)] rounded-xl
                 shadow-2xl p-3 w-72 space-y-2"
      style={{ left: position.left, top: position.top, transform: 'translate(12px, -50%)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin size={13} style={{ color: annotation.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
            {annotation.createdBy?.name || 'Anonymous'}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">{fmt(annotation.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]"
          title="Close"
        ><X size={12} /></button>
      </div>

      {/* Body */}
      {mode === 'view' ? (
        <p className="text-xs text-[var(--text-secondary)] leading-snug whitespace-pre-wrap
                      px-2 py-1.5 rounded-lg bg-[var(--bg)] min-h-[40px]">
          {annotation.comment || <span className="italic text-[var(--text-muted)]">No comment</span>}
        </p>
      ) : (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                     text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1
                     focus:ring-[var(--primary)] resize-none"
        />
      )}

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center justify-end gap-1 pt-1 border-t border-[var(--border)]">
          {mode === 'view' ? (
            <>
              <button
                type="button"
                onClick={onDelete}
                className="text-xs px-2 py-1 rounded-lg text-[var(--error)] hover:bg-[var(--error)]/10
                           flex items-center gap-1"
              >
                <Trash2 size={11} /> Delete
              </button>
              <button
                type="button"
                onClick={() => { setDraft(annotation.comment || ''); setMode('edit'); }}
                className="text-xs px-2 py-1 rounded-lg text-[var(--primary)] hover:bg-[var(--primary)]/10
                           flex items-center gap-1"
              >
                <Edit2 size={11} /> Edit
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('view')}
                className="text-xs px-2 py-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg)]"
              >Cancel</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!draft.trim()}
                className="text-xs px-3 py-1 rounded-lg bg-[var(--primary)] text-black font-bold
                           hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
              >
                <Save size={11} /> Save
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Clear-all confirmation overlay ─────────────────────────────────────────
const ClearAllConfirm = ({ count, onConfirm, onCancel }) => (
  <div
    className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    onPointerDown={(e) => e.stopPropagation()}
  >
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 max-w-sm shadow-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Trash size={16} className="text-[var(--error)]" />
        <p className="text-sm font-bold text-[var(--text-primary)]">Clear all annotations?</p>
      </div>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
        This will permanently delete all <strong>{count}</strong> annotation{count === 1 ? '' : 's'}
        {' '}on this version. You can't undo this in bulk.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg)]"
        >Cancel</button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--error)] text-white font-bold hover:opacity-90"
        >Delete all</button>
      </div>
    </div>
  </div>
);

// ─── Main modal ─────────────────────────────────────────────────────────────
// revisionMode: markup-first revision flow — defaults to the pen tool and shows
// a "Request Revision" CTA that hands off to the instructions/deadline form
// via onProceedToRevision.
const PreviewDrawingModal = ({
  drawing, isOpen, onClose, version,
  revisionMode = false, onProceedToRevision,
}) => {
  const { hasPermission, user } = useAuth();
  const toast = useToast();

  const targetVersion = version != null ? version : drawing?.version;
  const canAnnotate   = hasPermission?.('drawings.approve') ?? false;
  const hasOverride   = hasPermission?.('drawings.release') ?? false;
  const isPdf         = isPdfFile(drawing);

  // ── File / signed URL ──────────────────────────────────────────────────
  const [fileUrl, setFileUrl]         = useState(null);
  const [loadingFile, setLoadingFile] = useState(true);
  const [fileError, setFileError]     = useState(null);

  // ── Image intrinsic size ──────────────────────────────────────────────
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const imgRef = useRef(null);

  // ── Zoom / pan ─────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart  = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // ── Tool state ─────────────────────────────────────────────────────────
  const [tool, setTool]               = useState('cursor'); // cursor|pen|rectangle|pin|eraser
  const [color, setColor]             = useState('#E74C3C');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [inFlight, setInFlight]       = useState(null);
  const [pinDraft, setPinDraft]       = useState(null); // {norm, screen}
  const [viewingPin, setViewingPin]   = useState(null); // annotationId

  // Generic annotation drag state — works for pin, rectangle, and pen.
  // Shape: { id, type, sx, sy, cursorAtStart: {x,y}, original: shape-data }
  const [draggingAnn, setDraggingAnn] = useState(null);
  const dragMovedRef = useRef(false);

  // ── Annotations ────────────────────────────────────────────────────────
  const [annotations, setAnnotations] = useState([]);
  const [loadingAnns, setLoadingAnns] = useState(false);
  const [selectedAnn, setSelectedAnn] = useState(null);

  // Undo stack — entries are { id } for created annotations
  const [undoStack, setUndoStack] = useState([]);

  // Clear-all confirm
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Inline pin comment labels (toggled from the toolbar)
  const [showLabels, setShowLabels] = useState(true);

  // Save button confirmation flash (everything auto-saves; this just reassures the user).
  const [saveFlash, setSaveFlash] = useState(false);
  const saveFlashTimer = useRef(null);
  useEffect(() => () => { if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current); }, []);

  const viewportRef = useRef(null);

  const canEditAnnotation = useCallback(
    (a) => a?.createdBy?._id === user?._id || hasOverride,
    [user?._id, hasOverride]
  );

  // ── Reset state when modal opens/closes ───────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setZoom(1); setPan({ x: 0, y: 0 });
    setTool(revisionMode && canAnnotate && !isPdf ? 'pen' : 'cursor');
    setInFlight(null);
    setPinDraft(null); setViewingPin(null);
    setDraggingAnn(null); setSelectedAnn(null);
    setUndoStack([]); setShowClearConfirm(false);
  }, [isOpen, drawing?._id]);

  // ── Fetch signed URL ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !drawing?._id) return;
    setLoadingFile(true); setFileError(null); setFileUrl(null);
    const opts = (targetVersion != null && targetVersion !== drawing.version)
      ? { historyVersion: targetVersion } : undefined;
    pmsService.getDrawingPreviewUrl(drawing._id, opts)
      .then((res) => setFileUrl(res?.url || null))
      .catch((err) => setFileError(err?.message || 'Could not load file'))
      .finally(() => setLoadingFile(false));
  }, [isOpen, drawing?._id, targetVersion, drawing?.version]);

  // ── Fetch annotations ─────────────────────────────────────────────────
  const loadAnnotations = useCallback(async () => {
    if (!drawing?._id) return;
    setLoadingAnns(true);
    try {
      const res = await pmsService.listDrawingAnnotations(drawing._id, targetVersion);
      setAnnotations(res.annotations || []);
    } catch {
      setAnnotations([]);
    } finally {
      setLoadingAnns(false);
    }
  }, [drawing?._id, targetVersion]);

  useEffect(() => { if (isOpen) loadAnnotations(); }, [isOpen, loadAnnotations]);

  // ── Image load ─────────────────────────────────────────────────────────
  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // ── Coord helpers ──────────────────────────────────────────────────────
  const getNormCoords = useCallback((e) => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp((e.clientX - rect.left) / rect.width,  0, 1),
      y: clamp((e.clientY - rect.top)  / rect.height, 0, 1),
    };
  }, []);

  // Pixel position (within viewport) for popups, given normalized pin coords
  const popupScreenPos = useCallback((norm) => {
    const img = imgRef.current;
    const view = viewportRef.current;
    if (!img || !view) return { left: 0, top: 0 };
    const imgRect  = img.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    return {
      left: (imgRect.left - viewRect.left) + norm.x * imgRect.width,
      top:  (imgRect.top  - viewRect.top)  + norm.y * imgRect.height,
    };
  }, []);

  // ── Zoom controls ──────────────────────────────────────────────────────
  const zoomIn    = () => setZoom((z) => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM));
  const zoomOut   = () => setZoom((z) => clamp(z / 1.25, MIN_ZOOM, MAX_ZOOM));
  const zoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom((z) => clamp(z * factor, MIN_ZOOM, MAX_ZOOM));
  };

  // ── Persistence helpers ────────────────────────────────────────────────
  const commitAnnotation = async (shape) => {
    try {
      const res = await pmsService.createDrawingAnnotation(drawing._id, {
        drawingVersion: targetVersion,
        color,
        strokeWidth,
        ...shape,
      });
      setAnnotations((prev) => [...prev, res.annotation]);
      // Track for undo (only creates — deletes/edits aren't undoable in V1)
      setUndoStack((prev) => [...prev, { id: res.annotation._id }]);
    } catch (err) {
      toast.error(err?.message || 'Failed to save annotation');
    }
  };

  const handleDelete = useCallback(async (annotationId) => {
    try {
      await pmsService.deleteDrawingAnnotation(annotationId);
      setAnnotations((prev) => prev.filter((a) => a._id !== annotationId));
      setSelectedAnn((s) => (s === annotationId ? null : s));
      setViewingPin((s) => (s === annotationId ? null : s));
      // Drop from undo stack if present
      setUndoStack((prev) => prev.filter((u) => u.id !== annotationId));
    } catch (err) {
      toast.error(err?.message || 'Failed to delete annotation');
    }
  }, [toast]);

  const handleUpdate = useCallback(async (annotationId, patch, opts = {}) => {
    try {
      const res = await pmsService.updateDrawingAnnotation(annotationId, patch);
      setAnnotations((prev) => prev.map((a) => (a._id === annotationId ? res.annotation : a)));
      if (opts.toast) toast.success(opts.toast);
    } catch (err) {
      toast.error(err?.message || 'Failed to update annotation');
      // Reload on failure so the local state matches the server
      loadAnnotations();
    }
  }, [toast, loadAnnotations]);

  // ── Pin handlers ───────────────────────────────────────────────────────
  const handlePinDraftSubmit = async (comment) => {
    if (!pinDraft) return;
    const { norm } = pinDraft;
    setPinDraft(null);
    await commitAnnotation({ type: 'pin', point: norm, comment });
  };

  const handlePinEdit = (annotation, newComment) =>
    handleUpdate(annotation._id, { comment: newComment }, { toast: 'Pin updated' });

  // ── Annotation pointer handlers ────────────────────────────────────────
  const onAnnotationPointerDown = (e, a) => {
    e.stopPropagation();

    // Eraser tool: delete on click
    if (tool === 'eraser') {
      if (!canEditAnnotation(a)) {
        toast.error("You can't erase someone else's annotation");
        return;
      }
      handleDelete(a._id);
      return;
    }

    // Any non-eraser tool: existing annotations are interactive (drag /
    // click) — you don't have to switch to the cursor tool first. This
    // means clicking a freshly placed pin while still in pin-mode picks
    // it up to move, instead of being a no-op.
    if (canEditAnnotation(a)) {
      const c = getNormCoords(e);
      if (!c) {
        setSelectedAnn(a._id);
        return;
      }
      // Snapshot the geometry at drag start; drag math is "original + cursor delta"
      // so the pointer maintains its grab offset regardless of zoom or shape size.
      const original = a.type === 'pin'       ? { point:  { ...a.point } }
                     : a.type === 'rectangle' ? { rect:   { ...a.rect  } }
                     : a.type === 'pen'       ? { points: (a.points || []).map((p) => ({ ...p })) }
                     : null;
      if (!original) {
        setSelectedAnn(a._id);
        return;
      }
      setDraggingAnn({
        id:            a._id,
        type:          a.type,
        sx:            e.clientX,
        sy:            e.clientY,
        cursorAtStart: c,
        original,
      });
      dragMovedRef.current = false;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }

    // Read-only viewer for pins you can't edit
    if (a.type === 'pin') {
      setViewingPin(a._id);
      return;
    }

    // Otherwise: just select
    setSelectedAnn(a._id);
  };

  // ── Canvas pointer handlers ────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (isPdf) return;
    if (pinDraft || viewingPin || showClearConfirm) return;
    if (e.button !== 0) return;

    if (tool === 'cursor') {
      // Clear selection on empty canvas click
      setSelectedAnn(null);
      isPanning.current = true;
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === 'eraser') return; // eraser only deletes via annotation handlers

    if (!canAnnotate) return;
    const c = getNormCoords(e);
    if (!c) return;

    if (tool === 'pen') {
      setInFlight({ type: 'pen', points: [c] });
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } else if (tool === 'rectangle') {
      setInFlight({ type: 'rectangle', start: c, end: c });
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } else if (tool === 'pin') {
      const screen = popupScreenPos(c);
      setPinDraft({ norm: c, screen });
    }
  };

  const onPointerMove = (e) => {
    // Generic annotation drag (pin / rect / pen)
    if (draggingAnn) {
      const pxdx = e.clientX - draggingAnn.sx;
      const pxdy = e.clientY - draggingAnn.sy;
      if (Math.abs(pxdx) > DRAG_THRESHOLD_PX || Math.abs(pxdy) > DRAG_THRESHOLD_PX) {
        dragMovedRef.current = true;
      }
      if (dragMovedRef.current) {
        const c = getNormCoords(e);
        if (!c) return;
        // Normalized cursor delta from drag start — applied to the
        // snapshotted geometry. This translates the whole shape rigidly.
        const dx = c.x - draggingAnn.cursorAtStart.x;
        const dy = c.y - draggingAnn.cursorAtStart.y;

        let patch = null;
        if (draggingAnn.type === 'pin') {
          patch = {
            point: {
              x: clamp(draggingAnn.original.point.x + dx, 0, 1),
              y: clamp(draggingAnn.original.point.y + dy, 0, 1),
            },
          };
        } else if (draggingAnn.type === 'rectangle') {
          const r = draggingAnn.original.rect;
          // Keep size unchanged; clamp so the rect can't leave the image.
          patch = {
            rect: {
              x: clamp(r.x + dx, 0, Math.max(0, 1 - r.w)),
              y: clamp(r.y + dy, 0, Math.max(0, 1 - r.h)),
              w: r.w,
              h: r.h,
            },
          };
        } else if (draggingAnn.type === 'pen') {
          // Clamp by the stroke's bounding box so no point falls off-canvas
          const xs = draggingAnn.original.points.map((p) => p.x);
          const ys = draggingAnn.original.points.map((p) => p.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          const cdx = clamp(dx, -minX, 1 - maxX);
          const cdy = clamp(dy, -minY, 1 - maxY);
          patch = {
            points: draggingAnn.original.points.map((p) => ({
              x: p.x + cdx,
              y: p.y + cdy,
            })),
          };
        }

        if (patch) {
          setAnnotations((prev) =>
            prev.map((a) => (a._id === draggingAnn.id ? { ...a, ...patch } : a))
          );
        }
      }
      return;
    }

    if (isPanning.current) {
      const dx = e.clientX - panStart.current.mx;
      const dy = e.clientY - panStart.current.my;
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
      return;
    }
    if (!inFlight) return;
    const c = getNormCoords(e);
    if (!c) return;
    if (inFlight.type === 'pen') {
      setInFlight((s) => ({ ...s, points: [...s.points, c] }));
    } else if (inFlight.type === 'rectangle') {
      setInFlight((s) => ({ ...s, end: c }));
    }
  };

  const onPointerUp = async (e) => {
    // Generic annotation drag end
    if (draggingAnn) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      const id = draggingAnn.id;
      const type = draggingAnn.type;
      if (dragMovedRef.current) {
        // Persist the new geometry — patch only the field for this type
        const moved = annotations.find((a) => a._id === id);
        if (moved) {
          if (type === 'pin' && moved.point) {
            handleUpdate(id, { point: moved.point });
          } else if (type === 'rectangle' && moved.rect) {
            handleUpdate(id, { rect: moved.rect });
          } else if (type === 'pen' && moved.points?.length) {
            handleUpdate(id, { points: moved.points });
          }
        }
      } else if (type === 'pin') {
        // Click (no drag) on a pin → open viewer
        setViewingPin(id);
      } else {
        // Click on rect / pen → just select
        setSelectedAnn(id);
      }
      setDraggingAnn(null);
      dragMovedRef.current = false;
      return;
    }

    if (isPanning.current) {
      isPanning.current = false;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      return;
    }
    if (!inFlight) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    try {
      if (inFlight.type === 'pen' && inFlight.points.length >= 2) {
        await commitAnnotation({ type: 'pen', points: inFlight.points });
      } else if (inFlight.type === 'rectangle') {
        const r = {
          x: Math.min(inFlight.start.x, inFlight.end.x),
          y: Math.min(inFlight.start.y, inFlight.end.y),
          w: Math.abs(inFlight.end.x - inFlight.start.x),
          h: Math.abs(inFlight.end.y - inFlight.start.y),
        };
        if (r.w > 0.005 && r.h > 0.005) {
          await commitAnnotation({ type: 'rectangle', rect: r });
        }
      }
    } finally {
      setInFlight(null);
    }
  };

  // ── Undo (Ctrl/Cmd + Z) ────────────────────────────────────────────────
  const handleUndo = useCallback(async () => {
    if (!undoStack.length) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    try {
      await pmsService.deleteDrawingAnnotation(last.id);
      setAnnotations((prev) => prev.filter((a) => a._id !== last.id));
    } catch (err) {
      toast.error(err?.message || 'Undo failed');
      // Restore the stack entry on failure
      setUndoStack((prev) => [...prev, last]);
    }
  }, [undoStack, toast]);

  // ── Clear all ──────────────────────────────────────────────────────────
  const handleClearAll = async () => {
    const targets = annotations.filter(canEditAnnotation);
    setShowClearConfirm(false);
    if (!targets.length) return;
    const ids = targets.map((a) => a._id);
    // Optimistic clear; rollback any that fail
    setAnnotations((prev) => prev.filter((a) => !ids.includes(a._id)));
    setUndoStack((prev) => prev.filter((u) => !ids.includes(u.id)));
    const failed = [];
    for (const id of ids) {
      try { await pmsService.deleteDrawingAnnotation(id); }
      catch { failed.push(id); }
    }
    if (failed.length) {
      toast.error(`${failed.length} annotation${failed.length === 1 ? '' : 's'} could not be deleted`);
      loadAnnotations();
    }
  };

  // ── Save (confirms everything is persisted) ────────────────────────────
  // Every action auto-saves; this gives the reviewer an explicit "I'm done"
  // checkpoint. We refresh from the server too, so any concurrent edits by
  // another reviewer become visible.
  const handleSave = useCallback(async () => {
    try {
      await loadAnnotations();
      const n = annotations.length;
      toast.success(`All annotations saved (${n} item${n === 1 ? '' : 's'})`);
      setSaveFlash(true);
      if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
      saveFlashTimer.current = setTimeout(() => setSaveFlash(false), 1800);
    } catch (err) {
      toast.error(err?.message || 'Could not verify save');
    }
  }, [loadAnnotations, annotations.length, toast]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      const target = e.target;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'Escape') {
        if (pinDraft) { setPinDraft(null); return; }
        if (viewingPin) { setViewingPin(null); return; }
        if (showClearConfirm) { setShowClearConfirm(false); return; }
        onClose?.();
        return;
      }

      // Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !inField) {
        e.preventDefault();
        handleSave();
        return;
      }

      // Single-key tool shortcuts (ignore when typing or holding modifiers)
      if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'v')                  setTool('cursor');
      else if (k === 'p' && canAnnotate) setTool('pen');
      else if (k === 'r' && canAnnotate) setTool('rectangle');
      else if (k === 'm' && canAnnotate) setTool('pin');
      else if (k === 'e' && canAnnotate) setTool('eraser');
      else if (k === '+' || k === '=') zoomIn();
      else if (k === '-' || k === '_') zoomOut();
      else if (k === '0')              zoomReset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, pinDraft, viewingPin, showClearConfirm, handleUndo, handleSave, onClose, canAnnotate]);

  // ── SVG render helpers ────────────────────────────────────────────────
  const viewBox = imgSize.w && imgSize.h ? `0 0 ${imgSize.w} ${imgSize.h}` : '0 0 1000 1000';
  const renderStrokeWidth = (w) =>
    Math.max(1, (w || 2) * Math.min(imgSize.w, imgSize.h) / 600);

  // Cursor for the viewport based on the tool / drag state
  const viewportCursor = useMemo(() => {
    if (isPdf) return 'default';
    if (draggingAnn) return 'grabbing';
    if (tool === 'cursor') return isPanning.current ? 'grabbing' : 'grab';
    if (tool === 'eraser') return 'cell';
    return 'crosshair';
  }, [tool, isPdf, draggingAnn]);

  const viewingPinAnn = useMemo(
    () => annotations.find((a) => a._id === viewingPin) || null,
    [annotations, viewingPin]
  );

  if (!isOpen || !drawing) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col" role="dialog" aria-modal>

      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-black/60 border-b border-white/10
                      backdrop-blur-md shrink-0">
        <button
          type="button"
          onClick={onClose}
          title="Back (Esc)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                     border border-white/15 text-white/80 hover:bg-white/10 hover:text-white
                     transition-colors"
        >
          <ArrowLeft size={13} /> Back
        </button>
        <Eye size={16} className="text-[var(--primary)]" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{drawing.title}</p>
          <p className="text-[10px] text-white/50">
            v{targetVersion}
            {drawing.projectId?.name ? ` · ${drawing.projectId.name}` : ''}
            {drawing.fileName ? ` · ${drawing.fileName}` : ''}
          </p>
        </div>

        {revisionMode && (
          <span className="hidden md:inline-flex shrink-0 items-center text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/25">
            Mark the changes, then continue
          </span>
        )}

        {/* Zoom (images only) */}
        {!isPdf && (
          <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white/5">
            <ToolButton onClick={zoomOut} title="Zoom out (-)"><ZoomOut size={15} /></ToolButton>
            <span className="text-[10px] font-bold text-white/80 px-1 min-w-[36px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <ToolButton onClick={zoomIn} title="Zoom in (+)"><ZoomIn size={15} /></ToolButton>
            <ToolButton onClick={zoomReset} title="Reset view (0)"><Maximize2 size={15} /></ToolButton>
          </div>
        )}

        {/* Tool palette */}
        {!isPdf && canAnnotate && (
          <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white/5">
            <ToolButton active={tool === 'cursor'}    onClick={() => setTool('cursor')}    title="Select / pan (V)"><MousePointer2 size={15} /></ToolButton>
            <ToolButton active={tool === 'pen'}       onClick={() => setTool('pen')}       title="Pen (P)"><Pencil size={15} /></ToolButton>
            <ToolButton active={tool === 'rectangle'} onClick={() => setTool('rectangle')} title="Rectangle (R)"><Square size={15} /></ToolButton>
            <ToolButton active={tool === 'pin'}       onClick={() => setTool('pin')}       title="Comment pin (M)"><MapPin size={15} /></ToolButton>
            <ToolButton active={tool === 'eraser'}    onClick={() => setTool('eraser')}    title="Eraser (E)" danger><Eraser size={15} /></ToolButton>
          </div>
        )}

        {/* Colour + stroke */}
        {!isPdf && canAnnotate && (tool === 'pen' || tool === 'rectangle' || tool === 'pin') && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5">
            <Palette size={13} className="text-white/60" />
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={`w-4 h-4 rounded-full border-2 transition-transform
                    ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {tool !== 'pin' && (
              <div className="flex items-center gap-0.5 ml-1">
                {STROKE_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStrokeWidth(s.value)}
                    className={`w-6 h-6 rounded text-[10px] font-bold transition-colors
                      ${strokeWidth === s.value
                        ? 'bg-[var(--primary)] text-black'
                        : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                  >{s.label}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Show / hide inline pin comment labels */}
        {!isPdf && (
          <ToolButton
            active={showLabels}
            onClick={() => setShowLabels((v) => !v)}
            title={showLabels ? 'Hide pin comments' : 'Show pin comments'}
          >
            <MessageSquare size={15} />
          </ToolButton>
        )}

        {/* Undo */}
        {!isPdf && canAnnotate && (
          <ToolButton
            onClick={handleUndo}
            disabled={!undoStack.length}
            title="Undo last (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </ToolButton>
        )}

        {/* Save — explicit, labeled action */}
        {!isPdf && canAnnotate && (
          <button
            type="button"
            onClick={handleSave}
            title="Save (Ctrl+S) — confirms all changes are persisted"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                        ml-2 transition-all
                        ${saveFlash
                          ? 'bg-[var(--success)] text-white'
                          : 'bg-[var(--primary)] text-black hover:opacity-90'}`}
          >
            {saveFlash
              ? (<><CheckCircle2 size={13} /> Saved</>)
              : (<><Save size={13} /> Save</>)}
          </button>
        )}

        {revisionMode && (
          <button
            type="button"
            onClick={onProceedToRevision}
            title="Continue — add revision instructions & deadline"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                       ml-1.5 bg-[var(--warning)] text-white hover:opacity-90 transition-all"
          >
            <GitBranch size={13} /> Request Revision
          </button>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Viewport */}
        <div
          ref={viewportRef}
          className="relative flex-1 overflow-hidden bg-[#1a1a1a] select-none"
          onWheel={handleWheel}
          style={{ cursor: viewportCursor }}
        >
          {loadingFile && (
            <div className="absolute inset-0 flex items-center justify-center text-white/60">
              <Loader2 size={28} className="animate-spin" />
            </div>
          )}

          {fileError && !loadingFile && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
              <AlertCircle size={28} />
              <p className="text-sm">{fileError}</p>
            </div>
          )}

          {/* PDF */}
          {!loadingFile && !fileError && fileUrl && isPdf && (
            <iframe title={drawing.title} src={fileUrl} className="w-full h-full border-0" />
          )}

          {/* Image + annotation overlay */}
          {!loadingFile && !fileError && fileUrl && !isPdf && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="relative"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isPanning.current || inFlight || draggingAnn ? 'none' : 'transform 0.15s ease-out',
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  ref={imgRef}
                  src={fileUrl}
                  alt={drawing.title}
                  onLoad={handleImageLoad}
                  draggable={false}
                  className="block max-w-[90vw] max-h-[80vh] object-contain pointer-events-none"
                />

                {/* SVG annotation overlay */}
                {imgSize.w > 0 && (
                  <svg
                    viewBox={viewBox}
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    {annotations.map((a) => {
                      const sw = renderStrokeWidth(a.strokeWidth);
                      const isSel  = selectedAnn === a._id;
                      const isErase = tool === 'eraser';
                      const opacity = isErase ? 0.55 : (isSel ? 1 : 0.95);

                      // Existing annotations are draggable from any non-eraser tool,
                      // so the grab cursor shows even when a drawing tool is active.
                      const isDraggable = tool !== 'eraser' && canEditAnnotation(a);
                      const isBeingDragged = draggingAnn?.id === a._id;
                      const hitProps = {
                        style: {
                          pointerEvents: 'auto',
                          cursor: isErase
                            ? 'not-allowed'
                            : isDraggable
                              ? (isBeingDragged ? 'grabbing' : 'grab')
                              : 'pointer',
                        },
                        onPointerDown: (e) => onAnnotationPointerDown(e, a),
                      };

                      const stroke = isErase ? '#ff5252' : a.color;
                      const baseProps = {
                        stroke,
                        strokeWidth: sw * (isErase ? 1.25 : 1),
                        fill: 'none',
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        opacity,
                        ...hitProps,
                      };

                      if (a.type === 'pen' && a.points?.length > 1) {
                        const d = a.points.map((p, i) =>
                          `${i === 0 ? 'M' : 'L'} ${p.x * imgSize.w} ${p.y * imgSize.h}`
                        ).join(' ');
                        return <path key={a._id} d={d} {...baseProps} />;
                      }
                      if (a.type === 'rectangle' && a.rect) {
                        return (
                          <rect
                            key={a._id}
                            x={a.rect.x * imgSize.w}
                            y={a.rect.y * imgSize.h}
                            width={a.rect.w * imgSize.w}
                            height={a.rect.h * imgSize.h}
                            {...baseProps}
                            fill={`${a.color}1A`}
                          />
                        );
                      }
                      if (a.type === 'pin' && a.point) {
                        const cx = a.point.x * imgSize.w;
                        const cy = a.point.y * imgSize.h;
                        const r  = Math.min(imgSize.w, imgSize.h) * 0.018;

                        // Inline comment label (toggleable)
                        const labelText = a.comment ? truncateForLabel(a.comment) : '';
                        const fontSize  = r * 0.95;
                        const charW     = fontSize * 0.58;
                        const padX      = fontSize * 0.8;
                        const padY      = fontSize * 0.45;
                        const labelW    = labelText.length * charW + padX * 2;
                        const labelH    = fontSize + padY * 2;
                        // Flip label to the left side when it would overflow the image
                        const labelOnRight = (cx + r * 1.6 + labelW) < imgSize.w;
                        const labelX = labelOnRight ? cx + r * 1.6 : cx - r * 1.6 - labelW;
                        const labelY = cy - labelH / 2;

                        return (
                          <g key={a._id} opacity={opacity} {...hitProps}>
                            {/* Hit zone */}
                            <circle cx={cx} cy={cy} r={r * 1.4} fill="transparent" />
                            {/* Pin body */}
                            <circle cx={cx} cy={cy} r={r} fill={a.color} stroke="white" strokeWidth={r * 0.25} />
                            <circle cx={cx} cy={cy} r={r * 0.35} fill="white" />
                            {isSel && (
                              <circle cx={cx} cy={cy} r={r * 1.6} fill="none" stroke={a.color} strokeWidth={r * 0.15} strokeDasharray={`${r * 0.5} ${r * 0.3}`} />
                            )}
                            {/* Inline comment label */}
                            {showLabels && labelText && (
                              <g>
                                {/* Tiny connector tick */}
                                <line
                                  x1={cx + (labelOnRight ? r : -r)}
                                  y1={cy}
                                  x2={labelOnRight ? labelX : labelX + labelW}
                                  y2={cy}
                                  stroke={a.color}
                                  strokeWidth={r * 0.2}
                                  opacity={0.7}
                                />
                                <rect
                                  x={labelX}
                                  y={labelY}
                                  width={labelW}
                                  height={labelH}
                                  rx={labelH / 2}
                                  ry={labelH / 2}
                                  fill={a.color}
                                  opacity={0.96}
                                />
                                <text
                                  x={labelX + padX}
                                  y={cy + fontSize * 0.35}
                                  fill="white"
                                  fontSize={fontSize}
                                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                                  fontWeight="600"
                                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                  {labelText}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      }
                      return null;
                    })}

                    {/* In-flight shape preview */}
                    {inFlight?.type === 'pen' && inFlight.points.length > 1 && (
                      <path
                        d={inFlight.points.map((p, i) =>
                          `${i === 0 ? 'M' : 'L'} ${p.x * imgSize.w} ${p.y * imgSize.h}`
                        ).join(' ')}
                        stroke={color}
                        strokeWidth={renderStrokeWidth(strokeWidth)}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {inFlight?.type === 'rectangle' && (
                      <rect
                        x={Math.min(inFlight.start.x, inFlight.end.x) * imgSize.w}
                        y={Math.min(inFlight.start.y, inFlight.end.y) * imgSize.h}
                        width={Math.abs(inFlight.end.x - inFlight.start.x) * imgSize.w}
                        height={Math.abs(inFlight.end.y - inFlight.start.y) * imgSize.h}
                        stroke={color}
                        strokeWidth={renderStrokeWidth(strokeWidth)}
                        fill={`${color}1A`}
                      />
                    )}
                  </svg>
                )}
              </div>
            </div>
          )}

          {/* New-pin draft popup */}
          {pinDraft && (
            <PinDraftPopup
              position={pinDraft.screen}
              color={color}
              onSubmit={handlePinDraftSubmit}
              onCancel={() => setPinDraft(null)}
            />
          )}

          {/* Existing-pin viewer popup */}
          {viewingPinAnn && viewingPinAnn.point && (
            <PinViewerPopup
              annotation={viewingPinAnn}
              position={popupScreenPos(viewingPinAnn.point)}
              canEdit={canEditAnnotation(viewingPinAnn)}
              onClose={() => setViewingPin(null)}
              onSave={(text) => handlePinEdit(viewingPinAnn, text)}
              onDelete={() => handleDelete(viewingPinAnn._id)}
            />
          )}

          {/* Clear-all confirm */}
          {showClearConfirm && (
            <ClearAllConfirm
              count={annotations.filter(canEditAnnotation).length}
              onCancel={() => setShowClearConfirm(false)}
              onConfirm={handleClearAll}
            />
          )}

          {/* PDF annotation notice */}
          {isPdf && canAnnotate && (
            <div className="absolute bottom-3 left-3 right-3 mx-auto max-w-md
                            bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2
                            text-[11px] text-white/70 text-center">
              PDF annotation isn't supported yet — use the right-side comments instead, or
              re-upload the page as an image to mark it up.
            </div>
          )}

          {/* Shortcut hint pill (image only) */}
          {!isPdf && canAnnotate && !pinDraft && !viewingPin && !showClearConfirm && (
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md border border-white/10
                            rounded-lg px-2.5 py-1.5 text-[10px] text-white/50 font-mono">
              V·select  P·pen  R·rect  M·pin  E·erase  Ctrl+Z·undo  Ctrl+S·save
            </div>
          )}
        </div>

        {/* Side panel — annotations list */}
        <aside className="w-72 shrink-0 bg-[#0f0f0f] border-l border-white/10 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-white/60">Annotations</p>
              <p className="text-[10px] text-white/40 mt-0.5">
                {annotations.length} item{annotations.length === 1 ? '' : 's'} · v{targetVersion}
              </p>
            </div>
            {canAnnotate && annotations.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                title="Delete all annotations on this version"
                className="p-1.5 rounded-lg text-white/40 hover:text-[var(--error)] hover:bg-white/5 transition-colors"
              >
                <Trash size={13} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingAnns ? (
              <div className="flex items-center justify-center py-8 text-white/40">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : annotations.length === 0 ? (
              <div className="text-center py-8 text-white/40 text-xs">
                <MessageSquare size={20} className="mx-auto mb-2 opacity-50" />
                {canAnnotate
                  ? 'No annotations yet. Pick a tool and start marking.'
                  : 'No annotations on this version.'}
              </div>
            ) : (
              annotations.map((a) => {
                const isSel = selectedAnn === a._id || viewingPin === a._id;
                return (
                  <div
                    key={a._id}
                    onClick={() => {
                      if (a.type === 'pin') {
                        setSelectedAnn(a._id);
                        setViewingPin(a._id);
                      } else {
                        setSelectedAnn(a._id);
                      }
                    }}
                    className={`group rounded-lg p-2.5 border cursor-pointer transition-colors
                      ${isSel
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: a.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                          <span className="uppercase font-bold">{a.type}</span>
                          <span>·</span>
                          <span className="truncate">{a.createdBy?.name || '—'}</span>
                        </div>
                        {a.comment && (
                          <p className="text-xs text-white/80 mt-1 leading-snug whitespace-pre-wrap">
                            {a.comment}
                          </p>
                        )}
                        <p className="text-[10px] text-white/30 mt-1">{fmt(a.createdAt)}</p>
                      </div>
                      {canEditAnnotation(a) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(a._id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/40
                                     hover:text-[var(--error)] hover:bg-white/5 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!canAnnotate && (
            <div className="px-4 py-2.5 border-t border-white/10 text-[10px] text-white/40 shrink-0">
              You don't have permission to add annotations.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default PreviewDrawingModal;
