import { useCallback } from 'react';
import { crmService } from '../services/crmService';

/**
 * Lead Status Transition Mapping
 * Maps CRM actions to their corresponding status and lifecycle stage.
 */
export const LEAD_ACTIONS = {
  SUBMIT_ENQUIRY: 'submit_enquiry',
  SCHEDULE_MEETING: 'schedule_meeting',
  SUBMIT_CLIENT_INFO: 'submit_client_info',
  RECORD_FOLLOWUP: 'record_followup',
  SEND_PROPOSAL: 'send_proposal',
  MARK_INTERESTED: 'mark_interested',
  RECORD_ADVANCE: 'record_advance',
  MARK_LOST: 'mark_lost',
};

const ACTION_STATUS_MAP = {
  [LEAD_ACTIONS.SUBMIT_ENQUIRY]: { status: 'new', lifecycle: 'enquiry' },
  [LEAD_ACTIONS.SCHEDULE_MEETING]: { status: 'contacted', lifecycle: 'meeting_scheduled' },
  [LEAD_ACTIONS.SUBMIT_CLIENT_INFO]: { status: 'contacted', lifecycle: 'kit' },
  [LEAD_ACTIONS.RECORD_FOLLOWUP]: { status: 'contacted', lifecycle: 'kit' },
  [LEAD_ACTIONS.SEND_PROPOSAL]: { status: 'proposal_sent', lifecycle: 'proposal_sent' },
  [LEAD_ACTIONS.MARK_INTERESTED]: { status: 'proposal_sent', lifecycle: 'interested' },
  [LEAD_ACTIONS.RECORD_ADVANCE]: { status: 'converted', lifecycle: 'converted' },
  [LEAD_ACTIONS.MARK_LOST]: { status: 'lost', lifecycle: 'lost' },
};

/**
 * useLeadStatusManager — Hook to manage automatic lead status updates.
 */
export const useLeadStatusManager = () => {
  /**
   * Automatically transitions a lead's status based on a specific action.
   */
  const transitionStatus = useCallback(async (leadId, action) => {
    if (!leadId || !action) return;

    const mapping = ACTION_STATUS_MAP[action];
    if (!mapping) return;

    try {
      // First update the status (this also triggers some lifecycle mapping in backend)
      await crmService.updateLeadStatus(leadId, mapping.status);
      
      // If the action requires a specific lifecycle stage that differs from the default 
      // mapping in the backend's updateLeadStatus, we update it explicitly.
      if (mapping.lifecycle) {
        await crmService.updateLead(leadId, { lifecycleStage: mapping.lifecycle });
      }
      
      console.log(`Lead ${leadId} automatically transitioned to ${mapping.status}/${mapping.lifecycle} via ${action}`);
    } catch (error) {
      console.error(`Failed to automatically update lead status for ${leadId}:`, error);
    }
  }, []);

  return {
    transitionStatus,
    LEAD_ACTIONS,
  };
};

export default useLeadStatusManager;
