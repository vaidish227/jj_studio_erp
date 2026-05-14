# BACKEND_GUIDE.md — JJ Studio ERP Backend

> Complete guide to the Node.js/Express/MongoDB backend: modules, APIs, services, middleware, validation, auth, and error handling.

---

## 1. TECH STACK

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20 | Runtime |
| Express | 5.2.1 | Web framework |
| MongoDB | — | Database |
| Mongoose | 9.5.0 | MongoDB ODM |
| jsonwebtoken | 9.0.3 | JWT auth tokens |
| bcrypt | 6.0.0 | Password hashing |
| Joi | 18.1.2 | Request validation |
| Nodemailer | 8.0.6 | Email sending |
| dotenv | 17.4.2 | Environment config |
| cors | 2.8.6 | CORS middleware |

---

## 2. ENTRY POINT & APP INITIALIZATION

### `backend/index.js`
```js
require('dotenv').config({ path: '../backend/.env' });
const connectDb = require('./src/config/db');
const app = require('./src/app');

connectDb();
app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
```

### `backend/src/app.js`
Configures Express with middleware and all route registrations:
```js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// 14 route groups registered here
app.use('/api/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/clients', require('./modules/crm/routes/Client.route'));
// ... etc.

module.exports = app;
```

### `backend/src/config/db.js`
```js
const mongoose = require('mongoose');

async function connectDb() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    family: 4
  });
  console.log('MongoDB connected');
}
```

---

## 3. MODULE STRUCTURE

Every backend module follows this internal layout:

```
modules/<name>/
├── controllers/    → HTTP request handlers
├── models/         → Mongoose schemas
├── routes/         → Express Router
├── service/        → Business logic layer (optional)
├── validator/      → Joi schemas
└── utils/          → Module-specific helpers
```

### Module Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Model file | `ModelName.model.js` | `CRMClient.model.js` |
| Controller file | `ModelName.controller.js` | `CRMClient.controller.js` |
| Route file | `ModelName.route.js` | `Client.route.js` |
| Service file | `name.service.js` | `auth.service.js` |
| Validator file | `ModelName.validator.js` | `Lead.validator.js` |

---

## 4. AUTHENTICATION MODULE

### Location
```
modules/auth/
├── controllers/auth.controller.js
├── models/user.model.js
├── routes/auth.routes.js
├── service/auth.service.js
└── validator/auth.validator.js
```

### Routes
```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/change-password
```

### Controller Pattern
```js
// auth.controller.js
const signup = async (req, res) => {
  try {
    // 1. Validate
    const { error } = signupSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    // 2. Check duplicate
    const existing = await User.findOne({ email: req.body.email });
    if (existing) return res.status(409).json({ message: 'Email already exists' });

    // 3. Hash + create
    const hashed = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({ ...req.body, password: hashed });

    // 4. Respond
    res.status(201).json({
      message: 'User created',
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

### Service Pattern
```js
// auth.service.js
const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');
  
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('Invalid credentials');
  
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secretkey',
    { expiresIn: '1d' }
  );
  
  return { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } };
};
```

### Validation Pattern (Joi)
```js
// auth.validator.js
const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const signupSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().optional(),
  role: Joi.string().valid('admin','sales','manager','accounts','designer','supervisor').optional()
});
```

---

## 5. CRM MODULE

### Location
```
modules/crm/
├── controllers/
│   ├── CRMClient.controller.js   ← PRIMARY
│   ├── Client.controller.js      ← Deprecated
│   ├── Lead.controller.js        ← Legacy
│   ├── Metting.controller.js     ← Meetings
│   ├── FollowUp.controller.js    ← Follow-ups
│   └── Proposal.controller.js    ← CRM proposals
├── models/
│   ├── CRMClient.model.js        ← PRIMARY unified model
│   ├── Client.model.js           ← Deprecated
│   ├── Lead.model.js             ← Deprecated
│   ├── Metting.model.js
│   └── FollowUp.model.js
├── routes/
│   ├── Client.route.js           ← Points to CRMClient controller
│   ├── Metting.routes.js
│   └── FollowUp.route.js
├── utils/
│   ├── sendEmail.js              ← Nodemailer
│   └── Template/                 ← Email HTML templates
└── validator/
    └── Lead.validator.js
```

### CRMClient Controller Operations
```js
createClientEnquiry(req, res)     // POST /api/clients/create
getClients(req, res)              // GET  /api/clients/get
getClientById(req, res)           // GET  /api/clients/get/:id
updateClientDetails(req, res)     // PUT  /api/clients/update/:id
updateClientStatus(req, res)      // PATCH /api/clients/status/:id
deleteClient(req, res)            // DELETE /api/clients/delete/:id
appendTimelineEvent(req, res)     // POST /api/clients/timeline/:id
getStats(req, res)                // GET  /api/clients/totalclient
```

### Query Filters (GET /api/clients/get)
```
?status=new|contacted|meeting_done|proposal_sent|converted|lost
?lifecycleStage=enquiry|meeting_scheduled|kit|...
?projectType=Residential|Commercial
?assignedTo=<userId>
```

### Email Utility
```js
// utils/sendEmail.js
const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    }
  });
  await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
};
```

---

## 6. PROPOSAL MODULE

### Location
```
modules/proposal/
├── controllers/
│   ├── Boq.controller.js
│   ├── Boq_item.controller.js
│   ├── Template.controller.js
│   ├── Approval.controller.js
│   ├── Payment.controller.js
│   ├── ProposalVersion.controller.js
│   ├── Activity.controller.js
│   └── Esign.controller.js
├── models/
│   ├── Boq.model.js
│   ├── Boq_item.model.js
│   ├── Template.model.js
│   ├── Approval.model.js
│   ├── Payment.model.js
│   ├── Proposal_version.model.js
│   ├── Activity.model.js
│   └── ESign.model.js
└── routes/ (8 route files)
```

### Key API Routes
```
POST   /api/Template/create        → Create template
GET    /api/Template/get           → List templates
GET    /api/Template/getbyid/:id   → Get template
PUT    /api/Template/update/:id    → Update template
DELETE /api/Template/delete/:id    → Delete template

POST   /api/boq/createBoq         → Create BOQ for proposal
PUT    /api/boq/updateBoq/:id     → Update BOQ + recalculate total

POST   /api/Approve               → Submit or respond to approval
POST   /api/payment/create        → Record payment
POST   /api/esign/create          → Record e-signature
```

---

## 7. MIDDLEWARE

### Current Global Middleware (app.js)
```js
app.use(cors());          // Allow all origins — should be restricted in production
app.use(express.json());  // Parse JSON body
```

### Missing (Should Be Added)
```js
// JWT verification middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Role guard middleware
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// Usage on routes:
router.get('/get', verifyToken, requireRole('admin', 'manager'), getClients);
```

---

## 8. VALIDATION PATTERN

Use Joi in every controller. Validate `req.body` before any DB operation:

```js
const Joi = require('joi');

// Define schema
const createLeadSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().required(),
  email: Joi.string().email().optional(),
  source: Joi.string().valid('walk_in','referral','website','instagram','whatsapp','other').default('walk_in'),
  projectType: Joi.string().valid('Residential','Commercial').optional(),
  budget: Joi.number().optional(),
  area: Joi.number().optional(),
});

// Use in controller
const createClientEnquiry = async (req, res) => {
  const { error, value } = createLeadSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  
  // Proceed with validated `value`...
};
```

---

## 9. ERROR HANDLING PATTERN

All controllers use try/catch. Standard error response:

```js
const doSomething = async (req, res) => {
  try {
    // ... business logic
    res.status(200).json({ message: 'Success', data: result });
  } catch (err) {
    console.error('[doSomething]', err);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
};
```

**Common status codes:**
| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET/PUT/PATCH |
| 201 | Created | Successful POST (new resource) |
| 400 | Bad Request | Validation failure |
| 401 | Unauthorized | Missing/invalid JWT |
| 403 | Forbidden | Valid JWT, wrong role |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate email/phone |
| 500 | Server Error | Unexpected exception |

---

## 10. DATABASE ACCESS PATTERNS

### Create
```js
const client = await CRMClient.create({
  name: value.name,
  phone: value.phone,
  source: value.source,
});
```

### Read with Filters
```js
const query = {};
if (req.query.status) query.status = req.query.status;
if (req.query.lifecycleStage) query.lifecycleStage = req.query.lifecycleStage;

const clients = await CRMClient
  .find(query)
  .populate('assignedTo', 'name email role')
  .sort({ createdAt: -1 })
  .limit(50);
```

### Update
```js
const updated = await CRMClient.findByIdAndUpdate(
  id,
  { $set: { status: newStatus, lifecycleStage: newStage } },
  { new: true, runValidators: true }
);
if (!updated) return res.status(404).json({ message: 'Client not found' });
```

### Append to Array (Timeline)
```js
await CRMClient.findByIdAndUpdate(id, {
  $push: {
    interactionHistory: {
      type: 'note',
      title: req.body.title,
      description: req.body.description,
      createdAt: new Date()
    }
  },
  $set: { lastInteractionAt: new Date() }
});
```

### Populate References
```js
const proposal = await Proposal
  .findById(id)
  .populate('leadId', 'name phone email trackingId')
  .populate('createdBy', 'name role')
  .populate('approved_by', 'name');
```

---

## 11. SEED SCRIPTS

Located in `backend/src/scripts/` and root-level `backend/`:

| Script | Purpose |
|--------|---------|
| `generateClients.js` | Generate mock CRMClient records |
| `generateLeads.js` | Generate mock lead records (legacy) |
| `seedTemplates.js` | Seed initial proposal templates |
| `migrateToUnifiedClient.js` | One-time migration script to consolidate Lead/Client → CRMClient |

Run with: `node backend/seedTemplates.js`

---

## 12. ADDING A NEW MODULE (Backend Checklist)

1. Create `backend/src/modules/<name>/`
2. Create subfolders: `controllers/`, `models/`, `routes/`, `validator/`
3. Create Mongoose schema in `models/`
4. Create controller with try/catch pattern
5. Create Joi validator
6. Create route file linking controller methods
7. Register route in `backend/src/app.js`:
   ```js
   const newRoutes = require('./src/modules/<name>/routes/<Name>.route');
   app.use('/api/<name>', newRoutes);
   ```

---

## 13. ENVIRONMENT VARIABLES

```env
MONGO_URI=mongodb://localhost:27017/jj_studio
PORT=5000
JWT_SECRET=your-secret-key-here          # REQUIRED in production
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password       # Use Gmail App Password, not account password
```

---

## 14. BEST PRACTICES

### Always
- Use `async/await` — no callbacks or `.then()` chains
- Wrap every controller in `try/catch`
- Validate all request bodies with Joi before DB operations
- Use `{ new: true }` with `findByIdAndUpdate`
- Use `$set` for partial updates (don't replace whole document)
- Use `$push` for appending to arrays (interactionHistory, communicationLogs)
- Add `timestamps: true` to every new Mongoose schema
- Use `.populate()` for cross-collection references
- Log errors: `console.error('[functionName]', err)`
- Return early on validation failure: `if (error) return res.status(400)...`

### Never
- Bypass Joi validation
- Store plain-text passwords (always bcrypt)
- Expose full error objects to clients
- Use `req.body` directly before validation (use the `value` from Joi)
- Delete timeline entries (interactionHistory is append-only)
- Remove the deprecated Lead/Client models without running migration
- Use `findOneAndDelete` without checking if result exists first

### Security
- Restrict CORS origin to known frontend domain in production
- Never fall back to hardcoded JWT secret in production
- Use Gmail App Passwords (not actual Gmail password)
- Add `verifyToken` middleware to all non-public routes before go-live
