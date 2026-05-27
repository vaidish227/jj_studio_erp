# AI_CONTEXT.md — JJ Studio ERP: Master AI Context File

> **Purpose:** This file is the single source of truth for any AI model assisting with development on this codebase. Read this file before writing any code. It encodes the complete architecture, conventions, business rules, and development philosophy of the JJ Studio ERP system.

---

## 1. PROJECT OVERVIEW

**Product:** JJ Studio ERP — An Enterprise Resource Planning system built for **JJ Studio**, an Interior Architecture & Design company.

**Core Business Purpose:**
JJ Studio operates a high-touch interior design service business. The ERP manages the complete client lifecycle from first contact (walk-in, referral, Instagram DM) all the way through interior design project delivery. The system replaces spreadsheets and disconnected tools with a unified workflow.

**Current Scope (Live/Active):**
| Module | Status |
|--------|--------|
| CRM — Lead & Client Management | ✅ Active |
| Proposal & Quotation System | ✅ Active |
| Authentication & User Management | ✅ Active |
| Dashboard & Analytics | ✅ Active |
| Meeting Management | ✅ Active |
| Follow-up Management | ✅ Active |
| PMS — Project Management System | ✅ Active (full stack) |
| DDMS — Design & Drawing Library (DLR) | ✅ Active (full stack) |
| Vendor Directory | ✅ Active (full stack) |

**Planned/Stub Modules (Models exist, limited frontend):**
| Module | Status |
|--------|--------|
| HRM — Human Resources | 🔧 Stub |
| Finance Management | 🔧 Stub |
| Inventory Management | 🔧 Stub |

---

## 2. TECH STACK

### Backend
| Technology | Version | Role |
|------------|---------|------|
| Node.js | 20 | Runtime |
| Express | 5.2.1 | Web framework |
| MongoDB | — | Primary database |
| Mongoose | 9.5.0 | ODM |
| JWT (jsonwebtoken) | 9.0.3 | Authentication tokens |
| bcrypt | 6.0.0 | Password hashing (10 rounds) |
| Joi | 18.1.2 | Request validation |
| Nodemailer | 8.0.6 | Email sending (Gmail SMTP) |
| dotenv | 17.4.2 | Environment variables |
| cors | 2.8.6 | CORS headers |
| nodemon | 3.1.14 | Dev auto-reload |

### Frontend
| Technology | Version | Role |
|------------|---------|------|
| React | 19.2.5 | UI library |
| React Router DOM | 7.14.2 | Client-side routing |
| Vite | 8.0.10 | Build tool & dev server |
| Tailwind CSS | 4.2.4 | Utility-first styling |
| Axios | 1.15.2 | HTTP client |
| Lucide React | 1.9.0 | Icon library |
| ESLint | 10.2.1 | Linting |

### Infrastructure
| Technology | Role |
|------------|------|
| Docker | Container packaging |
| Docker Compose | Multi-container orchestration |
| NGINX | Frontend reverse proxy (production) |
| AWS EC2 | Production server (IP: 3.108.106.233) |

---

## 3. MONOREPO STRUCTURE

```
ERP/
├── backend/                    # Node.js + Express + MongoDB API
│   ├── src/
│   │   ├── app.js              # Express app (routes registered here)
│   │   ├── index.js            # Entry point (DB connect + server start)
│   │   ├── config/
│   │   │   └── db.js           # Mongoose connection
│   │   ├── modules/            # Feature modules
│   │   │   ├── auth/           # Authentication & user management
│   │   │   ├── crm/            # CRM: clients, meetings, follow-ups, proposals
│   │   │   ├── proposal/       # Proposal system: BOQ, templates, approvals
│   │   │   ├── pms/            # Project Management System (full stack, see PMS section)
│   │   │   ├── hrm/            # (Stub) Human Resources
│   │   │   ├── finance/        # (Stub) Finance
│   │   │   └── inventory/      # (Stub) Inventory
│   │   └── scripts/            # Seed & migration scripts
│   ├── app.js                  # ← NOTE: This is in backend root, not src/
│   ├── package.json
│   ├── Dockerfile
│   └── .env
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── main.jsx            # React entry point
│   │   ├── App.jsx             # Router configuration
│   │   ├── modules/            # Feature modules
│   │   │   ├── auth/           # Login page, auth hooks
│   │   │   ├── dashboard/      # Dashboard page + components
│   │   │   ├── crm/            # CRM forms + CRMContext
│   │   │   ├── leads/          # Lead pipeline pages
│   │   │   ├── proposal/       # Proposal system pages
│   │   │   ├── profile/        # User profile
│   │   │   └── settings/       # Settings + user creation
│   │   └── shared/             # Cross-module reusables
│   │       ├── components/     # Reusable UI component library
│   │       ├── hooks/          # Custom React hooks
│   │       ├── layouts/        # AppLayout, Sidebar, Navbar, PublicLayout
│   │       ├── services/       # apiClient, authService, crmService
│   │       ├── notifications/  # ToastProvider
│   │       ├── filters/        # AdvancedFilter, DateRangeFilter, etc.
│   │       ├── constants/      # Navigation config
│   │       ├── styles/         # theme.css (CSS variables)
│   │       └── utils/          # dateUtils
│   ├── public/                 # Static assets (logo, favicon)
│   ├── index.html
│   ├── vite.config.js
│   ├── nginx.conf              # Production NGINX config
│   ├── Dockerfile
│   └── .env
│
├── docker-compose.yml
└── docs/                       # AI context documentation (this folder)
```

---

## 4. ARCHITECTURE SUMMARY

### Backend Architecture
- **Style:** Modular Monolith with feature-based module folders
- **Pattern:** MVC (Model → Controller → Route), with a thin service layer for auth
- **Entry flow:** `index.js` → `app.js` → `modules/*/routes` → `modules/*/controllers` → `modules/*/models`
- **No global auth middleware** — JWT is validated per-controller where needed (currently inconsistently enforced)
- **Validation:** Joi schemas in `validator/` folder per module
- **Email:** Nodemailer with Gmail SMTP via utility function in `crm/utils/sendEmail.js`

### Frontend Architecture
- **Style:** Feature-based module structure under `src/modules/`
- **Routing:** React Router v7 with nested routes, `AppLayout` as shell
- **State:** React Context API only (no Redux/Zustand)
  - `CRMContext` — active lead state + lifecycle automation
  - `ToastContext` — global notification system
- **Data fetching:** Axios via `apiClient.js` with request/response interceptors
- **API abstraction:** `crmService.js` centralizes all CRM API calls
- **Styling:** Tailwind CSS v4 utility classes + CSS variables in `theme.css`

---

## 5. KEY BUSINESS ENTITIES

### User
Roles: `admin`, `sales`, `manager`, `accounts`, `designer`, `supervisor`

### CRMClient (Primary entity — the "lead → client" record)
The most important model. Tracks a person from first enquiry all the way to a converted client. Single document per person, updated as they progress through the lifecycle.

**Lifecycle Stages (ordered):**
```
enquiry → meeting_scheduled → thank_you_sent → client_info_pending →
kit → followup_due → show_project → interested → proposal_sent →
advance_received → project_moved → project_started → converted | lost
```

**Status (simplified view):**
```
new → contacted → meeting_done → proposal_sent → converted | lost
```

**Key fields:**
- `trackingId` — Auto-generated: `CLI-YYYY-NNNN` (e.g., `CLI-2025-0042`)
- `source` — walk_in | referral | website | instagram | whatsapp | other
- `interactionHistory[]` — Event-sourced timeline of all interactions
- `communicationLogs[]` — WhatsApp/Email/SMS logs
- `advancePayment` — Payment received before project starts
- `showProject` — Assets shown to client (images, videos, links)
- `assignedTo` — Sales person (User ref)

### Proposal
Linked to a CRMClient. Contains BOQ (Bill of Quantities), pricing, approval workflow, e-signature tracking, and payment recording.

**Proposal Status Flow:**
```
draft → pending_approval → manager_approved → sent →
esign_received → payment_received → project_ready → project_started
(or) → rejected
```

### BOQ (Bill of Quantities)
Attached to a Proposal. Contains line items (BOQ_items) that sum to a total. Has GST and final amount calculations.

### Template
Reusable proposal structure with configurable columns and rows. Types: `residential` | `commercial`.

---

## 6. API CONVENTIONS

### Base URL
- Development: `http://localhost:5000/api`
- Production: `http://3.108.106.233:5000/api`

### Route Naming
```
POST   /api/[resource]/create       → Create new
GET    /api/[resource]/get          → List all (with query params for filters)
GET    /api/[resource]/get/:id      → Get single by ID
PUT    /api/[resource]/update/:id   → Full update
PATCH  /api/[resource]/status/:id  → Status-only update
DELETE /api/[resource]/delete/:id  → Delete
```

### Known Inconsistencies (Do NOT change — backward-compatible)
- `/api/metting` — typo for "meeting", intentional in codebase
- `/api/Template` — capital T, matches route registration
- `/api/Approve` — capital A, matches route registration
- Some routes use `/delete` (no `:id`) with ID in body — check controller

### Response Format
Success:
```json
{ "message": "...", "data": { ... } }
```
Error:
```json
{ "message": "Error description" }
```

### Authentication Header
```
Authorization: Bearer <jwt_token>
```
Token stored in `localStorage` as `auth_token`. User object stored as `user` (JSON string).

---

## 7. AUTHENTICATION & RBAC

### Auth Flow
1. User visits `/login` → submits email + password
2. Frontend calls `POST /api/auth/login`
3. Backend validates credentials, loads role permissions from `Role` collection
4. Returns `{ token, user, permissions: ['crm.read', ...] }`
5. Frontend `useLogin` calls `AuthContext.login(user, token, permissions)`
6. All subsequent API calls include `Authorization: Bearer <token>` header via Axios interceptor
7. On logout: `AuthContext.logout()` clears token + user + permissions from localStorage

### JWT Payload
`{ id, email, role }` — 1-day expiry

### Backend Auth Middleware
`backend/src/middleware/auth.middleware.js`
- `verifyToken` — validates JWT, sets `req.user`. Applied globally in `app.js` after `/api/auth` routes.
- `requirePermission(perm)` — loads role permissions from DB, returns 403 if missing.
- `requireRole(...roles)` — quick role check (no DB lookup).

### Frontend Auth System
- `AuthContext` (`shared/context/AuthContext.jsx`) — provides `user`, `permissions`, `isAuthenticated`, `login()`, `logout()`, `hasPermission()`
- `useAuth()` hook — access AuthContext
- `usePermission(perm)` hook — returns Boolean
- `PermissionGate` component — conditionally renders children based on permission

### Roles
| Role | Enum | Key Permissions |
|------|------|----------------|
| `admin` | admin | `*` (everything) |
| `md` | md | read all + approve + reports + drawings.read + vendor.read |
| `manager` | manager | CRM + proposal.approve + projects.create + drawings.approve + drawings.release + vendor.manage |
| `sales` | sales | CRM + KIT + proposal (no approve) |
| `accounts` | accounts | finance + reports |
| `designer` | designer | projects + tasks + drawings.upload + site_logs.read |
| `supervisor` | supervisor | CRM read + projects + tasks + site_logs.create + drawings.read |
| `vendor` | vendor | vendor portal only |
| `client` | client | client portal only |

### Permission Format
`module.action` — e.g. `crm.read`, `proposal.approve`, `users.manage`

Role permissions are **dynamically managed** via Settings → Roles & Permissions (admin UI).
See `docs/RBAC_GUIDE.md` for complete reference.

### localStorage Keys
| Key | Value |
|-----|-------|
| `auth_token` | JWT string |
| `user` | `{ id, name, email, role }` JSON |
| `permissions` | `[String]` JSON array |

---

## 8. CODING STANDARDS & CONVENTIONS

### File Naming
| Type | Convention | Example |
|------|-----------|---------|
| Backend models | `PascalCase.model.js` | `CRMClient.model.js` |
| Backend controllers | `PascalCase.controller.js` | `CRMClient.controller.js` |
| Backend routes | `PascalCase.route.js` | `Client.route.js` |
| Backend validators | `PascalCase.validator.js` | `Lead.validator.js` |
| Backend services | `camelCase.service.js` | `auth.service.js` |
| Frontend pages | `PascalCasePage.jsx` | `LoginPage.jsx` |
| Frontend components | `PascalCase.jsx` | `Button.jsx` (in own folder) |
| Frontend hooks | `useCamelCase.js` | `useLogin.js` |
| Frontend services | `camelCaseService.js` | `crmService.js` |
| Frontend context | `PascalCaseContext.jsx` | `CRMContext.jsx` |

### Backend Conventions
- CommonJS modules (`require` / `module.exports`)
- Async/await for all async operations
- Try/catch in every controller function
- Validation with Joi before business logic
- Business logic in controller (thin service layer — only auth has a dedicated service)
- Mongoose models registered with `mongoose.model("ModelName", schema)`

### Frontend Conventions
- ES modules (`import` / `export`)
- Functional components only (no class components)
- Custom hooks for API calls and form logic (never call API directly in component)
- `crmService.js` for all CRM-related API calls
- `apiClient.js` for all raw axios calls
- Context providers wrap route groups in `App.jsx`
- Tailwind utility classes directly in JSX (no CSS modules)
- Lucide React for all icons

### Naming Conventions
- React components: PascalCase
- Hooks: `useNoun` or `useVerbNoun`
- API service methods: `verbNoun` (createLead, updateStatus, getById)
- MongoDB collection names: Mongoose pluralizes model name automatically
- Environment variables: SCREAMING_SNAKE_CASE

---

## 9. STATE MANAGEMENT RULES

### Global State (Context API)
1. **CRMContext** — Scoped to CRM + Proposal route groups
   - `activeLead` — persisted in localStorage
   - `crmState` — draft/step state
   - Access via: `useCRM()` hook
   
2. **ToastContext** — App-wide, provided at root
   - Use `useToast()` hook to trigger toasts
   - Methods: `success()`, `error()`, `info()`, `warning()`

3. **PMSContext** — App-wide (wraps BrowserRouter in App.jsx)
   - `activeProject` — currently viewed project (set by `useProjectDetail`)
   - `invalidateProjects()` — bumps a version counter; causes `useProjects` to re-fetch
   - Access via: `usePMS()` hook

### Local State
- Form state: `useState` in custom hook (e.g., `useLogin`, `useEnquiry`)
- UI state (modals, toggles): `useState` in component
- List + filter state: custom hooks like `useLeadList`, `useFilters`, `useProjects`, `useDrawings`

### Rules
- **Never call API directly in JSX** — use custom hooks
- **Never use Redux** — project uses Context API
- **Always extract form logic** into a dedicated `useFormName.js` hook
- **Persist minimal state** — only `activeLead` and auth in localStorage

### React 19 Compiler Rule — useEffect
`eslint-plugin-react-hooks ^7.1.1` forbids **synchronous `setState` in effect bodies**. Use the version-trigger pattern:
```js
const [isLoading, setIsLoading] = useState(true); // initial load
const [version, setVersion] = useState(0);

useEffect(() => {
  let cancelled = false;
  service.fetch()
    .then(res => { if (!cancelled) setData(res); })
    .catch(err => { if (!cancelled) setError(err); })
    .finally(() => { if (!cancelled) setIsLoading(false); });
  return () => { cancelled = true; };
}, [version]); // re-runs when version bumps

const refresh = useCallback(() => {
  setIsLoading(true);   // event-handler context — allowed
  setVersion(v => v + 1);
}, []);
```
Never put `setIsLoading(true)` at the top of an effect body.

---

## 10. IMPORTANT WORKFLOWS

### New Client Enquiry → Conversion Flow
```
1. Sales team fills /crm/forms/enquiry
   → Creates CRMClient (status: new, lifecycle: enquiry)

2. Team schedules meeting → /crm/meetings
   → CRMClient lifecycle: meeting_scheduled
   → Email sent to client (Nodemailer)

3. Post-meeting → thank you automation
   → lifecycle: thank_you_sent

4. Client fills /public/client-info (shareable public link)
   → CRMClient enriched with full details
   → lifecycle: client_info_pending → kit (KIT = Keep In Touch)

5. Follow-ups tracked → /crm/follow-ups
   → lifecycle: followup_due

6. Show project assets to client
   → lifecycle: show_project → interested

7. Create proposal → /proposal/create
   → Proposal (status: draft) created, linked to CRMClient
   → lifecycle: proposal_sent

8. Manager approves proposal → /proposal/approval
   → Proposal status: manager_approved → sent
   → lifecycle: proposal_sent

9. Client e-signs → tracked in ESign collection
   → Proposal status: esign_received

10. Advance payment received
    → CRMClient advancePayment updated
    → lifecycle: advance_received → project_moved

11. Converted → /crm/converted
    → CRMClient status: converted
    → lifecycle: converted
    → Ready to link to PMS Project
```

### Proposal Creation Flow
```
1. Create Template (optional reuse)
2. Create Proposal → link to client, optionally use template
3. Build BOQ → attach line items
4. Submit for internal approval
5. Manager approves/rejects
6. Send to client
7. Track e-sign
8. Record payment
9. Mark project-ready
```

---

### PMS Project Lifecycle (Design Sub-Flow)
```
1. Project created (status: design_phase)
   → Kickstart checklist (6 items: WhatsApp groups, forms, quotation)

2. Designer A leads — sub-designer slots filled (B/C/D/E + Supervisor)

3. Tasks created per designer (taskType maps to sub-flow):
   ac_coordination, technical_drawing, kitchen_drawing,
   bathroom_drawing, automation_coordination, 3d_render,
   concept_making, furniture_layout, site_measurement

4. Each task has checklist items + optional external coordination
   → Kanban view (by status) or grouped list view (by taskType)

5. Drawings uploaded per task → DLR (Drawing Library Repository)
   draft → send_for_approval → approved/rejected → released_to_site

6. Client approvals tracked separately (6 types):
   AC, Automation, Kitchen, Bathroom Material, CP Fittings, Wall & Floor
   → Approval Dashboard at /pms/approvals for pending response queue

7. Site logs recorded by supervisor
   → Site Visits also logged (purpose, observations, next visit date)

8. Material selection tracked per project (category, brand, status)
   Statuses: proposed → selected_by_client → ordered → delivered_at_site

9. Purchase Orders raised per project/vendor with line items
   PO lifecycle: draft → sent_to_vendor → confirmed → delivered/cancelled

10. Milestones set with due dates and critical flag
    → All dates aggregate into Project Calendar at /pms/calendar

11. WhatsApp groups per project (main, drawing, supervision, payment)
    → Linked to whatsapp.service.sendImmediate() for update broadcasts

12. Activity log auto-records all significant actions (fire-and-forget)

13. Project phases: design_phase → execution_phase → handover → completed
```

### New PMS Backend Entities (added 2026-05-15)
| Model | Collection | Purpose |
|-------|-----------|---------|
| `ProjectMilestone` | `pms_milestones` | Date-keyed project milestones with critical flag |
| `PMSActivityLog` | `pms_activity_logs` | Audit trail for all PMS actions |
| `WhatsAppProjectGroup` | `pms_whatsapp_groups` | WA group records linked to project |
| `PMSApproval` | `pms_approvals` | Cross-project approval requests & responses |
| `SiteVisit` | `pms_sitevisits` | Site visit logs with purpose/observations |
| `Material` | `pms_materials` | Material selection tracking per project |
| `PurchaseOrder` | `pms_purchaseorders` | POs with line items, vendor, payment status |

### New PMS API Routes (added 2026-05-15)
| Prefix | Purpose |
|--------|---------|
| `/api/pms/milestone` | Milestones CRUD |
| `/api/pms/activity` | Activity log (paginated read) |
| `/api/pms/whatsapp-group` | WA group CRUD + send update |
| `/api/pms/calendar` | Aggregated calendar events (read-only) |

### Activity Logger Pattern
`backend/src/shared/activityLogger.js` — fire-and-forget utility:
- Import: `const logActivity = require('../shared/activityLogger')`
- Never throws; wraps DB write in try/catch, logs to console on error
- Called at end of every significant controller action (create, update, status change)

### Drawing Lifecycle
```
draft
  ↓ sendForApproval (only from draft or rejected)
sent_for_approval
  ↓ approveDrawing (with optional remarks)   ↓ rejectDrawing (reason required)
approved                                      rejected
  ↓ releaseDrawing (propagates to task)         ↓ reviseDrawing (new version)
released_to_site                              draft (v+1)
```

---

## 11. DO'S AND DON'TS FOR AI-ASSISTED DEVELOPMENT

### DO
- Follow the existing module folder structure: `backend/src/modules/<name>/{controllers,models,routes,validator}/`
- Use Joi for all backend validation
- Use `crmService.js` for any new CRM-related API call on the frontend
- Extend `CRMContext` for new CRM-level state
- Use `useToast()` for user-facing notifications
- Use Tailwind CSS classes (no custom CSS unless CSS variable override)
- Add new routes to `backend/src/app.js`
- Follow existing API naming patterns (see Section 6)
- Use `mongoose.Schema.Types.ObjectId` with `ref` for relations
- Use `timestamps: true` on every new Mongoose schema

### DON'T
- Don't create Redux, Zustand, or any new state library
- Don't bypass the `apiClient.js` interceptor (never call axios directly)
- Don't rename `/api/metting` to `/api/meeting` — it will break existing data
- Don't use TypeScript — project is plain JavaScript
- Don't add CSS modules — use Tailwind only
- Don't add class-based React components
- Don't hardcode API URLs — use `import.meta.env.VITE_API_URL`
- Don't skip Joi validation on new backend endpoints
- Don't add frontend auth guards as separate route wrapper components — use AppLayout
- Don't use `var` — use `const` / `let`

---

## 12. ENVIRONMENT VARIABLES

### Backend (`.env`)
```
MONGO_URI=mongodb://localhost:27017/jj_studio
PORT=5000
JWT_SECRET=<secret>          # Falls back to "secretkey" if missing
EMAIL_USER=<gmail>
EMAIL_PASS=<gmail-app-password>
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:5000/api
# Production: VITE_API_URL=http://3.108.106.233:5000/api
```

---

## 13. KNOWN TECHNICAL DEBT & ISSUES

| Issue | Location | Priority |
|-------|----------|----------|
| JWT secret falls back to hardcoded "secretkey" | `auth.service.js` | 🔴 Critical — set JWT_SECRET in production .env |
| No per-route requirePermission on existing routes yet | CRM + Proposal routes | 🟡 High — add incrementally |
| CORS is fully open `cors()` | `app.js` | 🟡 High |
| Deprecated Lead.model.js & Client.model.js still in codebase | `crm/models/` | 🟡 High |
| Typo "metting" throughout codebase | routes, service, API | 🟠 Medium |
| trackingId generation is not concurrency-safe (countDocuments + 1) | `CRMClient.model.js` | 🟠 Medium |
| No pagination on most list endpoints | `crm/controllers/` | 🟠 Medium |
| No soft-delete — DELETE is hard delete | `CRMClient.controller.js` | 🟠 Medium |
| Token stored in localStorage (XSS risk) | Frontend | 🟡 High |
| Drawing file upload is URL-based (no real file storage) | `Drawing.controller.js` + `UploadDrawingModal.jsx` | 🟡 High — integrate Cloudinary or S3 |
| seedRoles.js must be run manually after permissions change | `backend/src/scripts/seedRoles.js` | 🟠 Medium — run after each role permission update |
| CreateTaskModal assignedTo field uses raw ObjectId | `CreateTaskModal.jsx` | 🟠 Medium — replace with user search/select |
| CreateProjectModal clientId field uses raw ObjectId | `CreateProjectModal.jsx` | 🟠 Medium — replace with CRM client search |

---

## 14. FUTURE MODULE ANCHORS

When building stub modules, these cross-references already exist:

- `CRMClient.linkedProjects[]` → `Project` (pms module)
- `CRMClient.linkedInvoices[]` → `Invoice` (finance module)
- `Proposal.leadId` → `CRMClient`
- `Project.clientId` → `CRMClient` (in pms/models/Project.model.js)
- `Project.proposalId` → `Proposal`
