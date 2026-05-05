import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, FileText, Eye } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';
import Select from '../../../shared/components/Select/Select';
import DynamicTableBuilder from '../../../shared/components/DynamicTableBuilder/DynamicTableBuilder';
import { crmService } from '../../../shared/services/crmService';
import TemplatePreviewModal from '../components/TemplatePreviewModal';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader } from '../../../shared/components';

const TemplateEditorPage = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    type: 'residential',
    description: '',
    structure: { columns: [], rows: [] },
  });

  useEffect(() => {
    if (isEditing) {
      const fetchTemplate = async () => {
        try {
          const response = await crmService.getTemplateById(id);
          const templateData = response.data; // backend returns { success: true, data: {...} }

          if (templateData) {
            setFormData({
              name: templateData.name || '',
              type: templateData.type || 'residential',
              description: templateData.description || '',
              structure: templateData.structure || { columns: [], rows: [] },
            });
          }
        } catch (err) {
          toast.error('Failed to fetch template details.');
        } finally {
          setLoading(false);
        }
      };
      fetchTemplate();
    }
  }, [id, isEditing]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStructureChange = (newStructure) => {
    setFormData((prev) => ({ ...prev, structure: newStructure }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Template name is required.');
      return;
    }

    if (!formData.structure.columns.length) {
      setError('Template must have at least one column.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await crmService.updateTemplate(id, formData);
        toast.success('Template updated successfully!');
      } else {
        await crmService.createTemplate(formData);
        toast.success('Template created successfully!');
      }
      setTimeout(() => navigate('/proposal/templates'), 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader fullPage label="Loading template structure..." />;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/proposal/templates')}
            className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] hover:text-[var(--primary)] text-[var(--text-muted)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {isEditing ? 'Edit Template' : 'Create New Template'}
            </h1>
            <p className="text-[var(--text-muted)] font-medium flex items-center gap-2 mt-1">
              {isEditing ? `Editing: ${formData.name}` : 'Build a dynamic quotation template'}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="px-6 border-[var(--border)]">
            <Eye size={18} />
            Preview
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={saving} className="px-8 shadow-lg shadow-[var(--primary)]/20">
            <Save size={18} />
            {isEditing ? 'Update Template' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Meta Configuration */}
      <Card className="shadow-xl shadow-black/5 border-none p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
            <FileText size={20} />
          </div>
          <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-wide">Template Information</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField label="Template Name" required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Plumbing Quotation"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
            />
          </FormField>

          <Select
            label="Template Type"
            value={formData.type}
            onChange={(val) => handleChange('type', val)}
            options={[
              { value: 'residential', label: 'Residential' },
              { value: 'commercial', label: 'Commercial' },
            ]}
          />

          <div className="lg:col-span-3">
            <FormField label="Description (Optional)">
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Briefly describe what this template is used for..."
                rows={2}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
              />
            </FormField>
          </div>
        </div>
      </Card>

      {/* Dynamic Builder */}
      <div className="pt-4">
        <DynamicTableBuilder
          structure={formData.structure}
          onChange={handleStructureChange}
        />
      </div>

      <TemplatePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        template={formData}
      />
    </div>
  );
};

export default TemplateEditorPage;
