import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Layers, FolderOpen, Search, Plus, Download, Upload,
  ChevronDown, Check, Trash2, ExternalLink,
} from 'lucide-react';
import { Button, Loader, SearchInput, Modal, PdfViewer } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useProjects from '../hooks/useProjects';
import useProjectMoMs from '../hooks/useProjectMoMs';
import useProjectDocuments from '../hooks/useProjectDocuments';
import RecordMoMModal from '../components/RecordMoMModal';
import MoMPreviewModal from '../components/MoMPreviewModal';
import UploadDocumentModal from '../components/UploadDocumentModal';
import DocumentCard, { metaFor } from '../components/DocumentCard';
import ClientFormsPanel from '../components/ClientFormsPanel';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

// ─── Category definitions ────────────────────────────────────────────────────
// Client Details · Documents · MOM · Design Files · SOP filter the document
// grid; Forms swaps the grid for the Client Forms panel (templates + links).
// Kept in sync with DocumentsTab.jsx CATEGORIES.
const CATEGORIES = [
  { id: 'client_details', label: 'Client Details' },
  { id: 'documents',      label: 'Documents' },
  { id: 'mom',            label: 'MOM' },
  { id: 'design_files',   label: 'Design Files' },
  { id: 'sop',            label: 'SOP' },
  { id: 'forms',          label: 'Forms' },
];

// Badge label per ProjectDocument.status
const STATUS_LABELS = {
  uploaded: 'Uploaded',
  approved: 'Approved',
  signed:   'Signed',
  verified: 'Verified',
};

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
            {activeCategory !== 'forms' && (
              <div className="w-full sm:w-64">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search files…"
                />
              </div>
            )}
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
              {activeCategory !== 'forms' && (
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
              )}
            </div>
          </div>
        </div>

        {/* Forms tab — render the client forms panel; otherwise the documents grid */}
        {activeCategory === 'forms' ? (
          <ClientFormsPanel project={selectedProject} />
        ) : (
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {docs.map((doc) => (
                <DocumentCard
                  key={doc.id || doc.momId || doc.name}
                  doc={doc}
                  getPreviewUrl={getPreviewUrl}
                  onPreview={handlePreview}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </div>
        )}
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
