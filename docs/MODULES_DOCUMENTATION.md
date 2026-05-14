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
Admin-facing module for creating new users and managing system configuration.

### Frontend Structure
```
modules/settings/
├── pages/
│   └── SettingsPage.jsx
├── components/
│   └── CreateUserForm.jsx
└── hooks/
    └── useCreateUser.js
```

### API Endpoints Used
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create new user (admin only) |

### Business Rules
1. Only admins should create new users (currently unprotected)
2. Role assignment happens at creation time
3. No user deletion currently implemented

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

## MODULE 7: PMS — PROJECT MANAGEMENT SYSTEM (STUB)

### Purpose
Will manage active interior design projects after client conversion. Track tasks, milestones, site visits, designers, and supervisors.

### Current State
Models defined, no controllers or routes yet.

### Models
```
modules/pms/models/
├── Project.model.js      → Core project entity
├── Task.model.js         → Project tasks
├── Milestone.model.js    → Project milestones
└── SiteVisit.model.js    → Site visit records
```

### Project Model Fields
| Field | Type | Notes |
|-------|------|-------|
| `clientId` | ObjectId ref CRMClient | Required |
| `proposalId` | ObjectId ref Proposal | Optional |
| `name` | String | Required |
| `projectType` | Enum | Residential, Commercial |
| `siteAddress` | String | |
| `city` | String | |
| `area` | Number | sq ft |
| `budget` | Number | |
| `status` | Enum | design, execution, completed |
| `designer` | ObjectId ref User | |
| `supervisor` | ObjectId ref User | |
| `startDate` | Date | |
| `endDate` | Date | |
| `notes` | String | |

### Integration Points
- Created when CRMClient.advancePayment.movedToProjectManagement = true
- CRMClient.linkedProjects[] stores Project ObjectIds
- Proposal.leadId connects back to the client

### Next Steps to Implement
1. Create `pms/controllers/Project.controller.js`
2. Create `pms/routes/Project.route.js`
3. Register `/api/projects` in `app.js`
4. Create frontend `modules/pms/` with project list, detail, task board

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
