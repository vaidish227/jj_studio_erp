import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Save, Eye, FileText, CheckCircle, Plus, Trash2, LayoutTemplate, Users, LayoutGrid } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import DynamicTableBuilder from '../../../shared/components/DynamicTableBuilder/DynamicTableBuilder';
import { crmService } from '../../../shared/services/crmService';
// import ProposalPreviewModal from '../components/ProposalPreviewModal';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader, MultiPicker } from '../../../shared/components';

const GST_RATE = 0.18; // 18% GST

const generateId = () => Math.random().toString(36).substring(2, 9);

const CreateProposalPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get('leadId');
  // Bulk preselect via comma-separated leadIds, e.g. /proposal/create?leadIds=a,b,c
  const leadIdsParam = searchParams.get('leadIds');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data sources
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Selections & form state — supports bulk mode: array of selected client objects.
  // When editing an existing proposal, we lock this to a single client.
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [proposalTitle, setProposalTitle] = useState('');

  // Array of sections instead of a single structure
  const [sections, setSections] = useState([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const isEditing = Boolean(searchParams.get('id'));
  const isBulk = !isEditing && selectedLeads.length > 1;

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [leadsRes, templatesRes] = await Promise.all([
          crmService.getLeads({ lifecycleStage: 'interested,proposal_sent,advance_received,project_moved', limit: 200 }),
          crmService.getTemplates()
        ]);

        const leadsList = leadsRes?.leads || [];
        setLeads(leadsList);
        setTemplates(templatesRes?.data || []);

        // If editing existing proposal — lock to its single client
        const proposalId = searchParams.get('id');
        if (proposalId) {
          const res = await crmService.getProposalById(proposalId);
          const p = res.proposal;
          const leadId = p.leadId?._id || p.leadId;
          const existing = leadsList.find((l) => l._id === leadId);
          if (existing) setSelectedLeads([existing]);
          setProposalTitle(p.title || '');
          setSections(p.content?.sections || []);
        } else if (leadIdsParam) {
          // Bulk deep link from ProposalClientsPage — "Draft N Proposals" passes
          // ?leadIds=id1,id2,id3 and we preselect every matching lead so the
          // existing bulk-create flow takes over.
          const wantedIds = leadIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
          const preselected = leadsList.filter((l) => wantedIds.includes(l._id));
          if (preselected.length > 0) setSelectedLeads(preselected);
        } else if (leadIdParam) {
          // Coming from "Draft Proposal for [Lead]" deep link — preselect that one
          const preselected = leadsList.find((l) => l._id === leadIdParam);
          if (preselected) setSelectedLeads([preselected]);
        }
      } catch (err) {
        toast.error('Failed to load proposal data.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Deep-clone a template's structure with fresh column/row ids so two sections
  // built from the same template don't share React keys / entangle their edits.
  const cloneTemplateStructure = (template) => {
    const cloned = JSON.parse(JSON.stringify(template.structure));
    const idMap = {};
    cloned.columns = (cloned.columns || []).map((c) => {
      const newId = generateId();
      idMap[c.id] = newId;
      return { ...c, id: newId };
    });
    cloned.rows = (cloned.rows || []).map((r) => {
      const newCells = {};
      Object.entries(r.cells || {}).forEach(([oldColId, val]) => {
        const newColId = idMap[oldColId];
        if (newColId) newCells[newColId] = val;
      });
      return { ...r, id: generateId(), cells: newCells };
    });
    return cloned;
  };

  // Called by the MultiPicker confirm — receives the full array of templates
  // the user ticked. We append each as a new section (allows the same template
  // to appear twice if they pick it again later).
  const addTemplatesFromPicker = (picked) => {
    const newSections = picked
      .filter((t) => t?.structure)
      .map((t) => ({ id: generateId(), title: t.name, structure: cloneTemplateStructure(t) }));
    if (newSections.length === 0) return;
    setSections((prev) => [...prev, ...newSections]);
    toast.success(`Added ${newSections.length} template${newSections.length === 1 ? '' : 's'}.`);
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

  // Auto-calculate totals across ALL sections.
  // Strategy (least-surprise → fall-back):
  //   1. If a column is explicitly typed 'number' AND named amount/total/cost → that's the row total.
  //   2. Otherwise look for qty + rate (by type and by name) and multiply.
  //   3. As a final fallback, sum all numeric-typed cells (a single 'number' column = the price).
  // Tolerates strings like "5,000" and "₹1,200.50". (#50)
  const parseCellNum = (raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    const cleaned = String(raw).replace(/[₹,\s]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const { subtotal, gst, finalAmount } = useMemo(() => {
    let calculatedSubtotal = 0;

    sections.forEach(section => {
      const numericCols = (section.structure.columns || []).filter(c => c.type === 'number');
      const labelLower = (c) => (c.label || '').toLowerCase();

      const amountCol =
        numericCols.find(c => /(amount|total|cost)/.test(labelLower(c))) ||
        (numericCols.length === 1 ? numericCols[0] : null);
      const qtyCol = numericCols.find(c => /(qty|quantity)/.test(labelLower(c)));
      const rateCol = numericCols.find(c => /(rate|price|unit)/.test(labelLower(c)) && c !== amountCol);

      section.structure.rows.forEach(row => {
        if (row.isGroupHeader) return;

        let amount = null;

        if (amountCol) {
          amount = parseCellNum(row.cells[amountCol.id]);
        }
        if (amount === null && qtyCol && rateCol) {
          const q = parseCellNum(row.cells[qtyCol.id]);
          const r = parseCellNum(row.cells[rateCol.id]);
          if (q !== null && r !== null) amount = q * r;
        }

        if (amount !== null) calculatedSubtotal += amount;
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
    if (selectedLeads.length === 0) {
      toast.error('Please select at least one client.');
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

    const basePayload = {
      templateId: null, // Multiple templates exist now
      title: proposalTitle,
      content: { sections },
      subtotal,
      gst,
      finalAmount,
      status,
    };

    try {
      const proposalId = searchParams.get('id');

      // EDIT MODE — single client, single update
      if (proposalId) {
        const payload = { ...basePayload, leadId: selectedLeads[0]?._id };
        await crmService.updateProposal(proposalId, payload);
        toast.success(status === 'pending_approval' ? 'Proposal sent for approval!' : 'Proposal saved successfully!');
        navigate(`/proposal/review/${proposalId}`);
        return;
      }

      // CREATE MODE — one proposal per selected client (bulk).
      // Use Promise.allSettled so a single failure doesn't abort the rest;
      // we report a clear per-row outcome at the end.
      const results = await Promise.allSettled(
        selectedLeads.map((lead) =>
          crmService.createProposal({ ...basePayload, leadId: lead._id })
        )
      );

      const ok       = results.filter((r) => r.status === 'fulfilled');
      const failed   = results.filter((r) => r.status === 'rejected');
      const verb     = status === 'pending_approval' ? 'sent for approval' : 'saved';

      if (ok.length > 0 && failed.length === 0) {
        toast.success(
          ok.length === 1
            ? `Proposal ${verb} successfully!`
            : `${ok.length} proposals ${verb}.`
        );
      } else if (ok.length > 0 && failed.length > 0) {
        toast.error(`${ok.length} ${verb}, ${failed.length} failed. Check the proposal list and retry the failed ones.`);
      } else {
        toast.error(`Failed to ${status === 'pending_approval' ? 'send' : 'save'} proposals. Please try again.`);
      }

      // Route: single client → straight to its review; many → list page with the right milestone scope.
      if (ok.length === 1) {
        const created = ok[0].value?.proposal || ok[0].value;
        const newId = created?._id;
        if (newId) {
          navigate(`/proposal/review/${newId}`);
          return;
        }
      }
      navigate(status === 'pending_approval' ? '/proposal/list?milestone=pending_approval' : '/proposal/list');
    } catch (err) {
      toast.error(err?.message || 'Failed to save proposal.');
    } finally {
      setSaving(false);
    }
  };

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
            disabled={sections.length === 0 || selectedLeads.length === 0}
          >
            <Save size={18} className="mr-2" />
            {isBulk ? `Save ${selectedLeads.length} Drafts` : 'Save Draft'}
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSave('pending_approval')}
            isLoading={saving === 'pending_approval'}
            className="shadow-lg shadow-[var(--primary)]/20 font-bold"
            disabled={sections.length === 0 || selectedLeads.length === 0}
          >
            <Send size={18} className="mr-2" />
            {isBulk ? `Send ${selectedLeads.length} for Approval` : 'Send for Approval'}
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

              {/* Inline "add more" — saves the user from scrolling back up to the sidebar
                  to add another template once they've started building. Same multi-pick
                  picker as the sidebar; both invoke addTemplatesFromPicker which appends. */}
              {sections.length > 0 && (
                <div className="pt-2 border-t border-dashed border-[var(--border)]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3 text-center">
                    Need another section?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MultiPicker
                      items={templates}
                      value={[]}
                      onChange={addTemplatesFromPicker}
                      getId={(t) => t._id}
                      getLabel={(t) => t.name}
                      getSubtitle={(t) => t.description}
                      getBadge={(t) => t.type}
                      searchFields={['name', 'description', 'type']}
                      placeholder="+ Add more templates..."
                      searchPlaceholder="Search templates..."
                      triggerIcon={LayoutGrid}
                      confirmMode
                      confirmLabel="Add selected"
                      emptyText="No templates yet"
                    />
                    <Button variant="outline" className="border-dashed" onClick={addManualSection}>
                      <LayoutTemplate size={16} />
                      Add Custom Table
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Side: Settings & Totals */}
        <div className="w-full lg:w-[380px] shrink-0 space-y-6 sticky top-6">
          <Card className="shadow-xl shadow-black/5 border-none p-6 bg-[var(--surface)]">
            <h3 className="text-lg font-black text-[var(--text-primary)] mb-6 uppercase tracking-wide border-b border-[var(--border)] pb-4">Settings</h3>

            <div className="space-y-6">
              {/* Client picker — multi-select for bulk create. Locked to a single
                  pick in edit mode (you can't re-target an existing proposal). */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  {isEditing ? 'Client (Lead)' : 'Select Client(s) — Bulk Create Supported'}
                </label>
                <MultiPicker
                  items={leads}
                  value={selectedLeads}
                  onChange={isEditing ? () => {} : setSelectedLeads}
                  getId={(l) => l._id}
                  getLabel={(l) => l.name || 'Unnamed'}
                  getSubtitle={(l) => [l.phone, l.city].filter(Boolean).join(' · ')}
                  getBadge={(l) => l.projectType}
                  searchFields={['name', 'phone', 'email', 'city']}
                  placeholder="Select clients..."
                  searchPlaceholder="Search by name, phone, email..."
                  triggerIcon={Users}
                  disabled={isEditing}
                  emptyText="No leads available"
                />
                {isBulk && (
                  <p className="text-[11px] text-[var(--primary)] font-bold flex items-center gap-1.5 mt-1.5">
                    <CheckCircle size={12} />
                    {selectedLeads.length} proposals will be created — one per client
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t border-[var(--border)]">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Add Content</label>

                {/* Template picker — confirmMode so user can tick many then "Add N" */}
                <MultiPicker
                  items={templates}
                  value={[]}              /* always show empty — we APPEND on commit */
                  onChange={addTemplatesFromPicker}
                  getId={(t) => t._id}
                  getLabel={(t) => t.name}
                  getSubtitle={(t) => t.description}
                  getBadge={(t) => t.type}
                  searchFields={['name', 'description', 'type']}
                  placeholder="+ Add Template(s)..."
                  searchPlaceholder="Search templates..."
                  triggerIcon={LayoutGrid}
                  confirmMode
                  confirmLabel="Add selected"
                  emptyText="No templates yet — create one first"
                />

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
                <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  {isBulk ? 'Per Proposal' : 'Final Amount'}
                </span>
                <span className="text-2xl font-black text-[var(--primary)]">
                  Rs. {finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {isBulk && (
                <p className="text-[11px] text-[var(--text-muted)] font-medium text-right">
                  Each of the {selectedLeads.length} clients will get a separate proposal at this amount.
                </p>
              )}
            </div>

            <Button
              variant="primary"
              className="w-full mt-8 py-4 text-sm font-bold shadow-lg shadow-[var(--primary)]/20"
              onClick={() => handleSave('draft')}
              isLoading={saving === 'draft'}
              disabled={sections.length === 0 || selectedLeads.length === 0}
            >
              {isBulk ? `Generate ${selectedLeads.length} Proposals` : 'Generate Proposal'}
            </Button>
          </Card>
        </div>
      </div>

      {/* Modal removed as per requirements - using full-page review instead */}
    </div>
  );
};

export default CreateProposalPage;
