import React, { useState, useMemo } from 'react';
import {
  Plus, ListChecks, Edit2, Trash2, Paperclip, X, MapPin,
} from 'lucide-react';
import { Button, Modal, Loader, FormField, Input, Select } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../../shared/services/pmsService';
import useSnags from '../../hooks/useSnags';
import EntryFilesUploadModal from '../EntryFilesUploadModal';
import SignedImageThumb from '../SignedImageThumb';
import SignedMedia from '../SignedMedia';
import InlineFilePicker from '../InlineFilePicker';
import { uploadGroupedFiles } from '../../utils/mediaKinds';

const SEVERITY_META = {
  low:    { label: 'Low',    cls: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' },
  medium: { label: 'Medium', cls: 'bg-[var(--warning)]/10 text-[var(--warning)]' },
  high:   { label: 'High',   cls: 'bg-[var(--error)]/10 text-[var(--error)]' },
};
const STATUS_META = {
  open:        { label: 'Open',        cls: 'bg-[var(--warning)]/10 text-[var(--warning)]' },
  in_progress: { label: 'In Progress', cls: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' },
  resolved:    { label: 'Resolved',    cls: 'bg-[var(--success)]/10 text-[var(--success)]' },
  closed:      { label: 'Closed',      cls: 'bg-[var(--border)] text-[var(--text-muted)]' },
};
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const FILTERS = [{ id: 'all', label: 'All' }, ...STATUS_OPTIONS.map((s) => ({ id: s.value, label: s.label }))];

const EMPTY = { title: '', issue: '', location: '', area: '', zone: '', severity: 'medium', status: 'open', description: '' };

const SnagModal = ({ isOpen, onClose, onSave, initial = EMPTY, title, withMedia = false }) => {
  const [form, setForm]   = useState(initial);
  const [media, setMedia] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  React.useEffect(() => { if (isOpen) { setForm(initial); setMedia([]); } /* eslint-disable-next-line */ }, [isOpen]);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form, media); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-lg">
      <div className="space-y-4">
        <FormField label="Title" required>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Paint chipped on east wall" />
        </FormField>
        <FormField label="Issue">
          <Input value={form.issue} onChange={(e) => set('issue', e.target.value)} placeholder="Short summary of the defect" />
        </FormField>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Location">
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. 2nd Floor" />
          </FormField>
          <FormField label="Area">
            <Input value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Master Bedroom" />
          </FormField>
          <FormField label="Zone">
            <Input value={form.zone} onChange={(e) => set('zone', e.target.value)} placeholder="e.g. Wardrobe wall" />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Severity">
            <Select value={form.severity} onChange={(v) => set('severity', v)} options={SEVERITY_OPTIONS} />
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Describe the issue and what needs to be done…"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] resize-none"
          />
        </FormField>
        {withMedia && (
          <FormField label="Photos, Audio & Video">
            <InlineFilePicker files={media} onChange={setMedia} kinds={['image', 'audio', 'video']} />
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

const SnagListTab = ({ project }) => {
  const toast = useToast();
  const { snags, counts, isLoading, error, createSnag, updateSnag, deleteSnag, refresh } =
    useSnags(project?._id);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [mediaFor, setMediaFor]     = useState(null);
  const [filter, setFilter]         = useState('all');

  const visible = useMemo(
    () => (filter === 'all' ? snags : snags.filter((s) => s.status === filter)),
    [snags, filter]
  );

  const openSigned = async (snagId, fileId) => {
    try {
      const res = await pmsService.getSnagMediaPreviewUrl(snagId, fileId);
      if (!res?.url) throw new Error('No URL returned');
      window.open(res.url, '_blank', 'noopener');
    } catch (err) { toast.error(err?.message || 'Could not open the file'); }
  };

  const handleCreate = async (form, media) => {
    try {
      const res = await createSnag(form);
      const id = res?.snag?._id;
      if (id && media?.length) {
        await uploadGroupedFiles(media, (fd) => pmsService.uploadSnagMedia(id, fd));
        refresh();
      }
      toast.success('Snag added');
    } catch (err) { toast.error(err?.message || 'Failed'); }
  };

  const handleStatusChange = async (snag, status) => {
    try { await updateSnag(snag._id, { status }); }
    catch (err) { toast.error(err?.message || 'Update failed'); }
  };

  const handleDeleteMedia = async (snagId, fileId) => {
    if (!window.confirm('Remove this file?')) return;
    try { await pmsService.deleteSnagMedia(snagId, fileId); toast.success('Removed'); refresh(); }
    catch (err) { toast.error(err?.message || 'Delete failed'); }
  };

  const handleDeleteSnag = async (snag) => {
    if (!window.confirm(`Delete snag "${snag.title}"?`)) return;
    try { await deleteSnag(snag._id); toast.success('Snag deleted'); }
    catch (err) { toast.error(err?.message || 'Delete failed'); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading snags…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Snag List <span className="text-[var(--text-muted)] font-normal">({snags.length})</span>
        </h3>
        <PermissionGate permission="snag_list.create">
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={!project?._id}><Plus size={14} /> Add Snag</Button>
        </PermissionGate>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => {
          const isActive = filter === f.id;
          const n = f.id === 'all' ? snags.length : (counts?.[f.id] || 0);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors
                ${isActive ? 'bg-[var(--primary)] text-black' : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
            >
              {f.label}
              {n > 0 && <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-black/15 text-black' : 'bg-[var(--border)] text-[var(--text-muted)]'}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-[var(--error)]">Failed to load snags.</p>}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--warning)]/10 flex items-center justify-center mb-3">
            <ListChecks size={22} className="text-[var(--warning)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No snags {filter !== 'all' ? `(${filter.replace('_', ' ')})` : 'logged'}</p>
          <p className="text-xs text-[var(--text-muted)] mb-4">Track site defects with photos, audio/video, severity and resolution status.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((snag) => {
            const sev = SEVERITY_META[snag.severity] || SEVERITY_META.medium;
            const st  = STATUS_META[snag.status] || STATUS_META.open;
            const media = snag.media || [];
            const images = media.filter((m) => m.kind === 'image');
            const audios = media.filter((m) => m.kind === 'audio');
            const videos = media.filter((m) => m.kind === 'video');
            const place = [snag.location, snag.area, snag.zone].filter(Boolean).join(' · ');
            return (
              <div key={snag._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{snag.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sev.cls}`}>{sev.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    {snag.issue && <p className="text-xs font-semibold text-[var(--text-secondary)] mt-1">{snag.issue}</p>}
                    {place && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 inline-flex items-center gap-1"><MapPin size={11} /> {place}</p>
                    )}
                    {snag.description && <p className="text-xs text-[var(--text-secondary)] mt-1 whitespace-pre-wrap">{snag.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <PermissionGate permission="snag_list.update">
                      <div className="w-32">
                        <Select value={snag.status} onChange={(v) => handleStatusChange(snag, v)} options={STATUS_OPTIONS} />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setMediaFor(snag)}><Paperclip size={13} /></Button>
                      <button onClick={() => setEditing(snag)} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)]" title="Edit"><Edit2 size={13} /></button>
                    </PermissionGate>
                    <PermissionGate permission="snag_list.delete">
                      <button onClick={() => handleDeleteSnag(snag)} className="p-1.5 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)]" title="Delete"><Trash2 size={13} /></button>
                    </PermissionGate>
                  </div>
                </div>

                {/* Images */}
                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2 mt-3">
                    {images.map((img) => (
                      <div key={img._id} className="relative group">
                        <SignedImageThumb
                          loadUrl={() => pmsService.getSnagMediaPreviewUrl(snag._id, img._id)}
                          alt={img.fileName}
                          onClick={() => openSigned(snag._id, img._id)}
                          className="aspect-square"
                        />
                        <PermissionGate permission="snag_list.update">
                          <button
                            onClick={() => handleDeleteMedia(snag._id, img._id)}
                            className="absolute top-1 right-1 p-1 rounded-md bg-[var(--surface)]/85 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition"
                            title="Remove photo"
                          ><X size={11} /></button>
                        </PermissionGate>
                      </div>
                    ))}
                  </div>
                )}

                {/* Video */}
                {videos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    {videos.map((vid) => (
                      <div key={vid._id} className="relative group">
                        <SignedMedia kind="video" fileName={vid.fileName} loadUrl={() => pmsService.getSnagMediaPreviewUrl(snag._id, vid._id)} />
                        <PermissionGate permission="snag_list.update">
                          <button
                            onClick={() => handleDeleteMedia(snag._id, vid._id)}
                            className="absolute top-1 right-1 p-1 rounded-md bg-[var(--surface)]/85 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition z-10"
                            title="Remove video"
                          ><X size={12} /></button>
                        </PermissionGate>
                      </div>
                    ))}
                  </div>
                )}

                {/* Audio */}
                {audios.length > 0 && (
                  <div className="space-y-1.5 mt-3">
                    {audios.map((aud) => (
                      <div key={aud._id} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <SignedMedia kind="audio" fileName={aud.fileName} loadUrl={() => pmsService.getSnagMediaPreviewUrl(snag._id, aud._id)} />
                        </div>
                        <PermissionGate permission="snag_list.update">
                          <button
                            onClick={() => handleDeleteMedia(snag._id, aud._id)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 shrink-0"
                            title="Remove audio"
                          ><X size={12} /></button>
                        </PermissionGate>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SnagModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        title="Add Snag"
        withMedia
      />
      {editing && (
        <SnagModal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          onSave={async (d) => { try { await updateSnag(editing._id, d); toast.success('Snag updated'); setEditing(null); } catch (e) { toast.error(e?.message || 'Failed'); } }}
          initial={{ title: editing.title, issue: editing.issue || '', location: editing.location || '', area: editing.area || '', zone: editing.zone || '', severity: editing.severity || 'medium', status: editing.status || 'open', description: editing.description || '' }}
          title="Edit Snag"
        />
      )}
      {mediaFor && (
        <EntryFilesUploadModal
          isOpen={!!mediaFor}
          onClose={() => setMediaFor(null)}
          title={`Add Media — ${mediaFor.title}`}
          kinds={['image', 'audio', 'video']}
          uploadFn={(fd) => pmsService.uploadSnagMedia(mediaFor._id, fd)}
          onUploaded={() => { refresh(); }}
        />
      )}
    </div>
  );
};

export default SnagListTab;
