# VIBE_CODING_PROMPTS.md — JJ Studio ERP

> Production-grade, architecture-aware prompts for AI-assisted development. Each prompt is self-contained and includes all context an AI needs to generate correct, consistent code.

---

## HOW TO USE THESE PROMPTS

1. Copy the prompt
2. Replace `[PLACEHOLDERS]` with your specific values
3. Paste into Claude Code, Cursor, Windsurf, or ChatGPT
4. The AI will generate code consistent with the existing architecture

Always reference `AI_DEVELOPMENT_RULES.md` if the AI produces inconsistent output.

---

## PROMPT 1: CREATE A NEW BACKEND MODULE

```
You are working on the JJ Studio ERP backend. The stack is Node.js + Express 5 + MongoDB + Mongoose + Joi. 
It uses CommonJS modules (require/module.exports). All code must follow the existing module structure.

Create a complete backend module for [MODULE_NAME] with the following:

Module path: backend/src/modules/[module_name]/

1. MODEL: backend/src/modules/[module_name]/models/[ModelName].model.js
   - Mongoose schema for [MODEL_NAME]
   - Fields: [LIST YOUR FIELDS WITH TYPES]
   - Include { timestamps: true }
   - Include relevant indexes

2. VALIDATOR: backend/src/modules/[module_name]/validator/[ModelName].validator.js
   - Joi validation schemas for create and update operations
   - Export named schemas (createSchema, updateSchema)

3. CONTROLLER: backend/src/modules/[module_name]/controllers/[ModelName].controller.js
   - Functions: create, getAll, getById, update, delete
   - Each function wrapped in try/catch
   - Validate req.body with Joi before any DB operation
   - Return format: { message: string, data: object } on success
   - Return format: { message: string } on error
   - Use proper HTTP status codes (200, 201, 400, 404, 500)

4. ROUTES: backend/src/modules/[module_name]/routes/[ModelName].route.js
   - Express Router
   - POST /create
   - GET /get
   - GET /get/:id
   - PUT /update/:id
   - DELETE /delete/:id

5. Tell me the exact line to add to backend/src/app.js to register this module.

CONTEXT:
- The primary client entity is CRMClient (not Lead or Client — those are deprecated)
- If this module links to clients, use: leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMClient' }
- All dates should be stored as Date type, not strings
- Do not use TypeScript — plain JavaScript only
```

---

## PROMPT 2: CREATE A NEW REACT PAGE + HOOK

```
You are working on the JJ Studio ERP frontend. The stack is React 19 + Vite + Tailwind CSS + React Router v7.
It uses ES modules (import/export). All components must be functional (no class components).

Create a complete page for [PAGE_NAME] ([DESCRIPTION]).

1. CUSTOM HOOK: frontend/src/modules/[module_name]/hooks/use[PageName].js
   - Import { crmService } from '../../../shared/services/crmService' (or relevant service)
   - Import { useToast } from '../../../shared/notifications/ToastProvider'
   - Manage: data state, loading state, error state
   - Fetch data on mount using useEffect
   - Handle errors by calling toast.error(errorMessage)
   - Export all state and handlers as a single object

2. PAGE COMPONENT: frontend/src/modules/[module_name]/pages/[PageName]Page.jsx
   - Import and use the hook above
   - Show a loading spinner (use <Loader /> from shared/components/Loader/Loader.jsx) while loading
   - Use Tailwind classes exclusively (no custom CSS, no CSS modules)
   - Use Lucide React icons where needed: import { IconName } from 'lucide-react'
   - Use shared components from shared/components/ where appropriate

3. Tell me:
   - The import line to add to frontend/src/App.jsx
   - The Route element to add inside the appropriate route group
   - The navigation entry to add to frontend/src/shared/constants/navigation.js

EXISTING SERVICES AVAILABLE:
- crmService.getLeads(params) — Get CRM clients
- crmService.getLeadById(id) — Get single client
- crmService.updateLeadStatus(id, data) — Update client status
- crmService.createMeeting(data) — Create meeting
- crmService.getProposals(params) — Get proposals
```

---

## PROMPT 3: ADD A CRUD MODULE (FULL STACK)

```
You are working on the JJ Studio ERP system. 

I need a complete full-stack CRUD feature for [ENTITY_NAME] ([DESCRIPTION]).

TECH STACK:
- Backend: Node.js + Express 5 + MongoDB + Mongoose + Joi (CommonJS)
- Frontend: React 19 + Vite + Tailwind CSS + React Router v7 + Axios (ES Modules)

BACKEND (backend/src/modules/[module_name]/):
1. Mongoose model with fields: [FIELDS]
2. Joi validators for create/update
3. Controller: create, getAll, getById, update, delete (all with try/catch)
4. Express routes: POST /create, GET /get, GET /get/:id, PUT /update/:id, DELETE /delete/:id
5. Route registration line for app.js

FRONTEND:
1. API service methods in crmService.js (or new service file if unrelated to CRM):
   - create[Entity](data)
   - get[Entities](params)
   - get[Entity]ById(id)
   - update[Entity](id, data)
   - delete[Entity](id)

2. Custom hook: use[Entity]List.js
   - Fetch list with loading/error states
   - Expose: data, loading, error, refetch, handleDelete, handleStatusChange

3. List page: [Entity]ListPage.jsx
   - Table or card layout using Tailwind
   - Search, filter, and sort controls
   - Delete confirmation using <ConfirmationModal />
   - Add button that opens a modal form

4. Form/Modal: Add[Entity]Modal.jsx
   - Form fields matching the model
   - Calls create[Entity] or update[Entity] based on mode
   - Shows success/error toasts
   - Closes on success

RULES:
- Do not use TypeScript
- Use only Tailwind for styling
- Use only lucide-react for icons
- Form logic must be in a custom hook, not the component
- Always use useToast() for user feedback
```

---

## PROMPT 4: ADD AN API ENDPOINT TO EXISTING MODULE

```
You are working on the JJ Studio ERP backend (Node.js + Express 5 + MongoDB).

Add a new API endpoint to the existing [MODULE_NAME] module:

Endpoint: [HTTP_METHOD] /api/[route_prefix]/[endpoint_path]
Purpose: [DESCRIBE WHAT IT DOES]
Request body (if applicable): [FIELDS]
Response: [DESCRIBE EXPECTED RESPONSE]

RULES:
1. Add the route handler in: backend/src/modules/[module_name]/controllers/[Name].controller.js
2. Add the route in: backend/src/modules/[module_name]/routes/[Name].route.js
3. Validate any req.body with a new Joi schema in the validator file
4. Follow the existing error handling pattern: try/catch, return res.status().json({ message, data })
5. If this updates a CRMClient, use $set or $push (never replace the entire document)
6. If this updates interactionHistory, use $push (append-only)
7. Do NOT modify app.js — the route is already registered

EXISTING PATTERNS TO FOLLOW:
- Validation: const { error, value } = schema.validate(req.body); if (error) return res.status(400)...
- DB update: await Model.findByIdAndUpdate(id, { $set: updates }, { new: true })
- Not found: if (!doc) return res.status(404).json({ message: 'Not found' })
```

---

## PROMPT 5: ADD A MONGOOSE MODEL

```
Add a new Mongoose model for [ENTITY_NAME] to the JJ Studio ERP backend.

Location: backend/src/modules/[module_name]/models/[EntityName].model.js

Fields needed:
[LIST FIELDS WITH TYPES AND CONSTRAINTS]

Requirements:
1. Use CommonJS (const mongoose = require('mongoose'), module.exports = mongoose.model(...))
2. Include { timestamps: true } in schema options
3. Add these cross-references (use ObjectId refs):
   [LIST ANY FOREIGN KEY RELATIONSHIPS]
4. Add indexes for: [LIST FIELDS THAT NEED INDEXES]
5. If this entity links to clients, reference 'CRMClient' (not 'Lead' or 'Client')

Standard enum patterns used in this project:
- Status fields: use lowercase with underscores (e.g., 'pending_approval', 'in_progress')
- Type fields: use lowercase (e.g., 'residential', 'commercial')
- Role fields: use lowercase (e.g., 'admin', 'sales', 'manager')
```

---

## PROMPT 6: IMPLEMENT THE PMS MODULE (PROJECT MANAGEMENT)

```
You are working on the JJ Studio ERP system. I need to implement the Project Management System (PMS) module.

The models already exist at:
- backend/src/modules/pms/models/Project.model.js
- backend/src/modules/pms/models/Task.model.js
- backend/src/modules/pms/models/Milestone.model.js
- backend/src/modules/pms/models/SiteVisit.model.js

PMS is activated when a CRMClient is converted (CRMClient.advancePayment.movedToProjectManagement = true).
A Project links to CRMClient via clientId and to Proposal via proposalId.

IMPLEMENT:
1. Backend controllers for Project CRUD
2. Backend routes for /api/projects
3. Register route in backend/src/app.js
4. Frontend hook: useProjectList.js + useProjectDetails.js
5. Frontend pages:
   - /pms/projects → ProjectListPage.jsx (table of active projects)
   - /pms/projects/:id → ProjectDetailsPage.jsx (project details with tasks)
6. Add PMS nav items to frontend/src/shared/constants/navigation.js
7. Add routes to frontend/src/App.jsx

When a project is created, also:
- Add ObjectId to CRMClient.linkedProjects[]
- Append to CRMClient.interactionHistory with type: 'project'

TECH: Node.js + Express + MongoDB + React 19 + Tailwind CSS
No TypeScript. CommonJS backend. ES Modules frontend.
```

---

## PROMPT 7: ADD ROLE-BASED ACCESS CONTROL (RBAC)

```
Add proper RBAC middleware to the JJ Studio ERP backend.

Currently there is NO auth middleware — any valid JWT accesses any route.

IMPLEMENT:
1. Create: backend/src/middleware/auth.middleware.js
   - verifyToken(req, res, next) — validates JWT, sets req.user
   - requireRole(...roles) — checks req.user.role against allowed roles

JWT config: 
- Secret from process.env.JWT_SECRET (fallback: 'secretkey')
- Token in Authorization header: 'Bearer <token>'
- JWT payload: { id, email, role }

2. Apply to routes in app.js:
   - Public (no auth): POST /api/auth/login
   - Any authenticated user: GET /api/clients/get, etc.
   - Sales + Manager + Admin: POST /api/clients/create
   - Manager + Admin only: POST /api/Approve, GET /api/proposal/approval
   - Admin only: POST /api/auth/signup

3. The middleware should set req.user = { id, email, role } for use in controllers.

4. Update controllers that need req.user (e.g., createdBy: req.user.id)

RULES:
- CommonJS (require/module.exports)
- Do not modify Mongoose models
- Do not break existing routes — add middleware on top
```

---

## PROMPT 8: CREATE A DASHBOARD WIDGET

```
Add a new dashboard widget to the JJ Studio ERP.

Widget: [WIDGET_NAME]
Purpose: [DESCRIBE WHAT METRIC/DATA IT SHOWS]
Data source: [WHICH API ENDPOINT PROVIDES THE DATA]

IMPLEMENT:
1. Backend: Add a stats/aggregate endpoint if needed
   Location: [CONTROLLER FILE]
   Endpoint: GET /api/[resource]/stats

2. Frontend component: frontend/src/modules/dashboard/components/[WidgetName].jsx
   - Fetches its own data using crmService or apiClient
   - Shows loading state with a skeleton or spinner
   - Handles error gracefully (don't crash dashboard)
   - Uses Tailwind for layout (no CSS files)
   - Uses Lucide React for any icons

3. Add to DashboardPage.jsx

DESIGN GUIDELINES:
- Match the existing StatCard pattern for metric displays
- Use white background, rounded corners, subtle shadow: className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
- Numbers/metrics: large, bold text
- Labels: text-sm text-gray-500
- Icons: from lucide-react, size={20}, className="text-[color]-500"
```

---

## PROMPT 9: ADD EMAIL NOTIFICATION

```
Add an email notification for [TRIGGER_EVENT] in the JJ Studio ERP backend.

EMAIL SYSTEM:
- Nodemailer with Gmail SMTP
- Config in sendEmail utility: backend/src/modules/crm/utils/sendEmail.js
- Credentials from: process.env.EMAIL_USER, process.env.EMAIL_PASS
- Email templates in: backend/src/modules/crm/utils/Template/

IMPLEMENT:
1. Create email HTML template: backend/src/modules/crm/utils/Template/[templateName].js
   - Export a function: (data) => htmlString
   - Include JJ Studio branding (use the business name in the header)
   - Include relevant data: [WHAT DATA THE EMAIL SHOULD SHOW]
   - Plain but professional HTML — no external CSS libraries

2. Trigger the email in controller: [CONTROLLER_FILE] → [FUNCTION_NAME]
   - Call after successful DB operation
   - Pass recipient email from the CRMClient record
   - Don't await the email (fire and forget to avoid blocking response):
     sendEmail({ to, subject, html }).catch(console.error);

3. Don't fail the API response if the email fails — email is best-effort

Template data available from CRMClient:
- name, phone, email, trackingId, projectType, budget, assignedTo
```

---

## PROMPT 10: ADD SEARCH AND FILTER TO LIST PAGE

```
Add search and filter functionality to the [PAGE_NAME] in the JJ Studio ERP frontend.

CURRENT STATE:
- Page: frontend/src/modules/[module]/pages/[PageName]Page.jsx
- Hook: frontend/src/modules/[module]/hooks/use[Name].js
- API: crmService.[getMethod](params)

IMPLEMENT:
1. Update the hook to accept and pass filter params to the API:
   - searchQuery: string (name, phone search)
   - statusFilter: string (specific status values)
   - dateRange: { from, to } (date filtering)
   - sortBy: string (createdAt, name, etc.)
   - sortOrder: 'asc' | 'desc'

2. Add filter state to the hook using useState
3. Add debouncing for the search field (useEffect with 300ms delay)
4. Add a refetch that triggers when filters change

5. Add filter UI to the page:
   - Use <SearchInput /> from shared/components/SearchInput/SearchInput.jsx
   - Use <FilterDropdown /> from shared/filters/FilterDropdown.jsx
   - Use <SortSelector /> from shared/filters/SortSelector.jsx
   - Use <DateRangeFilter /> from shared/filters/DateRangeFilter.jsx
   - Clear/reset filters button

6. Display result count: "Showing X of Y records"

TAILWIND LAYOUT for filter bar:
className="flex flex-wrap gap-3 mb-6 items-center"
```

---

## PROMPT 11: BUILD A PROPOSAL TEMPLATE EDITOR

```
The proposal template system in JJ Studio ERP uses a table-based structure:

Template.structure = {
  columns: [{ id, label, type: 'text'|'number'|'label', width }],
  rows: [{ id, isGroupHeader: boolean, cells: { columnId: value } }]
}

Build or improve the TemplateEditorPage at:
frontend/src/modules/proposal/pages/TemplateEditorPage.jsx

FEATURES NEEDED:
1. Add/remove columns with type selection (text, number, label)
2. Add/remove rows (regular and group header rows)
3. Inline cell editing (click-to-edit)
4. Real-time preview of the template table
5. Save template (POST /api/Template/create or PUT /api/Template/update/:id)
6. Template name and type (residential/commercial) form at top

API calls use:
- crmService.createTemplate(data)
- crmService.updateTemplate(id, data)
- crmService.getTemplateById(id)

The TemplateEditorPage is used for both create (/proposal/templates/create) 
and edit (/proposal/templates/edit/:id) — use useParams() to detect the mode.

No TypeScript. Tailwind only. Functional React components. Custom hooks.
```

---

## PROMPT 12: ADD PAGINATION TO A BACKEND ENDPOINT

```
Add cursor-based or page-based pagination to the [ENDPOINT] in the JJ Studio ERP backend.

ENDPOINT: GET /api/[resource]/get
CONTROLLER: backend/src/modules/[module]/controllers/[Name].controller.js

IMPLEMENT:
1. Accept query params:
   - page (default: 1)
   - limit (default: 20, max: 100)

2. Apply pagination in the Mongoose query:
   const skip = (page - 1) * limit;
   const [data, total] = await Promise.all([
     Model.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
     Model.countDocuments(query)
   ]);

3. Return response:
   {
     message: 'Fetched',
     data: [...],
     pagination: {
       page: number,
       limit: number,
       total: number,
       totalPages: number,
       hasNextPage: boolean,
       hasPrevPage: boolean
     }
   }

4. Update the frontend service call to pass page and limit:
   crmService.getXxx({ page, limit, ...otherFilters })

5. Add pagination controls to the frontend list page using Tailwind:
   - Previous/Next buttons
   - Current page indicator
   - Total results count
```

---

## PROMPT 13: IMPLEMENT SOFT DELETE

```
Add soft delete to the CRMClient model in the JJ Studio ERP.

CURRENT STATE:
- DELETE /api/clients/delete/:id performs hard delete
- Model: backend/src/modules/crm/models/CRMClient.model.js

IMPLEMENT:
1. Add fields to CRMClient schema:
   - deletedAt: { type: Date, default: null }
   - isDeleted: { type: Boolean, default: false }

2. Add Mongoose index: { isDeleted: 1 }

3. Add a Mongoose query middleware to automatically exclude soft-deleted docs:
   crmClientSchema.pre(/^find/, function(next) {
     if (!this.getQuery().includeDeleted) {
       this.where({ isDeleted: false });
     }
     next();
   });

4. Update deleteClient controller to set soft delete:
   await CRMClient.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() });

5. Add a new route for restoring deleted clients:
   PATCH /api/clients/restore/:id → sets isDeleted: false, deletedAt: null

6. Update getStats to exclude deleted records
7. Add a "deleted leads" view accessible to admins

Do NOT touch the existing API response format — just change the implementation.
```

---

## PROMPT 14: CREATE A MOBILE-RESPONSIVE LEAD CARD

```
Create or improve the LeadCard component in the JJ Studio ERP frontend.

Component: frontend/src/modules/leads/components/LeadCard.jsx

The card displays a CRMClient record in a compact card format.

DATA TO DISPLAY:
- trackingId (e.g., CLI-2025-0042) — top-right badge
- name — bold heading
- phone — with phone icon
- email — if present
- source — with colored badge (walk_in → green, instagram → purple, referral → blue, etc.)
- projectType — Residential/Commercial tag
- budget — formatted as ₹X,XX,XXX
- status — <StatusBadge status={status} />
- lifecycleStage — subtitle text
- lastInteractionAt — "Last contact: X days ago"
- assignedTo.name — small text at bottom

ACTIONS:
- Click card → navigate to /crm/leads/:id
- Quick action buttons on hover: 
  - Schedule Meeting (Calendar icon)
  - Add Follow-up (Bell icon)
  - View Proposal (FileText icon)

DESIGN:
- White background, rounded-xl, shadow-sm, border border-gray-100
- Hover: shadow-md, transition-shadow duration-200
- Mobile: single column, full width
- Desktop: fits in a 3-column grid
- No external CSS — Tailwind only
- Icons: lucide-react only

PROPS: { lead: CRMClient, onMeeting?, onFollowup?, onProposal? }
```

---

## PROMPT 15: GENERATE SEED DATA SCRIPT

```
Create a seed script for [ENTITY_NAME] in the JJ Studio ERP backend.

Location: backend/src/scripts/seed[EntityName].js

The script should:
1. Connect to MongoDB using the MONGO_URI from .env
2. Clear existing [Entity] records (optional — add a --clear flag)
3. Generate N=[COUNT] realistic records with:
   [DESCRIBE WHAT FIELDS SHOULD BE SEEDED AND WITH WHAT DATA]
4. Insert all records in a single bulkWrite or insertMany call
5. Log progress: "Inserting [N] records..."
6. Log completion: "Seed complete. [N] records inserted."
7. Disconnect from MongoDB and exit

For CRMClient records, generate:
- Realistic Indian names
- Valid Indian phone numbers (+91 format or 10-digit)
- Sources: mix of walk_in, referral, instagram
- Various lifecycle stages
- Random assignment to existing user IDs
- Tracking IDs: CLI-2025-NNNN format

Run with: node backend/src/scripts/seed[EntityName].js
```

---

## PROMPT 16: REFACTOR A FEATURE FOR CONSISTENCY

```
Refactor [FILE/FEATURE] in the JJ Studio ERP to match the project's architectural conventions.

CURRENT ISSUES:
[DESCRIBE WHAT IS WRONG OR INCONSISTENT]

TARGET CONVENTIONS (from AI_DEVELOPMENT_RULES.md):
1. Form logic must be in a custom hook, not the component
2. API calls must go through crmService.js
3. User feedback must use useToast()
4. Styling must use Tailwind classes only
5. Icons must be from lucide-react
6. Components must be functional (no class components)
7. Error handling: try/catch in controllers, toast.error() on frontend

REFACTOR STEPS:
1. Extract form state into use[FormName].js hook
2. Move API calls to crmService.js if they're not already there
3. Replace any alert() / console.log() with useToast() calls
4. Replace any custom CSS with equivalent Tailwind classes
5. Replace any non-Lucide icons with Lucide equivalents
6. Ensure the component file only contains JSX and hook calls

Keep the same functionality — this is a refactor, not a rewrite.
Do not add new features. Do not change API endpoints.
```
