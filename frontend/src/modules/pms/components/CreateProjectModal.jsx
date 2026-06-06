import React, { useState, useEffect, useMemo } from 'react';
import { Workflow } from 'lucide-react';
import { Modal, Button, FormField, Input, Select } from '../../../shared/components';
import ClientSearchSelect from '../../../shared/components/ClientSearchSelect/ClientSearchSelect';
import useProjectForm from '../hooks/useProjectForm';
import { pmsService } from '../../../shared/services/pmsService';

const PROJECT_TYPES = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial',  label: 'Commercial' },
];

// Pick the best-fit default template for a given project type.
// Preference: type-match default > Any default > first active.
const pickDefaultTemplate = (templates, projectType) => {
  if (!templates?.length) return null;
  const actives = templates.filter((t) => t.isActive !== false);
  return (
    actives.find((t) => t.isDefault && t.projectType === projectType) ||
    actives.find((t) => t.isDefault && t.projectType === 'Any') ||
    actives.find((t) => t.isDefault) ||
    actives[0]
  );
};

const CreateProjectModal = ({ isOpen, onClose, onCreated }) => {
  const { form, setField, setAddressField, errors, isSubmitting, submit, reset } = useProjectForm(onCreated);
  const [selectedClient, setSelectedClient] = useState(null);

  // Workflow templates — loaded once when the modal opens.
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setTplLoading(true);
    pmsService.listWorkflowTemplates()
      .then((res) => {
        if (cancelled) return;
        const list = (res.templates || []).filter((t) => t.isActive !== false);
        setTemplates(list);
        // Auto-select the best-fit default for the current project type.
        if (!form.workflowTemplateId) {
          const pick = pickDefaultTemplate(list, form.projectType);
          if (pick) setField('workflowTemplateId', pick._id);
        }
      })
      .catch(() => setTemplates([]))
      .finally(() => { if (!cancelled) setTplLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // When project type changes, re-pick the default template (only if the user
  // hasn't explicitly overridden — i.e., still on a default-pick result).
  useEffect(() => {
    if (!templates.length) return;
    const current = templates.find((t) => t._id === form.workflowTemplateId);
    const previousDefault = pickDefaultTemplate(templates, current?.projectType);
    // Only auto-switch if the current selection was itself the auto-pick.
    if (current && current._id !== previousDefault?._id) return;
    const nextDefault = pickDefaultTemplate(templates, form.projectType);
    if (nextDefault && nextDefault._id !== form.workflowTemplateId) {
      setField('workflowTemplateId', nextDefault._id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.projectType, templates]);

  const templateOptions = useMemo(
    () => templates.map((t) => ({
      value: t._id,
      label: `${t.name}${t.isDefault ? ' (default)' : ''} — ${t.projectType || 'Any'} · ${t.phaseCount} phases · ${t.taskCount} tasks`,
    })),
    [templates]
  );

  // Selected template (with phases) for the preview strip.
  const selectedTemplate = templates.find((t) => t._id === form.workflowTemplateId);
  const phasePreview = useMemo(() => {
    if (!selectedTemplate?.phases?.length) return [];
    return [...selectedTemplate.phases].sort((a, b) => a.order - b.order);
  }, [selectedTemplate]);

  const handleClientChange = (client) => {
    setSelectedClient(client);
    setField('clientId', client?._id || '');
    if (client) {
      // Auto-populate fields from CRMClient record
      if (client.projectType) setField('projectType', client.projectType);
      if (!form.name && client.name) setField('name', `${client.name} — ${client.projectType || 'Interior'} Project`);
      if (client.address || client.city) {
        setAddressField('fullAddress', client.address || '');
        setAddressField('city', client.city || '');
      }
      if (client.budget || client.quotedAmount) {
        setField('budget', String(client.budget || client.quotedAmount || ''));
      }
      if (client.approxArea || client.area) {
        setField('area', String(client.approxArea || client.area || ''));
      }
    }
  };

  const handleClose = () => {
    setSelectedClient(null);
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Project" className="max-w-xl">
      <div className="space-y-4">

        <FormField label="Client" error={errors.clientId} required>
          <ClientSearchSelect
            value={selectedClient}
            onChange={handleClientChange}
            placeholder="Search client by name or phone..."
          />
        </FormField>

        <FormField label="Proposal ID" error={errors.proposalId}>
          <Input
            value={form.proposalId}
            onChange={(e) => setField('proposalId', e.target.value)}
            placeholder="Paste Proposal ObjectId (optional)"
          />
        </FormField>

        <FormField label="Project Name" error={errors.name} required>
          <Input
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="e.g. Mehta Villa — 3BHK Redesign"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Project Type" error={errors.projectType} required>
            <Select
              value={form.projectType}
              onChange={(val) => setField('projectType', val)}
              options={PROJECT_TYPES}
            />
          </FormField>

          <FormField label="Area (sqft)">
            <Input
              type="number"
              value={form.area}
              onChange={(e) => setField('area', e.target.value)}
              placeholder="1800"
            />
          </FormField>
        </div>

        {/* Workflow Template — drives which phases / tasks / sign-offs spawn */}
        <FormField
          label={
            <span className="inline-flex items-center gap-1.5">
              <Workflow size={12} className="text-[var(--primary)]" />
              Workflow Template
              {tplLoading && <span className="text-[10px] text-[var(--text-muted)] font-normal">(loading…)</span>}
            </span>
          }
        >
          <Select
            value={form.workflowTemplateId}
            onChange={(val) => setField('workflowTemplateId', val)}
            options={templateOptions}
            placeholder={tplLoading ? 'Loading templates…' : 'Pick a workflow (auto-selected)'}
            disabled={tplLoading || templateOptions.length === 0}
          />
          {selectedTemplate?.description && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{selectedTemplate.description}</p>
          )}
        </FormField>

        {/* Phase preview — shows the exact stepper the project will get */}
        {phasePreview.length > 0 && (
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Phase Flow Preview
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              {phasePreview.map((p, idx) => (
                <React.Fragment key={`${p.name}-${idx}`}>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                    <span className="w-4 h-4 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[9px] font-black flex items-center justify-center">
                      {p.order}
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--text-primary)] capitalize">
                      {p.name}
                    </span>
                  </div>
                  {idx < phasePreview.length - 1 && (
                    <span className="text-[var(--text-muted)] text-xs">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <FormField label="Site Address" error={errors.fullAddress} required>
          <Input
            value={form.siteAddress.fullAddress}
            onChange={(e) => setAddressField('fullAddress', e.target.value)}
            placeholder="Full site address"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Building / Society">
            <Input
              value={form.siteAddress.buildingName}
              onChange={(e) => setAddressField('buildingName', e.target.value)}
              placeholder="Prestige Heights"
            />
          </FormField>
          <FormField label="City">
            <Input
              value={form.siteAddress.city}
              onChange={(e) => setAddressField('city', e.target.value)}
              placeholder="Mumbai"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Unit">
            <Input value={form.siteAddress.unit} onChange={(e) => setAddressField('unit', e.target.value)} placeholder="4B" />
          </FormField>
          <FormField label="Floor">
            <Input value={form.siteAddress.floor} onChange={(e) => setAddressField('floor', e.target.value)} placeholder="12" />
          </FormField>
          <FormField label="Tower">
            <Input value={form.siteAddress.tower} onChange={(e) => setAddressField('tower', e.target.value)} placeholder="A" />
          </FormField>
        </div>

        <FormField label="Budget (₹)">
          <Input
            type="number"
            value={form.budget}
            onChange={(e) => setField('budget', e.target.value)}
            placeholder="4500000"
          />
        </FormField>

        <FormField label="Expected Completion Date">
          <Input
            type="date"
            value={form.estimatedCompletionDate}
            onChange={(e) => setField('estimatedCompletionDate', e.target.value)}
          />
        </FormField>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={isSubmitting}>
            Create Project
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateProjectModal;
