import { useState, useEffect } from 'react';
import { Loader2, Plus, Building2, Pencil } from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { departmentService } from '../services/departmentService';

const inputCls =
  'w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30';

const DepartmentAdminPage = () => {
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#C19A45', order: 0, isActive: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await departmentService.list(); setDepartments(r.departments || []); }
    catch (err) { toast.error(err?.message || 'Failed to load departments'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditing(null); setForm({ name: '', color: '#C19A45', order: 0, isActive: true }); setModalOpen(true); };
  const openEdit = (d) => { setEditing(d); setForm({ name: d.name, color: d.color || '#C19A45', order: d.order || 0, isActive: d.isActive }); setModalOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      if (editing) await departmentService.update(editing._id, form);
      else await departmentService.create(form);
      toast.success(editing ? 'Department updated' : 'Department created');
      setModalOpen(false);
      await load();
    } catch (err) { toast.error(err?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (d) => {
    try {
      if (d.isActive) await departmentService.remove(d._id); // soft-deactivate
      else await departmentService.update(d._id, { isActive: true });
      await load();
    } catch (err) { toast.error(err?.message || 'Failed'); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Departments</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Admin-managed master data. The system works with zero departments configured.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[var(--primary)] text-black font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-[var(--primary-hover)]">
          <Plus size={16} /> Add Department
        </button>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-muted)]"><Loader2 className="animate-spin mr-2" />Loading…</div>
        ) : departments.length === 0 ? (
          <div className="py-16 text-center text-[var(--text-muted)]">
            <Building2 size={34} className="mx-auto opacity-40" />
            <p className="font-semibold mt-2 text-[var(--text-secondary)]">No departments yet</p>
            <p className="text-xs mt-1">Add departments like Design, MIS, Accounts, HR, Marketing — or whatever fits your org.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Color</th>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d._id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{d.name}</td>
                  <td className="px-4 py-3"><span className="inline-block w-5 h-5 rounded" style={{ background: d.color }} /></td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{d.order}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${d.isActive ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20' : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]'}`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(d)} className="text-[var(--text-muted)] hover:text-[var(--primary-active)] mr-3"><Pencil size={15} /></button>
                    <button onClick={() => toggleActive(d)} className="text-xs font-semibold text-[var(--text-secondary)] hover:underline">
                      {d.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Department' : 'Add Department'}>
        <div className="space-y-4">
          <FormField label="Name" required>
            <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Design" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Color">
              <input type="color" className="w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
            </FormField>
            <FormField label="Order">
              <input type="number" className={inputCls} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" isLoading={saving} onClick={save}>Save Department</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DepartmentAdminPage;
