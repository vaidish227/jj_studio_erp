# PROJECT_ARCHITECTURE.md — JJ Studio ERP

> Detailed architecture documentation. Cross-reference with `AI_CONTEXT.md` for conventions and business rules.

---

## 1. SYSTEM OVERVIEW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│              React SPA (Vite) — Port 3000 (NGINX)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │   Auth   │  │   CRM    │  │ Proposal │  │  Dashboard   │   │
│  │  Module  │  │  Module  │  │  Module  │  │   Module     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                    ↕ Axios + JWT Bearer Token                    │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (Express 5 — Port 5000)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │   Auth   │  │   CRM    │  │ Proposal │  │  Nodemailer  │   │
│  │ Module   │  │  Module  │  │  Module  │  │  (Email)     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                         Mongoose ODM                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MongoDB (jj_studio DB)                        │
│  CRMClients │ Users │ Proposals │ BOQs │ Templates │ Meetings   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. BACKEND ARCHITECTURE

### 2.1 Entry Point Chain

```
backend/index.js
  └── loads .env
  └── calls connectDb() [src/config/db.js]
  └── imports app from src/app.js
  └── app.listen(PORT)

backend/src/app.js
  └── express()
  └── cors() middleware
  └── express.json() middleware
  └── Route registrations (14 route groups)
  └── exports app
```

### 2.2 Module Internal Structure

Every module follows this internal layout:

```
modules/<name>/
├── controllers/    ← HTTP handlers (req → res)
├── models/         ← Mongoose schemas & models
├── routes/         ← Express Router definitions
├── service/        ← Business logic (optional, only auth uses this)
├── validator/      ← Joi validation schemas
└── utils/          ← Module-specific utilities (email templates, etc.)
```

### 2.3 Request Lifecycle

```
HTTP Request
  │
  ▼
Express Router (app.js routes)
  │
  ▼
Route Handler (routes/X.route.js)
  │  No auth middleware at route level
  │
  ▼
Controller Function (controllers/X.controller.js)
  │
  ├─► Joi Validation (validator/X.validator.js)
  │     └── If invalid → return 400 { message }
  │
  ├─► Service (service/X.service.js) [only auth]
  │     └── Business logic
  │
  ├─► Mongoose Model (models/X.model.js)
  │     └── DB query/mutation
  │
  └─► Response
        ├── 200/201 { message, data }
        └── 4xx/5xx { message }
```

### 2.4 Registered API Routes

| Mount Path | Module File | Purpose |
|------------|-------------|---------|
| `/api/auth` | `auth/routes/auth.routes.js` | Login, signup, password |
| `/api/leads` | `crm/routes/Lead.route.js` | Legacy leads (deprecated) |
| `/api/clients` | `crm/routes/Client.route.js` | Primary CRMClient CRUD |
| `/api/followup` | `crm/routes/FollowUp.route.js` | Follow-up management |
| `/api/metting` | `crm/routes/Metting.routes.js` | Meeting management |
| `/api/proposal` | `crm/routes/Proposal.route.js` | CRM proposals |
| `/api/boq` | `proposal/routes/Boq.route.js` | Bill of Quantities |
| `/api/boqitem` | `proposal/routes/Boq_item.route.js` | BOQ line items |
| `/api/Template` | `proposal/routes/Template_route.js` | Proposal templates |
| `/api/Approve` | `proposal/routes/Approval.Route.js` | Approval workflow |
| `/api/payment` | `proposal/routes/Payment.Routes.js` | Payment recording |
| `/api/proposalversion` | `proposal/routes/Proposalversion.Route.js` | Version history |
| `/api/activity` | `proposal/routes/Activity.route.js` | Activity log |
| `/api/esign` | `proposal/routes/Esign.route.js` | E-signature tracking |

### 2.5 Authentication Architecture

```
POST /api/auth/login
  → auth.controller.js::login()
  → Validate with Joi (loginSchema)
  → auth.service.js::loginUser()
      → Find user by email (User.findOne)
      → bcrypt.compare(password, user.password)
      → jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '1d' })
      → return { token, user }
  → 200 { message, token, user: { id, name, email, role } }

Frontend stores:
  localStorage.auth_token = token
  localStorage.user = JSON.stringify({ id, name, email, role })

All subsequent requests:
  axios interceptor adds:
  Authorization: Bearer <token>
```

**Security Gap:** No `verifyToken` middleware applied globally. Each controller that needs auth must manually decode the JWT if needed. Currently most controllers don't verify the token — they trust any request with well-formed data.

---

## 3. FRONTEND ARCHITECTURE

### 3.1 Application Shell

```
main.jsx
  └── <React.StrictMode>
        └── <ToastProvider>              ← Global toast notifications
              └── <BrowserRouter>
                    └── <Routes>
                          ├── /login → LoginPage (no layout)
                          ├── /public/* → PublicLayout (no auth)
                          └── AppLayout (authenticated shell)
                                └── Sidebar + Navbar + <Outlet />
                                      ├── /dashboard
                                      ├── CRMProvider → /crm/*
                                      ├── CRMProvider → /proposal/*
                                      ├── /profile
                                      └── /settings
```

### 3.2 Layout System

```
AppLayout
├── Sidebar (left nav)
│   ├── SidebarGroup (section grouping)
│   └── SidebarItem (nav link with icon)
├── Navbar (top bar)
│   ├── Breadcrumb / page title
│   ├── Notification icon
│   └── ProfileDropdown (user menu)
└── <Outlet /> (page content area)

PublicLayout
└── Centered, minimal layout for public forms (no nav)
```

### 3.3 Routing Strategy

React Router v7 is used with **nested routes**. The `AppLayout` component renders once as the persistent shell — child routes render inside its `<Outlet />`. This means the sidebar and navbar never re-mount on navigation.

**Route groups:**
- `CRMProvider` wraps both `/crm/*` and `/proposal/*` so these modules share CRM state
- `/login` and `/public/*` are completely outside `AppLayout` (no shell)
- `path="*"` catch-all redirects to `/dashboard`

### 3.4 State Management Architecture

```
ToastContext (root)
└── CRMContext (scoped to CRM + Proposal routes)
    └── activeLead: CRMClient | null  [persisted in localStorage]
    └── crmState: { lastStep, drafts }
    └── setActiveLead(lead)
    └── clearActiveLead()
```

**No external state library.** All module state is local or fetched fresh per page via custom hooks.

### 3.5 API Integration Architecture

```
Component
  └── calls custom hook (e.g., useLeadList, useLeadDetails)
        └── hook calls crmService.methodName(params)
              └── crmService calls apiClient.verb(endpoint, data)
                    └── Axios instance (apiClient.js)
                          └── Request interceptor: add Bearer token
                          └── Response interceptor: unwrap data / handle errors
                          └── HTTP request to backend
```

The `crmService.js` is the single API gateway for all CRM-related operations. Never bypass it by calling `apiClient` directly for CRM data.

### 3.6 Component Architecture

```
src/shared/components/
├── Atomic UI components (Button, Input, Select, Badge, Avatar)
├── Form utilities (FormField, Checkbox)
├── Data display (DashboardCard, DynamicTableBuilder)
├── Modal system (Modal, ConfirmationModal)
├── Navigation (Dropdown, ProfileDropdown, ActionBar)
├── Feedback (Loader)
└── Domain components (ProposalViewer, StatusBadge, PaymentStatusModal)
```

Every component lives in its own folder with the same name:
```
components/
└── Button/
    └── Button.jsx
```

### 3.7 Custom Hooks Catalog

| Hook | Location | Purpose |
|------|----------|---------|
| `useLogin` | `modules/auth/hooks/` | Login form state + API |
| `useClient` | `modules/crm/hooks/` | Client CRUD operations |
| `useLead` | `modules/crm/hooks/` | Lead CRUD operations |
| `useEnquiry` | `shared/hooks/` | Enquiry form state + submit |
| `useClientInfo` | `shared/hooks/` | Client info form state + submit |
| `useLeadFlow` | `shared/hooks/` | Lead lifecycle automation |
| `useLeadStatusManager` | `shared/hooks/` | Status transition logic |
| `useLeadDetails` | `modules/leads/hooks/` | Single lead fetch + update |
| `useLeadList` | `modules/leads/hooks/` | Lead list + filter state |
| `useDashboardData` | `modules/dashboard/hooks/` | Dashboard stats |
| `useApi` | `shared/hooks/` | Generic async call wrapper |
| `useClickOutside` | `shared/hooks/` | Outside click detection |
| `useFilters` | `shared/filters/` | Advanced filter state |
| `useCreateUser` | `modules/settings/hooks/` | User creation form |

---

## 4. DATABASE ARCHITECTURE

### 4.1 MongoDB Database: `jj_studio`

**Collections (Active):**
| Collection | Mongoose Model | Description |
|-----------|---------------|-------------|
| `crmclients` | `CRMClient` | Primary lead/client records |
| `users` | `User` | System users (all roles) |
| `proposals` | `Proposal` | Proposal documents |
| `boqs` | `Boq` | Bill of Quantities |
| `boq_items` | `Boq_item` | BOQ line items |
| `templates` | `Template` | Proposal templates |
| `approvals` | `Approval` | Approval workflow records |
| `payments` | `Payment` | Payment records |
| `esigns` | `ESign` | E-signature records |
| `mettings` | `Metting` | Meeting records (typo intentional) |
| `followups` | `FollowUp` | Follow-up records |
| `activities` | `Activity` | Activity log |
| `proposalversions` | `ProposalVersion` | Proposal version history |

**Collections (Stub — models exist, no active controllers):**
| Collection | Mongoose Model | Module |
|-----------|---------------|--------|
| `projects` | `Project` | pms |
| `tasks` | `Task` | pms |
| `milestones` | `Milestone` | pms |
| `sitevisits` | `SiteVisit` | pms |
| `employees` | `Employee` | hrm |
| `inventories` | `Inventory` | inventory |

### 4.2 Entity Relationship Overview

```
User (1) ──────────────── (N) CRMClient.assignedTo
User (1) ──────────────── (N) Proposal.createdBy
User (1) ──────────────── (N) Proposal.approved_by
User (1) ──────────────── (N) Metting.createdBy
User (1) ──────────────── (N) FollowUp.assignedTo

CRMClient (1) ────────── (N) Metting.leadId
CRMClient (1) ────────── (N) FollowUp.leadId
CRMClient (1) ────────── (N) Proposal.leadId
CRMClient (1) ────────── (N) CRMClient.linkedProjects[]  ──→ Project
CRMClient (1) ────────── (N) CRMClient.linkedInvoices[]  ──→ Invoice (future)

Proposal (1) ─────────── (1) Boq.proposalId
Boq (1) ──────────────── (N) Boq_item.boqId
Proposal (1) ─────────── (N) Approval.proposalId
Proposal (1) ─────────── (N) Payment.proposalId
Proposal (1) ─────────── (1) ESign.proposalId
Proposal (1) ─────────── (N) ProposalVersion.proposalId
Proposal (1) ─────────── (N) Activity.proposalId
Template (1) ─────────── (N) Proposal.templateId
```

---

## 5. MODULE INTERACTION MAP

```
                    ┌─────────────┐
                    │     CRM     │
                    │  (CRMClient)│
                    └──────┬──────┘
                           │ leadId
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌──────────┐  ┌─────────┐
         │Meeting │  │ FollowUp │  │Proposal │
         └────────┘  └──────────┘  └────┬────┘
                                         │
                           ┌─────────────┼──────────────┐
                           ▼             ▼              ▼
                        ┌─────┐   ┌──────────┐   ┌──────────┐
                        │ BOQ │   │ Approval │   │ Payment  │
                        └──┬──┘   └──────────┘   └──────────┘
                           │
                      ┌────▼─────┐
                      │ BOQ_Item │
                      └──────────┘
                           │
                    ┌──────▼──────┐
                    │   ESign /   │
                    │   Activity  │
                    └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  PMS        │
                    │  (Project)  │
                    │  [future]   │
                    └─────────────┘
```

---

## 6. DEPLOYMENT ARCHITECTURE

### 6.1 Docker Compose (Production)

```yaml
services:
  backend:
    build: ./backend         # Node 20 Alpine
    port: 5000:5000
    env_file: .env
    restart: always

  frontend:
    build: ./frontend        # Multi-stage: Node build → NGINX
    port: 3000:80
    build-arg: VITE_API_URL=http://3.108.106.233:5000/api
    depends_on: backend
    restart: always
```

### 6.2 Frontend Build Process (Multi-stage Docker)

```
Stage 1 (Build):
  Node 20 Alpine
  npm install
  npm run build  →  /app/dist/

Stage 2 (Serve):
  NGINX stable-alpine
  COPY dist → /usr/share/nginx/html
  Custom nginx.conf → SPA routing support
```

### 6.3 NGINX Configuration

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```
This ensures React Router's client-side routing works — all 404s fall back to `index.html`.

### 6.4 Environment-Based API URLs

| Environment | Backend URL |
|------------|-------------|
| Local Dev | `http://localhost:5000/api` |
| Production | `http://3.108.106.233:5000/api` |

The frontend reads `VITE_API_URL` at build time. The production URL is injected as a Docker build argument.

---

## 7. SHARED SYSTEMS

### 7.1 Email System (Nodemailer)
- Location: `backend/src/modules/crm/utils/sendEmail.js`
- Transport: Gmail SMTP
- Templates: Located in `crm/utils/Template/`
  - `leadTemplate.js` — New lead notification
  - `meetingTemplate.js` — Meeting confirmation
  - `meetingRescheduleTemplate.js` — Meeting reschedule
  - `referrerTemplate.js` — Referral acknowledgement

### 7.2 Toast Notification System
- Location: `frontend/src/shared/notifications/ToastProvider.jsx`
- Context: `ToastContext`
- Hook: `useToast()`
- Auto-dismiss with configurable duration
- Types: success, error, info, warning

### 7.3 Advanced Filter System
- Location: `frontend/src/shared/filters/`
- Components: `AdvancedFilter.jsx`, `DateRangeFilter.jsx`, `FilterDropdown.jsx`, `SortSelector.jsx`
- Hook: `useFilters.js`
- Config: `FilterConfig.js`
- Used in lead lists, proposal lists, meeting lists

### 7.4 Dynamic Table Builder
- Location: `frontend/src/shared/components/DynamicTableBuilder/`
- Used for BOQ rendering and proposal template display
- Configurable columns and row types

---

## 8. SCALABILITY & FUTURE ARCHITECTURE NOTES

### Current Bottlenecks
1. No pagination on most GET endpoints → will slow as data grows
2. No indexing strategy beyond the 4 indexes on CRMClient
3. Email sending is synchronous (blocks request thread)
4. No rate limiting on API endpoints

### Recommended Future Improvements
1. Add pagination middleware for all list endpoints
2. Add `express-rate-limit` for API protection
3. Move email sending to a job queue (Bull/BullMQ with Redis)
4. Add `express-validator` or global Joi middleware
5. Implement proper `verifyToken` middleware on all protected routes
6. Add MongoDB Atlas for production (vs self-hosted)
7. Implement soft-delete (`deletedAt` timestamp) for CRMClient
8. Fix trackingId generation with an atomic counter collection
