# AI_DEVELOPMENT_RULES.md — JJ Studio ERP

> This file defines the **hard rules** every AI model must follow when generating code for this project. Violating these rules produces inconsistent, unmaintainable, or broken code. Read before writing a single line.

---

## RULE 1: RESPECT THE MODULE FOLDER STRUCTURE

### Backend
New backend features MUST be placed inside:
```
backend/src/modules/<module-name>/
├── controllers/<Name>.controller.js
├── models/<Name>.model.js
├── routes/<Name>.route.js
├── validator/<Name>.validator.js
└── service/<name>.service.js   (only if complex business logic exists)
```

**Violation example:**
```
backend/src/utils/newFeature.js   ❌  (wrong — not in a module)
backend/src/modules/crm/newFile.js ❌  (wrong — not in correct subfolder)
```

**Correct:**
```
backend/src/modules/pms/controllers/Project.controller.js  ✅
backend/src/modules/pms/models/Project.model.js  ✅
```

### Frontend
New frontend features MUST follow:
```
frontend/src/modules/<module-name>/
├── pages/<FeatureName>Page.jsx
├── components/<Component>/<Component>.jsx
└── hooks/use<FeatureName>.js
```

Shared/reusable items go in:
```
frontend/src/shared/components/<ComponentName>/<ComponentName>.jsx
frontend/src/shared/hooks/use<HookName>.js
frontend/src/shared/services/<serviceName>.js
```

---

## RULE 2: NEVER BYPASS THE API SERVICE LAYER

### Backend: No direct Express routes outside module system
```js
// ❌ WRONG — route added directly to app.js
app.get('/api/newfeature', (req, res) => { ... });

// ✅ CORRECT — create route file, register in app.js
// 1. modules/newfeature/routes/NewFeature.route.js
// 2. In app.js: app.use('/api/newfeature', require('./modules/newfeature/routes/NewFeature.route'));
```

### Frontend: Always use the service layer
```js
// ❌ WRONG — calling axios directly in a component
import axios from 'axios';
const data = await axios.get('http://localhost:5000/api/clients/get');

// ❌ WRONG — calling apiClient directly in a page component
const data = await apiClient.get('/clients/get');

// ✅ CORRECT — use crmService
const data = await crmService.getLeads({ status: 'new' });
```

---

## RULE 3: ALWAYS USE JOI VALIDATION ON THE BACKEND

Every controller that accepts `req.body` MUST validate it with Joi before processing:

```js
// ❌ WRONG — using req.body directly
const { name, phone } = req.body;
await CRMClient.create({ name, phone });

// ✅ CORRECT — validate first
const { error, value } = createLeadSchema.validate(req.body);
if (error) return res.status(400).json({ message: error.details[0].message });
await CRMClient.create({ name: value.name, phone: value.phone });
```

Joi schema goes in the module's `validator/` folder, NOT inline in the controller.

---

## RULE 4: PRESERVE EXISTING API PATHS — ESPECIALLY TYPOS

These routes contain intentional typos or non-standard casing. **Do NOT rename or fix them** — frontend and existing data depend on them:

| Route | Note |
|-------|------|
| `/api/metting` | Typo for "meeting" — keep as is |
| `/api/Template` | Capital T — keep as is |
| `/api/Approve` | Capital A — keep as is |

Adding a new meeting endpoint? Use `/api/metting/newEndpoint`.

---

## RULE 5: NEVER USE CLASS COMPONENTS IN REACT

All React code must use functional components:

```jsx
// ❌ WRONG
class LeadCard extends React.Component { render() { ... } }

// ✅ CORRECT
function LeadCard({ lead }) { return <div>...</div>; }
export default LeadCard;
```

---

## RULE 6: ALWAYS EXTRACT FORM LOGIC INTO CUSTOM HOOKS

Form state, submission, and validation must live in a dedicated hook, not in the component:

```jsx
// ❌ WRONG — form logic in component
function EnquiryForm() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    setLoading(true);
    await crmService.createLead({ name });
    setLoading(false);
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}

// ✅ CORRECT — logic in hook
// useEnquiry.js
export function useEnquiry() {
  const [form, setForm] = useState({ name: '' });
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await crmService.createLead(form);
      success('Enquiry created!');
    } catch (err) {
      error(err);
    } finally {
      setLoading(false);
    }
  };

  return { form, setForm, loading, handleSubmit };
}

// EnquiryForm.jsx — clean component
function EnquiryForm() {
  const { form, setForm, loading, handleSubmit } = useEnquiry();
  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## RULE 7: USE USETOAST FOR ALL USER-FACING FEEDBACK

```js
// ❌ WRONG — alert, console, or window.alert
alert('Saved!');
console.log('Error occurred');

// ❌ WRONG — custom notification state
const [notification, setNotification] = useState('');

// ✅ CORRECT
const { success, error, info, warning } = useToast();
success('Lead created successfully');
error('Failed to save. Please try again.');
```

---

## RULE 8: MONGODB SCHEMAS MUST INCLUDE TIMESTAMPS

```js
// ❌ WRONG
const schema = new mongoose.Schema({ name: String });

// ✅ CORRECT
const schema = new mongoose.Schema({ name: String }, { timestamps: true });
```

---

## RULE 9: APPEND-ONLY ARRAYS — NEVER OVERWRITE

The `interactionHistory` and `communicationLogs` arrays in CRMClient are audit trails:

```js
// ❌ WRONG — overwrites entire array
await CRMClient.findByIdAndUpdate(id, {
  interactionHistory: newArray
});

// ✅ CORRECT — append only
await CRMClient.findByIdAndUpdate(id, {
  $push: {
    interactionHistory: {
      type: 'note',
      title: 'Follow-up called',
      description: req.body.description,
      createdAt: new Date()
    }
  },
  $set: { lastInteractionAt: new Date() }
});
```

---

## RULE 10: USE COMMON JS ON BACKEND, ES MODULES ON FRONTEND

```js
// ✅ Backend (CommonJS)
const express = require('express');
const CRMClient = require('../models/CRMClient.model');
module.exports = router;

// ✅ Frontend (ES Modules)
import { crmService } from '../../../shared/services/crmService';
export default function MyComponent() { ... }
```

Never mix these. Never add `"type": "module"` to the backend `package.json`.

---

## RULE 11: ENVIRONMENT VARIABLES — NO HARDCODED URLS

```js
// ❌ WRONG — Backend
const mongoUri = 'mongodb://localhost:27017/jj_studio';

// ✅ CORRECT — Backend
const mongoUri = process.env.MONGO_URI;

// ❌ WRONG — Frontend
const apiUrl = 'http://localhost:5000/api';

// ✅ CORRECT — Frontend (use the apiClient, which reads from env)
// Never reference backend URL directly — use apiClient or crmService
```

---

## RULE 12: TAILWIND ONLY — NO CSS FILES FOR COMPONENT STYLING

```jsx
// ❌ WRONG — custom CSS file
import './LeadCard.css';
<div className="lead-card">...</div>

// ✅ CORRECT — Tailwind classes only
<div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
  ...
</div>
```

Exception: CSS variables for theme tokens may go in `shared/styles/theme.css`.

---

## RULE 13: ICONS — ONLY LUCIDE REACT

```jsx
// ❌ WRONG
import { FaUser } from 'react-icons/fa';
import UserIcon from './UserIcon.svg';

// ✅ CORRECT
import { User, ChevronRight, Plus, Trash2 } from 'lucide-react';
<User size={20} className="text-gray-500" />
```

---

## RULE 14: MONGOOSE OPERATIONS — USE CORRECT PATTERNS

```js
// ✅ Find with partial update
await Model.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });

// ✅ Always check if document exists
const doc = await Model.findById(id);
if (!doc) return res.status(404).json({ message: 'Not found' });

// ✅ Populate references
await Proposal.findById(id).populate('leadId', 'name phone email');

// ✅ Return from async routes
return res.status(200).json({ data });  // Always use return
```

---

## RULE 15: CONTROLLER ERROR HANDLING — ALWAYS TRY/CATCH

```js
// ✅ Every controller function MUST have this shape:
const doOperation = async (req, res) => {
  try {
    // validation
    // business logic
    // db operation
    return res.status(200).json({ message: 'Success', data: result });
  } catch (err) {
    console.error('[doOperation]', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};
```

---

## RULE 16: RESPONSE FORMAT CONSISTENCY

### Success responses
```js
// Single resource
res.status(200).json({ message: 'Client found', data: client });

// List
res.status(200).json({ message: 'Clients fetched', data: clients, total: clients.length });

// Created
res.status(201).json({ message: 'Client created', data: newClient });
```

### Error responses
```js
res.status(400).json({ message: 'Validation error message' });
res.status(404).json({ message: 'Client not found' });
res.status(500).json({ message: 'Internal server error' });
```

**Never** return nested `{ error: { message: ... } }` or raw exception objects.

---

## RULE 17: ROUTE REGISTRATION ORDER MATTERS

When adding new routes to `app.js`, respect the existing registration order. Add specific routes before wildcard/generic ones:

```js
// ✅ CORRECT — specific before generic
app.use('/api/clients', clientRoutes);
app.use('/api/leads', leadRoutes);
// New module:
app.use('/api/projects', projectRoutes);   // Add after existing routes
```

---

## RULE 18: NO TYPESCRIPT

This project is entirely JavaScript. Do NOT:
- Add TypeScript files (`.ts`, `.tsx`)
- Add `tsconfig.json`
- Add `@types/*` packages
- Use TypeScript-only syntax (type annotations, interfaces, generics, etc.)

---

## RULE 19: NEW MODULE CHECKLIST — NEVER SKIP STEPS

### Backend new module:
1. ✅ Create `modules/<name>/` with subfolders
2. ✅ Write Mongoose schema (with timestamps)
3. ✅ Write Joi validator
4. ✅ Write controller (try/catch on all functions)
5. ✅ Write route file
6. ✅ Register route in `app.js`

### Frontend new module:
1. ✅ Create `modules/<name>/pages/`, `components/`, `hooks/`
2. ✅ Write custom hook for API data fetching
3. ✅ Write page component using the hook
4. ✅ Add method to `crmService.js` (or create new service file)
5. ✅ Add route in `App.jsx`
6. ✅ Add navigation entry in `shared/constants/navigation.js`
7. ✅ Export from `modules/<name>/index.js`

---

## RULE 20: DEPRECATED MODELS — DO NOT USE

These models exist only for legacy compatibility:
```
backend/src/modules/crm/models/Lead.model.js    ← DEPRECATED
backend/src/modules/crm/models/Client.model.js  ← DEPRECATED
```

All new client/lead operations MUST use:
```
backend/src/modules/crm/models/CRMClient.model.js  ✅
```

If writing a new feature that involves clients or leads, always reference `CRMClient`.

---

## SUMMARY QUICK-REFERENCE TABLE

| Rule | Key Constraint |
|------|---------------|
| Folder structure | All code inside `modules/<name>/` subfolders |
| API service layer | Frontend always uses service files, never raw axios |
| Joi validation | All req.body must be validated before DB ops |
| Route typos | Never rename `/api/metting`, `/api/Template`, `/api/Approve` |
| React components | Functional only, hooks for logic |
| Form logic | Always in dedicated `useFoo.js` hook |
| Toasts | Always `useToast()` for user feedback |
| Timestamps | `{ timestamps: true }` on all Mongoose schemas |
| Arrays | `$push` to interactionHistory/communicationLogs, never overwrite |
| Module system | CommonJS backend, ES Modules frontend |
| Env vars | No hardcoded URLs or secrets |
| Styling | Tailwind classes only |
| Icons | Lucide React only |
| Error handling | try/catch in every controller |
| Deprecated models | Use CRMClient, not Lead or Client |
| TypeScript | Never — project is JavaScript only |
