import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Plus, Trash2, Send, Eye, Link2,
  CheckCircle, Clock, AlertCircle, FileText, ChevronDown, ChevronUp,
  Copy, Check, Pencil,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import FormBuilderModal from './FormBuilderModal';
import SendFormLinkModal from './SendFormLinkModal';

const STATUS_BADGE = {
  active:    { label: 'Active',    color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30' },
  completed: { label: 'Submitted', color: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30' },
  expired:   { label: 'Expired',   color: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)] border-[var(--border)]' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_BADGE[status] || STATUS_BADGE.active;
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${s.color}`}>
      {s.label}
    </span>
  );
};

// ─── Link card ─────────────────────────────────────────────────────────────────
const FormLinkCard = ({ link, onSend, onDelete, onViewResponse }) => {
  const [copied, setCopied] = useState(false);
  const appUrl  = window.location.origin;
  const formUrl = `${appUrl}/forms/${link.token}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const createdAt = link.createdAt
    ? new Date(link.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">
              {link.templateId?.title || 'Untitled Form'}
            </p>
            <StatusBadge status={link.status} />
          </div>
          {link.templateId?.description && (
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
              {link.templateId.description}
            </p>
          )}
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Created {createdAt} · {link.responseCount || 0} response{link.responseCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Delete */}
        <PermissionGate permission={['documents.delete', 'projects.delete']} mode="any">
          <button
            type="button"
            onClick={() => onDelete(link)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--error)]/10 hover:text-[var(--error)] transition-colors shrink-0"
            title="Delete form link"
          >
            <Trash2 size={13} />
          </button>
        </PermissionGate>
      </div>

      {/* Link URL + copy */}
      <div className="flex items-center gap-1.5 bg-[var(--bg)] rounded-lg px-2.5 py-1.5">
        <Link2 size={11} className="text-[var(--text-muted)] shrink-0" />
        <span className="flex-1 text-[10px] font-mono text-[var(--text-muted)] truncate">{formUrl}</span>
        <button type="button" onClick={copyLink} className="shrink-0">
          {copied
            ? <Check size={11} className="text-[var(--success)]" />
            : <Copy size={11} className="text-[var(--text-muted)] hover:text-[var(--primary)]" />}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <PermissionGate permission="documents.upload">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onSend(link)}
            disabled={link.status === 'completed'}
          >
            <Send size={12} />
            Send
          </Button>
        </PermissionGate>
        {link.responseCount > 0 && (
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onViewResponse(link)}>
            <Eye size={12} />
            View Response
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Response viewer ───────────────────────────────────────────────────────────
const ResponseViewer = ({ response, onClose }) => {
  const fields  = response.templateId?.fields || [];
  const data    = response.data || {};
  const submitted = response.submittedAt
    ? new Date(response.submittedAt).toLocaleString('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
      })
    : '';

  const renderValue = (field) => {
    const val = data[field.id];
    if (val === undefined || val === null || val === '') return <em className="text-[var(--text-muted)]">—</em>;
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-[var(--border)]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Form Response</p>
            <p className="text-sm font-extrabold text-[var(--text-primary)]">
              {response.templateId?.title}
            </p>
            {submitted && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Submitted {submitted}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1 p-4 space-y-3">
          {fields.filter((f) => f.type !== 'section').map((f) => (
            <div key={f.id} className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{f.label}</p>
              <p className="text-sm text-[var(--text-primary)]">{renderValue(f)}</p>
            </div>
          ))}
          {response.documentId && (
            <div className="mt-2 pt-3 border-t border-[var(--border)]">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">PDF Generated</p>
              <div className="flex items-center gap-2 text-xs text-[var(--success)]">
                <CheckCircle size={13} />
                Saved to Client Details in Document Repository
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────
/**
 * ClientFormsPanel — content of the "Forms" tab in the project DocumentsTab.
 *
 * Props:
 *   project — { _id, name }
 */
const ClientFormsPanel = ({ project }) => {
  const toast = useToast();
  const [links,        setLinks]        = useState([]);
  const [responses,    setResponses]    = useState([]);
  const [templates,    setTemplates]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [builderOpen,  setBuilderOpen]  = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [sendModal,    setSendModal]    = useState(null);   // the link to send
  const [viewResponse, setViewResponse] = useState(null);  // the response to view
  const [createLinkFor, setCreateLinkFor] = useState(null); // templateId awaiting link creation
  const [showTemplates, setShowTemplates] = useState(false);

  const loadData = useCallback(async () => {
    if (!project?._id) return;
    setLoading(true);
    try {
      const [linksRes, respRes, templRes] = await Promise.all([
        pmsService.getProjectFormLinks(project._id),
        pmsService.getProjectFormResponses(project._id),
        pmsService.getClientFormTemplates(),
      ]);
      setLinks(linksRes?.data?.links || []);
      setResponses(respRes?.data?.responses || []);
      setTemplates(templRes?.data?.templates || []);
    } catch (err) {
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [project?._id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateLink = async (templateId) => {
    setCreateLinkFor(templateId);
    try {
      await pmsService.createFormLink({ projectId: project._id, templateId });
      toast.success('Form link created');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create link');
    } finally {
      setCreateLinkFor(null);
    }
  };

  const handleDeleteLink = async (link) => {
    if (!window.confirm(`Delete this form link? Submitted responses are kept.`)) return;
    try {
      await pmsService.deleteFormLink(link._id);
      toast.success('Form link deleted');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const handleViewResponse = (link) => {
    const resp = responses.find((r) => String(r.formLinkId?._id || r.formLinkId) === String(link._id));
    if (resp) setViewResponse(resp);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-bold text-[var(--text-primary)]">Client Forms</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Create dynamic forms, send links to clients, store responses as PDF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowTemplates((v) => !v); }}
          >
            <ClipboardList size={13} />
            Templates
            {showTemplates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </Button>
          <PermissionGate permission="documents.upload">
            <Button variant="primary" size="sm" onClick={() => { setEditTemplate(null); setBuilderOpen(true); }}>
              <Plus size={13} />
              New Template
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Template library (collapsible) */}
      {showTemplates && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            Form Templates ({templates.length})
          </p>
          {templates.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2">No templates yet. Create your first template.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{t.title}</p>
                    {t.description && (
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{t.description}</p>
                    )}
                    <p className="text-[10px] text-[var(--text-muted)]">{t.fields?.length || 0} fields</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <PermissionGate permission="documents.upload">
                      <button
                        type="button"
                        onClick={() => { setEditTemplate(t); setBuilderOpen(true); }}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--primary)] transition-colors"
                        title="Edit template"
                      >
                        <Pencil size={12} />
                      </button>
                    </PermissionGate>
                    <PermissionGate permission="documents.upload">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleCreateLink(t._id)}
                        disabled={createLinkFor === t._id}
                      >
                        <Link2 size={11} />
                        {createLinkFor === t._id ? 'Creating…' : 'Use for this Project'}
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active form links */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Form Links for this Project ({links.length})
        </p>
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 border border-dashed border-[var(--border)] rounded-xl">
            <FileText size={24} className="text-[var(--text-muted)] mb-2" />
            <p className="text-sm font-bold text-[var(--text-secondary)]">No forms sent yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
              Create a template, then click "Use for this Project" to generate a shareable link for the client.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {links.map((link) => (
              <FormLinkCard
                key={link._id}
                link={link}
                onSend={(l) => setSendModal(l)}
                onDelete={handleDeleteLink}
                onViewResponse={handleViewResponse}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <FormBuilderModal
        isOpen={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditTemplate(null); }}
        template={editTemplate}
        onSaved={() => loadData()}
      />

      {sendModal && (
        <SendFormLinkModal
          isOpen
          onClose={() => setSendModal(null)}
          formLink={sendModal}
        />
      )}

      {viewResponse && (
        <ResponseViewer
          response={viewResponse}
          onClose={() => setViewResponse(null)}
        />
      )}
    </div>
  );
};

export default ClientFormsPanel;
