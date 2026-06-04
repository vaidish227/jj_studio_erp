import apiClient from './apiClient';

export const pmsService = {
  // ─── Projects ──────────────────────────────────────────────────────────────
  createProject:         (data)              => apiClient.post('/pms/project/create', data),
  getAllProjects:         (params)            => apiClient.get('/pms/project/all', { params }),
  getProjectById:        (id)                => apiClient.get(`/pms/project/${id}`),
  updateProject:         (id, data)          => apiClient.put(`/pms/project/update/${id}`, data),
  deleteProject:         (id)                => apiClient.delete(`/pms/project/delete/${id}`),
  updateKickstart:       (id, data)          => apiClient.patch(`/pms/project/kickstart/${id}`, data),
  updateTeam:            (id, data)          => apiClient.patch(`/pms/project/team/${id}`, data),
  updateClientApproval:  (id, data)          => apiClient.patch(`/pms/project/client-approval/${id}`, data),

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  createTask:            (data)                      => apiClient.post('/pms/task/create', data),
  getAllTasks:            (params)                    => apiClient.get('/pms/task/all', { params }),
  getTasksByProject:     (projectId)                 => apiClient.get(`/pms/task/project/${projectId}`),
  getMyTasks:            ()                          => apiClient.get('/pms/task/my-tasks'),
  getTaskById:           (id)                        => apiClient.get(`/pms/task/${id}`),
  updateTask:            (id, data)                  => apiClient.put(`/pms/task/update/${id}`, data),
  toggleChecklist:       (taskId, idx, isCompleted)  => apiClient.patch(`/pms/task/checklist/${taskId}/${idx}`, { isCompleted }),
  deleteTask:            (id)                        => apiClient.delete(`/pms/task/delete/${id}`),

  // ─── Drawings ──────────────────────────────────────────────────────────────
  uploadDrawing:         (data)              => apiClient.post('/pms/drawing/upload', data),
  reviseDrawing:         (id, data)          => apiClient.post(`/pms/drawing/revise/${id}`, data),
  getAllDrawings:         (params)            => apiClient.get('/pms/drawing/all', { params }),
  getPendingApprovals:   ()                  => apiClient.get('/pms/drawing/pending-approvals'),
  getDrawingsByProject:  (projectId, params) => apiClient.get(`/pms/drawing/project/${projectId}`, { params }),
  getDrawingsByTask:     (taskId)            => apiClient.get(`/pms/drawing/task/${taskId}`),
  sendForApproval:       (id)                => apiClient.patch(`/pms/drawing/send-for-approval/${id}`),
  approveDrawing:        (id, data)          => apiClient.patch(`/pms/drawing/approve/${id}`, data),
  rejectDrawing:         (id, data)          => apiClient.patch(`/pms/drawing/reject/${id}`, data),
  releaseDrawing:        (id)                => apiClient.patch(`/pms/drawing/release/${id}`),
  deleteDrawing:         (id)                => apiClient.delete(`/pms/drawing/delete/${id}`),

  // ─── Vendors ───────────────────────────────────────────────────────────────
  getVendors:            (params)            => apiClient.get('/pms/vendor/all', { params }),
  createVendor:          (data)              => apiClient.post('/pms/vendor/create', data),
  updateVendor:          (id, data)          => apiClient.put(`/pms/vendor/update/${id}`, data),
  deleteVendor:          (id)                => apiClient.delete(`/pms/vendor/delete/${id}`),

  // ─── Site Logs ─────────────────────────────────────────────────────────────
  createSiteLog:         (data)              => apiClient.post('/pms/sitelog/create', data),
  getSiteLogsByProject:  (projectId)         => apiClient.get(`/pms/sitelog/project/${projectId}`),

  // ─── Milestones ────────────────────────────────────────────────────────────
  createMilestone:       (data)              => apiClient.post('/pms/milestone/create', data),
  getMilestonesByProject:(projectId)         => apiClient.get(`/pms/milestone/project/${projectId}`),
  updateMilestone:       (id, data)          => apiClient.put(`/pms/milestone/update/${id}`, data),
  deleteMilestone:       (id)                => apiClient.delete(`/pms/milestone/delete/${id}`),

  // ─── Activity Log ──────────────────────────────────────────────────────────
  getProjectActivity:    (projectId, params) => apiClient.get(`/pms/activity/project/${projectId}`, { params }),

  // ─── Site Visits ───────────────────────────────────────────────────────────
  createSiteVisit:       (data)              => apiClient.post('/pms/sitevisit/create', data),
  getSiteVisitsByProject:(projectId)         => apiClient.get(`/pms/sitevisit/project/${projectId}`),
  updateSiteVisit:       (id, data)          => apiClient.put(`/pms/sitevisit/update/${id}`, data),
  deleteSiteVisit:       (id)                => apiClient.delete(`/pms/sitevisit/delete/${id}`),

  // ─── Materials ─────────────────────────────────────────────────────────────
  createMaterial:        (data)              => apiClient.post('/pms/material/create', data),
  getMaterialsByProject: (projectId)         => apiClient.get(`/pms/material/project/${projectId}`),
  updateMaterial:        (id, data)          => apiClient.put(`/pms/material/update/${id}`, data),

  // ─── Purchase Orders ───────────────────────────────────────────────────────
  createPO:              (data)              => apiClient.post('/pms/po/create', data),
  getPOsByProject:       (projectId)         => apiClient.get(`/pms/po/project/${projectId}`),
  updatePO:              (id, data)          => apiClient.put(`/pms/po/update/${id}`, data),
  deletePO:              (id)                => apiClient.delete(`/pms/po/delete/${id}`),

  // ─── Approvals ─────────────────────────────────────────────────────────────
  requestApproval:       (data)              => apiClient.post('/pms/approval/request', data),
  getProjectApprovals:   (projectId)         => apiClient.get(`/pms/approval/project/${projectId}`),
  getPendingApprovalsByUser: (userId)        => apiClient.get(`/pms/approval/pending/${userId}`),
  respondToApproval:     (id, data)          => apiClient.patch(`/pms/approval/respond/${id}`, data),

  // ─── WhatsApp Groups ───────────────────────────────────────────────────────
  createWhatsAppGroup:        (data)         => apiClient.post('/pms/whatsapp-group/create', data),
  getAllWhatsAppGroups:        (params)       => apiClient.get('/pms/whatsapp-group/all', { params }),
  getWhatsAppGroupsByProject: (projectId)    => apiClient.get(`/pms/whatsapp-group/project/${projectId}`),
  getWhatsAppGroupById:       (id)           => apiClient.get(`/pms/whatsapp-group/${id}`),
  updateWhatsAppGroup:        (id, data)     => apiClient.put(`/pms/whatsapp-group/update/${id}`, data),
  deleteWhatsAppGroup:        (id)           => apiClient.delete(`/pms/whatsapp-group/delete/${id}`),
  addWhatsAppGroupMember:     (id, data)     => apiClient.post(`/pms/whatsapp-group/${id}/members`, data),
  removeWhatsAppGroupMember:  (id, phone)    => apiClient.delete(`/pms/whatsapp-group/${id}/members/${encodeURIComponent(phone)}`),
  syncWhatsAppGroup:          (id)           => apiClient.post(`/pms/whatsapp-group/${id}/sync`),
  sendWhatsAppGroupUpdate:    (id, data)     => apiClient.post(`/pms/whatsapp-group/send/${id}`, data),

  // ─── Calendar ──────────────────────────────────────────────────────────────
  getCalendarEvents:     (params)            => apiClient.get('/pms/calendar/events', { params }),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  getGlobalStats:        ()                  => apiClient.get('/pms/dashboard/global-stats'),
  getProjectDashboard:   (projectId)         => apiClient.get(`/pms/dashboard/project/${projectId}`),
  getUserDashboard:      (params)            => apiClient.get('/pms/dashboard/user', { params }),

  // ─── Task Workflow (designer→PM review cycle) ─────────────────────────────
  submitTask:       (id, data)  => apiClient.patch(`/pms/task/submit/${id}`, data || {}),
  approveTask:      (id, data)  => apiClient.patch(`/pms/task/approve/${id}`, data || {}),
  requestRevision:  (id, data)  => apiClient.patch(`/pms/task/request-revision/${id}`, data),
  reassignTask:     (id, data)  => apiClient.patch(`/pms/task/reassign/${id}`, data),
  getReviewQueue:   (params)    => apiClient.get('/pms/task/review-queue', { params }),

  // ─── Workflow Engine (Phase 1) ────────────────────────────────────────────
  // Override every gate currently blocking a task; flips task.status blocked → not_started.
  overrideTaskGate:    (taskId, data) =>
    apiClient.post(`/pms/task/${taskId}/override`, data),
  // Override a single project-level gate by id. Used by ProjectGatesTab.
  overrideProjectGate: (projectId, gateId, data) =>
    apiClient.post(`/pms/project/${projectId}/gates/${gateId}/override`, data),

  // ─── Workflow Engine (Phase 2) ────────────────────────────────────────────
  getProjectGates:     (projectId) => apiClient.get(`/pms/project/${projectId}/gates`),

  // ─── Principal Designer review (Phase 2) ──────────────────────────────────
  getDrawingPDReview:  (drawingId)        => apiClient.get(`/pms/drawing/${drawingId}/pd-review`),
  requestPDReview:     (drawingId, data)  => apiClient.post(`/pms/drawing/${drawingId}/pd-review/request`, data || {}),
  respondPDReview:     (drawingId, data)  => apiClient.post(`/pms/drawing/${drawingId}/pd-review/respond`, data),

  // ─── Vendor Engagement (Phase 2) ──────────────────────────────────────────
  createVendorEngagement:    (data)            => apiClient.post('/pms/vendor-engagement/create', data),
  getVendorEngagements:      (projectId)       => apiClient.get(`/pms/vendor-engagement/project/${projectId}`),
  getVendorEngagementById:   (id)              => apiClient.get(`/pms/vendor-engagement/${id}`),
  recordVendorQuote:         (id, data)        => apiClient.patch(`/pms/vendor-engagement/${id}/quote`, data),
  recordVendorClientApproval:(id, data)        => apiClient.patch(`/pms/vendor-engagement/${id}/client-approval`, data || {}),
  emitVendorPO:              (id, data)        => apiClient.post(`/pms/vendor-engagement/${id}/emit-po`, data),
  markVendorDelivered:       (id, data)        => apiClient.patch(`/pms/vendor-engagement/${id}/delivered`, data || {}),
  markVendorSiteReceived:    (id, data)        => apiClient.patch(`/pms/vendor-engagement/${id}/site-received`, data || {}),
  cancelVendorEngagement:    (id, data)        => apiClient.patch(`/pms/vendor-engagement/${id}/cancel`, data),

  // ─── Drawing Release Log (Phase 2) ────────────────────────────────────────
  getDrawingReleaseLog:      (drawingId)       => apiClient.get(`/pms/drawing/${drawingId}/release-log`),
  ackDrawingRelease:         (logId, data)     => apiClient.post(`/pms/drawing/release-log/${logId}/ack`, data || {}),

  // ─── MyDay (Phase 3a) ──────────────────────────────────────────────────────
  getMyDay:                  ()                => apiClient.get('/pms/myday'),

  // ─── Handover (Phase 3b) ───────────────────────────────────────────────────
  getHandover:               (projectId)               => apiClient.get(`/pms/handover/project/${projectId}`),
  requestHandover:           (projectId, data)         => apiClient.post(`/pms/handover/project/${projectId}/request`, data || {}),
  updateHandoverDrawing:     (id, itemId, data)        => apiClient.patch(`/pms/handover/${id}/drawings/${itemId}`, data),
  addHandoverPunch:          (id, data)                => apiClient.post(`/pms/handover/${id}/punch`, data),
  resolveHandoverPunch:      (id, punchId, data)       => apiClient.patch(`/pms/handover/${id}/punch/${punchId}`, data),
  signHandover:              (id, data)                => apiClient.post(`/pms/handover/${id}/sign`, data || {}),
  acceptHandover:            (id, data)                => apiClient.post(`/pms/handover/${id}/accept`, data || {}),
  rejectHandover:            (id, data)                => apiClient.post(`/pms/handover/${id}/reject`, data),

  // ─── Templates admin (Phase 3b) ────────────────────────────────────────────
  listChecklistTemplates:    (params)                  => apiClient.get('/pms/templates/checklist', { params }),
  getChecklistTemplate:      (id)                      => apiClient.get(`/pms/templates/checklist/${id}`),
  createChecklistTemplate:   (data)                    => apiClient.post('/pms/templates/checklist', data),
  updateChecklistTemplate:   (id, data)                => apiClient.patch(`/pms/templates/checklist/${id}`, data),
  deleteChecklistTemplate:   (id)                      => apiClient.delete(`/pms/templates/checklist/${id}`),
  listWorkflowTemplates:     ()                        => apiClient.get('/pms/templates/workflow'),
  getWorkflowTemplate:       (id)                      => apiClient.get(`/pms/templates/workflow/${id}`),

  // ─── Analytics (Phase 4) ───────────────────────────────────────────────────
  getGateAging:              ()                        => apiClient.get('/pms/analytics/gate-aging'),
  getDrawingReleaseSLA:      (params)                  => apiClient.get('/pms/analytics/drawing-release-sla', { params }),
  getDesignerUtilisation:    ()                        => apiClient.get('/pms/analytics/designer-utilisation'),
  getVendorPerformance:      ()                        => apiClient.get('/pms/analytics/vendor-performance'),
  getProjectProfitability:   ()                        => apiClient.get('/pms/analytics/project-profitability'),

  // ─── Designer-scoped project list ─────────────────────────────────────────
  getMyProjects:    (params)    => apiClient.get('/pms/project/my-projects', { params }),

  // ─── Assignable Users (task assignment & team management) ─────────────────
  getAssignableUsers:      ()                       => apiClient.get('/pms/users/assignable'),
  updateUserContact:       (userId, data)           => apiClient.patch(`/pms/users/${userId}/contact`, data),

  // ─── Project Initiation (Proposal → PMS) ──────────────────────────────────
  getProposalPreview:    (proposalId)        => apiClient.get(`/pms/project-initiation/proposal-preview/${proposalId}`),
  initiateFromProposal:  (data)              => apiClient.post('/pms/project-initiation/from-proposal', data),

  // ─── PMS Dashboard (operational landing page) ─────────────────────────────
  getDashboardOverview:  (period = 'month')  => apiClient.get(`/pms/dashboard/overview?period=${period}`),

  // ─── DLR Sheet ─────────────────────────────────────────────────────────────
  getDLRSheet:           (projectId)         => apiClient.get(`/pms/drawing/dlr/${projectId}`),

  // ─── DDMS — Designer Dashboard ────────────────────────────────────────────
  getDesignerDashboard:  ()                  => apiClient.get('/pms/designer/dashboard'),

  // ─── DDMS — Design Comments ────────────────────────────────────────────────
  getDrawingComments:    (drawingId)         => apiClient.get(`/pms/design-comments/${drawingId}`),
  addDrawingComment:     (drawingId, data)   => apiClient.post(`/pms/design-comments/${drawingId}`, data),

  // ─── DDMS — Revision Requests ─────────────────────────────────────────────
  createRevisionRequest:         (data)      => apiClient.post('/pms/design-revisions', data),
  getRevisionRequestsByDrawing:  (drawingId) => apiClient.get(`/pms/design-revisions/drawing/${drawingId}`),
  resolveRevisionRequest:        (id)        => apiClient.patch(`/pms/design-revisions/${id}/resolve`),

  // ─── Responsibilities (dynamic team master list) ──────────────────────────
  listResponsibilities:    (params)         => apiClient.get('/pms/responsibility/all', { params }),
  createResponsibility:    (data)           => apiClient.post('/pms/responsibility/create', data),
  updateResponsibility:    (id, data)       => apiClient.patch(`/pms/responsibility/update/${id}`, data),
  deleteResponsibility:    (id, opts = {})  => apiClient.delete(`/pms/responsibility/delete/${id}`, { params: opts }),
};
