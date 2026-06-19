import React, { useState } from 'react';
import {
  Plus, HardHat, Edit2, Trash2, Upload, FileText, FileImage, Download, Eye, X,
  Phone, Mail, MapPin, Calendar,
} from 'lucide-react';
import { Button, Modal, Loader, FormField, Input, Select } from '../../../../shared/components';
import DatePicker from '../../../../shared/components/DatePicker/DatePicker';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../../shared/services/pmsService';
import useContractors from '../../hooks/useContractors';
import EntryFilesUploadModal from '../EntryFilesUploadModal';
import InlineFilePicker from '../InlineFilePicker';
import { uploadGroupedFiles } from '../../utils/mediaKinds';

const STATUS_META = {
  active:     { label: 'Active',     cls: 'bg-[var(--success)]/10 text-[var(--success)]' },
  on_hold:    { label: 'On Hold',    cls: 'bg-[var(--warning)]/10 text-[var(--warning)]' },
  completed:  { label: 'Completed',  cls: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' },
  terminated: { label: 'Terminated', cls: 'bg-[var(--error)]/10 text-[var(--error)]' },
};
const STATUS_OPTIONS = [
  { value: 'active',     label: 'Active' },
  { value: 'on_hold',    label: 'On Hold' },
  { value: 'completed',  label: 'Completed' },
  { value: 'terminated', label: 'Terminated' },
];

const FILE_KINDS = ['document', 'image'];

const EMPTY = {
  name: '', company: '', trade: '', phone: '', email: '', address: '',
  scope: '', status: 'active', startDate: '', endDate: '',
  contractValue: '', amountPaid: '', notes: '',
};

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

const toDateInput = (d) => (d ? String(d).slice(0, 10) : '');

const textareaCls =
  'w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] resize-none';

const ContractorModal = ({ isOpen, onClose, onSave, initial = EMPTY, title, withFiles = false }) => {
  const [form, setForm]     = useState(initial);
  const [files, setFiles]   = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  React.useEffect(() => { if (isOpen) { setForm(initial); setFiles([]); } /* eslint-disable-next-line */ }, [isOpen]);

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSave(form, files); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-2xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Directory */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Contractor / contact name" />
          </FormField>
          <FormField label="Company">
            <Input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Firm / company name" />
          </FormField>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Trade / Specialization">
            <Input value={form.trade} onChange={(e) => set('trade', e.target.value)} placeholder="e.g. Civil, Electrical, Plumbing" />
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Phone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Contact number" />
          </FormField>
          <FormField label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" />
          </FormField>
        </div>
        <FormField label="Address">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Office / site address" />
        </FormField>

        {/* Assigned scope */}
        <FormField label="Assigned Scope of Work">
          <textarea
            value={form.scope}
            onChange={(e) => set('scope', e.target.value)}
            rows={2}
            placeholder="What this contractor is responsible for…"
            className={textareaCls}
          />
        </FormField>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Start Date">
            <DatePicker value={toDateInput(form.startDate)} onChange={(e) => set('startDate', e.target.value)} />
          </FormField>
          <FormField label="End Date">
            <DatePicker value={toDateInput(form.endDate)} onChange={(e) => set('endDate', e.target.value)} />
          </FormField>
        </div>

        {/* Payments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Contract Value (₹)">
            <Input type="number" min="0" value={form.contractValue} onChange={(e) => set('contractValue', e.target.value)} placeholder="0" />
          </FormField>
          <FormField label="Amount Paid (₹)">
            <Input type="number" min="0" value={form.amountPaid} onChange={(e) => set('amountPaid', e.target.value)} placeholder="0" />
          </FormField>
        </div>

        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Any additional notes…"
            className={textareaCls}
          />
        </FormField>

        {withFiles && (
          <FormField label="Agreements & Documents">
            <InlineFilePicker files={files} onChange={setFiles} kinds={FILE_KINDS} />
          </FormField>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving} disabled={!form.name.trim()}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};

const PaymentBar = ({ contractValue, amountPaid }) => {
  const value = Number(contractValue) || 0;
  const paid  = Number(amountPaid) || 0;
  const pending = Math.max(0, value - paid);
  const pct = value > 0 ? Math.min(100, Math.round((paid / value) * 100)) : 0;
  if (value <= 0 && paid <= 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
        <span>Payments</span>
        <span>{pct}% paid</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
        <div className="h-full rounded-full bg-[var(--success)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Value</p>
          <p className="text-xs font-bold text-[var(--text-primary)]">{inr(value)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Paid</p>
          <p className="text-xs font-bold text-[var(--success)]">{inr(paid)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Pending</p>
          <p className="text-xs font-bold text-[var(--warning)]">{inr(pending)}</p>
        </div>
      </div>
    </div>
  );
};

const ContractorTab = ({ project }) => {
  const toast = useToast();
  const { contractors, isLoading, error, createContractor, updateContractor, deleteContractor, refresh } =
    useContractors(project?._id);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [filesFor, setFilesFor]     = useState(null);

  const openSigned = async (contractorId, fileId, mode) => {
    try {
      const res = mode === 'download'
        ? await pmsService.getContractorFileDownloadUrl(contractorId, fileId)
        : await pmsService.getContractorFilePreviewUrl(contractorId, fileId);
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
      const res = await createContractor(form);
      const id = res?.contractor?._id;
      if (id && files?.length) {
        await uploadGroupedFiles(files, (fd) => pmsService.uploadContractorFiles(id, fd));
        refresh();
      }
      toast.success('Contractor added');
    } catch (err) { toast.error(err?.message || 'Failed'); }
  };

  const handleDeleteFile = async (contractorId, fileId) => {
    if (!window.confirm('Remove this document?')) return;
    try { await pmsService.deleteContractorFile(contractorId, fileId); toast.success('Document removed'); refresh(); }
    catch (err) { toast.error(err?.message || 'Delete failed'); }
  };

  const handleDeleteContractor = async (c) => {
    if (!window.confirm(`Delete "${c.name}" and all their documents?`)) return;
    try { await deleteContractor(c._id); toast.success('Contractor deleted'); }
    catch (err) { toast.error(err?.message || 'Delete failed'); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Contractors <span className="text-[var(--text-muted)] font-normal">({contractors.length})</span>
        </h3>
        <PermissionGate permission="contractor.create">
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={!project?._id}><Plus size={14} /> Add Contractor</Button>
        </PermissionGate>
      </div>

      {error && <p className="text-xs text-[var(--error)]">Failed to load contractors.</p>}

      {contractors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-3">
            <HardHat size={22} className="text-[var(--primary)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No contractors yet</p>
          <p className="text-xs text-[var(--text-muted)] mb-4">Add contractors with their scope, agreements and payment details.</p>
          <PermissionGate permission="contractor.create">
            <Button size="sm" onClick={() => setShowCreate(true)} disabled={!project?._id}><Plus size={14} /> Add Contractor</Button>
          </PermissionGate>
        </div>
      ) : (
        <div className="space-y-3">
          {contractors.map((c) => {
            const sm = STATUS_META[c.status] || STATUS_META.active;
            const contacts = [c.phone, c.email].filter(Boolean);
            return (
              <div key={c._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{c.name}</p>
                      {c.company && <span className="text-[11px] text-[var(--text-muted)]">· {c.company}</span>}
                      {c.trade && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">{c.trade}</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                    </div>
                    {/* Contacts */}
                    {(contacts.length > 0 || c.address) && (
                      <div className="flex items-center gap-3 flex-wrap mt-1 text-[11px] text-[var(--text-muted)]">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-[var(--primary)]">
                            <Phone size={11} /> {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-[var(--primary)]">
                            <Mail size={11} /> {c.email}
                          </a>
                        )}
                        {c.address && (
                          <span className="inline-flex items-center gap-1"><MapPin size={11} /> {c.address}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <PermissionGate permission="contractor.update">
                      <Button size="sm" variant="outline" onClick={() => setFilesFor(c)}><Upload size={13} /> Files</Button>
                      <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)]" title="Edit"><Edit2 size={13} /></button>
                    </PermissionGate>
                    <PermissionGate permission="contractor.delete">
                      <button onClick={() => handleDeleteContractor(c)} className="p-1.5 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)]" title="Delete"><Trash2 size={13} /></button>
                    </PermissionGate>
                  </div>
                </div>

                {c.scope && <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{c.scope}</p>}

                {(c.startDate || c.endDate) && (
                  <p className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1 mt-1">
                    <Calendar size={11} />
                    {toDateInput(c.startDate) || '—'} → {toDateInput(c.endDate) || '—'}
                  </p>
                )}

                <PaymentBar contractValue={c.contractValue} amountPaid={c.amountPaid} />

                {c.notes && <p className="text-[11px] text-[var(--text-muted)] mt-2 whitespace-pre-wrap">{c.notes}</p>}

                {/* Documents */}
                {c.documents?.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {c.documents.map((doc) => {
                      const Icon = doc.kind === 'image' ? FileImage : FileText;
                      return (
                        <div key={doc._id} className="group flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                          <Icon size={14} className="text-[var(--primary)] shrink-0" />
                          <span className="text-xs text-[var(--text-primary)] truncate max-w-[160px]" title={doc.fileName}>{doc.fileName}</span>
                          <button onClick={() => openSigned(c._id, doc._id, 'preview')} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--primary)]" title="Preview"><Eye size={12} /></button>
                          <button onClick={() => openSigned(c._id, doc._id, 'download')} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--primary)]" title="Download"><Download size={12} /></button>
                          <PermissionGate permission="contractor.update">
                            <button onClick={() => handleDeleteFile(c._id, doc._id)} className="p-1 rounded hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)]" title="Remove"><X size={12} /></button>
                          </PermissionGate>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--text-muted)] italic mt-2">No agreements or documents yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ContractorModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        title="Add Contractor"
        withFiles
      />
      {editing && (
        <ContractorModal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          onSave={async (d) => { try { await updateContractor(editing._id, d); toast.success('Contractor updated'); setEditing(null); } catch (e) { toast.error(e?.message || 'Failed'); } }}
          initial={{
            name: editing.name || '', company: editing.company || '', trade: editing.trade || '',
            phone: editing.phone || '', email: editing.email || '', address: editing.address || '',
            scope: editing.scope || '', status: editing.status || 'active',
            startDate: toDateInput(editing.startDate), endDate: toDateInput(editing.endDate),
            contractValue: editing.contractValue ?? '', amountPaid: editing.amountPaid ?? '',
            notes: editing.notes || '',
          }}
          title="Edit Contractor"
        />
      )}
      {filesFor && (
        <EntryFilesUploadModal
          isOpen={!!filesFor}
          onClose={() => setFilesFor(null)}
          title={`Add Documents — ${filesFor.name}`}
          kinds={FILE_KINDS}
          uploadFn={(fd) => pmsService.uploadContractorFiles(filesFor._id, fd)}
          onUploaded={() => { refresh(); }}
        />
      )}
    </div>
  );
};

export default ContractorTab;
