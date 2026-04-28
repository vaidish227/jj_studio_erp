import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { crmService } from '../../../shared/services/crmService';

const POLL_INTERVAL_MS = 30000;

const matchesQuery = (value, query) =>
  String(value || '')
    .toLowerCase()
    .includes(query.toLowerCase());

const getFollowupBadge = (dateValue) => {
  const now = new Date();
  const date = new Date(dateValue);
  const diff = date.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);

  if (diff < 0) return 'OVERDUE';
  if (diff === 0) return 'TODAY';
  return 'TOMORROW';
};

const useDashboardData = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [state, setState] = useState({
    stats: null,
    pipeline: { newLeads: [], meetings: [], proposals: [] },
    followups: [],
    isLoading: true,
    error: '',
  });

  const fetchDashboardData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: '' }));

    try {
      const [
        allLeadsRes,
        convertedRes,
        lostRes,
        contactedRes,
        meetingDoneRes,
        proposalSentRes,
        followupsRes,
        meetingsRes,
      ] = await Promise.all([
        crmService.getLeads({ limit: 1 }),
        crmService.getLeads({ status: 'converted', limit: 1 }),
        crmService.getLeads({ status: 'lost', limit: 1 }),
        crmService.getLeads({ status: 'contacted', limit: 1 }),
        crmService.getLeads({ status: 'meeting_done', limit: 1 }),
        crmService.getLeads({ status: 'proposal_sent', limit: 1 }),
        crmService.getFollowups(),
        crmService.getMeetings(),
      ]);

      const allLeads = allLeadsRes.leads || [];
      const allMeetings = meetingsRes.meetings || [];
      const allFollowups = followupsRes.followups || [];
      const scheduledMeetings = allMeetings
        .filter((meeting) => meeting.status !== 'cancelled')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setState({
        stats: {
          totalLeads: allLeadsRes.total || 0,
          converted: convertedRes.total || 0,
          followups: allFollowups.filter((item) => item.status !== 'done').length,
          lostLeads: lostRes.total || 0,
          inProgress: (contactedRes.total || 0) + (meetingDoneRes.total || 0),
          interested: proposalSentRes.total || 0,
        },
        pipeline: {
          newLeads: allLeads.slice(0, 5),
          meetings: scheduledMeetings.slice(0, 5),
          proposals: proposalSentRes.leads || [],
        },
        followups: allFollowups
          .filter((item) => item.status !== 'done')
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 5)
          .map((item) => ({
            id: item._id,
            name: item.leadId?.name || 'Unknown Lead',
            project: item.note || 'Follow-up reminder',
            time: item.date ? new Date(item.date).toLocaleString('en-IN') : '—',
            status: getFollowupBadge(item.date),
          })),
        isLoading: false,
        error: '',
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load dashboard data.',
      }));
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const intervalId = window.setInterval(fetchDashboardData, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchDashboardData]);

  const filteredState = useMemo(() => {
    if (!query.trim()) return state;

    return {
      ...state,
      pipeline: {
        newLeads: (state.pipeline.newLeads || []).filter((lead) =>
          [lead.name, lead.phone, lead.projectType, lead.city].some((value) => matchesQuery(value, query))
        ),
        meetings: (state.pipeline.meetings || []).filter((meeting) =>
          [meeting.leadId?.name, meeting.leadId?.phone, meeting.leadId?.projectType, meeting.notes].some((value) =>
            matchesQuery(value, query)
          )
        ),
        proposals: (state.pipeline.proposals || []).filter((lead) =>
          [lead.name, lead.phone, lead.projectType, lead.city].some((value) => matchesQuery(value, query))
        ),
      },
      followups: (state.followups || []).filter((item) =>
        [item.name, item.project, item.time].some((value) => matchesQuery(value, query))
      ),
    };
  }, [query, state]);

  return filteredState;
};

export default useDashboardData;
