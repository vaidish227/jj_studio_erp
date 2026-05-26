# MODULES_DOCUMENTATION.md — JJ Studio ERP

> Module-by-module breakdown of every feature in the system. Includes business logic, workflows, API endpoints, database entities, and inter-module dependencies.

---

## MODULE 1: AUTHENTICATION & USER MANAGEMENT

### Purpose
Manages system access: user registration (admin-only), login, and password management. Stores user roles that determine feature access throughout the ERP.

### Business Context
JJ Studio employees are assigned one of six roles. Admins create accounts. Sales staff use the CRM. Managers approve proposals. Designers and supervisors will access PMS once built.

### Workflow
```
Admin creates user account → User logs in → JWT issued → 
User accesses modules based on role
```

### Backend Structure
```
modules/auth/
├── controllers/auth.controller.js
│   ├── signup(req, res)          → POST /api/auth/signup
│   ├── login(req, res)           → POST /api/auth/login
│   └── changePasswordController  → POST /api/auth/change-password
├── models/user.model.js          → User schema
├── routes/auth.routes.js         → Route definitions
├── service/auth.service.js       → loginUser(), changePassword()
└── validator/auth.validator.js   → Joi schemas
```

### Frontend Structure
```
modules/auth/
├── pages/
│   ├── LoginPage.jsx             → Login form with role selector UI
│   └── RoleSelector.jsx         → Role dropdown component
├── hooks/
│   └── useLogin.js              → Form state + validation + API call
└── services/
    └── authService.js           → login(), signup(), logout()
```

### API Endpoints
| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| POST | `/api/auth/signup` | No | Create new user |
| POST | `/api/auth/login` | No | Authenticate user, get JWT |
| POST | `/api/auth/change-password` | No (should be Yes) | Change password |

### Database Entity: User
| Field | Type | Notes |
|-------|------|-------|
| `name` | String | Required |
| `email` | String | Unique, lowercase |
| `password` | String | bcrypt hashed, min 6 chars |
| `phone` | String | Optional |
| `role` | Enum | admin, sales, manager, accounts, designer, supervisor |
| `createdAt/updatedAt` | Timestamps | Auto |

### Permissions
- `signup`: Should be admin-only (currently unprotected)
- `login`: Public
- `change-password`: Should require own userId auth

### Dependencies
- User `_id` is referenced in: CRMClient.assignedTo, Proposal.createdBy, Metting.createdBy, FollowUp.assignedTo

---

## MODULE 2: CRM — CLIENT RELATIONSHIP MANAGEMENT

### Purpose
The core operational module. Tracks every potential client from first contact (enquiry) through meeting, follow-up, proposal, and conversion. The CRMClient document is the central data object that all other modules connect to.

### Business Context
JJ Studio gets inquiries via walk-ins, referrals, social media (Instagram), and their website. Each inquiry is captured as a lead and assigned to a sales person. The sales cycle involves multiple meetings, follow-ups, and eventually a design proposal.

### Full Lifecycle Workflow
```
Stage 1 — ENQUIRY
  Sales captures basic info (name, phone, source, project type)
  → CRMClient created (status: new, lifecycle: enquiry)

Stage 2 — MEETING
  Meeting scheduled with client
  → lifecycle: meeting_scheduled
  → Nodemailer sends meeting confirmation email

Stage 3 — THANK YOU
  Post-meeting thank you automation
  → automation.thankYouScheduledFor set
  → lifecycle: thank_you_sent

Stage 4 — CLIENT INFO
  Public form link sent to client
  → Client fills detailed info (DOB, address, family, site address)
  → CRMClient.clientInfoCompleted = true
  → lifecycle: client_info_pending → kit

Stage 5 — KIT (Keep In Touch)
  Client in follow-up / nurturing phase
  → lifecycle: kit, followup_due
  → Multiple follow-ups tracked

Stage 6 — SHOW PROJECT
  Team shows portfolio/previous work to client
  → CRMClient.showProject.assets populated
  → lifecycle: show_project → interested

Stage 7 — PROPOSAL
  Proposal created and sent
  → lifecycle: proposal_sent
  → Proposal module activated

Stage 8 — ADVANCE PAYMENT
  Client pays advance amount
  → CRMClient.advancePayment.received = true
  → lifecycle: advance_received → project_moved

Stage 9 — CONVERSION
  Client officially converted
  → status: converted, lifecycle: converted
  → Ready to link to PMS Project (future)

(Alternative) LOST
  Client declines at any stage
  → status: lost, lifecycle: lost
```

### Backend Structure
```
modules/crm/
├── controllers/
│   ├── CRMClient.controller.js    → PRIMARY (all main operations)
│   ├── Client.controller.js       → Deprecated
│   ├── Lead.controller.js         → Legacy operations
│   ├── Metting.controller.js      → Meeting management
│   ├── FollowUp.controller.js     → Follow-up management
│   ├── Proposal.controller.js     → CRM-level proposals
│   └── Template.controller.js     → Email/message templates
├── models/
│   ├── CRMClient.model.js         → PRIMARY unified model
│   ├── Client.model.js            → Deprecated
│   ├── Lead.model.js              → Deprecated
│   ├── Metting.model.js           → Meetings
│   └── FollowUp.model.js          → Follow-ups
├── routes/
│   ├── Client.route.js            → Maps to CRMClient controller
│   ├── Lead.route.js              → Legacy
│   ├── Metting.routes.js          → Meeting routes
│   ├── FollowUp.route.js          → Follow-up routes
│   └── Proposal.route.js          → CRM proposal routes
├── utils/
│   ├── sendEmail.js               → Nodemailer utility
│   └── Template/
│       ├── leadTemplate.js
│       ├── meetingTemplate.js
│       ├── meetingRescheduleTemplate.js
│       └── referrerTemplate.js
└── validator/
    └── Lead.validator.js          → Joi validation
```

### Frontend Structure
```
modules/crm/
├── context/
│   └── CRMContext.jsx            → activeLead state, lifecycle helpers
├── pages/
│   ├── EnquiryFormPage.jsx       → Step 1: Basic enquiry capture
│   └── ClientInfoFormPage.jsx    → Step 2: Detailed client info
├── hooks/
│   ├── useClient.js              → Client API operations
│   └── useLead.js                → Lead API operations
└── index.js                      → Module exports

modules/leads/
├── pages/
│   ├── NewLeadsPage.jsx          → /crm/new-leads
│   ├── LeadDetailsPage.jsx       → /crm/leads/:id
│   ├── MeetingsPage.jsx          → /crm/meetings
│   ├── FollowUpsPage.jsx         → /crm/follow-ups
│   ├── KITPage.jsx               → /crm/qualified
│   ├── ConvertedPage.jsx         → /crm/converted
│   └── LostLeadsPage.jsx         → /crm/lost-leads
├── components/
│   ├── LeadCard.jsx
│   ├── LeadListView.jsx
│   └── AddLeadModal.jsx
└── hooks/
    ├── useLeadDetails.js
    └── useLeadList.js
```

### API Endpoints — Clients (Primary)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/clients/create` | Create enquiry (new CRMClient) |
| GET | `/api/clients/get` | List clients (filters: status, lifecycleStage, projectType) |
| GET | `/api/clients/get/:id` | Get single client |
| PUT | `/api/clients/update/:id` | Update client details |
| PATCH | `/api/clients/status/:id` | Update status + lifecycle |
| DELETE | `/api/clients/delete/:id` | Delete client |
| POST | `/api/clients/timeline/:id` | Append interaction history event |
| GET | `/api/clients/totalclient` | Get stats (counts by status) |

### API Endpoints — Meetings
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/metting/create` | Schedule meeting |
| GET | `/api/metting/get` | List all meetings |
| GET | `/api/metting/get/:leadId` | Meetings for a lead |
| PUT | `/api/metting/update/:id` | Update meeting |

### API Endpoints — Follow-ups
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/followup/create` | Create follow-up |
| GET | `/api/followup/get` | List all follow-ups |
| GET | `/api/followup/get/:leadId` | Follow-ups for a lead |
| PUT | `/api/followup/update/:id` | Update follow-up |
| PATCH | `/api/followup/updatestatus/:id` | Update follow-up status |

### Key Business Rules
1. `trackingId` is auto-generated: `CLI-YYYY-NNNN` (e.g., CLI-2025-0001)
2. `clientInfoCompleted` flag separates enquiry-only records from full profiles
3. The `interactionHistory` array is append-only — never delete entries
4. `communicationLogs` track WhatsApp, Email, SMS separately with direction (Inbound/Outbound)
5. `advancePayment.movedToProjectManagement` triggers PMS integration (future)
6. A lost client can be re-opened (no hard lock on status)

### Dependencies
- CRMClient is referenced by: Proposal, Metting, FollowUp, PMS/Project
- Requires: User (for assignedTo)
- Feeds into: Proposal module (when lifecycle reaches proposal_sent)

---

## MODULE 3: PROPOSAL & QUOTATION SYSTEM

### Purpose
Manages the complete proposal lifecycle for design projects: creating template-based BOQs (Bills of Quantities), going through an internal approval workflow, sending to clients, collecting e-signatures, and recording advance payments.

### Business Context
JJ Studio provides detailed proposals with room-by-room cost breakdowns. Proposals go through an internal manager approval before being sent to clients. E-signatures confirm client acceptance, after which advance payments are collected and projects begin.

### Workflow
```
1. Sales creates proposal → links to CRMClient
   → Optional: select a reusable template
   → Status: draft

2. Build BOQ
   → Attach BOQ items (room, description, rate, quantity)
   → System calculates total + GST = finalAmount

3. Submit for approval
   → Status: pending_approval
   → Approval record created (type: internal)

4. Manager reviews
   → Approve: status → manager_approved
   → Reject: status → rejected (with reason)

5. Send to client
   → Status: sent
   → sentAt timestamp recorded
   → CRMClient lifecycle → proposal_sent

6. Client signs (E-sign)
   → ESign record created (status: signed)
   → Proposal status → esign_received

7. Advance payment received
   → Payment record created
   → Proposal status → payment_received
   → CRMClient.advancePayment updated

8. Project ready
   → Status → project_ready → project_started
   → Links to PMS (future)
```

### Backend Structure
```
modules/proposal/
├── controllers/
│   ├── Boq.controller.js           → BOQ CRUD
│   ├── Boq_item.controller.js      → BOQ line items CRUD
│   ├── Template.controller.js      → Template CRUD
│   ├── Approval.controller.js      → Approval workflow
│   ├── Payment.controller.js       → Payment recording
│   ├── ProposalVersion.controller.js → Version history
│   ├── Activity.controller.js      → Activity logging
│   └── Esign.controller.js         → E-signature tracking
├── models/
│   ├── Boq.model.js
│   ├── Boq_item.model.js
│   ├── Template.model.js
│   ├── Approval.model.js
│   ├── Payment.model.js
│   ├── Proposal_version.model.js
│   ├── Activity.model.js
│   └── ESign.model.js
└── routes/ (8 route files, one per controller)
```

Note: The `Proposal.model.js` itself lives in `crm/models/Proposal.model.js` even though it's conceptually a proposal-system entity. Its CRUD is in `crm/controllers/Proposal.controller.js` and routed via `/api/proposal`.

### Frontend Structure
```
modules/proposal/
├── pages/
│   ├── ProposalListPage.jsx        → /proposal/list
│   ├── CreateProposalPage.jsx      → /proposal/create
│   ├── ProposalTemplatesPage.jsx   → /proposal/templates
│   ├── TemplateEditorPage.jsx      → /proposal/templates/create|edit/:id
│   ├── ProposalClientsPage.jsx     → /proposal/clients
│   ├── ProposalApprovalPage.jsx    → /proposal/approval
│   ├── SentProposalsPage.jsx       → (embedded in SentProposalDashboard)
│   └── ApprovedProposalsPage.jsx   → (embedded in ApprovedDashboard)
├── dashboard/
│   ├── ProposalDashboard.jsx       → /proposal (index)
│   ├── ActivityList.jsx
│   ├── QuickActions.jsx
│   ├── StatusTracker.jsx
│   └── SummaryCard.jsx
├── approval/
│   └── ApprovalDashboard.jsx
├── approved/
│   ├── ApprovedClientDetails.jsx
│   └── ApprovedDashboard.jsx
├── sent/
│   ├── SentProposalDashboard.jsx   → /proposal/sent
│   └── SentProposalReviewPage.jsx  → /proposal/sent/:id
├── review/
│   └── ReviewPage.jsx              → /proposal/review/:id
├── components/
│   ├── ProposalPreviewModal.jsx
│   ├── TemplatePreviewModal.jsx
│   └── ApprovalFormModal.jsx
└── index.js
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/proposal/create` | Create proposal |
| GET | `/api/proposal/get` | List proposals |
| GET | `/api/proposal/get/:id` | Get proposal |
| PUT | `/api/proposal/update/:id` | Update proposal |
| PATCH | `/api/proposal/updatestatus/:id` | Update status |
| POST | `/api/proposal/send/:id` | Mark as sent |
| POST | `/api/boq/createBoq` | Create BOQ |
| GET | `/api/boq/getBoq` | List BOQs |
| GET | `/api/boq/get` | Get BOQ by ID |
| PUT | `/api/boq/updateBoq/:id` | Update BOQ |
| DELETE | `/api/boq/delete` | Delete BOQ |
| POST | `/api/Template/create` | Create template |
| GET | `/api/Template/get` | List templates |
| GET | `/api/Template/getbyid/:id` | Get template |
| PUT | `/api/Template/update/:id` | Update template |
| DELETE | `/api/Template/delete/:id` | Delete template |
| POST | `/api/Approve` | Submit/respond to approval |
| POST | `/api/payment/create` | Record payment |
| GET | `/api/payment/get` | List payments |
| POST | `/api/esign/create` | Record e-sign |
| GET | `/api/esign/get` | List e-signs |

### Template Structure
Templates define reusable BOQ table layouts:
```json
{
  "name": "Residential Standard",
  "type": "residential",
  "structure": {
    "columns": [
      { "id": "area", "label": "Area", "type": "label", "width": 200 },
      { "id": "item", "label": "Item", "type": "text", "width": 300 },
      { "id": "rate", "label": "Rate", "type": "number", "width": 100 },
      { "id": "qty", "label": "Qty", "type": "number", "width": 80 },
      { "id": "total", "label": "Total", "type": "number", "width": 120 }
    ],
    "rows": [
      { "id": "r1", "isGroupHeader": true, "cells": { "area": "Living Room" } },
      { "id": "r2", "isGroupHeader": false, "cells": { "item": "Flooring", "rate": 150, "qty": 400 } }
    ]
  }
}
```

### Key Business Rules
1. A proposal must be linked to a CRMClient (`leadId`)
2. Manager approval is required before client can receive proposal
3. Rejection reason must be captured when manager rejects
4. E-sign and payment are tracked independently per proposal
5. Proposal versions are created on significant edits (version field increments)
6. BOQ total = sum of all BOQ_items; finalAmount = total + (total × gst/100)

### Dependencies
- Requires: CRMClient, User, Template (optional)
- Produces: ESign, Payment, Activity, ProposalVersion
- Feeds into: PMS/Project (when project_ready)

---

## MODULE 4: DASHBOARD

### Purpose
Provides a real-time snapshot of the sales pipeline, recent activity, upcoming follow-ups, and key performance metrics for the logged-in user (or all data for admins/managers).

### Frontend Structure
```
modules/dashboard/
├── pages/
│   └── DashboardPage.jsx         → /dashboard
├── components/
│   ├── SalesPipeline.jsx         → Visual funnel/pipeline
│   ├── FollowUpsPanel.jsx        → Upcoming follow-ups
│   └── StatCard.jsx              → Metric card
└── hooks/
    └── useDashboardData.js       → Fetches stats, pipeline data, follow-ups
```

### Data Sources
- Client counts by status: `GET /api/clients/totalclient`
- Pipeline stages: derived from CRMClient.lifecycleStage counts
- Follow-ups: `GET /api/followup/get` (filtered to pending, upcoming)

### Key Metrics Displayed
1. Total Leads (new + in-progress)
2. Converted Clients
3. Active Proposals
4. Pending Follow-ups
5. Meetings This Week
6. Revenue Pipeline (estimated from proposal amounts)

---

## MODULE 5: SETTINGS & USER MANAGEMENT

### Purpose
Admin-facing module for user management, RBAC, and role/permission configuration. Split into two dedicated pages under a Settings landing.

### Frontend Structure
```
modules/settings/
├── pages/
│   ├── SettingsPage.jsx          → Landing: two cards (Users, Roles & Permissions)
│   ├── UserManagementPage.jsx    → Create users + live team list with role selector
│   └── RolesPermissionsPage.jsx  → Permission matrix by role
└── hooks/
    ├── useUserManagement.js      → Fetch/create users, update user role
    └── useRolesPermissions.js    → Fetch roles, manage permission matrix state
```

### Routes
| Path | Page | Notes |
|------|------|-------|
| `/settings` | SettingsPage | Landing; shows access-denied if no `users.manage` |
| `/settings/users` | UserManagementPage | Create accounts + role assignment |
| `/settings/roles-permissions` | RolesPermissionsPage | Permission matrix editor |

### API Endpoints Used
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create new user |
| GET | `/api/roles/users/list` | List all users |
| PATCH | `/api/roles/users/:userId/role` | Update a user's role |
| GET | `/api/roles` | List all roles |
| GET | `/api/roles/permissions/all` | List all permissions |
| PATCH | `/api/roles/:id` | Save permission matrix for a role |

### Business Rules
1. Only users with `users.manage` permission can access Settings pages
2. Role assignment available both at creation time and post-creation via the user list
3. Permission matrix changes are saved per-role (one PATCH per role save)
4. No user deletion currently implemented

---

## MODULE 6: PROFILE

### Purpose
Allows logged-in users to view and update their own profile information.

### Frontend Structure
```
modules/profile/
└── pages/
    └── ProfilePage.jsx
```

### Data
- Reads from `localStorage.user` initially
- May call `GET /api/auth/me` (if implemented) for fresh data

---

## MODULE 7: PMS — PROJECT MANAGEMENT SYSTEM

### Purpose
Manages active interior design projects after client conversion. Tracks tasks by designer sub-flow, drawing approvals, team assignments, kickstart milestones, client approvals, site logs, and vendors.

### Business Context
After a client converts (advance payment received), a Project is created and assigned to Designer A (primary). Sub-designer slots B/C/D/E handle specialized sub-flows (AC, kitchens, bathrooms, automation, concepts). Tasks are created per sub-flow and drawings uploaded to the DLR (Drawing Library Repository). A supervisor oversees site execution and logs site visits.

### Project Lifecycle
```
design_phase → execution_phase → handover → completed
(or)                          → on_hold | cancelled
```

### Backend Structure
```
modules/pms/
├── controllers/
│   ├── Project.controller.js        → Project CRUD + kickstart + team + client approvals
│   ├── Task.controller.js           → Task CRUD + checklist toggle + getMyTasks
│   ├── Drawing.controller.js        → Full drawing lifecycle (upload, revise, approve, release)
│   ├── Vendor.controller.js         → Vendor directory CRUD
│   ├── SiteLog.controller.js        → Site log entries per project
│   ├── Milestone.controller.js      → Milestone CRUD with auto-completedDate
│   ├── ActivityLog.controller.js    → Paginated activity log read
│   ├── WhatsAppGroup.controller.js  → WA group CRUD + sendGroupUpdate
│   ├── Calendar.controller.js       → Aggregated calendar events (read-only)
│   ├── Approval.controller.js       → Approval requests + responses
│   ├── SiteVisit.controller.js      → Site visit logs
│   ├── Material.controller.js       → Material selection tracking
│   ├── PurchaseOrder.controller.js  → PO CRUD + line items auto-total
│   └── PMSDashboard.controller.js   → PMS summary stats
├── models/
│   ├── Project.model.js             → Project with kickstart, team slots, client approvals
│   ├── Task.model.js                → Tasks with checklist and external coordination
│   ├── Drawing.model.js             → Drawings with versioning and approval lifecycle
│   ├── ProjectMilestone.model.js    → Milestones with critical flag + order
│   ├── PMSActivityLog.model.js      → Audit trail (15 action types, 11 entity types)
│   └── WhatsAppProjectGroup.model.js → WA groups linked to whatsapp.service
├── validator/ (Joi schemas for all controllers)
└── routes/ (one per controller)

backend/src/shared/
└── activityLogger.js               → Fire-and-forget logActivity() utility
```

### Frontend Structure
```
modules/pms/
├── context/
│   └── PMSContext.jsx              → activeProject, invalidateProjects()
├── hooks/
│   ├── useProjects.js              → paginated/filtered project list
│   ├── useProjectDetail.js         → project + tasks + drawings + siteLogs
│   ├── useProjectForm.js           → create project form logic
│   ├── useTaskForm.js              → create task form + checklist builder
│   ├── useDrawings.js              → drawings list with filter state
│   ├── useVendors.js               → vendor list with category filter
│   ├── useMilestones.js            → milestones CRUD
│   ├── useSiteVisits.js            → site visits CRUD
│   ├── useMaterials.js             → materials CRUD
│   ├── usePurchaseOrders.js        → PO CRUD
│   ├── useActivityLog.js           → paginated logs with loadMore/hasMore
│   └── useWhatsAppGroups.js        → WA groups CRUD + sendUpdate
├── pages/
│   ├── ProjectsPage.jsx            → /projects (list + grid, filter, create modal)
│   ├── ProjectDetailPage.jsx       → /projects/:id (12-tab detail view)
│   ├── MyTasksPage.jsx             → /tasks (cross-project tasks for logged-in user)
│   ├── DrawingLibraryPage.jsx      → /drawings + /drawings/pending-approvals
│   ├── VendorDirectoryPage.jsx     → /vendors
│   ├── CalendarPage.jsx            → /pms/calendar (monthly grid, 5 event types)
│   └── ApprovalDashboardPage.jsx   → /pms/approvals (pending approval queue)
└── components/
    ├── (badge/icon/card components same as before)
    └── tabs/
        ├── OverviewTab.jsx          → Summary cards + kickstart + client approvals
        ├── TasksTab.jsx             → List view (by taskType) OR Kanban (by status)
        ├── DrawingsTab.jsx          → Project drawings list
        ├── SiteLogsTab.jsx          → Chronological logs + inline add form
        ├── TeamTab.jsx              → Designer A-E + supervisor + contractor
        ├── ClientApprovalsTab.jsx   → Full 6-approval tracker
        ├── MilestonesTab.jsx        → Timeline with critical/overdue detection
        ├── SiteVisitsTab.jsx        → Site visit logs with purpose/observations
        ├── MaterialsTab.jsx         → Grouped by category, edit in place
        ├── PurchaseOrdersTab.jsx    → PO cards with status workflow + line items
        ├── WhatsAppTab.jsx          → WA group cards with send update flow
        └── ActivityTab.jsx          → Paginated audit timeline with 15 action icons
```

### API Endpoints — Projects
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/project/create` | Create project |
| GET | `/api/pms/project/all` | List projects (paginated, filterable by status) |
| GET | `/api/pms/project/:id` | Get project by ID |
| PUT | `/api/pms/project/update/:id` | Update project |
| PATCH | `/api/pms/project/kickstart/:id` | Update kickstart checklist flags |
| PATCH | `/api/pms/project/team/:id` | Update team assignments |
| PATCH | `/api/pms/project/client-approval/:id` | Upsert a client approval record |
| DELETE | `/api/pms/project/delete/:id` | Delete project |

### API Endpoints — Tasks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/task/create` | Create task |
| GET | `/api/pms/task/my-tasks` | Tasks assigned to the current user |
| GET | `/api/pms/task/project/:projectId` | Tasks for a project |
| GET | `/api/pms/task/:id` | Get single task by ID |
| PUT | `/api/pms/task/update/:id` | Update task (validates allowed fields only) |
| PATCH | `/api/pms/task/checklist/:taskId/:idx` | Toggle single checklist item |
| DELETE | `/api/pms/task/delete/:id` | Delete task |

### API Endpoints — Drawings (DDMS / DLR)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/drawing/upload` | Upload new drawing (URL-based) |
| POST | `/api/pms/drawing/revise/:id` | Upload revision (archives current to history) |
| GET | `/api/pms/drawing/all` | List all drawings (paginated, filterable) |
| GET | `/api/pms/drawing/pending-approvals` | Drawings with status=sent_for_approval |
| GET | `/api/pms/drawing/project/:projectId` | Drawings for a project |
| PATCH | `/api/pms/drawing/send-for-approval/:id` | Transition draft/rejected → sent_for_approval |
| PATCH | `/api/pms/drawing/approve/:id` | Approve (requires drawings.approve permission) |
| PATCH | `/api/pms/drawing/reject/:id` | Reject with required rejectionReason |
| PATCH | `/api/pms/drawing/release/:id` | Release to site (propagates to parent task) |
| DELETE | `/api/pms/drawing/delete/:id` | Delete drawing |

### API Endpoints — Vendors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pms/vendor/all` | List vendors (optional `?category=AC`) |
| POST | `/api/pms/vendor/create` | Add vendor |
| PUT | `/api/pms/vendor/update/:id` | Update vendor |
| DELETE | `/api/pms/vendor/delete/:id` | Delete vendor |

### API Endpoints — Milestones
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/milestone/create` | Create milestone |
| GET | `/api/pms/milestone/project/:projectId` | List milestones for project |
| PATCH | `/api/pms/milestone/update/:id` | Update milestone (auto-sets completedDate) |
| DELETE | `/api/pms/milestone/delete/:id` | Delete milestone |

### API Endpoints — Site Visits
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/site-visit/create` | Log site visit |
| GET | `/api/pms/site-visit/project/:projectId` | List visits for project |
| PUT | `/api/pms/site-visit/update/:id` | Update visit |
| DELETE | `/api/pms/site-visit/delete/:id` | Delete visit |

### API Endpoints — Materials
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/material/create` | Add material |
| GET | `/api/pms/material/project/:projectId` | List materials for project |
| PUT | `/api/pms/material/update/:id` | Update material |

### API Endpoints — Purchase Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/purchase-order/create` | Create PO (line items auto-total) |
| GET | `/api/pms/purchase-order/project/:projectId` | List POs for project |
| PATCH | `/api/pms/purchase-order/update/:id` | Update status or payment status |
| DELETE | `/api/pms/purchase-order/delete/:id` | Delete PO |

### API Endpoints — Approvals
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/approval/request` | Create approval request |
| GET | `/api/pms/approval/project/:projectId` | Approvals for a project |
| GET | `/api/pms/approval/pending/:userId` | Pending approvals for a user |
| PATCH | `/api/pms/approval/respond/:id` | Submit approval response |

### API Endpoints — WhatsApp Groups
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pms/whatsapp-group/create` | Create group record |
| GET | `/api/pms/whatsapp-group/project/:projectId` | Groups for project |
| PUT | `/api/pms/whatsapp-group/update/:id` | Update group |
| DELETE | `/api/pms/whatsapp-group/delete/:id` | Delete group |
| POST | `/api/pms/whatsapp-group/send/:id` | Send message to all members |

### API Endpoints — Activity Log
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pms/activity/project/:projectId` | Paginated activity log |

### API Endpoints — Calendar
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pms/calendar/events` | Aggregated events (`?startDate&endDate&projectId&types[]`) |

### Task Types (9 enums → TASK_TYPE_CONFIG)
| Enum | Label | Assigned to |
|------|-------|-------------|
| `ac_coordination` | AC Coordination | Designer C |
| `technical_drawing` | Technical Drawing | Designer C |
| `kitchen_drawing` | Kitchen Drawing | Designer D |
| `bathroom_drawing` | Bathroom Drawing | Designer D |
| `automation_coordination` | Automation | Designer C |
| `3d_render` | 3D Render | Designer E |
| `concept_making` | Concept Making | Designer E |
| `furniture_layout` | Furniture Layout | Designer B |
| `site_measurement` | Site Measurement | Designer B |

### RBAC Permission Mapping
| Permission | Grants access to |
|-----------|-----------------|
| `projects.read` | GET all projects, GET project by ID |
| `projects.create` | POST create project |
| `projects.update` | PUT update, PATCH kickstart/team/client-approval |
| `projects.delete` | DELETE project |
| `tasks.read` | GET tasks by project, GET task by ID, GET my-tasks |
| `tasks.create` | POST create task |
| `tasks.update` | PUT update task, PATCH checklist item |
| `tasks.delete` | DELETE task |
| `drawings.read` | GET all drawings, GET by project/task |
| `drawings.upload` | POST upload/revise, PATCH send-for-approval, DELETE |
| `drawings.approve` | GET pending-approvals, PATCH approve/reject |
| `drawings.release` | PATCH release to site |
| `vendor.read` | GET all vendors, GET vendor by ID |
| `vendor.create` | POST create vendor |
| `vendor.update` | PUT update vendor, DELETE vendor |
| `site_logs.read` | GET project logs, GET log by ID |
| `site_logs.create` | POST create log, PUT update log |
| `site_visits.read` | GET site visits by project |
| `site_visits.create` | POST log visit |
| `site_visits.update` | PUT update visit, DELETE visit |
| `materials.read` | GET materials by project |
| `materials.create` | POST add material |
| `materials.update` | PUT update material |
| `materials.delete` | DELETE material |
| `purchase_orders.read` | GET POs by project |
| `purchase_orders.create` | POST create PO |
| `purchase_orders.update` | PATCH update PO, DELETE PO |
| `milestones.read` | GET milestones by project |
| `milestones.create` | POST create milestone |
| `milestones.update` | PATCH update milestone |
| `milestones.delete` | DELETE milestone |
| `approvals.read` | GET project approvals, GET pending |
| `approvals.create` | POST request approval |
| `approvals.respond` | PATCH respond to approval |
| `activity.read` | GET activity log |
| `calendar.read` | GET calendar events |
| `pms.whatsapp.manage` | Full WA group CRUD + send |

### Validator Structure
All PMS controllers validate `req.body` with Joi before any DB operation.
Validator files: `modules/pms/validator/{Project,Task,Drawing,Vendor,SiteLog,Milestone,WhatsAppGroup,Approval,SiteVisit,Material,PurchaseOrder}.validator.js`

### Key Business Rules
1. `proposalId` on Project is **optional** — not every project originates from a formal proposal
2. Drawing upload is URL-based — file must be hosted externally (Google Drive, Cloudinary, etc.)
3. `sendForApproval` only works when status is `draft` or `rejected`
4. `releaseDrawing` sets the parent task status to `released_to_site`
5. `kickstartCompleted` is auto-set when all 6 kickstart flags are true
6. `clientApprovals` is an upsert — creating a new approval or updating existing by type
7. `SiteLog.supervisorId` is always set from `req.user._id` (never from request body)
8. `updateProject` and `updateTask` only accept whitelisted fields — immutable fields (trackingId, clientId, projectId, taskType) cannot be overwritten via the API
9. `PurchaseOrder.items[].amount` is auto-computed as `quantity * rate` on create/update
10. `ProjectMilestone.completedDate` is auto-set when status is changed to `completed`
11. `PMSActivityLog` writes are fire-and-forget — never block a request; errors only `console.error`
12. `Calendar.getCalendarEvents` is read-only aggregation — no new model, derives from existing date fields across 5 models
13. Run `node backend/src/scripts/seedRoles.js` after any permission change

### Integration Points
- Projects link to `CRMClient` via `clientId` and optionally to `Proposal` via `proposalId`
- `CRMClient.linkedProjects[]` stores Project ObjectIds
- Drawing `releaseDrawing` propagates status to parent Task
- `WhatsAppProjectGroup.sendGroupUpdate` calls existing `whatsapp.service.sendImmediate()` — no new provider logic
- Calendar aggregates from: Task.dueDate, ProjectMilestone.dueDate, SiteVisit.visitDate, PurchaseOrder.expectedDeliveryDate, Project.estimatedCompletionDate

---

## MODULE 8: HRM — HUMAN RESOURCES (STUB)

### Purpose
Will manage employees, attendance, payroll, and leave management.

### Current State
Single model file only.

```
modules/hrm/
└── Employees.model.js
```

---

## MODULE 9: FINANCE (STUB)

### Purpose
Will manage invoices, expenses, and financial reporting.

### Current State
Single model file only.

```
modules/finance/models/
└── Payment.model.js       → (separate from proposal Payment)
```

---

## MODULE 10: INVENTORY (STUB)

### Purpose
Will manage materials, vendor stock, and procurement.

### Current State
Single model file only.

```
modules/inventory/models/
└── Inventory.model.js
```

---

## MODULE DEPENDENCY MATRIX

| Module | Depends On | Depended On By |
|--------|-----------|---------------|
| Auth | — | All modules (User ref) |
| CRM | Auth (User) | Proposal, PMS, Finance |
| Proposal | CRM, Auth | PMS, Finance |
| Dashboard | CRM, Proposal | — |
| Settings | Auth | — |
| Profile | Auth | — |
| PMS | CRM, Proposal, Auth | Finance, Inventory |
| Finance | Proposal, PMS | — |
| Inventory | PMS | — |
| HRM | Auth | — |
