import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Save, Eye, FileText, CheckCircle, Plus, Trash2, LayoutTemplate } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import Select from '../../../shared/components/Select/Select';
import DynamicTableBuilder from '../../../shared/components/DynamicTableBuilder/DynamicTableBuilder';
import { crmService } from '../../../shared/services/crmService';
// import ProposalPreviewModal from '../components/ProposalPreviewModal';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader } from '../../../shared/components';

const GST_RATE = 0.18; // 18% GST

const generateId = () => Math.random().toString(36).substring(2, 9);

const CreateProposalPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get('leadId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data sources
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Selections & form state
  const [selectedLeadId, setSelectedLeadId] = useState(leadIdParam || '');
  const [proposalTitle, setProposalTitle] = useState('');

  // Array of sections instead of a single structure
  const [sections, setSections] = useState([]);

  const [previewOpen, setPreviewOpen] = useState(false);

  // Deriving the selected client object for the preview modal
  const selectedClient = useMemo(() => {
    return leads.find(l => l._id === selectedLeadId) || {};
  }, [leads, selectedLeadId]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [leadsRes, templatesRes] = await Promise.all([
          crmService.getLeads({ lifecycleStage: 'interested' }),
          crmService.getTemplates()
        ]);

        setLeads(leadsRes?.leads || []);
        setTemplates(templatesRes?.data || []);

        // If editing existing proposal
        const proposalId = searchParams.get('id');
        if (proposalId) {
          const res = await crmService.getProposalById(proposalId);
          const p = res.proposal;
          setSelectedLeadId(p.leadId?._id || p.leadId || '');
          setProposalTitle(p.title || '');
          setSections(p.content?.sections || []);
        }
      } catch (err) {
        toast.error('Failed to load proposal data.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [searchParams]);

  const addTemplateSection = (templateId) => {
    if (!templateId) return;
    const template = templates.find(t => t._id === templateId);
    if (template && template.structure) {
      setSections(prev => [
        ...prev,
        {
          id: generateId(),
          title: template.name,
          structure: JSON.parse(JSON.stringify(template.structure))
        }
      ]);
      // Reset the dropdown
      document.getElementById('template-select').value = '';
    }
  };

  const addManualSection = () => {
    setSections(prev => [
      ...prev,
      {
        id: generateId(),
        title: 'Custom Work Phase',
        structure: { columns: [], rows: [] }
      }
    ]);
  };

  const removeSection = (id) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const updateSectionStructure = (id, newStructure) => {
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, structure: newStructure } : s
    ));
  };

  const updateSectionTitle = (id, newTitle) => {
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, title: newTitle } : s
    ));
  };

  // Auto-calculate totals across ALL sections
  const { subtotal, gst, finalAmount } = useMemo(() => {
    let calculatedSubtotal = 0;

    sections.forEach(section => {
      section.structure.rows.forEach(row => {
        if (row.isGroupHeader) return;

        let amount = 0;
        let qty = 1;
        let rate = 0;
        let amountFound = false;

        section.structure.columns.forEach(col => {
          const val = parseFloat(row.cells[col.id]) || 0;
          const colName = col.label.toLowerCase();

          if (colName.includes('amount') || colName.includes('total') || colName.includes('cost')) {
            amount = val;
            amountFound = true;
          } else if (colName.includes('qty') || colName.includes('quantity')) {
            qty = val;
          } else if (colName.includes('rate') || colName.includes('price')) {
            rate = val;
          }
        });

        if (!amountFound) {
          amount = qty * rate;
        }

        calculatedSubtotal += amount;
      });
    });

    const calculatedGst = calculatedSubtotal * GST_RATE;
    const calculatedFinal = calculatedSubtotal + calculatedGst;

    return {
      subtotal: calculatedSubtotal,
      gst: calculatedGst,
      finalAmount: calculatedFinal
    };
  }, [sections]);

  const handleSave = async (status = 'draft') => {
    if (!selectedLeadId) {
      toast.error('Please select a client (lead).');
      return;
    }
    if (sections.length === 0) {
      toast.error('Please add at least one template or custom table.');
      return;
    }
    if (!proposalTitle.trim()) {
      toast.error('Please enter a proposal title.');
      return;
    }

    setSaving(status);

    try {
      const selectedLead = leads.find(l => l._id === selectedLeadId);

      if (selectedLead && !selectedLead.clientId) {
        await crmService.createClient({
          name: selectedLead.name,
          phone: selectedLead.phone,
          email: selectedLead.email,
          leadId: selectedLeadId,
        });
      }

      const payload = {
        leadId: selectedLeadId,
        templateId: null, // Multiple templates exist now
        title: proposalTitle,
        content: { sections }, // Wrap array in object to ensure schema accepts it well
        subtotal,
        gst,
        finalAmount,
        status
      };

      let response;
      const proposalId = searchParams.get('id');
      
      if (proposalId) {
        response = await crmService.updateProposal(proposalId, payload);
      } else {
        response = await crmService.createProposal(payload);
      }

      const finalId = proposalId || response?.proposal?._id || response?._id;
      
      toast.success(status === 'pending_approval' ? 'Proposal sent for approval!' : 'Proposal saved successfully!');
      
      if (finalId) {
        navigate(`/proposal/review/${finalId}`);
      } else {
        navigate('/proposal/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save proposal.');
    } finally {
      setSaving(false);
    }
  };

  const leadOptions = leads.map(l => ({ value: l._id, label: `${l.name} ${l.phone ? `(${l.phone})` : ''}` }));

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] hover:text-[var(--primary)] text-[var(--text-muted)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Create Proposal</h1>
            <p className="text-[var(--text-muted)] font-medium mt-1">Draft a new formal proposal for interested clients.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => handleSave('draft')} 
            isLoading={saving === 'draft'} 
            className="border-[var(--border)] font-bold"
            disabled={sections.length === 0}
          >
            <Save size={18} className="mr-2" /> Save Draft
          </Button>
          <Button 
            variant="primary" 
            onClick={() => handleSave('pending_approval')} 
            isLoading={saving === 'pending_approval'} 
            className="shadow-lg shadow-[var(--primary)]/20 font-bold"
            disabled={sections.length === 0}
          >
            <Send size={18} className="mr-2" /> Send for Approval
          </Button>
        </div>
      </div>

      {loading && <Loader fullPage label="Syncing leads & templates..." />}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Side: Builder */}
        <div className="flex-1 w-full space-y-6">
          <Card className="shadow-xl shadow-black/5 border-none p-6">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                <FileText size={20} />
              </div>
              <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-wide">Proposal Content</h2>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Proposal Title</label>
              <input
                type="text"
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                placeholder="e.g. Complete Interior Works"
                className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] font-medium outline-none transition-colors"
              />
            </div>

            <div className="space-y-10">
              {sections.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg)]">
                  <p className="text-[var(--text-muted)] font-medium">Add a template or custom table from the right panel to begin.</p>
                </div>
              ) : (
                sections.map((section, index) => (
                  <div key={section.id} className="space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 max-w-sm">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                          className="w-full text-xl font-black text-[var(--text-primary)] bg-transparent border-b-2 border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] outline-none transition-colors pb-1"
                          placeholder="Section Title"
                        />
                      </div>
                      <button
                        onClick={() => removeSection(section.id)}
                        className="p-2 text-[var(--text-muted)] hover:bg-[var(--error)]/10 hover:text-[var(--error)] rounded-xl transition-colors"
                        title="Remove Section"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <DynamicTableBuilder
                      structure={section.structure}
                      onChange={(newStruct) => updateSectionStructure(section.id, newStruct)}
                    />
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Side: Settings & Totals */}
        <div className="w-full lg:w-[380px] shrink-0 space-y-6 sticky top-6">
          <Card className="shadow-xl shadow-black/5 border-none p-6 bg-[var(--surface)]">
            <h3 className="text-lg font-black text-[var(--text-primary)] mb-6 uppercase tracking-wide border-b border-[var(--border)] pb-4">Settings</h3>

            <div className="space-y-6">
              <Select
                label="Select Client (Lead)"
                value={selectedLeadId}
                onChange={setSelectedLeadId}
                options={[{ value: '', label: 'Select Client...' }, ...leadOptions]}
              />

              <div className="space-y-3 pt-4 border-t border-[var(--border)]">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Add Content</label>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <select
                      id="template-select"
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                      onChange={(e) => addTemplateSection(e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>+ Add Template...</option>
                      {templates.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button variant="outline" className="w-full border-dashed" onClick={addManualSection}>
                  <LayoutTemplate size={16} />
                  Add Custom Table
                </Button>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--border)] space-y-3">
              <div className="flex justify-between text-sm font-medium text-[var(--text-secondary)]">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-[var(--text-secondary)]">
                <span>GST (18%)</span>
                <span>Rs. {gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-end pt-3 border-t border-[var(--border)]">
                <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Final Amount</span>
                <span className="text-2xl font-black text-[var(--primary)]">
                  Rs. {finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full mt-8 py-4 text-sm font-bold shadow-lg shadow-[var(--primary)]/20"
              onClick={() => handleSave('draft')}
              isLoading={saving === 'draft'}
              disabled={sections.length === 0 || !selectedLeadId}
            >
              Generate Proposal
            </Button>
          </Card>
        </div>
      </div>

      {/* Modal removed as per requirements - using full-page review instead */}
    </div>
  );
};

export default CreateProposalPage;
