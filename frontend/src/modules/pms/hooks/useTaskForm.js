import { useState, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const INITIAL = {
  projectId:   '',
  taskType:    '',
  title:       '',
  assignedTo:  '',
  priority:    'medium',
  startDate:   '',
  dueDate:     '',
  notes:       '',
  checklist:   [],
  externalCoordination: {
    isNeeded:          false,
    vendorId:          '',
    quotationUrl:      '',
    amount:            '',
  },
};

// initialProjectId: fixed projectId prop (e.g. from ProjectDetailPage).
// When null/undefined the caller (AssignTaskPage) sets form.projectId via setField().
const useTaskForm = (initialProjectId = '', onSuccess) => {
  const toast                           = useToast();
  const [form, setForm]                 = useState(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors]             = useState({});

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  }, [errors]);

  const setExtField = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      externalCoordination: { ...prev.externalCoordination, [field]: value },
    }));
  }, []);

  const addChecklistItem = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      checklist: [...prev.checklist, { item: '', isCompleted: false }],
    }));
  }, []);

  const updateChecklistItem = useCallback((idx, value) => {
    setForm((prev) => {
      const updated = [...prev.checklist];
      updated[idx] = { ...updated[idx], item: value };
      return { ...prev, checklist: updated };
    });
  }, []);

  const removeChecklistItem = useCallback((idx) => {
    setForm((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== idx),
    }));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.projectId && !initialProjectId) e.projectId = 'Project is required';
    if (!form.taskType) e.taskType = 'Task type is required';
    if (!form.title.trim()) e.title = 'Title is required';
    return e;
  };

  // extraFields: optional overrides injected by the calling component (e.g. notifyMail, notifyWhatsApp)
  const submit = useCallback(async (extraFields = {}) => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setIsSubmitting(true);
    // form.projectId wins when set by selector; fall back to the constructor param
    const resolvedProjectId = form.projectId || initialProjectId;
    try {
      const payload = {
        ...form,
        ...extraFields,
        projectId: resolvedProjectId,
        externalCoordination: form.externalCoordination.isNeeded
          ? {
              ...form.externalCoordination,
              amount: form.externalCoordination.amount
                ? Number(form.externalCoordination.amount)
                : undefined,
            }
          : { isNeeded: false },
      };
      const res = await pmsService.createTask(payload);
      toast.success(`Task "${res.task.title}" assigned`);

      const nr = res.notificationResults || {};
      if (nr.whatsapp?.sent === false) {
        toast.warning(
          nr.whatsapp.reason === 'no_phone'
            ? 'WhatsApp skipped — no phone number saved for this employee'
            : `WhatsApp failed: ${nr.whatsapp.reason}`
        );
      }
      if (nr.mail?.sent === false) {
        toast.warning(
          nr.mail.reason === 'no_email'
            ? 'Email skipped — no email address on file'
            : `Email failed: ${nr.mail.reason}`
        );
      }

      setForm(INITIAL);
      onSuccess?.(res.task);
    } catch (err) {
      toast.error(err || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, initialProjectId, toast, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => { setForm(INITIAL); setErrors({}); }, []);

  return {
    form, setField, setExtField,
    addChecklistItem, updateChecklistItem, removeChecklistItem,
    errors, isSubmitting, submit, reset,
  };
};

export default useTaskForm;
