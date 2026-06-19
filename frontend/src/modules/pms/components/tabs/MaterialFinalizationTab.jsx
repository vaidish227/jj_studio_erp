import React, { useState } from 'react';
import {
  Plus, PackageCheck, Edit2, Trash2, Upload, FileText, Download, Eye, X,
} from 'lucide-react';
import { Button, Modal, Loader, FormField, Input, Select } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../../shared/services/pmsService';
import useMaterialFinalization from '../../hooks/useMaterialFinalization';
import EntryFilesUploadModal from '../EntryFilesUploadModal';
import SignedImageThumb from '../SignedImageThumb';
import InlineFilePicker from '../InlineFilePicker';
import { uploadGroupedFiles } from '../../utils/mediaKinds';

const STATUS_META = {
  draft:     { label: 'Draft',     cls: 'bg-[var(--border)] text-[var(--text-muted)]' },
  finalized: { label: 'Finalized', cls: 'bg-[var(--success)]/10 text-[var(--success)]' },
};

const CATEGORY_OPTIONS = [
  { value: '',          label: '— Select —' },
  { value: 'Flooring',  label: 'Flooring' },
  { value: 'Fittings',  label: 'Fittings' },
  { value: 'Paint',     label: 'Paint' },
  { value: 'Hardware',  label: 'Hardware' },
  { value: 'Lighting',  label: 'Lighting' },
  { value: 'Furniture', label: 'Furniture' },
  { value: 'Other',     label: 'Other' },
];

const EMPTY = { title: '', category: '', brand: '', specification: '', description: '', status: 'finalized' };

const EntryModal = ({ isOpen, onClose, onSave, initial = EMPTY, title, withFiles = false }) => {
  const [form, setForm]     = useState(initial);
  const [files, setFiles]   = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  React.useEffect(() => { if (isOpen) { setForm(initial); setFiles([]); } /* eslint-disable-next-line */ }, [isOpen]);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form, files); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-lg">
      <div className="space-y-4">
        <FormField label="Title" required>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Living Room Flooring — Vitrified Tile" />
        </FormField>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Category">
            <Select value={form.category} onChange={(v) => set('category', v)} options={CATEGORY_OPTIONS} />
          </FormField>
          <FormField label="Status">
            <Select
              value={form.status}
              onChange={(v) => set('status', v)}
              options={[{ value: 'finalized', label: 'Finalized' }, { value: 'draft', label: 'Draft' }]}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Brand">
            <Input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Kajaria" />
          </FormField>
          <FormField label="Specification">
            <Input value={form.specification} onChange={(e) => set('specification', e.target.value)} placeholder="Colour, size, model…" />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Where it's used, approval notes…"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] resize-none"
          />
        </FormField>
        {withFiles && (
          <FormField label="Images & Documents">
            <InlineFilePicker files={files} onChange={setFiles} kinds={['image', 'document']} />
          </FormField>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving} disabled={!form.title.trim()}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};

const MaterialFinalizationTab = ({ project }) => {
  const toast = useToast();
  const { entries, isLoading, error, createEntry, updateEntry, deleteEntry, refresh } =
    useMaterialFinalization(project?._id);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [filesFor, setFilesFor]     = useState(null);

  const openSigned = async (entryId, fileId, mode) => {
    try {
      const res = mode === 'download'
        ? await pmsService.getMatFinFileDownloadUrl(entryId, fileId)
        : await pmsService.getMatFinFilePreviewUrl(entryId, fileId);
      if (!res?.url) throw new Error('No URL returned');
      if (mode === 'download') {
        const a = document.createElement('a');
        a.href = res.url; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        window.open(res.url, '_blank', 'noopener');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not open the file');
    }
  };

  const handleCreate = async (form, files) => {
    try {
      const res = await createEntry(form);
      const id = res?.entry?._id;
      if (id && files?.length) {
        await uploadGroupedFiles(files, (fd) => pmsService.uploadMatFinFiles(id, fd));
        refresh();
      }
      toast.success('Entry added');
    } catch (err) { toast.error(err?.message || 'Failed'); }
  };

  const handleDeleteFile = async (entryId, fileId) => {
    if (!window.confirm('Remove this file?')) return;
    try { await pmsService.deleteMatFinFile(entryId, fileId); toast.success('File removed'); refresh(); }
    catch (err) { toast.error(err?.message || 'Delete failed'); }
  };

  const handleDeleteEntry = async (entry) => {
    if (!window.confirm(`Delete "${entry.title}" and all its files?`)) return;
    try { await deleteEntry(entry._id); toast.success('Entry deleted'); }
    catch (err) { toast.error(err?.message || 'Delete failed'); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Material Finalization <span className="text-[var(--text-muted)] font-normal">({entries.length})</span>
        </h3>
        <PermissionGate permission="material_finalization.create">
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={!project?._id}><Plus size={14} /> Add Entry</Button>
        </PermissionGate>
      </div>

      {error && <p className="text-xs text-[var(--error)]">Failed to load entries.</p>}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-teal)]/10 flex items-center justify-center mb-3">
            <PackageCheck size={22} className="text-[var(--accent-teal)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No finalized materials yet</p>
          <p className="text-xs text-[var(--text-muted)] mb-4">Record finalized material selections with reference images and documents.</p>
          <PermissionGate permission="material_finalization.create">
            <Button size="sm" onClick={() => setShowCreate(true)} disabled={!project?._id}><Plus size={14} /> Add Entry</Button>
          </PermissionGate>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const sm = STATUS_META[entry.status] || STATUS_META.finalized;
            return (
              <div key={entry._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{entry.title}</p>
                      {entry.category && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">{entry.category}</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                    </div>
                    {(entry.brand || entry.specification) && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        {[entry.brand, entry.specification].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {entry.description && <p className="text-xs text-[var(--text-secondary)] mt-1 whitespace-pre-wrap">{entry.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <PermissionGate permission="material_finalization.update">
                      <Button size="sm" variant="outline" onClick={() => setFilesFor(entry)}><Upload size={13} /> Files</Button>
                      <button onClick={() => setEditing(entry)} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)]" title="Edit"><Edit2 size={13} /></button>
                    </PermissionGate>
                    <PermissionGate permission="material_finalization.delete">
                      <button onClick={() => handleDeleteEntry(entry)} className="p-1.5 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)]" title="Delete"><Trash2 size={13} /></button>
                    </PermissionGate>
                  </div>
                </div>

                {/* Images */}
                {entry.images?.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2 mt-3">
                    {entry.images.map((img) => (
                      <div key={img._id} className="relative group">
                        <SignedImageThumb
                          loadUrl={() => pmsService.getMatFinFilePreviewUrl(entry._id, img._id)}
                          alt={img.fileName}
                          onClick={() => openSigned(entry._id, img._id, 'preview')}
                          className="aspect-square"
                        />
                        <PermissionGate permission="material_finalization.update">
                          <button
                            onClick={() => handleDeleteFile(entry._id, img._id)}
                            className="absolute top-1 right-1 p-1 rounded-md bg-[var(--surface)]/85 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition"
                            title="Remove image"
                          ><X size={11} /></button>
                        </PermissionGate>
                      </div>
                    ))}
                  </div>
                )}

                {/* Documents */}
                {entry.documents?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {entry.documents.map((doc) => (
                      <div key={doc._id} className="group flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                        <FileText size={14} className="text-[var(--primary)] shrink-0" />
                        <span className="text-xs text-[var(--text-primary)] truncate max-w-[160px]" title={doc.fileName}>{doc.fileName}</span>
                        <button onClick={() => openSigned(entry._id, doc._id, 'preview')} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--primary)]" title="Preview"><Eye size={12} /></button>
                        <button onClick={() => openSigned(entry._id, doc._id, 'download')} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--primary)]" title="Download"><Download size={12} /></button>
                        <PermissionGate permission="material_finalization.update">
                          <button onClick={() => handleDeleteFile(entry._id, doc._id)} className="p-1 rounded hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)]" title="Remove"><X size={12} /></button>
                        </PermissionGate>
                      </div>
                    ))}
                  </div>
                )}

                {(!entry.images?.length && !entry.documents?.length) && (
                  <p className="text-[11px] text-[var(--text-muted)] italic mt-2">No images or documents yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <EntryModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        title="Add Material Finalization"
        withFiles
      />
      {editing && (
        <EntryModal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          onSave={async (d) => { try { await updateEntry(editing._id, d); toast.success('Entry updated'); setEditing(null); } catch (e) { toast.error(e?.message || 'Failed'); } }}
          initial={{ title: editing.title, category: editing.category || '', brand: editing.brand || '', specification: editing.specification || '', description: editing.description || '', status: editing.status || 'finalized' }}
          title="Edit Entry"
        />
      )}
      {filesFor && (
        <EntryFilesUploadModal
          isOpen={!!filesFor}
          onClose={() => setFilesFor(null)}
          title={`Add Files — ${filesFor.title}`}
          kinds={['image', 'document']}
          uploadFn={(fd) => pmsService.uploadMatFinFiles(filesFor._id, fd)}
          onUploaded={() => { refresh(); }}
        />
      )}
    </div>
  );
};

export default MaterialFinalizationTab;
