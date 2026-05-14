# FRONTEND_GUIDE.md — JJ Studio ERP Frontend

> Complete guide to the React frontend: structure, components, hooks, API integration, styling, and best practices.

---

## 1. TECH STACK

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.5 | UI framework |
| React Router DOM | 7.14.2 | Client-side routing |
| Vite | 8.0.10 | Dev server + build tool |
| Tailwind CSS | 4.2.4 | Utility-first styling |
| Axios | 1.15.2 | HTTP client |
| Lucide React | 1.9.0 | Icon library |

---

## 2. FOLDER STRUCTURE

```
frontend/src/
├── main.jsx                      # React entry point
├── App.jsx                       # Router + layout structure
│
├── modules/                      # Feature modules (business domain)
│   ├── auth/                     # Authentication
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   └── RoleSelector.jsx
│   │   ├── hooks/
│   │   │   └── useLogin.js
│   │   └── services/
│   │       └── authService.js
│   │
│   ├── dashboard/                # Dashboard + KPIs
│   │   ├── pages/DashboardPage.jsx
│   │   ├── components/
│   │   │   ├── SalesPipeline.jsx
│   │   │   ├── FollowUpsPanel.jsx
│   │   │   └── StatCard.jsx
│   │   └── hooks/useDashboardData.js
│   │
│   ├── crm/                      # CRM forms + context
│   │   ├── context/CRMContext.jsx
│   │   ├── pages/
│   │   │   ├── EnquiryFormPage.jsx
│   │   │   └── ClientInfoFormPage.jsx
│   │   ├── hooks/
│   │   │   ├── useClient.js
│   │   │   └── useLead.js
│   │   └── index.js
│   │
│   ├── leads/                    # Lead pipeline views
│   │   ├── pages/
│   │   │   ├── NewLeadsPage.jsx
│   │   │   ├── LeadDetailsPage.jsx
│   │   │   ├── MeetingsPage.jsx
│   │   │   ├── FollowUpsPage.jsx
│   │   │   ├── KITPage.jsx
│   │   │   ├── ConvertedPage.jsx
│   │   │   └── LostLeadsPage.jsx
│   │   ├── components/
│   │   │   ├── LeadCard.jsx
│   │   │   ├── LeadListView.jsx
│   │   │   └── AddLeadModal.jsx
│   │   ├── hooks/
│   │   │   ├── useLeadDetails.js
│   │   │   └── useLeadList.js
│   │   └── index.js
│   │
│   ├── proposal/                 # Proposal system
│   │   ├── pages/               # 8+ page components
│   │   ├── dashboard/
│   │   ├── approval/
│   │   ├── approved/
│   │   ├── sent/
│   │   ├── review/
│   │   ├── components/
│   │   └── index.js
│   │
│   ├── profile/
│   │   └── pages/ProfilePage.jsx
│   │
│   └── settings/
│       ├── pages/SettingsPage.jsx
│       ├── components/CreateUserForm.jsx
│       └── hooks/useCreateUser.js
│
└── shared/                       # Cross-module reusables
    ├── components/               # UI component library
    ├── hooks/                    # Generic hooks
    ├── layouts/                  # App shell components
    ├── services/                 # API clients + service layer
    ├── notifications/            # Toast system
    ├── filters/                  # Filter/sort components
    ├── constants/                # Navigation config
    ├── styles/                   # CSS variables
    └── utils/                    # Utility functions
```

---

## 3. ROUTING ARCHITECTURE

### Route File: `src/App.jsx`

The router uses React Router v7 with **nested layouts**. The `AppLayout` is the authenticated shell that renders once; all protected routes render as its children via `<Outlet />`.

```jsx
// Pattern: Layout wraps routes, children render in Outlet
<Route element={<AppLayout />}>
  <Route path="/dashboard" element={<DashboardPage />} />
  
  // Context-scoped groups
  <Route element={<CRMProvider><Outlet /></CRMProvider>}>
    <Route path="/crm/new-leads" element={<NewLeadsPage />} />
    // ... more CRM routes
  </Route>
</Route>
```

### Route Map

| Path | Component | Auth | Context |
|------|-----------|------|---------|
| `/login` | LoginPage | No | None |
| `/public/client-info` | ClientInfoFormPage | No | CRMProvider |
| `/dashboard` | DashboardPage | Yes | None |
| `/crm/forms/enquiry` | EnquiryFormPage | Yes | CRMProvider |
| `/crm/forms/client-info` | ClientInfoFormPage | Yes | CRMProvider |
| `/crm/leads/:id` | LeadDetailsPage | Yes | CRMProvider |
| `/crm/new-leads` | NewLeadsPage | Yes | CRMProvider |
| `/crm/meetings` | MeetingsPage | Yes | CRMProvider |
| `/crm/follow-ups` | FollowUpsPage | Yes | CRMProvider |
| `/crm/qualified` | KITPage | Yes | CRMProvider |
| `/crm/converted` | ConvertedPage | Yes | CRMProvider |
| `/crm/lost-leads` | LostLeadsPage | Yes | CRMProvider |
| `/proposal` | ProposalDashboard | Yes | CRMProvider |
| `/proposal/list` | ProposalListPage | Yes | CRMProvider |
| `/proposal/create` | CreateProposalPage | Yes | CRMProvider |
| `/proposal/templates` | ProposalTemplatesPage | Yes | CRMProvider |
| `/proposal/templates/create` | TemplateEditorPage | Yes | CRMProvider |
| `/proposal/templates/edit/:id` | TemplateEditorPage | Yes | CRMProvider |
| `/proposal/clients` | ProposalClientsPage | Yes | CRMProvider |
| `/proposal/approval` | ProposalApprovalPage | Yes | CRMProvider |
| `/proposal/sent` | SentProposalDashboard | Yes | CRMProvider |
| `/proposal/sent/:id` | SentProposalReviewPage | Yes | CRMProvider |
| `/proposal/approved` | ApprovedDashboard | Yes | CRMProvider |
| `/proposal/review/:id` | ProposalReviewPage | Yes | CRMProvider |
| `/profile` | ProfilePage | Yes | None |
| `/settings` | SettingsPage | Yes | None |
| `*` | → `/dashboard` | — | — |

**Note:** "Auth" here means guarded by `AppLayout` — currently `AppLayout` does NOT redirect to login if no token. This should be added.

---

## 4. LAYOUT SYSTEM

### AppLayout (`shared/layouts/AppLayout/AppLayout.jsx`)
Persistent shell for all authenticated pages:
```
┌────────────────────────────────────────┐
│              Navbar (top)              │
├──────────┬─────────────────────────────┤
│          │                             │
│ Sidebar  │      <Outlet />             │
│  (left)  │    (page content)           │
│          │                             │
└──────────┴─────────────────────────────┘
```

### Sidebar (`shared/layouts/Sidebar/Sidebar.jsx`)
- Navigation menu driven by `shared/constants/navigation.js`
- Uses `SidebarGroup` and `SidebarItem` components
- Active route highlighting via `useLocation()`

### Navbar (`shared/layouts/Navbar/Navbar.jsx`)
- Page title / breadcrumb display
- Notification icon (placeholder)
- `ProfileDropdown` → shows user name, role, logout button

### PublicLayout (`shared/layouts/PublicLayout/PublicLayout.jsx`)
- Minimal centered layout
- No navigation — for client-facing forms like the client info form

---

## 5. STATE MANAGEMENT

### CRMContext (`modules/crm/context/CRMContext.jsx`)

```jsx
// Provider usage in App.jsx
<CRMProvider><Outlet /></CRMProvider>

// Access in any CRM/Proposal component
const { activeLead, setActiveLead, clearActiveLead } = useCRM();
```

**State shape:**
```js
{
  activeLead: CRMClient | null,      // Persisted in localStorage
  crmState: {
    lastStep: string,
    drafts: {}
  }
}
```

**Key methods:**
- `setActiveLead(lead)` — Set current working lead (persists to localStorage)
- `clearActiveLead()` — Clear active lead on form completion
- `useLeadFlow(leadId)` — Hook for lifecycle automation

### ToastContext (`shared/notifications/ToastProvider.jsx`)

```jsx
// Access anywhere
const { success, error, info, warning } = useToast();

// Usage
success('Lead created successfully');
error('Failed to save — please try again');
```

### localStorage Keys
| Key | Value | Purpose |
|-----|-------|---------|
| `auth_token` | JWT string | Authentication token |
| `user` | JSON string | User object `{ id, name, email, role }` |
| `activeLead` | JSON string | Current CRM lead being worked |

---

## 6. API INTEGRATION

### The API Stack

```
Component/Hook
  → crmService.methodName()     [for CRM data]
  → authService.methodName()    [for auth]
  → apiClient.verb(path, data)  [for direct calls]
  → Axios instance
  → Backend API
```

### apiClient.js (Base Axios Instance)

```js
// Location: src/shared/services/apiClient.js

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

// Auto-attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-unwrap response + normalize errors
apiClient.interceptors.response.use(
  (response) => response.data,             // Returns data directly
  (error) => Promise.reject(                // Rejects with string message
    error?.response?.data?.message || error?.message || 'Something went wrong'
  )
);
```

### crmService.js (CRM API Layer)

All CRM-related API calls must go through `crmService`. Never call `apiClient` directly for CRM resources.

```js
import { crmService } from '@/shared/services/crmService';

// In hooks:
const leads = await crmService.getLeads({ status: 'new', lifecycleStage: 'enquiry' });
const lead = await crmService.getLeadById(id);
await crmService.updateLeadStatus(id, { status: 'contacted', lifecycleStage: 'meeting_scheduled' });
await crmService.appendTimelineEvent(id, { type: 'note', title: 'Called client', description: '...' });
```

### Pattern: Custom Hook for API Calls

Every page that needs API data has a corresponding custom hook:

```js
// Example: useLeadList.js
export function useLeadList(filters = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { success, error: showError } = useToast();

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await crmService.getLeads(filters);
      setLeads(data.clients || data.leads || []);
    } catch (err) {
      setError(err);
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [/* deps */]);
  
  return { leads, loading, error, refetch: fetchLeads };
}
```

---

## 7. COMPONENT LIBRARY

### Location: `src/shared/components/`

All components live in their own subfolder. Import path: `../../../shared/components/Button/Button`.

### Atomic Components

#### Button
```jsx
<Button onClick={fn} disabled={loading}>
  Save Lead
</Button>
```
Props: `onClick`, `disabled`, `type`, `variant`, `className`

#### Input
```jsx
<Input
  value={form.name}
  onChange={(e) => setForm({...form, name: e.target.value})}
  placeholder="Client name"
  icon={<User size={16} />}
/>
```

#### Select
```jsx
<Select
  value={form.source}
  onChange={(val) => setForm({...form, source: val})}
  options={[
    { label: 'Walk-in', value: 'walk_in' },
    { label: 'Instagram', value: 'instagram' },
  ]}
/>
```

#### Badge / StatusBadge
```jsx
<StatusBadge status="converted" />   // Auto-colors based on status value
<Badge text="High Priority" color="red" />
```

#### Modal
```jsx
<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Note">
  <p>Modal content here</p>
</Modal>
```

#### ConfirmationModal
```jsx
<ConfirmationModal
  isOpen={showConfirm}
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
  message="Are you sure you want to delete this lead?"
/>
```

#### DashboardCard
```jsx
<DashboardCard
  title="Total Leads"
  value={stats.totalLeads}
  icon={<Users />}
  trend="+12%"
/>
```

### Filter Components

```jsx
// Complete filter bar for a list page
<AdvancedFilter
  config={FilterConfig.leads}
  onFilterChange={setFilters}
/>

<DateRangeFilter
  onChange={({ from, to }) => setDateRange({ from, to })}
/>

<SortSelector
  options={['newest', 'oldest', 'priority']}
  onChange={setSortBy}
/>
```

---

## 8. FORM HANDLING PATTERN

All forms follow this pattern:

1. Extract form state + submit logic into a custom hook
2. Component renders form UI, binds to hook state
3. Hook calls service, handles errors, shows toasts

```jsx
// 1. Hook (useEnquiry.js)
export function useEnquiry() {
  const [form, setForm] = useState({ name: '', phone: '', source: 'walk_in' });
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await crmService.createLead(form);
      success('Enquiry created!');
      setForm({ name: '', phone: '', source: 'walk_in' }); // reset
    } catch (err) {
      error(err);
    } finally {
      setLoading(false);
    }
  };

  return { form, setForm, loading, handleSubmit };
}

// 2. Component (EnquiryFormPage.jsx)
export default function EnquiryFormPage() {
  const { form, setForm, loading, handleSubmit } = useEnquiry();
  return (
    <form onSubmit={handleSubmit}>
      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
      <Button type="submit" disabled={loading}>Submit</Button>
    </form>
  );
}
```

---

## 9. STYLING SYSTEM

### Tailwind CSS v4

All styling uses Tailwind utility classes directly in JSX. No CSS modules.

```jsx
// Correct
<div className="flex items-center gap-4 p-6 bg-white rounded-xl shadow-sm border border-gray-100">

// Wrong — don't add CSS files for this
<div className="my-custom-card">
```

### CSS Variables (Theme)

Located in `src/shared/styles/theme.css`. Defines brand colors as CSS variables:

```css
:root {
  --color-primary: ...;
  --color-secondary: ...;
  /* etc. */
}
```

Access in Tailwind via `bg-[var(--color-primary)]` or extend `tailwind.config.js`.

### Icon System

Use Lucide React exclusively:

```jsx
import { Users, ChevronRight, Plus, Trash2 } from 'lucide-react';

<Users size={20} className="text-gray-500" />
```

---

## 10. NOTIFICATION SYSTEM

### Usage

```jsx
import { useToast } from '../../shared/notifications/ToastProvider';

// In any component or hook:
const { success, error, info, warning } = useToast();

success('Lead saved successfully');
error('Failed to connect to server');
info('3 new leads assigned to you');
warning('This will permanently delete the client record');
```

### Custom Duration

```jsx
success('Operation complete', 5000);  // 5 second display
```

---

## 11. NAVIGATION CONFIGURATION

Navigation items are defined in `src/shared/constants/navigation.js` and rendered by `Sidebar.jsx`.

```js
// Structure
[
  {
    group: 'CRM',
    icon: Users,
    items: [
      { label: 'New Leads', path: '/crm/new-leads', icon: UserPlus },
      { label: 'Meetings', path: '/crm/meetings', icon: Calendar },
      // ...
    ]
  },
  {
    group: 'Proposals',
    items: [ /* ... */ ]
  }
]
```

To add a new nav item: update `navigation.js` and add the corresponding route in `App.jsx`.

---

## 12. ADDING A NEW MODULE (Frontend Checklist)

1. Create `src/modules/<name>/` folder
2. Create `pages/`, `components/`, `hooks/`, `index.js`
3. Create API methods in `src/shared/services/crmService.js` (or new service file)
4. Add custom hook for data fetching
5. Add route(s) in `App.jsx`
6. Add navigation item in `shared/constants/navigation.js`
7. Wrap in appropriate context provider if needed

---

## 13. BEST PRACTICES

### Always
- Extract form logic into custom hooks (`useFormName.js`)
- Use `useToast()` for all user-facing success/error feedback
- Call APIs only through service files, not directly via `apiClient`
- Use `lucide-react` for all icons
- Apply Tailwind classes only (no custom CSS unless theme variable)
- Read token from `localStorage.getItem('auth_token')` via apiClient interceptor (don't do it manually)

### Never
- Call `axios` directly — always use `apiClient`
- Duplicate API endpoints across service files
- Use class components
- Import from `react-redux`, `zustand`, or any store library
- Store sensitive data beyond token + user object in localStorage
- Use inline styles — use Tailwind classes

### Performance
- Lazy-load large page components with `React.lazy()` if pages grow heavy
- Memoize expensive computed values with `useMemo`
- Use `useCallback` for handlers passed to child components that memo-compare props
