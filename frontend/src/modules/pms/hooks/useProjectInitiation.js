import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const useProjectInitiation = (proposalId) => {
  const toast = useToast();

  const [proposal, setProposal]             = useState(null);
  const [existingProject, setExistingProject] = useState(null);
  const [isLoadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError]       = useState(null);

  const [isSubmitting, setSubmitting] = useState(false);

  // Team pre-assignments — each slot holds a full user object or null
  const [team, setTeam] = useState({
    primaryDesigner: null,
    supervisor:      null,
    designerB:       null,
    designerC:       null,
    designerD:       null,
    designerE:       null,
    contractor:      null,
  });

  const [overrides, setOverrides] = useState({
    name:                    '',
    notes:                   '',
    estimatedCompletionDate: '',
  });

  const setTeamMember = useCallback((field, user) => {
    setTeam((prev) => ({ ...prev, [field]: user }));
  }, []);

  const setOverride = useCallback((field, value) => {
    setOverrides((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Fetch proposal preview on mount
  useEffect(() => {
    if (!proposalId) return;
    let cancelled = false;

    pmsService.getProposalPreview(proposalId)
      .then((res) => {
        if (cancelled) return;
        setProposal(res.proposal);
        setExistingProject(res.existingProject);

        // Pre-fill name from proposal/client
        const client = res.proposal?.leadId;
        const autoName = `${client?.name || ''} — ${client?.projectType || 'Interior'} Project`;
        setOverrides((prev) => ({
          ...prev,
          name: autoName,
          notes: res.proposal?.notes || '',
        }));
      })
      .catch((err) => { if (!cancelled) setPreviewError(err); })
      .finally(() => { if (!cancelled) setLoadingPreview(false); });

    return () => { cancelled = true; };
  }, [proposalId]);

  const submit = useCallback(async (onSuccess) => {
    if (!proposalId) return;

    setSubmitting(true);
    try {
      const payload = {
        proposalId,
        name:                    overrides.name.trim() || undefined,
        notes:                   overrides.notes.trim() || undefined,
        estimatedCompletionDate: overrides.estimatedCompletionDate || undefined,
        // Team — send ObjectIds, drop null slots
        ...Object.fromEntries(
          Object.entries(team)
            .filter(([, user]) => user?._id)
            .map(([field, user]) => [field, user._id])
        ),
      };

      const res = await pmsService.initiateFromProposal(payload);
      toast.success(`Project "${res.project.name}" initiated successfully!`);
      onSuccess?.(res.project);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to initiate project';
      // Surface duplicate-project error specially
      if (err?.response?.status === 409) {
        toast.error('A project already exists for this proposal.');
        return err.response.data;
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [proposalId, overrides, team, toast]);

  return {
    proposal,
    existingProject,
    isLoadingPreview,
    previewError,
    team,
    setTeamMember,
    overrides,
    setOverride,
    isSubmitting,
    submit,
  };
};

export default useProjectInitiation;
