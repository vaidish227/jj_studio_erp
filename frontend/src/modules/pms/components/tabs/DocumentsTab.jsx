import React, { useMemo, useState } from 'react';
import {
  FileText, FileSpreadsheet, FileImage, BookOpen, Layers,
  FolderOpen, Eye, Download, Upload, FileArchive, File as FileIcon,
  ClipboardList, Plus, Trash2,
} from 'lucide-react';
import { Button, Loader, SearchInput } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../../shared/services/pmsService';
import RecordMoMModal from '../RecordMoMModal';
import MoMPreviewModal from '../MoMPreviewModal';
import UploadDocumentModal from '../UploadDocumentModal';
import useProjectMoMs from '../../hooks/useProjectMoMs';
import useProjectDocuments from '../../hooks/useProjectDocuments';

// Same category model as the standalone Document Repository page.
const CATEGORIES = [
  { id: 'client_details', label: 'Client Details' },
  { id: 'documents',      label: 'Documents' },
  { id: 'mom',            label: 'MOM' },
  { id: 'design_files',   label: 'Design Files' },
  { id: 'sop',            label: 'SOP' },
];

const STATUS_LABELS = {
  uploaded: 'Uploaded',
  approved: 'Approved',
  signed:   'Signed',
  verified: 'Verified',
};

const EXT_META = {
  pdf:  { icon: FileText,       bg: 'bg-[var(--error)]/12',       fg: 'text-[var(--error)]' },
  doc:  { icon: FileText,       bg: 'bg-[var(--accent-blue)]/12', fg: 'text-[var(--accent-blue)]' },
  docx: { icon: FileText,       bg: 'bg-[var(--accent-blue)]/12', fg: 'text-[var(--accent-blue)]' },
  xls:  { icon: FileSpreadsheet,bg: 'bg-[var(--success)]/12',     fg: 'text-[var(--success)]' },
  xlsx: { icon: FileSpreadsheet,bg: 'bg-[var(--success)]/12',     fg: 'text-[var(--success)]' },
  csv:  { icon: FileSpreadsheet,bg: 'bg-[var(--success)]/12',     fg: 'text-[var(--success)]' },
  png:  { icon: FileImage,      bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  jpg:  { icon: FileImage,      bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  jpeg: { icon: FileImage,      bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  webp: { icon: FileImage,      bg: 'bg-[var(--accent-teal)]/12', fg: 'text-[var(--accent-teal)]' },
  dwg:  { icon: BookOpen,       bg: 'bg-[var(--warning)]/12',     fg: 'text-[var(--warning)]' },
  dxf:  { icon: BookOpen,       bg: 'bg-[var(--warning)]/12',     fg: 'text-[var(--warning)]' },
  zip:  { icon: FileArchive,    bg: 'bg-[var(--text-muted)]/12',  fg: 'text-[var(--text-muted)]' },
  mom:  { icon: ClipboardList,  bg: 'bg-[var(--primary)]/12',     fg: 'text-[var(--primary)]' },
  default: { icon: FileIcon,    bg: 'bg-[var(--primary)]/12',     fg: 'text-[var(--primary)]' },
};
const metaFor = (ext) => EXT_META[(ext || '').toLowerCase()] || EXT_META.default;

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
    id:       d._id,
    name:     d.name,
    ext:      ext.length <= 5 ? ext : '',
    size:     formatSize(d.fileSize),
    status:   STATUS_LABELS[d.status] || '',
    category: d.category,
    source:   d.source,
  };
};

const DocCard = ({ doc, onReview, onDownload, onDelete }) => {
  const meta = metaFor(doc.ext);
  const Icon = meta.icon;
  return (
    <div className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden transition-all hover:border-[var(--primary)]/40 hover:shadow-md flex flex-col">
      <div className={`relative h-28 flex items-center justify-center ${meta.bg}`}>
        <Icon size={42} className={meta.fg} />
        {doc.status && (
          <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)]/85 text-[var(--text-secondary)] border border-[var(--border)]">
            {doc.status}
          </span>
        )}
        {!doc.recorded && onDelete && (
          <PermissionGate permission={['documents.delete', 'projects.delete']} mode="any">
            <button
              type="button"
              onClick={() => onDelete(doc)}
              className="absolute top-2 left-2 p-1.5 rounded-lg bg-[var(--surface)]/85 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition-all"
              title="Delete document"
            >
              <Trash2 size={12} />
            </button>
          </PermissionGate>
        )}
      </div>
      <div className="p-3 flex flex-col gap-3 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)] truncate" title={doc.name}>{doc.name}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{doc.size || '—'}</p>
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

const DocumentsTab = ({ project }) => {
  const toast = useToast();
  const [activeCategory, setActiveCategory] = useState('client_details');
  const [search, setSearch]                 = useState('');
  const [uploadOpen, setUploadOpen]         = useState(false);

  // Repository documents from the API (manual uploads + auto-filed approvals)
  const {
    documents, counts: docCounts, isLoading: docsLoading, refresh,
  } = useProjectDocuments(project?._id);

  // Recorded MoMs (persisted in localStorage per project) — these are
  // structured entries created via the Record MoM modal, distinct from
  // uploaded MoM files.
  const { moms, addMoM, updateMoM, removeMoM } = useProjectMoMs(project?._id);
  const [recordOpen, setRecordOpen]   = useState(false);
  const [editingMoM, setEditingMoM]   = useState(null);
  const [previewMoM, setPreviewMoM]   = useState(null);

  const cardDocs = useMemo(() => documents.map(toCardDoc), [documents]);

  // Map recorded MoMs to the same card shape so they render in the grid.
  const recordedMomDocs = useMemo(() => moms.map((m) => ({
    name:     `${m.title}.mom`,
    ext:      'mom',
    size:     `${m.attendees?.length || 0} attendees · ${m.actionItems?.length || 0} actions`,
    status:   'Recorded',
    category: 'mom',
    recorded: true,
    momId:    m.id,
  })), [moms]);

  const docs = useMemo(() => {
    const fromApi = cardDocs.filter((d) => d.category === activeCategory);
    const combined = activeCategory === 'mom'
      ? [...recordedMomDocs, ...fromApi]
      : fromApi;
    return combined.filter((d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()));
  }, [cardDocs, activeCategory, search, recordedMomDocs]);

  const counts = useMemo(() => {
    const map = {};
    for (const c of CATEGORIES) {
      const base = docCounts?.[c.id] || 0;
      map[c.id]  = c.id === 'mom' ? base + recordedMomDocs.length : base;
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

  const handleReview = (doc) => {
    if (doc.recorded) {
      const target = moms.find((m) => m.id === doc.momId);
      if (target) setPreviewMoM(target);
      return;
    }
    openSignedUrl(doc, 'preview');
  };
  const handleDownload = (doc) => {
    if (doc.recorded) {
      // For recorded MoMs, "Download" routes through the preview modal so the
      // user picks the markdown export there (avoids duplicating that logic).
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

  return (
    <div className="space-y-4">
      {/* Header */}
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
                {project?.name || 'Project'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-56">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search files…"
              />
            </div>
            {activeCategory === 'mom' && (
              <PermissionGate permission="projects.read">
                <Button variant="outline" size="sm" onClick={() => { setEditingMoM(null); setRecordOpen(true); }}>
                  <Plus size={14} />
                  Record MoM
                </Button>
              </PermissionGate>
            )}
            <PermissionGate permission={['documents.upload', 'projects.update', 'drawings.upload']} mode="any">
              <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)} disabled={!project?._id}>
                <Upload size={14} />
                Upload
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
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
      </div>

      {/* Documents grid */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 min-h-[280px]">
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
              >
                <Plus size={14} />
                Record MoM
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {docs.map((doc) => (
              <DocCard
                key={doc.id || doc.momId || doc.name}
                doc={doc}
                onReview={handleReview}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <RecordMoMModal
        isOpen={recordOpen}
        onClose={() => { setRecordOpen(false); setEditingMoM(null); }}
        projectName={project?.name}
        initialMoM={editingMoM}
        onSave={handleSaveMoM}
      />

      <MoMPreviewModal
        isOpen={!!previewMoM}
        onClose={() => setPreviewMoM(null)}
        mom={previewMoM}
        projectName={project?.name}
        onEdit={handleEditFromPreview}
        onDelete={handleDeleteFromPreview}
      />

      <UploadDocumentModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        projectId={project?._id}
        defaultCategory={activeCategory}
        onUploaded={(doc) => {
          refresh();
          if (doc?.category) setActiveCategory(doc.category);
        }}
      />
    </div>
  );
};

export default DocumentsTab;
