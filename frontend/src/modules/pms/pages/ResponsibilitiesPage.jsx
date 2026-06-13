import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Plus, Edit2, Trash2, Archive, ArchiveRestore, Lock, Search } from 'lucide-react';
import { Modal, Button, FormField, Input, Select, Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import { useAuth } from '../../../shared/context/AuthContext';

/**
 * ResponsibilitiesPage — admin master list backing the dynamic team modal.
 *
 * `system: true` rows (lead_designer, supervisor) cannot be deleted or have
 * their slug changed — downstream services resolve those by slug.
 */

const CATEGORIES = [
  { value: 'design', label: 'Design' },
  { value: 'site',   label: 'Site' },
  { value: 'exec',   label: 'Execution' },
  { value: 'other',  label: 'Other' },
];

const ROLE_OPTIONS = ['designer', 'manager', 'admin', 'md', 'supervisor'];
const VENDOR_KIND_OPTIONS = ['ac', 'automation', 'kitchen', 'bathroom_material', 'cp_fittings', 'wall_floor_material'];

// Curated icon picker — covers the most useful lucide icons without bloating the page.
const ICON_OPTIONS = [
  'Star', 'Ruler', 'Settings2', 'Droplets', 'Layers', 'HardHat', 'Wrench',
  'Users', 'User', 'Briefcase', 'PenTool', 'Hammer', 'Compass', 'Brush',
  'Lightbulb', 'Home', 'Building2', 'TreePine', 'Truck',
];

const COLOR_OPTIONS = [
  { value: 'text-[var(--primary)]', label: 'Primary' },
  { value: 'text-blue-600',         label: 'Blue' },
  { value: 'text-indigo-600',       label: 'Indigo' },
  { value: 'text-cyan-600',         label: 'Cyan' },
  { value: 'text-purple-600',       label: 'Purple' },
  { value: 'text-amber-600',        label: 'Amber' },
  { value: 'text-slate-600',        label: 'Slate' },
  { value: 'text-emerald-600',      label: 'Emerald' },
  { value: 'text-orange-600',       label: 'Orange' },
  { value: 'text-pink-600',         label: 'Pink' },
  { value: 'text-red-600',          label: 'Red' },
];

const Icon = ({ name, className, size = 16 }) => {
  const Comp = (name && LucideIcons[name]) || LucideIcons.Users;
  return <Comp size={size} className={className} />;
};

const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// ── Editor modal ─────────────────────────────────────────────────────────────
const EditorModal = ({ responsibility, isOpen, onClose, onSaved }) => {
  const toast = useToast();
  const isEdit = !!responsibility;
  const [form, setForm] = useState({
    name: '', slug: '', category: 'design', icon: 'Users', color: 'text-[var(--text-muted)]',
    defaultRoles: [], vendorKinds: [], order: 0, isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (responsibility) {
      setForm({
        name:         responsibility.name,
        slug:         responsibility.slug,
        category:     responsibility.category || 'design',
        icon:         responsibility.icon || 'Users',
        color:        responsibility.color || 'text-[var(--text-muted)]',
        defaultRoles: responsibility.defaultRoles || [],
        vendorKinds:  responsibility.vendorKinds  || [],
        order:        responsibility.order || 0,
        isActive:     responsibility.isActive !== false,
      });
    } else {
      setForm({
        name: '', slug: '', category: 'design', icon: 'Users', color: 'text-[var(--text-muted)]',
        defaultRoles: [], vendorKinds: [], order: 0, isActive: true,
      });
    }
  }, [isOpen, responsibility?._id]);

  const toggleArrayValue = (key, val) => {
    setForm((f) => {
      const arr = f[key].includes(val) ? f[key].filter((v) => v !== val) : [...f[key], val];
      return { ...f, [key]: arr };
    });
  };

  const handleSubmit = async () => {
    const trimmed = { ...form, name: form.name.trim(), slug: form.slug.trim() };
    if (!trimmed.name) return toast.error('Name is required');
    if (!isEdit && !trimmed.slug) return toast.error('Slug is required');
    setSubmitting(true);
    try {
      if (isEdit) {
        const { slug, ...editable } = trimmed;
        await pmsService.updateResponsibility(responsibility._id, editable);
        toast.success('Responsibility updated');
      } else {
        await pmsService.createResponsibility(trimmed);
        toast.success('Responsibility created');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Responsibility' : 'New Responsibility'}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  slug: isEdit ? f.slug : slugify(name),
                }));
              }}
              placeholder="e.g. MEP Coordination"
            />
          </FormField>
          <FormField label="Slug" required>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              disabled={isEdit}
              placeholder="mep_coordination"
            />
            {isEdit && (
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                <Lock size={9} className="inline mr-1" /> Slug is immutable after creation
              </p>
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Category">
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Display order">
            <Input
              type="number"
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))}
            />
          </FormField>
        </div>

        <FormField label="Icon">
          <div className="grid grid-cols-10 gap-1 p-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] max-h-32 overflow-y-auto">
            {ICON_OPTIONS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setForm((f) => ({ ...f, icon: name }))}
                title={name}
                className={`p-2 rounded ${form.icon === name ? 'bg-[var(--primary)]/15 ring-1 ring-[var(--primary)]' : 'hover:bg-[var(--border)]/40'}`}
              >
                <Icon name={name} className={form.color} />
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Color">
          <div className="flex flex-wrap gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  form.color === c.value
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/40'
                }`}
              >
                <Icon name={form.icon} className={c.value} size={13} />
                {c.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Default picker roles">
          <p className="text-[11px] text-[var(--text-muted)] -mt-1 mb-1.5">
            The employee picker filters to these roles for this responsibility.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleArrayValue('defaultRoles', r)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                  form.defaultRoles.includes(r)
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Vendor kinds owned">
          <p className="text-[11px] text-[var(--text-muted)] -mt-1 mb-1.5">
            Vendor groups (AC, kitchen, etc.) auto-include users assigned to this responsibility.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {VENDOR_KIND_OPTIONS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleArrayValue('vendorKinds', v)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                  form.vendorKinds.includes(v)
                    ? 'border-[var(--warning)] bg-[var(--warning)]/10 text-[var(--warning)]'
                    : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </FormField>
      </div>

      <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-[var(--border)]">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} isLoading={submitting}>
          {isEdit ? 'Save Changes' : 'Create Responsibility'}
        </Button>
      </div>
    </Modal>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
const ResponsibilitiesPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [responsibilities, setResponsibilities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const canManage = ['admin', 'md'].includes(user?.role);

  const load = async () => {
    setIsLoading(true);
    try {
      // apiClient's response interceptor already unwraps to the JSON body, so
      // the resolved value IS `{ count, responsibilities }` — not `{ data }`.
      // (Destructuring `{ data }` here read `undefined`, so `data.responsibilities`
      // threw on every load and surfaced a bogus "Failed to load" toast.)
      const res = await pmsService.listResponsibilities();
      setResponsibilities(res?.responsibilities || []);
    } catch (e) {
      toast.error('Failed to load responsibilities');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const handleArchive = async (r, activate = false) => {
    try {
      await pmsService.updateResponsibility(r._id, { isActive: activate });
      toast.success(activate ? 'Reactivated' : 'Archived');
      load();
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (r) => {
    if (r.system) return toast.error('System responsibilities cannot be deleted');
    if (!window.confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    try {
      await pmsService.deleteResponsibility(r._id);
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    }
  };

  const filtered = responsibilities.filter((r) =>
    !search
      ? true
      : r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">Project Responsibilities</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Customise the roles that appear in the project team modal.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus size={14} className="mr-1.5" /> New Responsibility
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
        <Search size={14} className="text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug..."
          className="flex-1 bg-transparent text-sm outline-none text-[var(--text-primary)]"
        />
      </div>

      {isLoading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-2xl">
          <p className="text-sm text-[var(--text-muted)]">No responsibilities found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-bold">Name</th>
                <th className="px-4 py-2.5 font-bold">Slug</th>
                <th className="px-4 py-2.5 font-bold">Category</th>
                <th className="px-4 py-2.5 font-bold">Roles</th>
                <th className="px-4 py-2.5 font-bold">Vendor kinds</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                {canManage && <th className="px-4 py-2.5 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id} className={`border-b border-[var(--border)] ${!r.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name={r.icon} className={r.color} />
                      <span className="font-semibold text-[var(--text-primary)]">{r.name}</span>
                      {r.system && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] px-1.5 py-0.5 rounded-full">
                          <Lock size={8} /> System
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[var(--text-muted)]">{r.slug}</td>
                  <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{r.category}</td>
                  <td className="px-4 py-3">
                    {r.defaultRoles?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {r.defaultRoles.map((role) => (
                          <span key={role} className="text-[10px] font-semibold bg-[var(--bg)] border border-[var(--border)] px-1.5 py-0.5 rounded">{role}</span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-[var(--text-muted)]">Any</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.vendorKinds?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {r.vendorKinds.map((v) => (
                          <span key={v} className="text-[10px] font-semibold bg-[var(--warning)]/10 text-[var(--warning)] px-1.5 py-0.5 rounded">{v}</span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-[var(--text-muted)]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.isActive ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
                      {r.isActive ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditing(r); setEditorOpen(true); }}
                          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg)]"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        {r.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleArchive(r, false)}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--warning)] hover:bg-[var(--bg)]"
                            title="Archive"
                          >
                            <Archive size={13} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleArchive(r, true)}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--bg)]"
                            title="Reactivate"
                          >
                            <ArchiveRestore size={13} />
                          </button>
                        )}
                        {!r.system && (
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg)]"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditorModal
        responsibility={editing}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />
    </div>
  );
};

export default ResponsibilitiesPage;
