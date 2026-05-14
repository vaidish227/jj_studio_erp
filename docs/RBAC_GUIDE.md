# RBAC_GUIDE.md — JJ Studio ERP Role-Based Access Control

> Complete guide to the RBAC system: roles, permissions, backend guards, frontend gates, and admin management UI.

---

## 1. ARCHITECTURE OVERVIEW

```
Login Request
  ↓
auth.service.js::loginUser()
  ↓ Loads Role document from DB
  ↓ Merges role.permissions + user.customPermissions
  ↓
Response: { token, user, permissions: ['crm.read', 'crm.create', ...] }
  ↓
Frontend stores permissions in AuthContext + localStorage.permissions
  ↓
Components / Routes / Sidebar filter themselves using usePermission() / PermissionGate
```

---

## 2. PERMISSION FORMAT

All permissions are strings in the format: **`module.action`**

| Module | Available Actions |
|--------|------------------|
| `dashboard` | `read` |
| `crm` | `read`, `create`, `update`, `delete` |
| `kit` | `read`, `create`, `update`, `delete` |
| `proposal` | `read`, `create`, `update`, `delete`, `approve` |
| `clients` | `read`, `create`, `update`, `delete` |
| `projects` | `read`, `create`, `update`, `delete` |
| `tasks` | `read`, `create`, `update`, `delete` |
| `reports` | `read`, `export` |
| `finance` | `read`, `create`, `update` |
| `settings` | `read`, `manage` |
| `users` | `read`, `create`, `update`, `delete`, `manage` |
| `vendor` | `read`, `update` |
| `client_portal` | `read` |

**Special wildcard:** `*` — grants all permissions. Only the `admin` role has this.

---

## 3. SYSTEM ROLES

| Role | Enum Value | Default Access |
|------|-----------|---------------|
| Administrator | `admin` | `*` (everything) |
| Managing Director | `md` | Read + approve + reports + export |
| Manager | `manager` | CRM + Proposal + Approve + Projects + Tasks |
| Sales Executive | `sales` | CRM + KIT + Proposal (no approve) |
| Accounts | `accounts` | Proposal read + Finance + Reports |
| Designer | `designer` | Projects + Tasks |
| Supervisor | `supervisor` | CRM read + Projects + Tasks |
| Vendor | `vendor` | Vendor portal only |
| Client | `client` | Client portal only |

Permissions per role are **fully editable by admin** via the Settings → Roles & Permissions UI.

---

## 4. DATABASE SCHEMA

### Role Collection (`roles`)
```js
{
  name: String,           // e.g. "sales" — unique, lowercase, immutable for system roles
  displayName: String,    // e.g. "Sales Executive"
  description: String,
  permissions: [String],  // e.g. ["crm.read", "crm.create", "proposal.read"]
  isSystem: Boolean,      // System roles cannot be deleted
  color: String,          // Hex color for UI badge
  createdAt: Date,
  updatedAt: Date
}
```

### User Model Updates
```js
// Added to existing User schema:
role: {
  type: String,
  enum: ["admin","md","manager","sales","accounts","designer","supervisor","vendor","client"],
  default: "sales"
},
customPermissions: {
  type: [String],
  default: []             // Per-user extra permissions on top of role permissions
}
```

---

## 5. BACKEND IMPLEMENTATION

### Middleware Location
`backend/src/middleware/auth.middleware.js`

### Exported Functions

```js
const { verifyToken, requirePermission, requireRole, hasPermission } = require('../middleware/auth.middleware');
```

#### `verifyToken`
Validates JWT from `Authorization: Bearer <token>` header. Sets `req.user = { id, email, role }`.

```js
// Apply to a route
router.get('/get', verifyToken, controller);
```

#### `requirePermission(permission)`
Loads the user's role permissions from DB + resolves effective permissions. Returns 403 if permission is missing.

```js
// Protect a route with a specific permission
router.post('/create', verifyToken, requirePermission('crm.create'), createController);
router.delete('/delete/:id', verifyToken, requirePermission('crm.delete'), deleteController);
```

#### `requireRole(...roles)`
Quick role check without full permission resolution. Use when you just need to check role membership.

```js
// Admin or MD only
router.get('/reports', verifyToken, requireRole('admin', 'md'), getReports);
```

### Global Auth Setup (app.js)
```js
// Public routes (no auth)
app.use('/api/auth', authRoutes);

// All routes below this require a valid JWT
app.use(verifyToken);

app.use('/api/clients', clientRoutes);
// ... all other routes
```

### Adding Permission Checks to a Route File
```js
const { requirePermission } = require('../../../middleware/auth.middleware');

router.get('/get', requirePermission('crm.read'), getClients);
router.post('/create', requirePermission('crm.create'), createClient);
router.put('/update/:id', requirePermission('crm.update'), updateClient);
router.delete('/delete/:id', requirePermission('crm.delete'), deleteClient);
```

### Checking Permission in Controller Code
```js
const { hasPermission } = require('../../../middleware/auth.middleware');

// Inside a controller:
if (!hasPermission(req.permissions, 'proposal.approve')) {
  return res.status(403).json({ message: 'Only managers can approve proposals' });
}
```

---

## 6. FRONTEND IMPLEMENTATION

### AuthContext
`frontend/src/shared/context/AuthContext.jsx`

Provides:
- `user` — `{ id, name, email, role }`
- `permissions` — `['crm.read', 'crm.create', ...]`
- `isAuthenticated` — Boolean
- `isAdmin` — Boolean (shortcut for `role === 'admin'`)
- `isLoading` — Boolean
- `login(userData, token, permissions)` — called after successful login
- `logout()` — clears all auth state
- `hasPermission(permission)` — check single permission
- `hasAnyPermission([...])` — check if has at least one
- `hasAllPermissions([...])` — check if has all

### useAuth Hook
```jsx
import { useAuth } from '../../../shared/context/AuthContext';

const { user, permissions, isAdmin, hasPermission, logout } = useAuth();
```

### usePermission Hook
`frontend/src/shared/hooks/usePermission.js`

```jsx
import usePermission from '../../../shared/hooks/usePermission';

// Single permission
const canCreate = usePermission('crm.create');

// Any of multiple (OR)
const canEdit = usePermission(['crm.update', 'proposal.update'], 'any');

// All of multiple (AND)
const canFullManage = usePermission(['users.create', 'users.delete'], 'all');
```

### PermissionGate Component
`frontend/src/shared/components/PermissionGate/PermissionGate.jsx`

```jsx
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';

// Hide completely if no permission
<PermissionGate permission="crm.create">
  <Button>Add Lead</Button>
</PermissionGate>

// Show fallback
<PermissionGate permission="crm.delete" fallback={<span className="text-gray-400">No access</span>}>
  <Button variant="danger">Delete</Button>
</PermissionGate>

// Render as disabled (greyed out, non-interactive)
<PermissionGate permission="proposal.approve" disabled>
  <Button>Approve Proposal</Button>
</PermissionGate>

// Multiple permissions (any mode)
<PermissionGate permission={['settings.manage', 'users.manage']} mode="any">
  <AdminPanel />
</PermissionGate>
```

### Sidebar Filtering
The sidebar in `Sidebar.jsx` automatically filters `NAV_ITEMS` based on `hasPermission()`.

Each nav item in `navigation.js` has an optional `permission` key:
```js
{ id: 'crm', permission: 'crm.read', ... }
{ id: 'proposal-approval', permission: 'proposal.approve', ... }
```

Items without a `permission` key are always visible.

### Route Protection
`AppLayout.jsx` redirects to `/login` if the user is not authenticated. Access to individual page routes is primarily controlled by the sidebar (hidden nav = no known entry point).

For strict route-level guards, wrap the route element:
```jsx
// In App.jsx, for a strict guard:
<Route
  path="/settings/roles"
  element={
    <PermissionGate permission="users.manage" fallback={<Navigate to="/dashboard" replace />}>
      <RolesPermissionsPage />
    </PermissionGate>
  }
/>
```

---

## 7. PERMISSIONS MANAGEMENT UI

**Location:** Settings → Roles & Permissions (visible to admin and md only)

**Features:**
1. **Permission Matrix** — table of all modules × all actions with toggle checkboxes per role
2. **User Assignments** — change the role of any user via dropdown
3. **Save/Discard** — changes are staged in `draftPermissions` state, saved only on explicit Save

**Admin flow to restrict Designer to Projects + Tasks only:**
1. Settings → Roles & Permissions
2. Select "Designer" role
3. Uncheck all non-project/task permissions
4. Click Save Changes
5. The next time a Designer logs in, their permissions sidebar will only show Projects + Tasks

---

## 8. SEED ROLES

Run once to populate default role permissions into the database:
```bash
node backend/src/scripts/seedRoles.js
```

Re-running is safe — it upserts (no duplicates).

---

## 9. ADDING PERMISSIONS FOR A NEW MODULE

When you add a new backend module (e.g., `inventory`):

1. **Backend** — Add permission strings to `Role.model.js`:
   ```js
   "inventory.read", "inventory.create", "inventory.update", "inventory.delete"
   ```

2. **Backend** — Apply to routes:
   ```js
   router.get('/get', requirePermission('inventory.read'), getInventory);
   ```

3. **Frontend** — Add to `permissions.js`:
   ```js
   INVENTORY_READ:   'inventory.read',
   INVENTORY_CREATE: 'inventory.create',
   ```

4. **Frontend** — Add to `PERMISSION_MODULES` in `permissions.js`:
   ```js
   { key: 'inventory', label: 'Inventory', actions: ['read', 'create', 'update', 'delete'] }
   ```

5. **Frontend** — Add to `navigation.js`:
   ```js
   { id: 'inventory', label: 'Inventory', permission: 'inventory.read', ... }
   ```

6. **Update seed script** — Add inventory permissions to appropriate roles in `seedRoles.js` and re-run.

---

## 10. SECURITY CONSIDERATIONS

| Concern | Mitigation |
|---------|-----------|
| API without auth | `verifyToken` applied globally in `app.js` after auth routes |
| Role escalation | `updateUserRole` restricted to `admin` only; system roles cannot be deleted |
| Token expiry | JWT expires in 1 day; response interceptor handles 401 errors |
| localStorage XSS | Consider migrating to httpOnly cookies for production |
| Stale permissions | Permissions loaded fresh on every login; log out + back in to apply role changes |
