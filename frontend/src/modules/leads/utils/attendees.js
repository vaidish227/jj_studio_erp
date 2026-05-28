// Shared helpers for the AttendeesEditor on Schedule / Reschedule modals.
// Used by both MeetingsPage and MeetingsCalendarPage so the modal seeding
// behaviour stays identical across surfaces.

export const EMPTY_ATTENDEES = { internal: [], client: [] };

export const seedClientAttendeesForLead = (lead) => {
  if (!lead?.name) return [];
  return [{
    name: lead.name,
    phone: lead.phone || '',
    email: lead.email || '',
    relation: 'lead',
    notifyEmail: true,
    notifyWhatsApp: true,
  }];
};

// Convert backend attendees (with populated userId references) → editor format
export const hydrateAttendeesFromMeeting = (meeting) => {
  if (!meeting?.attendees) return EMPTY_ATTENDEES;
  const internal = (meeting.attendees.internal || []).map((a) => ({
    userId: a.userId?._id || a.userId,
    name: a.name || a.userId?.name || '',
    email: a.email || a.userId?.email || '',
    phone: a.phone || a.userId?.phone || '',
    role: a.role || a.userId?.role || '',
    notifyEmail: a.notifyEmail !== false,
    notifyWhatsApp: a.notifyWhatsApp !== false,
  }));
  const client = (meeting.attendees.client || []).map((a) => ({
    name: a.name,
    phone: a.phone || '',
    email: a.email || '',
    relation: a.relation || 'other',
    notifyEmail: a.notifyEmail !== false,
    notifyWhatsApp: a.notifyWhatsApp !== false,
  }));
  return { internal, client };
};
