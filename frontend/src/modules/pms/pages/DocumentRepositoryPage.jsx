import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  FileText, FileSpreadsheet, FileImage, BookOpen,
  Layers, FolderOpen, Search, Plus, Eye, Download, Upload,
  ChevronDown, Check, FileArchive, File as FileIcon,
  ClipboardList, Trash2, ExternalLink,
} from 'lucide-react';
import { Button, Loader, SearchInput, Modal, PdfThumbnail, PdfViewer } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useProjects from '../hooks/useProjects';
import useProjectMoMs from '../hooks/useProjectMoMs';
import useProjectDocuments from '../hooks/useProjectDocuments';
import RecordMoMModal from '../components/RecordMoMModal';
import MoMPreviewModal from '../components/MoMPreviewModal';
import UploadDocumentModal from '../components/UploadDocumentModal';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

// ─── Category definitions ────────────────────────────────────────────────────
// Client Details · Documents · MOM · Design Files · SOP — each is a tab that
// filters the document grid.
const CATEGORIES = [
  { id: 'client_details', label: 'Client Details' },
  { id: 'documents',      label: 'Documents' },
  { id: 'mom',            label: 'MOM' },
  { id: 'design_files',   label: 'Design Files' },
  { id: 'sop',            label: 'SOP' },
];

// Badge label per ProjectDocument.status
const STATUS_LABELS = {
  uploaded: 'Uploaded',
  approved: 'Approved',
  signed:   'Signed',
  verified: 'Verified',
};

// ─── File-type styling ───────────────────────────────────────────────────────
// `tone` is the type's accent colour, applied via color-mix tints (same
// pattern as the dashboard KPI tiles) — never as a full-card wash. PDF
// deliberately avoids var(--error): the alarm red made cards look broken —
// muted terracotta keeps the "PDF red" identity instead.
const EXT_META = {
  pdf:  { icon: FileText,        tone: '#B65A41' },
  doc:  { icon: FileText,        tone: 'var(--accent-blue)' },
  docx: { icon: FileText,        tone: 'var(--accent-blue)' },
  xls:  { icon: FileSpreadsheet, tone: 'var(--success)' },
  xlsx: { icon: FileSpreadsheet, tone: 'var(--success)' },
  csv:  { icon: FileSpreadsheet, tone: 'var(--success)' },
  png:  { icon: FileImage,       tone: 'var(--accent-teal)' },
  jpg:  { icon: FileImage,       tone: 'var(--accent-teal)' },
  jpeg: { icon: FileImage,       tone: 'var(--accent-teal)' },
  webp: { icon: FileImage,       tone: 'var(--accent-teal)' },
  dwg:  { icon: BookOpen,        tone: 'var(--warning)' },
  dxf:  { icon: BookOpen,        tone: 'var(--warning)' },
  zip:  { icon: FileArchive,     tone: 'var(--text-muted)' },
  mom:  { icon: ClipboardList,   tone: 'var(--primary)' },
  default: { icon: FileIcon,     tone: 'var(--primary)' },
};

const metaFor = (ext) => EXT_META[(ext || '').toLowerCase()] || EXT_META.default;

// Types the preview panel can render inline — PDFs via the browser's viewer,
// images natively. Everything else keeps the icon + description fallback.
const INLINE_PREVIEW_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

// Module-level signed-URL cache so each document's URL is fetched once and
// shared between the grid thumbnails and the preview panel. The backend signs
// URLs for 1 hour; refresh comfortably before that.
const previewUrlCache = new Map(); // docId -> { promise, expiresAt }
const PREVIEW_URL_TTL = 50 * 60 * 1000;

const getPreviewUrl = (docId) => {
  const hit = previewUrlCache.get(docId);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;
  const promise = pmsService.getDocumentPreviewUrl(docId).then((res) => res?.url || null);
  previewUrlCache.set(docId, { promise, expiresAt: Date.now() + PREVIEW_URL_TTL });
  promise.catch(() => previewUrlCache.delete(docId));
  return promise;
};

const formatSize = (n) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

// Map a ProjectDocument API record to the card shape the grid renders.
const toCardDoc = (d) => {
  const ext = (d.fileName || d.fileUrl || '').split('.').pop()?.toLowerCase() || '';
  return {
    id:          d._id,
    name:        d.name,
    ext:         ext.length <= 5 ? ext : '',
    size:        formatSize(d.fileSize),
    status:      STATUS_LABELS[d.status] || '',
    category:    d.category,
    description: d.description,
    fileName:    d.fileName,
    uploadedBy:  d.uploadedBy?.name,
    createdAt:   d.createdAt,
    source:      d.source,
  };
};

// ─── Document Card ───────────────────────────────────────────────────────────
const DocumentCard = ({ doc, onPreview, onDownload }) => {
  const meta = metaFor(doc.ext);
  const Icon = meta.icon;
  const canThumb = !!doc.id && INLINE_PREVIEW_EXTS.includes(doc.ext);

  // Live first-page thumbnail for previewable types; while loading (or for
  // non-previewable types / fetch errors) the coloured icon plate shows.
  const [thumbUrl, setThumbUrl] = useState(null);
  useEffect(() => {
    if (!canThumb) return undefined;
    let cancelled = false;
    getPreviewUrl(doc.id)
      .then((url) => { if (!cancelled) setThumbUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [doc.id, canThumb]);

  // Transparent plate — the gradient + watermark live on the card root so the
  // meta/actions area below shares the same surface.
  const iconPlate = (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex items-center justify-center">
        <Icon size={22} style={{ color: meta.tone }} />
      </div>
      {doc.ext && (
        <span
          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
          style={{ background: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
        >
          {doc.ext}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="group relative border border-[var(--border)] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[var(--primary)]/40 hover:shadow-md flex flex-col"
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${meta.tone} 12%, var(--surface)) 0%, color-mix(in srgb, ${meta.tone} 3%, var(--surface)) 100%)` }}
    >
      {/* faint oversized watermark of the file-type icon — same motif as the KPI tiles */}
      <Icon
        size={90}
        className="absolute -right-4 -bottom-5 opacity-[0.07] pointer-events-none"
        style={{ color: meta.tone }}
      />
      {/* Visual top — live document thumbnail, falling back to the icon plate */}
      <button
        type="button"
        onClick={() => onPreview?.(doc)}
        className="group/plate relative w-full h-28 overflow-hidden"
      >
        {!thumbUrl ? (
          iconPlate
        ) : doc.ext === 'pdf' ? (
          <PdfThumbnail
            url={thumbUrl}
            alt={doc.name}
            className="w-full h-full object-cover object-top bg-white"
            fallback={iconPlate}
          />
        ) : (
          <img src={thumbUrl} alt={doc.name} className="w-full h-full object-cover bg-white" />
        )}
        {doc.status && (
          <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)]/85 text-[var(--text-secondary)] border border-[var(--border)]">
            {doc.status}
          </span>
        )}
        {/* Styled hover hint — replaces the native black tooltip */}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/plate:bg-black/25 transition-colors">
          <span className="opacity-0 group-hover/plate:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] text-[11px] font-bold text-[var(--text-primary)] shadow">
            <Eye size={12} />
            Preview
          </span>
        </span>
      </button>

      {/* Meta + actions — relative so it paints above the watermark */}
      <div className="relative p-3 flex flex-col gap-3 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)] truncate" title={doc.name}>
            {doc.name}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
            {doc.size || '—'}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-auto">
          <button
            type="button"
            onClick={() => onPreview?.(doc)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
          >
            <Eye size={12} />
            Preview
          </button>
          <button
            type="button"
            onClick={() => onDownload?.(doc)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--surface)]/70 text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Document preview popup ──────────────────────────────────────────────────
const DocumentPreviewModal = ({ doc, onClose, onOpen, onDownload, onDelete }) => {
  const canEmbed = !!doc?.id && INLINE_PREVIEW_EXTS.includes(doc?.ext);

  // Signed-URL state, keyed by document id so a stale result is never shown
  // for a newly opened document. Loading/url/error are all derived from
  // whether the stored result matches the current doc.
  const [preview, setPreview] = useState({ docId: null, url: null, error: null });
  const isCurrent   = preview.docId === doc?.id;
  const fileUrl     = canEmbed && isCurrent ? preview.url : null;
  const fileError   = canEmbed && isCurrent ? preview.error : null;
  const loadingFile = canEmbed && !isCurrent;

  // Fetch a signed URL for the opened document so it can render inline.
  useEffect(() => {
    if (!canEmbed) return undefined;
    let cancelled = false;
    const docId = doc.id;
    getPreviewUrl(docId)
      .then((url) => { if (!cancelled) setPreview({ docId, url, error: null }); })
      .catch((err) => { if (!cancelled) setPreview({ docId, url: null, error: err?.message || 'Could not load preview' }); });
    return () => { cancelled = true; };
  }, [doc?.id, canEmbed]);

  if (!doc) return null;

  const meta = metaFor(doc.ext);
  const Icon = meta.icon;

  return (
    <Modal isOpen onClose={onClose} title={doc.name} className="max-w-6xl">
      {/* Preview height = modal cap (80vh) minus header/caption/footer, so the
          modal body itself never double-scrolls with the page list. */}
      {loadingFile ? (
        <div className="h-[calc(80vh-230px)] min-h-[320px] flex items-center justify-center">
          <Loader />
        </div>
      ) : fileUrl && doc.ext === 'pdf' ? (
        <div className="h-[calc(80vh-230px)] min-h-[320px] overflow-y-auto custom-scrollbar rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
          <PdfViewer
            url={fileUrl}
            alt={doc.name}
            width={896}
            className="space-y-3 max-w-4xl mx-auto"
            fallback={(
              <div className="h-full flex items-center justify-center">
                <Loader />
              </div>
            )}
            errorFallback={(
              /* Rare path (e.g. storage host without CORS): the browser
                 viewer — toolbar and all — still beats no preview. */
              <iframe title={doc.name} src={fileUrl} className="w-full h-full border-0 bg-white" />
            )}
          />
        </div>
      ) : fileUrl ? (
        <div className="flex items-center justify-center">
          <img src={fileUrl} alt={doc.name} className="max-w-full max-h-[calc(80vh-230px)] object-contain rounded-xl" />
        </div>
      ) : (
        <div className="h-[40vh] flex flex-col items-center justify-center text-center">
          <div className="flex flex-col items-center gap-2.5 mb-4">
            <div
              className="w-20 h-20 rounded-2xl border flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${meta.tone} 12%, var(--surface)), var(--surface))`,
                borderColor: `color-mix(in srgb, ${meta.tone} 22%, transparent)`,
              }}
            >
              <Icon size={36} style={{ color: meta.tone }} />
            </div>
            {doc.ext && (
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md"
                style={{ background: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
              >
                {doc.ext}
              </span>
            )}
          </div>
          {fileError ? (
            <p className="text-sm text-[var(--error)] max-w-sm">{fileError}</p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] max-w-sm">
              No inline preview for this file type — use{' '}
              <span className="font-bold text-[var(--text-primary)]">Open</span> to view it in a
              new tab, or Download to save it locally.
            </p>
          )}
        </div>
      )}

      {(doc.description || (doc.source === 'manual' && doc.uploadedBy) || doc.createdAt) && (
        <div className="text-center mt-4 space-y-1">
          {doc.description && (
            <p className="text-xs text-[var(--text-muted)] whitespace-pre-wrap">
              {doc.description}
            </p>
          )}
          {((doc.source === 'manual' && doc.uploadedBy) || doc.createdAt) && (
            <p className="text-[11px] text-[var(--text-muted)]">
              {[
                doc.source === 'manual' && doc.uploadedBy ? `Added by ${doc.uploadedBy}` : null,
                doc.createdAt
                  ? new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : null,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-[var(--border)]">
        <p className="text-[11px] font-bold text-[var(--text-muted)] truncate">
          {[doc.size, doc.status].filter(Boolean).join(' · ')}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="primary" size="sm" onClick={() => onDownload?.(doc)}>
            <Download size={14} />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpen?.(doc)}>
            <ExternalLink size={14} />
            Open in tab
          </Button>
          <PermissionGate permission={['documents.delete', 'projects.delete']} mode="any">
            <button
              type="button"
              onClick={() => onDelete?.(doc)}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
              title="Delete document"
            >
              <Trash2 size={14} />
            </button>
          </PermissionGate>
        </div>
      </div>
    </Modal>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const DocumentRepositoryPage = () => {
  const { projects, isLoading } = useProjects();
  const toast = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeCategory, setActiveCategory]       = useState('client_details');
  const [search, setSearch]                       = useState('');
  const [previewDoc, setPreviewDoc]               = useState(null);
  const [projectOpen, setProjectOpen]             = useState(false);
  const [projectQuery, setProjectQuery]           = useState('');
  const [uploadOpen, setUploadOpen]               = useState(false);
  const projectRef = useRef(null);

  // Repository documents from the API (manual uploads + auto-filed approvals)
  const {
    documents, counts: docCounts, isLoading: docsLoading, refresh,
  } = useProjectDocuments(selectedProjectId);

  // Recorded MoMs (per-project, localStorage-backed) — same data store as DocumentsTab
  const { moms, addMoM, updateMoM, removeMoM } = useProjectMoMs(selectedProjectId);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingMoM, setEditingMoM] = useState(null);
  const [previewMoM, setPreviewMoM] = useState(null);

  // Close project dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (projectRef.current && !projectRef.current.contains(e.target)) {
        setProjectOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-select first project once loaded
  React.useEffect(() => {
    if (!selectedProjectId && projects?.length) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects?.find((p) => p._id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const cardDocs = useMemo(() => documents.map(toCardDoc), [documents]);

  // Map recorded MoMs to the doc shape so they render alongside file uploads.
  const recordedMomDocs = useMemo(() => moms.map((m) => ({
    name:     `${m.title}.mom`,
    ext:      'mom',
    size:     `${m.attendees?.length || 0} attendees · ${m.actionItems?.length || 0} actions`,
    status:   'Recorded',
    category: 'mom',
    recorded: true,
    momId:    m.id,
  })), [moms]);

  // Docs for current project, current category, current search.
  const docs = useMemo(() => {
    const fromApi = cardDocs.filter((d) => d.category === activeCategory);
    const combined = activeCategory === 'mom'
      ? [...recordedMomDocs, ...fromApi]
      : fromApi;
    return combined.filter((d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()));
  }, [cardDocs, activeCategory, search, recordedMomDocs]);

  // Per-category counts for tab badges
  const counts = useMemo(() => {
    const map = {};
    for (const c of CATEGORIES) {
      const base = docCounts?.[c.id] || 0;
      map[c.id] = c.id === 'mom' ? base + recordedMomDocs.length : base;
    }
    return map;
  }, [docCounts, recordedMomDocs]);

  const openSignedUrl = async (doc, kind) => {
    try {
      const res = kind === 'download'
        ? await pmsService.getDocumentDownloadUrl(doc.id)
        : await pmsService.getDocumentPreviewUrl(doc.id);
      if (!res?.url) throw new Error('No URL returned');
      if (kind === 'download') {
        const a = document.createElement('a');
        a.href = res.url;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(res.url, '_blank', 'noopener');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not open the file');
    }
  };

  const handlePreview = (doc) => {
    if (doc.recorded) {
      const target = moms.find((m) => m.id === doc.momId);
      if (target) setPreviewMoM(target);
      return;
    }
    setPreviewDoc(doc);
  };
  const handleDownload = (doc) => {
    if (doc.recorded) {
      const target = moms.find((m) => m.id === doc.momId);
      if (target) setPreviewMoM(target);
      return;
    }
    openSignedUrl(doc, 'download');
  };
  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}" from the repository?`)) return;
    try {
      await pmsService.deleteProjectDocument(doc.id);
      toast.success('Document deleted.');
      setPreviewDoc(null);
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const handleSaveMoM = (payload) => {
    if (editingMoM) {
      updateMoM(editingMoM.id, payload);
      setEditingMoM(null);
    } else {
      addMoM(payload);
      setActiveCategory('mom');
    }
  };
  const handleEditFromPreview = (mom) => {
    setPreviewMoM(null);
    setEditingMoM(mom);
    setRecordOpen(true);
  };
  const handleDeleteFromPreview = (mom) => {
    removeMoM(mom.id);
    setPreviewMoM(null);
    toast.success('MoM deleted.');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            PMS · Documents
          </p>
          <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text-primary)]">
            Document Repository
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Centralised store for project documents — agreements, BOQ, MOMs, drawings and SOPs.
          </p>
        </div>
      </header>

      {/* ── Top: Project selector dropdown ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            Project
          </p>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">
            {projects?.length || 0}
          </span>
        </div>

        <div ref={projectRef} className="relative w-full sm:w-96">
          <button
            type="button"
            onClick={() => setProjectOpen((p) => !p)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors
              ${projectOpen
                ? 'bg-[var(--surface)] border-[var(--primary)]/50'
                : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--primary)]/30'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen size={15} className="shrink-0 text-[var(--primary)]" />
              <span className="text-xs font-bold truncate text-[var(--text-primary)]">
                {selectedProject?.name || 'Select a project'}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${projectOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {projectOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
              {(projects?.length || 0) > 6 && (
                <div className="p-2 border-b border-[var(--border)]">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      autoFocus
                      value={projectQuery}
                      onChange={(e) => setProjectQuery(e.target.value)}
                      placeholder="Search projects…"
                      className="w-full pl-7 pr-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]/40 text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}
              <ul className="max-h-72 overflow-y-auto custom-scrollbar py-1">
                {(projects || [])
                  .filter((p) => !projectQuery.trim() || p.name.toLowerCase().includes(projectQuery.toLowerCase()))
                  .map((p) => {
                    const isActive = p._id === selectedProjectId;
                    return (
                      <li key={p._id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(p._id);
                            setPreviewDoc(null);
                            setProjectOpen(false);
                            setProjectQuery('');
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                            ${isActive
                              ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'}`}
                        >
                          <FolderOpen size={13} className="shrink-0" />
                          <span className="text-xs font-bold truncate flex-1">{p.name}</span>
                          {isActive && <Check size={12} className="shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                {(projects?.length || 0) === 0 && (
                  <li className="px-3 py-3 text-xs text-[var(--text-muted)] text-center">
                    No projects yet.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Body: repository details (full width) ── */}
      <section className="space-y-4 min-w-0">

        {/* Repository title bar */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                <Layers size={18} className="text-[var(--primary)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  Document Repository
                </p>
                <p className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                  {selectedProject?.name || 'Select a project'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search files…"
              />
            </div>
          </div>

          {/* Category tabs + actions on the same row */}
          <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setActiveCategory(cat.id); setPreviewDoc(null); }}
                    className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors
                      ${isActive
                        ? 'bg-[var(--primary)] text-black shadow-sm'
                        : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
                  >
                    {cat.label}
                    {counts[cat.id] > 0 && (
                      <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full
                        ${isActive ? 'bg-black/15 text-black' : 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
                        {counts[cat.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeCategory === 'mom' && (
                <PermissionGate permission="projects.read">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingMoM(null); setRecordOpen(true); }}
                    disabled={!selectedProjectId}
                  >
                    <Plus size={14} />
                    Record MoM
                  </Button>
                </PermissionGate>
              )}
              <PermissionGate permission={['documents.upload', 'projects.update', 'drawings.upload']} mode="any">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                  disabled={!selectedProjectId}
                >
                  <Upload size={14} />
                  Upload Document
                </Button>
              </PermissionGate>
            </div>
          </div>
        </div>

        {/* Documents grid */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 min-h-[320px]">
          {docsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <FolderOpen size={28} className="text-[var(--text-muted)] mb-2" />
              <p className="text-sm font-bold text-[var(--text-secondary)]">No documents</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                {search
                  ? 'Nothing matches your search.'
                  : activeCategory === 'mom'
                    ? 'Record a meeting minute or upload an MoM file to get started.'
                    : 'Upload the first document to this category. Approved proposals and drawings are filed here automatically.'}
              </p>
              {!search && activeCategory === 'mom' && (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setEditingMoM(null); setRecordOpen(true); }}
                  disabled={!selectedProjectId}
                >
                  <Plus size={14} />
                  Record MoM
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {docs.map((doc) => (
                <div key={doc.id || doc.momId || doc.name} className="w-[200px]">
                  <DocumentCard
                    doc={doc}
                    onPreview={handlePreview}
                    onDownload={handleDownload}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onOpen={(d) => openSignedUrl(d, 'preview')}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      )}

      <RecordMoMModal
        isOpen={recordOpen}
        onClose={() => { setRecordOpen(false); setEditingMoM(null); }}
        projectName={selectedProject?.name}
        initialMoM={editingMoM}
        onSave={handleSaveMoM}
      />

      <MoMPreviewModal
        isOpen={!!previewMoM}
        onClose={() => setPreviewMoM(null)}
        mom={previewMoM}
        projectName={selectedProject?.name}
        onEdit={handleEditFromPreview}
        onDelete={handleDeleteFromPreview}
      />

      <UploadDocumentModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        projectId={selectedProjectId}
        defaultCategory={activeCategory === 'mom' ? 'mom' : activeCategory}
        onUploaded={(doc) => {
          refresh();
          if (doc?.category) setActiveCategory(doc.category);
        }}
      />
    </div>
  );
};

export default DocumentRepositoryPage;
