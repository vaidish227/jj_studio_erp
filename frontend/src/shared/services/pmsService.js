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
  // Multipart file upload — pass a FormData instance. Axios drops the JSON
  // default content-type when undefined so the browser writes its own
  // multipart boundary.
  uploadDrawingFile:     (formData)          => apiClient.post('/pms/drawing/upload', formData, {
    headers: { 'Content-Type': undefined },
  }),
  reviseDrawing:         (id, data)          => apiClient.post(`/pms/drawing/revise/${id}`, data),
  // Auto-revision lookup for the upload form: returns { version: <next> }.
  getNextDrawingVersion: (params)            => apiClient.get('/pms/drawing/next-version', { params }),
  // Signed-URL accessors: { url, source, expiresIn }
  // Pass { historyVersion: N } to sign a past revision instead of the current file.
  getDrawingDownloadUrl: (id, { historyVersion } = {}) =>
    apiClient.get(`/pms/drawing/${id}/download`,
      historyVersion != null ? { params: { historyVersion } } : undefined),
  getDrawingPreviewUrl:  (id, { historyVersion } = {}) =>
    apiClient.get(`/pms/drawing/${id}/preview`,
      historyVersion != null ? { params: { historyVersion } } : undefined),
  getAllDrawings:         (params)            => apiClient.get('/pms/drawing/all', { params }),
  getPendingApprovals:   ()                  => apiClient.get('/pms/drawing/pending-approvals'),
  getDrawingsByProject:  (projectId, params) => apiClient.get(`/pms/drawing/project/${projectId}`, { params }),
  getDrawingsByTask:     (taskId)            => apiClient.get(`/pms/drawing/task/${taskId}`),
  sendForApproval:       (id)                => apiClient.patch(`/pms/drawing/send-for-approval/${id}`, {}),
  approveDrawing:        (id, data)          => apiClient.patch(`/pms/drawing/approve/${id}`, data),
  rejectDrawing:         (id, data)          => apiClient.patch(`/pms/drawing/reject/${id}`, data),
  releaseDrawing:        (id)                => apiClient.patch(`/pms/drawing/release/${id}`),
  deleteDrawing:         (id)                => apiClient.delete(`/pms/drawing/delete/${id}`),

  // ─── Drawing Annotations (Phase 6) ────────────────────────────────────────
  // Coordinates are normalized [0,1]; the modal converts to pixels on render.
  listDrawingAnnotations:   (id, version) =>
    apiClient.get(`/pms/drawing/${id}/annotations`,
      version != null ? { params: { version } } : undefined),
  createDrawingAnnotation:  (id, data)    => apiClient.post(`/pms/drawing/${id}/annotations`, data),
  updateDrawingAnnotation:  (annotationId, data) =>
    apiClient.patch(`/pms/drawing/annotation/${annotationId}`, data),
  deleteDrawingAnnotation:  (annotationId) => apiClient.delete(`/pms/drawing/annotation/${annotationId}`),

  // ─── Document Repository ───────────────────────────────────────────────────
  // Returns { documents, counts } — counts keyed by category for tab badges.
  getProjectDocuments:   (projectId, params) => apiClient.get(`/pms/document/project/${projectId}`, { params }),
  // Multipart manual upload — pass a FormData with file, projectId, name,
  // description, category. Same content-type trick as uploadDrawingFile.
  uploadProjectDocument: (formData)          => apiClient.post('/pms/document/upload', formData, {
    headers: { 'Content-Type': undefined },
  }),
  // Signed-URL accessors: { url, source, expiresIn }
  getDocumentDownloadUrl: (id)               => apiClient.get(`/pms/document/${id}/download`),
  getDocumentPreviewUrl:  (id)               => apiClient.get(`/pms/document/${id}/preview`),
  updateProjectDocument:  (id, data)         => apiClient.patch(`/pms/document/${id}`, data),
  deleteProjectDocument:  (id)               => apiClient.delete(`/pms/document/${id}`),

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
  getWorkflowTemplateOptions:()                        => apiClient.get('/pms/templates/workflow/options'),
  createWorkflowTemplate:    (data)                    => apiClient.post('/pms/templates/workflow', data),
  updateWorkflowTemplate:    (id, data)                => apiClient.patch(`/pms/templates/workflow/${id}`, data),
  deleteWorkflowTemplate:    (id)                      => apiClient.delete(`/pms/templates/workflow/${id}`),

  // ─── Analytics (Phase 4) ───────────────────────────────────────────────────
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
  getDesignerKRA:        (period = 'month')  => apiClient.get(`/pms/dashboard/designer-kra?period=${period}`),
  getDesignerDetail:     (userId, period = 'month') => apiClient.get(`/pms/dashboard/designer/${userId}?period=${period}`),
  downloadDesignerReportPdf: (userId, period = 'month') => apiClient.get(`/pms/dashboard/designer/${userId}/report.pdf?period=${period}`, { responseType: 'blob' }),
  getProjectAnalytics:   (period = 'month')  => apiClient.get(`/pms/dashboard/analytics?period=${period}`),
  // Phase C — report JSON (frontend turns these into .xlsx via SheetJS)
  getDesignerKpiReport:    (period = 'month') => apiClient.get(`/pms/dashboard/reports/designer-kpi?period=${period}`),
  getProjectSummaryReport: (period = 'month') => apiClient.get(`/pms/dashboard/reports/project-summary?period=${period}`),
  getAlerts:             ()                  => apiClient.get('/pms/dashboard/alerts'),
  getProjectPendingApproval: (projectId)     => apiClient.get(`/pms/dashboard/project/${projectId}/pending-md-approval`),

  // ─── DLR Sheet ─────────────────────────────────────────────────────────────
  getDLRSheet:           (projectId)         => apiClient.get(`/pms/drawing/dlr/${projectId}`),

  // ─── Project Planner / Master Plan ────────────────────────────────────────
  getPlannerMaster:      (projectId, params) => apiClient.get(`/pms/planner/${projectId}/master`, { params }),
  getPlannerSummary:     (projectId)         => apiClient.get(`/pms/planner/${projectId}/summary`),
  createPlannerRow:      (projectId, data)   => apiClient.post(`/pms/planner/${projectId}/rows`, data),
  patchPlannerRow:       (taskId,    data)   => apiClient.patch(`/pms/planner/rows/${taskId}`, data),
  deletePlannerRow:      (taskId)            => apiClient.delete(`/pms/planner/rows/${taskId}`),
  bulkAssignPlanner:     (data)              => apiClient.post(`/pms/planner/rows/bulk/assign`, data),
  bulkDatesPlanner:      (data)              => apiClient.post(`/pms/planner/rows/bulk/dates`, data),
  freezePlannerBaseline: (projectId)         => apiClient.post(`/pms/planner/${projectId}/baseline`),
  autoSchedulePlanner:   (projectId, data)   => apiClient.post(`/pms/planner/${projectId}/auto-schedule`, data),
  getPlanActivationPreview: (projectId)      => apiClient.get(`/pms/planner/${projectId}/activation-preview`),
  activatePlan:          (projectId, data)   => apiClient.post(`/pms/planner/${projectId}/activate`, data),
  // Switch THIS project's master-sheet template (project-specific; the global
  // default template is untouched). Blocked once work starts / plan is effective.
  changePlannerTemplate: (projectId, templateId) =>
    apiClient.post(`/pms/planner/${projectId}/change-template`, { templateId }),
  // Per-project phase management — mutates ONLY this project's planSnapshot
  // (names go in body/query, not the URL path, to dodge encoding issues).
  addPlannerPhase:    (projectId, data) => apiClient.post(`/pms/planner/${projectId}/phases`, data),            // { name }
  renamePlannerPhase: (projectId, data) => apiClient.patch(`/pms/planner/${projectId}/phases/rename`, data),    // { from, to }
  deletePlannerPhase: (projectId, name) => apiClient.delete(`/pms/planner/${projectId}/phases`, { params: { name } }),
  // Excel export — returns a Blob; caller is responsible for triggering download.
  exportPlannerExcel:    (projectId)         => apiClient.get(`/pms/planner/${projectId}/export`, { responseType: 'blob' }),
  // Blank import template (headers + sample row + Instructions sheet) — returns a Blob.
  getPlannerImportTemplate: ()               => apiClient.get(`/pms/planner/import-template`, { responseType: 'blob' }),
  // Excel import — multipart upload. Pass dryRun=true for a preview without writes.
  importPlannerExcel:    (projectId, file, { dryRun = false } = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('dryRun', String(!!dryRun));
    return apiClient.post(`/pms/planner/${projectId}/import`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

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
