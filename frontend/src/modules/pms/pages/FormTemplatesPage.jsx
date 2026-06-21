import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, LayoutTemplate, ClipboardList,
  FileText, Hash, Calendar, List, CheckSquare, Mail, Phone, AlignLeft, Type, Minus,
  Eye, LayoutGrid,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import FormPreviewModal from '../components/FormPreviewModal';

const VIEW_KEY = 'formTemplates.view'; // 'grid' | 'list'

const FIELD_META = {
  text:     { label: 'Short Text',     icon: Type },
  textarea: { label: 'Long Text',      icon: AlignLeft },
  email:    { label: 'Email',          icon: Mail },
  phone:    { label: 'Phone',          icon: Phone },
  number:   { label: 'Number',         icon: Hash },
  date:     { label: 'Date',           icon: Calendar },
  dropdown: { label: 'Dropdown',       icon: List },
  checkbox: { label: 'Checkboxes',     icon: CheckSquare },
  section:  { label: 'Section Header', icon: Minus },
};

const templateStats = (template) => ({
  fieldCount:    template.fields?.length || 0,
  requiredCount: template.fields?.filter((f) => f.required).length || 0,
  uniqueTypes:   [...new Set(template.fields?.map((f) => f.type) || [])],
});

// Small icon-only button used in row/card action clusters.
const IconButton = ({ icon: Icon, label, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`p-1.5 rounded-lg transition-colors ${
      danger
        ? 'text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10'
        : 'text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10'
    }`}
  >
    <Icon size={14} />
  </button>
);

const TypeChips = ({ types }) => (
  <div className="flex flex-wrap gap-1">
    {types.map((type) => {
      const meta = FIELD_META[type];
      const Icon = meta?.icon || FileText;
      return (
        <span key={type} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)]">
          <Icon size={8} />
          {meta?.label || type}
        </span>
      );
    })}
  </div>
);

// ─── Template card (grid view) ────────────────────────────────────────────────
const TemplateCard = ({ template, onPreview, onEdit, onDelete }) => {
  const { fieldCount, requiredCount, uniqueTypes } = templateStats(template);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-3 hover:border-[var(--primary)]/30 transition-colors">
      {/* Title */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
          <LayoutTemplate size={18} className="text-[var(--primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-[var(--text-primary)] truncate">{template.title}</p>
          {template.description ? (
            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-relaxed">{template.description}</p>
          ) : (
            <p className="text-xs text-[var(--text-muted)]/50 mt-0.5 italic">No description</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)]">
        <span>{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
        {requiredCount > 0 && (
          <><span className="opacity-40">·</span><span>{requiredCount} required</span></>
        )}
      </div>

      {/* Field type chips */}
      {uniqueTypes.length > 0 && <TypeChips types={uniqueTypes} />}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 mt-auto border-t border-[var(--border)]">
        <Button variant="ghost" size="sm" onClick={() => onPreview(template)} className="flex-1 justify-center">
          <Eye size={12} />
          Preview
        </Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(template)} className="flex-1 justify-center">
          <Edit2 size={12} />
          Edit
        </Button>
        <IconButton icon={Trash2} label="Delete template" danger onClick={() => onDelete(template)} />
      </div>
    </div>
  );
};

// ─── Template row (list view) ─────────────────────────────────────────────────
const TemplateRow = ({ template, onPreview, onEdit, onDelete }) => {
  const { fieldCount, requiredCount, uniqueTypes } = templateStats(template);

  return (
    <div className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 hover:border-[var(--primary)]/30 transition-colors">
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
        <LayoutTemplate size={16} className="text-[var(--primary)]" />
      </div>

      {/* Title + description */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[var(--text-primary)] truncate">{template.title}</p>
        {template.description ? (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{template.description}</p>
        ) : (
          <p className="text-xs text-[var(--text-muted)]/50 mt-0.5 italic">No description</p>
        )}
      </div>

      {/* Type chips — hidden on small screens */}
      <div className="hidden lg:block max-w-[280px]">
        {uniqueTypes.length > 0 && <TypeChips types={uniqueTypes} />}
      </div>

      {/* Stats */}
      <div className="hidden sm:flex flex-col items-end shrink-0 text-[10px] font-bold text-[var(--text-muted)] w-20">
        <span>{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
        {requiredCount > 0 && <span className="opacity-70">{requiredCount} required</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-[var(--border)]">
        <IconButton icon={Eye}   label="Preview form"   onClick={() => onPreview(template)} />
        <IconButton icon={Edit2} label="Edit template"  onClick={() => onEdit(template)} />
        <IconButton icon={Trash2} label="Delete template" danger onClick={() => onDelete(template)} />
      </div>
    </div>
  );
};

// ─── Grid / list view toggle ──────────────────────────────────────────────────
const ViewSwitch = ({ view, onChange }) => (
  <div className="flex items-center gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
    {[
      { key: 'grid', Icon: LayoutGrid, label: 'Grid view' },
      { key: 'list', Icon: List,       label: 'List view' },
    ].map(({ key, Icon, label }) => (
      <button
        key={key}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={view === key}
        onClick={() => onChange(key)}
        className={`p-2 rounded-lg transition-all ${
          view === key
            ? 'bg-[var(--primary)] text-black shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
        }`}
      >
        <Icon size={16} />
      </button>
    ))}
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const FormTemplatesPage = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [view, setView] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(VIEW_KEY) : null;
    return saved === 'list' ? 'list' : 'grid';
  });

  const changeView = useCallback((next) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pmsService.getClientFormTemplates();
      // apiClient's response interceptor already unwraps to response.data,
      // so the payload ({ templates }) sits directly on `res`.
      setTemplates(res?.templates || []);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (template) => {
    if (!window.confirm(`Delete "${template.title}"? This cannot be undone.`)) return;
    try {
      await pmsService.deleteClientFormTemplate(template._id);
      toast.success('Template deleted');
      setTemplates((prev) => prev.filter((t) => t._id !== template._id));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Templates</p>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Client Form Templates</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {templates.length > 0 && <ViewSwitch view={view} onChange={changeView} />}
          <Button variant="primary" onClick={() => navigate('/pms/form-templates/create')}>
            <Plus size={15} />
            New Template
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/15 flex items-center justify-center shrink-0 mt-0.5">
          <ClipboardList size={14} className="text-[var(--primary)]" />
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Build reusable form templates here, then open any project → Documents → Forms tab to attach a template and send the link to your client. Submitted responses are auto-saved as PDF in the project.
        </p>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader /></div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-4">
            <LayoutTemplate size={26} className="text-[var(--text-muted)]" />
          </div>
          <p className="text-sm font-bold text-[var(--text-secondary)]">No form templates yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs leading-relaxed">
            Create your first template to start collecting structured information from clients.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => navigate('/pms/form-templates/create')}>
            <Plus size={14} />
            Create First Template
          </Button>
        </div>
      ) : view === 'list' ? (
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <TemplateRow
              key={t._id}
              template={t}
              onPreview={setPreviewTemplate}
              onEdit={(tpl) => navigate(`/pms/form-templates/edit/${tpl._id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t._id}
              template={t}
              onPreview={setPreviewTemplate}
              onEdit={(tpl) => navigate(`/pms/form-templates/edit/${tpl._id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Client preview modal */}
      <FormPreviewModal
        template={previewTemplate}
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      />
    </div>
  );
};

export default FormTemplatesPage;
