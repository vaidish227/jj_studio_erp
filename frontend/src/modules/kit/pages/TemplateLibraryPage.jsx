import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Edit3, Trash2, Eye, X, Search, FileText } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import Card from '../../../shared/components/Card/Card';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmationModal } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';
import { CHANNELS } from '../constants';

/**
 * TemplateLibraryPage — channel-scoped list of KIT templates.
 * Rendered per channel from the router (e.g. <TemplateLibraryPage channel="whatsapp" />).
 */
const TemplateLibraryPage = ({ channel = 'whatsapp' }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const meta = CHANNELS[channel] || CHANNELS.whatsapp;
  const ChannelIcon = meta.icon;

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [previewItem, setPreviewItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await kitService.getTemplates({ channel });
      setTemplates(res?.data?.templates || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [channel, toast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      [t.name, t.category, t.subject, t.body, t.title].some((f) => (f || '').toLowerCase().includes(q))
    );
  }, [templates, search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await kitService.deleteTemplate(deleteId);
      setTemplates((prev) => prev.filter((t) => t._id !== deleteId));
      toast.success('Template deleted');
      setDeleteId(null);
    } catch (err) {
      toast.error(err?.message || 'Failed to delete template');
    } finally {
      setIsDeleting(false);
    }
  };

  const previewBody = (t) =>
    t.channel === 'email' ? (t.htmlBody || '') : (t.body || t.title || '');

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `color-mix(in srgb, ${meta.accent} 14%, transparent)`, color: meta.accent }}
          >
            <ChannelIcon size={24} />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {meta.label} Templates
            </h1>
            <p className="text-[var(--text-muted)] font-medium">
              Reusable {meta.label.toLowerCase()} messages for KIT campaigns and automations
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate(`/kit/templates/create?channel=${channel}`)}
          className="px-6 py-3"
        >
          <Plus size={18} /> Create Template
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, category, content..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors"
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
          <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">Loading templates...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-3xl p-16 text-center">
          <div className="w-20 h-20 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText size={32} className="text-[var(--text-muted)] opacity-30" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">No Templates Yet</h2>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto mt-2 font-medium">
            Create your first {meta.label.toLowerCase()} template to use in campaigns and automated journeys.
          </p>
          <Button variant="outline" className="mt-8" onClick={() => navigate(`/kit/templates/create?channel=${channel}`)}>
            <Plus size={16} /> Create Template
          </Button>
        </div>
      ) : (
        <Card className="p-0 border-none shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)] border-b border-[var(--border)] uppercase tracking-wider text-[11px] font-black">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((t) => (
                  <tr key={t._id} className="hover:bg-[var(--surface)]/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                        {t.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] font-medium truncate max-w-[320px]">
                        {t.channel === 'email' ? t.subject : (t.title || t.body)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge value={t.category} type="priority" />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${t.isActive ? 'text-[var(--success,#27AE60)]' : 'text-[var(--text-muted)]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-[var(--success,#27AE60)]' : 'bg-[var(--text-muted)]'}`} />
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] font-medium">
                      {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setPreviewItem(t)} title="Preview"
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => navigate(`/kit/templates/edit/${t._id}`)} title="Edit"
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg transition-colors">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => setDeleteId(t._id)} title="Delete"
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Preview modal (raw stored content) */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewItem(null)}>
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg)]">
              <h3 className="font-black text-[var(--text-primary)]">{previewItem.name}</h3>
              <button onClick={() => setPreviewItem(null)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {previewItem.channel === 'email' && (
                <p className="text-sm"><span className="font-bold text-[var(--text-muted)]">Subject: </span>{previewItem.subject}</p>
              )}
              {previewItem.channel === 'notification' && previewItem.title && (
                <p className="text-sm"><span className="font-bold text-[var(--text-muted)]">Title: </span>{previewItem.title}</p>
              )}
              <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]"
                dangerouslySetInnerHTML={previewItem.channel === 'email' ? { __html: previewBody(previewItem) } : undefined}>
                {previewItem.channel === 'email' ? undefined : previewBody(previewItem)}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message="Are you sure you want to delete this template? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default TemplateLibraryPage;
