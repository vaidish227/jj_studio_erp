import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  FileText, FileSpreadsheet, FileImage, FileCheck2, BookOpen,
  Layers, FolderOpen, Search, Plus, Eye, Download, Upload,
  ChevronRight, ChevronDown, Check, Filter, FileArchive, File as FileIcon,
  ClipboardList,
} from 'lucide-react';
import { Button, Loader, SearchInput } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useProjects from '../hooks/useProjects';
import useProjectMoMs from '../hooks/useProjectMoMs';
import RecordMoMModal from '../components/RecordMoMModal';
import MoMPreviewModal from '../components/MoMPreviewModal';
import { useToast } from '../../../shared/notifications/ToastProvider';

// ─── Category definitions ────────────────────────────────────────────────────
// The mockup labels: Client Details · Documents · MOM · Design Files · SOP.
// Each is rendered as a tab that filters the document grid.
const CATEGORIES = [
  { id: 'client_details', label: 'Client Details' },
  { id: 'documents',      label: 'Documents' },
  { id: 'mom',            label: 'MOM' },
  { id: 'design_files',   label: 'Design Files' },
  { id: 'sop',            label: 'SOP' },
];

// ─── Demo data ───────────────────────────────────────────────────────────────
// Until a /pms/documents backend exists, the page shows representative
// documents per project so MD/PM can validate the UI. Swap MOCK_DOCS for an
// API call when the backend lands.
const MOCK_DOCS_TEMPLATE = [
  { name: 'Agreement.pdf',     ext: 'pdf',  size: '2.1 MB',  status: 'Signed',    category: 'client_details' },
  { name: 'Client_Info.pdf',   ext: 'pdf',  size: '1.2 MB',  status: 'Verified',  category: 'client_details' },
  { name: 'BOQ_v2.xlsx',       ext: 'xlsx', size: '480 KB',  status: 'Updated 2d ago', category: 'documents' },
  { name: 'Quotation.pdf',     ext: 'pdf',  size: '780 KB',  status: 'Approved',  category: 'documents' },
  { name: 'Kickoff_MOM.docx',  ext: 'docx', size: '210 KB',  status: 'Shared',    category: 'mom' },
  { name: 'Review_MOM.pdf',    ext: 'pdf',  size: '320 KB',  status: 'Latest',    category: 'mom' },
  { name: 'Floor_Plan.dwg',    ext: 'dwg',  size: '5.4 MB',  status: 'Rev 3',     category: 'design_files' },
  { name: '3D_Living.png',     ext: 'png',  size: '1920×1080', status: '',         category: 'design_files' },
  { name: 'SOP_Washroom.pdf',  ext: 'pdf',  size: 'v1.2 · linked', status: '',      category: 'sop' },
  { name: 'SOP_Kitchen.pdf',   ext: 'pdf',  size: 'v1.0',    status: '',          category: 'sop' },
];

// ─── File-type styling ───────────────────────────────────────────────────────
const EXT_META = {
  pdf:  { icon: FileText,       bg: 'bg-[var(--error)]/12',       fg: 'text-[var(--error)]' },
  doc:  { icon: FileText,       bg: 'bg-[var(--accent-blue)]/12', fg: 'text-[var(--accent-blue)]' },
  docx: { icon: FileText,       bg: 'bg-[var(--accent-blue)]/12', fg: 'text-[var(--accent-blue)]' },
  xls:  { icon: FileSpreadsheet,bg: 'bg-[var(--success)]/12',     fg: 'text-[var(--success)]' },
  xlsx: { icon: FileSpreadsheet,bg: 'bg-[var(--success)]/12',     fg: 'text-[var(--success)]' },
  png:  { icon: FileImage,      bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  jpg:  { icon: FileImage,      bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  jpeg: { icon: FileImage,      bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  dwg:  { icon: BookOpen,       bg: 'bg-[var(--warning)]/12',     fg: 'text-[var(--warning)]' },
  zip:  { icon: FileArchive,    bg: 'bg-[var(--text-muted)]/12',  fg: 'text-[var(--text-muted)]' },
  mom:  { icon: ClipboardList,  bg: 'bg-[var(--primary)]/12',     fg: 'text-[var(--primary)]' },
  default: { icon: FileIcon,    bg: 'bg-[var(--primary)]/12',     fg: 'text-[var(--primary)]' },
};

const metaFor = (ext) => EXT_META[(ext || '').toLowerCase()] || EXT_META.default;

// ─── Document Card ───────────────────────────────────────────────────────────
const DocumentCard = ({ doc, onReview, onDownload }) => {
  const meta = metaFor(doc.ext);
  const Icon = meta.icon;

  return (
    <div className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[var(--primary)]/40 hover:shadow-md flex flex-col">
      {/* Visual top — coloured plate echoing the mockup */}
      <div className={`relative h-28 flex items-center justify-center ${meta.bg}`}>
        <Icon size={42} className={meta.fg} />
        {doc.status && (
          <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)]/85 text-[var(--text-secondary)] border border-[var(--border)]">
            {doc.status}
          </span>
        )}
      </div>

      {/* Meta + actions */}
      <div className="p-3 flex flex-col gap-3 flex-1">
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
            onClick={() => onReview?.(doc)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
          >
            <Eye size={12} />
            Review
          </button>
          <button
            type="button"
            onClick={() => onDownload?.(doc)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Inline preview panel ────────────────────────────────────────────────────
const PreviewPanel = ({ doc, onClose }) => {
  if (!doc) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-8 text-center">
        <FolderOpen size={28} className="text-[var(--text-muted)] mb-3" />
        <p className="text-sm font-bold text-[var(--text-secondary)]">Click a file to preview</p>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
          Review, download or share documents associated with this project.
        </p>
      </div>
    );
  }

  const meta = metaFor(doc.ext);
  const Icon = meta.icon;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.bg}`}>
            <Icon size={20} className={meta.fg} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{doc.name}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{doc.size || '—'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Close
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
        <div className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-4 ${meta.bg}`}>
          <Icon size={48} className={meta.fg} />
        </div>
        <p className="text-sm text-[var(--text-secondary)] max-w-sm">
          Preview not available inline for{' '}
          <span className="font-bold text-[var(--text-primary)]">.{doc.ext}</span> files.
          Use Download to open the file locally.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
        <Button variant="primary" size="sm" className="flex-1">
          <Download size={14} />
          Download
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          Share
        </Button>
      </div>
    </div>
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
  const projectRef = useRef(null);

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
    const combined = activeCategory === 'mom'
      ? [...recordedMomDocs, ...MOCK_DOCS_TEMPLATE.filter((d) => d.category === 'mom')]
      : MOCK_DOCS_TEMPLATE.filter((d) => d.category === activeCategory);
    return combined.filter((d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()));
  }, [activeCategory, search, recordedMomDocs]);

  // Per-category counts for tab badges
  const counts = useMemo(() => {
    const map = {};
    for (const c of CATEGORIES) {
      const base = MOCK_DOCS_TEMPLATE.filter((d) => d.category === c.id).length;
      map[c.id] = c.id === 'mom' ? base + recordedMomDocs.length : base;
    }
    return map;
  }, [recordedMomDocs]);

  const handleReview = (doc) => {
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
    toast.success(`Downloading ${doc.name}…`);
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
              <PermissionGate permission="projects.read">
                <Button variant="primary" size="sm">
                  <Upload size={14} />
                  Upload Document
                </Button>
              </PermissionGate>
            </div>
          </div>
        </div>

        {/* Grid + preview */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

          {/* Documents grid */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 min-h-[320px]">
            {docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <FolderOpen size={28} className="text-[var(--text-muted)] mb-2" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">No documents</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                  {search
                    ? 'Nothing matches your search.'
                    : activeCategory === 'mom'
                      ? 'Record a meeting minute or upload an MoM file to get started.'
                      : 'Upload the first document to this category.'}
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
                  <div key={doc.name} className="w-[200px]">
                    <DocumentCard
                      doc={doc}
                      onReview={handleReview}
                      onDownload={handleDownload}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview panel — desktop only */}
          <div className="hidden lg:block">
            <PreviewPanel doc={previewDoc} onClose={() => setPreviewDoc(null)} />
          </div>
        </div>
      </section>

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
    </div>
  );
};

export default DocumentRepositoryPage;
