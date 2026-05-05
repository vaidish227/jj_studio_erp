import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Loader2, Edit3, Trash2, Calendar, LayoutGrid, Eye, X } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import Card from '../../../shared/components/Card/Card';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import { crmService } from '../../../shared/services/crmService';
import TemplatePreviewModal from '../components/TemplatePreviewModal';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader, ConfirmationModal } from '../../../shared/components';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';

const ProposalTemplatesPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('proposal', 'templates');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmService.getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Apply reusable filter system
  const filteredTemplates = process(templates);

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await crmService.deleteTemplate(deleteId);
      setTemplates(prev => prev.filter(t => t._id !== deleteId));
      toast.success('Template deleted successfully');
      setDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete template');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Quotation Templates</h1>
          <p className="text-[var(--text-muted)] font-medium flex items-center gap-2">
            Manage your dynamic proposal structures
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/proposal/templates/create')} className="px-6 py-3 shadow-lg shadow-[var(--primary)]/20">
          <Plus size={18} />
          Create New Template
        </Button>
      </div>

      {/* Advanced Filter System */}
      <AdvancedFilter
        filters={filters}
        filterConfig={filterConfig}
        updateFilter={updateFilter}
        clearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        showSearch={true}
        compact={false}
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
          <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-3xl p-16 text-center">
          <div className="w-20 h-20 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-6">
            <LayoutGrid size={32} className="text-[var(--text-muted)] opacity-30" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">No Templates Found</h2>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto mt-2 font-medium">
            Create your first dynamic quotation template to easily generate structured proposals for your clients.
          </p>
          <Button
            variant="outline"
            className="mt-8"
            onClick={() => navigate('/proposal/templates/create')}
          >
            <Plus size={16} /> Create Template
          </Button>
        </div>
      ) : (
        <Card className="p-0 border-none shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)] border-b border-[var(--border)] uppercase tracking-wider text-[11px] font-black">
                <tr>
                  <th className="px-6 py-4">Template Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Structure</th>
                  <th className="px-6 py-4">Last Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredTemplates.map((template) => {
                  const structure = template.structure || {};
                  const columnsCount = structure.columns?.length || 0;
                  const rowsCount = structure.rows?.length || 0;

                  return (
                    <tr key={template._id} className="hover:bg-[var(--surface)]/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-[var(--text-primary)] text-base group-hover:text-[var(--primary)] transition-colors">
                              {template.name}
                            </p>
                            {template.description && (
                              <p className="text-xs text-[var(--text-muted)] font-medium truncate max-w-[250px]">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge value={template.type} type="priority" />
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--bg)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)]">
                          {columnsCount} Cols × {rowsCount} Rows
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)] font-medium flex items-center gap-2 h-full py-6">
                        <Calendar size={14} />
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPreviewTemplate(template)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                            title="Preview Template"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => navigate(`/proposal/templates/edit/${template._id}`)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg transition-colors"
                            title="Edit Template"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteId(template._id)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition-colors"
                            title="Delete Template"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Preview Modal */}
      <TemplatePreviewModal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        template={previewTemplate}
      />

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

export default ProposalTemplatesPage;
