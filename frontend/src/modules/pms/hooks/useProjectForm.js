import { useState, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { usePMS } from '../context/PMSContext';

const INITIAL = {
  clientId:                '',
  proposalId:              '',
  workflowTemplateId:      '',
  name:                    '',
  projectType:             'Residential',
  siteAddress: {
    fullAddress: '',
    buildingName: '',
    tower:        '',
    unit:         '',
    floor:        '',
    city:         '',
  },
  area:                    '',
  budget:                  '',
  estimatedCompletionDate: '',
};

const useProjectForm = (onSuccess) => {
  const toast               = useToast();
  const { invalidateProjects } = usePMS();
  const [form, setForm]         = useState(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors]     = useState({});

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  }, [errors]);

  const setAddressField = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      siteAddress: { ...prev.siteAddress, [field]: value },
    }));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.clientId)                     e.clientId    = 'Client is required';
    if (!form.name.trim())                  e.name        = 'Project name is required';
    if (!form.projectType)                  e.projectType = 'Project type is required';
    if (!form.siteAddress.fullAddress.trim()) e.fullAddress = 'Site address is required';
    return e;
  };

  const submit = useCallback(async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        area:   form.area   ? Number(form.area)   : undefined,
        budget: form.budget ? Number(form.budget) : undefined,
      };
      const res = await pmsService.createProject(payload);
      toast.success(`Project ${res.project.trackingId} created successfully`);
      invalidateProjects();
      setForm(INITIAL);
      onSuccess?.(res.project);
    } catch (err) {
      toast.error(err || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, toast, invalidateProjects, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => { setForm(INITIAL); setErrors({}); }, []);

  return { form, setField, setAddressField, errors, isSubmitting, submit, reset };
};

export default useProjectForm;
