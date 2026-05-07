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
 * useLeadStatusManager — Hook to manage automatic client status updates.
 * 
 * In the unified architecture, this now makes a SINGLE API call
 * to PATCH /api/clients/status/:id with both status and lifecycleStage
 * (previously required 2 separate calls).
 */
export const useLeadStatusManager = () => {
  /**
   * Automatically transitions a client's status based on a specific action.
   */
  const transitionStatus = useCallback(async (clientId, action) => {
    if (!clientId || !action) return;

    const mapping = ACTION_STATUS_MAP[action];
    if (!mapping) return;

    try {
      // Single API call — PATCH /api/clients/status/:id
      // The new CRMClient controller handles both status + lifecycle in one request
      await crmService.updateClientStatus(clientId, {
        status: mapping.status,
        lifecycleStage: mapping.lifecycle,
      });
      
      console.log(
        `Client ${clientId} transitioned to ${mapping.status}/${mapping.lifecycle} via ${action}`
      );
    } catch (error) {
      console.error(
        `Failed to update client status for ${clientId}:`,
        error
      );
    }
  }, []);

  return {
    transitionStatus,
    LEAD_ACTIONS,
  };
};

export default useLeadStatusManager;
