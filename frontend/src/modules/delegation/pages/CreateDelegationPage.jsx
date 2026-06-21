import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ClipboardList, UserCog, CalendarClock, ListChecks, Paperclip, Plus, Trash2,
} from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { delegationService } from '../services/delegationService';
import { PRIORITIES, PRIORITY_META } from '../constants/delegationStatus';
import { PRIORITY_ACCENT } from '../components/delegationFormat';
import AttachmentDropzone, { MAX_ATTACHMENT_BYTES } from '../components/create/AttachmentDropzone';
import ReviewSummaryPanel from '../components/create/ReviewSummaryPanel';
import CreateSuccessScreen from '../components/create/CreateSuccessScreen';

const inputCls =
  'w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30';

const EMPTY_FORM = { title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '' };

// Section wrapper — gives every block a consistent card + iconed header.
const Section = ({ icon: Icon, title, subtitle, children }) => (
  <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--primary)]/10 text-[var(--primary-active)] shrink-0">
        <Icon size={16} />
      </span>
      <div>
        <h2 className="text-sm font-extrabold text-[var(--text-primary)] leading-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-[var(--text-muted)]">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const Label = ({ children, required }) => (
  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
    {children}
    {required && <span className="text-[var(--error)]"> *</span>}
  </label>
);

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

const CreateDelegationPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canAssign = hasPermission('delegation.assign');

  const [form, setForm] = useState(EMPTY_FORM);
  const [checklist, setChecklist] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [files, setFiles] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [assigneeLoading, setAssigneeLoading] = useState(canAssign);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { delegation, assigneeName, dueDate }
  const titleRef = useRef(null);

  useEffect(() => {
    // assigneeLoading starts true (see useState) — the fetch below just flips it
    // off when done, so the empty-state hint never flashes mid-load.
    if (canAssign) {
      delegationService.assignees()
        .then((r) => setAssignees(r.users || []))
        .catch(() => {})
        .finally(() => setAssigneeLoading(false));
    }
  }, [canAssign]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const titleValid = form.title.trim().length >= 3;
  const assigneeName = useMemo(
    () => assignees.find((u) => u._id === form.assignedTo)?.name || '',
    [assignees, form.assignedTo],
  );
  const duePast = !!form.dueDate && startOfDay(form.dueDate) < startOfDay(new Date());

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setChecklist((c) => [...c, v]);
    setNewItem('');
  };

  const addFiles = (incoming) => {
    const tooBig = [];
    const ok = [];
    incoming.forEach((f) => (f.size > MAX_ATTACHMENT_BYTES ? tooBig.push(f.name) : ok.push(f)));
    if (tooBig.length) toast.error(`Skipped (over 20 MB): ${tooBig.join(', ')}`);
    if (ok.length) {
      setFiles((prev) => {
        const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
        return [...prev, ...ok.filter((f) => !seen.has(`${f.name}:${f.size}`))];
      });
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setChecklist([]);
    setNewItem('');
    setFiles([]);
    setError('');
    setResult(null);
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const submit = async () => {
    if (!titleValid) {
      setError('Title is required (min 3 characters).');
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    setBusyLabel('Creating delegation…');
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        assignedTo: canAssign && form.assignedTo ? form.assignedTo : undefined,
        dueDate: form.dueDate || undefined,
        checklist: checklist.map((item) => ({ item })),
      };
      const res = await delegationService.create(payload);
      const created = res.delegation;

      // Attachments use the existing post-create upload endpoint (one call each).
      if (files.length && created?._id) {
        setBusyLabel(`Uploading ${files.length} attachment${files.length === 1 ? '' : 's'}…`);
        const failed = [];
        for (const f of files) {
          try {
            const fd = new FormData();
            fd.append('file', f);
            await delegationService.addAttachment(created._id, fd);
          } catch {
            failed.push(f.name);
          }
        }
        if (failed.length) toast.error(`Delegation created, but some files failed to upload: ${failed.join(', ')}`);
      }

      toast.success('Delegation created');
      setResult({ delegation: created, assigneeName, dueDate: form.dueDate });
    } catch (err) {
      setError(err?.message || 'Failed to create delegation');
    } finally {
      setSaving(false);
      setBusyLabel('');
    }
  };

  if (result) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <CreateSuccessScreen
          delegation={result.delegation}
          assigneeName={result.assigneeName}
          dueDate={result.dueDate}
          onView={() => navigate(`/delegation/${result.delegation._id}`)}
          onCreateAnother={resetForm}
          onDashboard={() => navigate('/delegation')}
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/delegation/list')}
          aria-label="Back to all delegations"
          className="w-10 h-10 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)] transition-colors shrink-0 mt-0.5"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-black shadow-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-active))' }}
          >
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Create Delegation</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Create and assign work responsibilities across teams.</p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-sm text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-xl px-3 py-2.5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Form */}
        <div className="lg:col-span-2 space-y-5">
          <Section icon={ClipboardList} title="Basic Information" subtitle="What needs to be done?">
            <div className="space-y-4">
              <div>
                <Label required>Title</Label>
                <input
                  ref={titleRef}
                  autoFocus
                  className={inputCls}
                  value={form.title}
                  onChange={set('title')}
                  placeholder="e.g. 3D render — master bedroom"
                />
                {form.title.length > 0 && !titleValid && (
                  <p className="text-[11px] text-[var(--warning)] mt-1">Use at least 3 characters.</p>
                )}
              </div>
              <div>
                <Label>Description</Label>
                <textarea className={inputCls} rows={3} value={form.description} onChange={set('description')} placeholder="Add context, links or acceptance criteria…" />
              </div>
              <div>
                <Label>Priority</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRIORITIES.map((p) => {
                    const active = form.priority === p;
                    const accent = PRIORITY_ACCENT[p] || 'var(--text-muted)';
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setForm((f) => ({ ...f, priority: p }))}
                        className="rounded-xl border px-2 py-2.5 text-xs font-bold transition-all"
                        style={
                          active
                            ? { borderColor: accent, color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)` }
                            : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                        }
                      >
                        {PRIORITY_META[p].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>

          {canAssign && (
            <Section icon={UserCog} title="Assignment" subtitle="Who owns this work?">
              <div>
                <Label>Assign to</Label>
                <select className={inputCls} value={form.assignedTo} onChange={set('assignedTo')} disabled={assigneeLoading}>
                  <option value="">{assigneeLoading ? 'Loading users…' : '— unassigned —'}</option>
                  {assignees.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                </select>
                {!assigneeLoading && assignees.length === 0 && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">No assignable users found — you can assign this later.</p>
                )}
              </div>
            </Section>
          )}

          <Section icon={CalendarClock} title="Timeline" subtitle="When is it due?">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Due date</Label>
                <input type="date" className={inputCls} value={form.dueDate} onChange={set('dueDate')} />
                {duePast && <p className="text-[11px] text-[var(--warning)] mt-1">Heads up — this date is in the past.</p>}
              </div>
            </div>
          </Section>

          <Section icon={ListChecks} title="Checklist" subtitle="Optional sub-tasks to track progress.">
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                placeholder="Add a checklist item and press Enter"
              />
              <button type="button" aria-label="Add checklist item" onClick={addItem} className="px-3 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-secondary)]">
                <Plus size={16} />
              </button>
            </div>
            {checklist.length > 0 && (
              <ul className="mt-2 space-y-1">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm bg-[var(--bg)] rounded-lg px-3 py-1.5">
                    <span className="min-w-0 truncate text-[var(--text-secondary)]">{item}</span>
                    <button type="button" aria-label="Remove checklist item" onClick={() => setChecklist((c) => c.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-[var(--error)] shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section icon={Paperclip} title="Attachments" subtitle="Reference files, briefs or assets.">
            <AttachmentDropzone files={files} onAdd={addFiles} onRemove={(i) => setFiles((fs) => fs.filter((_, j) => j !== i))} disabled={saving} />
          </Section>
        </div>

        {/* Sticky live preview + actions */}
        <div className="lg:sticky lg:top-6">
          <ReviewSummaryPanel
            title={form.title.trim()}
            description={form.description.trim()}
            assigneeName={assigneeName}
            priority={form.priority}
            dueDate={form.dueDate}
            checklistCount={checklist.length}
            attachmentCount={files.length}
            canAssign={canAssign}
            titleValid={titleValid}
            duePast={duePast}
            saving={saving}
            busyLabel={busyLabel}
            canSubmit={titleValid}
            onSubmit={submit}
            onCancel={() => navigate('/delegation/list')}
          />
        </div>
      </div>
    </div>
  );
};

export default CreateDelegationPage;
