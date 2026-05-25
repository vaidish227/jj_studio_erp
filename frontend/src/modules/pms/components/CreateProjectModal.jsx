import React, { useState } from 'react';
import { Modal, Button, FormField, Input, Select } from '../../../shared/components';
import ClientSearchSelect from '../../../shared/components/ClientSearchSelect/ClientSearchSelect';
import useProjectForm from '../hooks/useProjectForm';

const PROJECT_TYPES = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial',  label: 'Commercial' },
];

const CreateProjectModal = ({ isOpen, onClose, onCreated }) => {
  const { form, setField, setAddressField, errors, isSubmitting, submit, reset } = useProjectForm(onCreated);
  const [selectedClient, setSelectedClient] = useState(null);

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
