import { useState, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const INITIAL = {
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

const useTaskForm = (projectId, onSuccess) => {
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
    if (!form.taskType) e.taskType = 'Task type is required';
    if (!form.title.trim()) e.title = 'Title is required';
    return e;
  };

  const submit = useCallback(async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        projectId,
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
      toast.success(`Task "${res.task.title}" created`);
      setForm(INITIAL);
      onSuccess?.(res.task);
    } catch (err) {
      toast.error(err || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, projectId, toast, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => { setForm(INITIAL); setErrors({}); }, []);

  return {
    form, setField, setExtField,
    addChecklistItem, updateChecklistItem, removeChecklistItem,
    errors, isSubmitting, submit, reset,
  };
};

export default useTaskForm;
