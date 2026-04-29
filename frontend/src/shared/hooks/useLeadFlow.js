import { useCallback, useEffect, useMemo, useState } from 'react';
import { crmService } from '../services/crmService';

const STORAGE_KEY = 'crm_automation_queue';

const readQueue = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const mergeQueueItem = (item) => {
  const queue = readQueue();
  const filtered = queue.filter(
    (entry) => !(entry.leadId === item.leadId && entry.type === item.type)
  );
  filtered.push(item);
  writeQueue(filtered);
};

const removeQueueItem = (leadId, type) => {
  const queue = readQueue().filter(
    (entry) => !(entry.leadId === leadId && entry.type === type)
  );
  writeQueue(queue);
};

export const lifecycleLabels = {
  enquiry: 'Enquiry',
  meeting_scheduled: 'In Progress',
  thank_you_sent: 'Thank You Sent',
  client_info_pending: 'Client Info Pending',
  kit: 'Qualified',
  followup_due: 'Nurturing',
  show_project: 'Project Shown',
  interested: 'Interested',
  proposal_sent: 'Proposal Sent',
  advance_received: 'Advance Received',
  project_moved: 'Moved to PM',
  converted: 'Converted',
  lost: 'Lost',
};

export const statusLabelMap = {
  new: 'New',
  contacted: 'In Progress',
  meeting_done: 'In Progress',
  proposal_sent: 'Interested',
  converted: 'Converted',
  lost: 'Lost',
};

const getAutomationTasks = (leadId, meetingDate) => {
  const baseTime = new Date(meetingDate).getTime();

  return [
    {
      leadId,
      type: 'thank_you',
      runAt: baseTime + 2 * 60 * 60 * 1000,
    },
    {
      leadId,
      type: 'followup_reminder',
      runAt: baseTime + 2 * 24 * 60 * 60 * 1000,
    },
  ];
};

export const useLeadFlow = (leadId) => {
  const [meetings, setMeetings] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshRelatedData = useCallback(async () => {
    if (!leadId) return;

    setIsLoading(true);
    try {
      const [meetingRes, followupRes, proposalRes] = await Promise.all([
        crmService.getMeetingsByLead(leadId),
        crmService.getFollowupsByLead(leadId),
        crmService.getProposals({ leadId }),
      ]);

      setMeetings(meetingRes.meetings || []);
      setFollowups(followupRes.followups || []);
      setProposals(proposalRes.proposals || []);
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  const scheduleAutomations = useCallback((targetLeadId, meetingDate) => {
    getAutomationTasks(targetLeadId, meetingDate).forEach(mergeQueueItem);
  }, []);

  const processAutomationQueue = useCallback(async () => {
    const now = Date.now();
    const queue = readQueue();

    for (const entry of queue) {
      if (entry.runAt > now) continue;

      try {
        if (entry.type === 'thank_you') {
          await crmService.triggerThankYou(entry.leadId);
        }

        if (entry.type === 'followup_reminder') {
          const reminderDate = new Date(entry.runAt).toISOString();
          await crmService.createFollowup({
            leadId: entry.leadId,
            date: reminderDate,
            note: 'Automated follow-up reminder generated 2 days after the meeting.',
            nextFollowupDate: new Date(entry.runAt + 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        removeQueueItem(entry.leadId, entry.type);
      } catch {
        // Keep failed automation in queue so it can retry later.
      }
    }
  }, []);

  useEffect(() => {
    processAutomationQueue();
    const intervalId = window.setInterval(processAutomationQueue, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [processAutomationQueue]);

  useEffect(() => {
    refreshRelatedData();
  }, [refreshRelatedData]);

  const timeline = useMemo(() => {
    const meetingItems = meetings.map((meeting) => ({
      id: meeting._id,
      type: 'meeting',
      date: meeting.date,
      title: `${meeting.type} meeting`,
      description: meeting.notes || 'Meeting scheduled with the client.',
    }));

    const followupItems = followups.map((followup) => ({
      id: followup._id,
      type: 'followup',
      date: followup.date,
      title: `Follow-up ${followup.status || 'pending'}`,
      description: followup.note || 'Follow-up interaction recorded.',
    }));

    const proposalItems = proposals.map((proposal) => ({
      id: proposal._id,
      type: 'proposal',
      date: proposal.createdAt,
      title: `Proposal ${proposal.status || 'draft'}`,
      description: `Final amount: Rs. ${Number(proposal.finalAmount || 0).toLocaleString('en-IN')}`,
    }));

    return [...meetingItems, ...followupItems, ...proposalItems].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [followups, meetings, proposals]);

  return {
    meetings,
    followups,
    proposals,
    timeline,
    isFlowLoading: isLoading,
    refreshRelatedData,
    scheduleAutomations,
    processAutomationQueue,
  };
};

export default useLeadFlow;
