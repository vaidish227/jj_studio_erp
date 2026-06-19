import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, LayoutTemplate, ClipboardList,
  FileText, Hash, Calendar, List, CheckSquare, Mail, Phone, AlignLeft, Type, Minus,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

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

// ─── Template card ────────────────────────────────────────────────────────────
const TemplateCard = ({ template, onEdit, onDelete }) => {
  const fieldCount    = template.fields?.length || 0;
  const requiredCount = template.fields?.filter((f) => f.required).length || 0;
  const uniqueTypes   = [...new Set(template.fields?.map((f) => f.type) || [])];

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
      {uniqueTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {uniqueTypes.map((type) => {
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
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
        <Button variant="outline" size="sm" onClick={() => onEdit(template)} className="flex-1 justify-center">
          <Edit2 size={12} />
          Edit
        </Button>
        <button
          type="button"
          onClick={() => onDelete(template)}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
          title="Delete template"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const FormTemplatesPage = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pmsService.getClientFormTemplates();
      setTemplates(res?.data?.templates || []);
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
        <Button variant="primary" onClick={() => navigate('/pms/form-templates/create')}>
          <Plus size={15} />
          New Template
        </Button>
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t._id}
              template={t}
              onEdit={(tpl) => navigate(`/pms/form-templates/edit/${tpl._id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FormTemplatesPage;
