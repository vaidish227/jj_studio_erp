# DATABASE_GUIDE.md — JJ Studio ERP Database

> Complete guide to the MongoDB database: collections, schemas, relationships, business constraints, and query patterns.

---

## 1. DATABASE OVERVIEW

- **DBMS:** MongoDB (NoSQL Document Store)
- **ODM:** Mongoose 9.5.0
- **Database Name:** `jj_studio`
- **Connection:** Via `MONGO_URI` environment variable
- **Local URI:** `mongodb://localhost:27017/jj_studio`

---

## 2. COLLECTIONS OVERVIEW

### Active Collections
| Collection Name | Mongoose Model | Primary Module | Status |
|----------------|---------------|----------------|--------|
| `crmclients` | `CRMClient` | CRM | Active |
| `users` | `User` | Auth | Active |
| `proposals` | `Proposal` | CRM/Proposal | Active |
| `boqs` | `Boq` | Proposal | Active |
| `boq_items` | `Boq_item` | Proposal | Active |
| `templates` | `Template` | Proposal | Active |
| `approvals` | `Approval` | Proposal | Active |
| `payments` | `Payment` | Proposal | Active |
| `esigns` | `ESign` | Proposal | Active |
| `mettings` | `Metting` | CRM | Active |
| `followups` | `FollowUp` | CRM | Active |
| `activities` | `Activity` | Proposal | Active |
| `proposalversions` | `ProposalVersion` | Proposal | Active |

### Stub Collections (Models defined, no controllers)
| Collection | Model | Module |
|-----------|-------|--------|
| `projects` | `Project` | pms |
| `tasks` | `Task` | pms |
| `milestones` | `Milestone` | pms |
| `sitevisits` | `SiteVisit` | pms |
| `employees` | `Employee` | hrm |
| `inventories` | `Inventory` | inventory |

---

## 3. ENTITY SCHEMAS (DETAILED)

---

### 3.1 User

**Collection:** `users`
**Model file:** `modules/auth/models/user.model.js`

```
┌─────────────────────────────────────────────┐
│                    User                      │
├─────────────────────────────────────────────┤
│ _id          ObjectId (auto)                │
│ name         String (required, trim)         │
│ email        String (required, unique, lower)│
│ password     String (required, min:6, hashed)│
│ phone        String (optional)               │
│ role         Enum (default: "sales")         │
│              admin | sales | manager         │
│              accounts | designer | supervisor│
│ createdAt    Date (auto)                     │
│ updatedAt    Date (auto)                     │
└─────────────────────────────────────────────┘
```

**Indexes:** `email` (unique)

**Business Rules:**
- Password is never stored in plain text (bcrypt 10 rounds)
- Email must be unique across the system
- Role determines UI access and (eventually) API access

---

### 3.2 CRMClient (PRIMARY entity)

**Collection:** `crmclients`
**Model file:** `modules/crm/models/CRMClient.model.js`

```
┌─────────────────────────────────────────────────────────────┐
│                        CRMClient                             │
├─────────────────────────────────────────────────────────────┤
│ IDENTIFICATION                                               │
│ _id                  ObjectId (auto)                        │
│ trackingId           String (unique, auto: CLI-YYYY-NNNN)   │
│                                                             │
│ LEAD SOURCE                                                  │
│ source               Enum (default: walk_in)                │
│                      walk_in | referral | website           │
│                      instagram | whatsapp | other           │
│ referredBy           String                                 │
│ referrerPhone        String                                 │
│                                                             │
│ BASIC CONTACT INFO                                           │
│ name                 String (required)                      │
│ phone                String (required)                      │
│ email                String                                 │
│                                                             │
│ SPOUSE/PARTNER                                               │
│ spouse.name          String                                 │
│ spouse.phone         String                                 │
│ spouse.email         String                                 │
│ spouse.dob           Date                                   │
│ spouse.anniversary   Date                                   │
│                                                             │
│ EXTENDED CLIENT INFO (from ClientInfoForm)                  │
│ dob                  Date                                   │
│ anniversary          Date                                   │
│ address              String (residential)                   │
│ companyName          String                                 │
│ officeAddress        String                                 │
│ children             [{ age: Number }]                      │
│ clientInfoCompleted  Boolean (default: false)               │
│ clientInfoCompletedAt Date                                  │
│                                                             │
│ PROJECT REQUIREMENTS                                         │
│ projectType          Enum: Residential | Commercial         │
│ area                 Number (sq ft)                         │
│ budget               Number                                 │
│ city                 String                                 │
│ siteAddress          {                                      │
│                        buildingName, tower, unit,          │
│                        floor, fullAddress, city            │
│                      }                                      │
│                                                             │
│ LIFECYCLE STATUS                                             │
│ status               Enum (default: new)                    │
│                      new | contacted | meeting_done         │
│                      proposal_sent | converted | lost       │
│ lifecycleStage       Enum (default: enquiry)                │
│                      [see lifecycle enum below]             │
│ priority             Enum (default: medium)                 │
│                      high | medium | low                    │
│                                                             │
│ INTERACTION HISTORY (event-sourced array, append-only)      │
│ interactionHistory   [{                                     │
│                        type: Enum (14 types),              │
│                        title: String,                       │
│                        description: String,                 │
│                        metadata: Mixed,                     │
│                        createdAt: Date                      │
│                      }]                                     │
│                                                             │
│ COMMUNICATION LOGS                                           │
│ communicationLogs    [{                                     │
│                        channel: WhatsApp|Email|SMS,        │
│                        direction: Inbound|Outbound,        │
│                        content: String,                     │
│                        subject: String,                     │
│                        status: String,                      │
│                        messageId: String,                   │
│                        timestamp: Date                      │
│                      }]                                     │
│                                                             │
│ RELATIONSHIP TRACKING                                        │
│ relationshipNotes    [{                                     │
│                        occasion, message,                  │
│                        sentAt, channel                     │
│                      }]                                     │
│                                                             │
│ AUTOMATION                                                   │
│ automation           {                                      │
│                        thankYouScheduledFor: Date,         │
│                        thankYouSentAt: Date,               │
│                        followupReminderFor: Date,          │
│                        followupReminderSentAt: Date        │
│                      }                                      │
│                                                             │
│ SHOW PROJECT                                                 │
│ showProject          {                                      │
│                        assets: [{ type, title, url, note}],│
│                        siteVisitPlanned: Boolean,          │
│                        siteVisitNote: String,              │
│                        showcasedAt: Date                   │
│                      }                                      │
│                                                             │
│ ADVANCE PAYMENT                                              │
│ advancePayment       {                                      │
│                        received: Boolean,                  │
│                        amount: Number,                     │
│                        receivedAt: Date,                   │
│                        note: String,                       │
│                        movedToProjectManagement: Boolean,  │
│                        movedAt: Date                       │
│                      }                                      │
│                                                             │
│ FUTURE LINKS                                                 │
│ linkedProjects       [ObjectId ref Project]                 │
│ linkedInvoices       [ObjectId ref Invoice]                 │
│                                                             │
│ METADATA                                                     │
│ assignedTo           ObjectId ref User                      │
│ notes                String                                 │
│ lastInteractionAt    Date                                   │
│ createdAt            Date (auto)                            │
│ updatedAt            Date (auto)                            │
└─────────────────────────────────────────────────────────────┘
```

**Indexes:**
```js
{ phone: 1 }
{ email: 1 }
{ trackingId: 1 }
{ status: 1, lifecycleStage: 1 }
```

**lifecycleStage Enum (Full Ordered List):**
```
enquiry
meeting_scheduled
thank_you_sent
client_info_pending
kit
followup_due
show_project
interested
proposal_sent
advance_received
project_moved
project_started
converted
lost
```

**interactionHistory.type Enum:**
```
note | meeting | thank_you | followup | client_info |
show_project | proposal | advance_payment | project |
status_change | communication | esign | payment |
promotional | migration
```

**Pre-save Hook:**
```js
// Auto-generate trackingId before validate
crmClientSchema.pre('validate', async function () {
  if (!this.trackingId) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments() + 1;
    this.trackingId = `CLI-${year}-${String(count).padStart(4, '0')}`;
  }
});
```
⚠️ **Known issue:** Not concurrency-safe. Two simultaneous creates could get same trackingId.

---

### 3.3 Proposal

**Collection:** `proposals`
**Model file:** `modules/crm/models/Proposal.model.js`

```
┌─────────────────────────────────────────────────────────┐
│                       Proposal                           │
├─────────────────────────────────────────────────────────┤
│ _id            ObjectId (auto)                          │
│ leadId         ObjectId ref CRMClient (required)        │
│ templateId     ObjectId ref Template (optional)         │
│ boqId          ObjectId ref Boq (optional)              │
│ title          String (required)                        │
│ description    String                                   │
│ content        Mixed (JSON — free-form proposal body)   │
│                                                         │
│ STATUS TRACKING                                          │
│ status         Enum (default: draft)                    │
│                draft | pending_approval                 │
│                manager_approved | sent                  │
│                esign_received | payment_received        │
│                project_ready | project_started          │
│                rejected                                 │
│ esignStatus    Enum: pending | completed | n/a          │
│ esignSignedAt  Date                                     │
│ esign          { status, signed_at }                    │
│                                                         │
│ APPROVAL                                                 │
│ approved_by    ObjectId ref User                        │
│ approved_at    Date                                     │
│ rejected_by    ObjectId ref User                        │
│ rejection_reason String                                 │
│ approvalHistory  Mixed[]                                │
│                                                         │
│ FINANCIAL                                                │
│ subtotal       Number                                   │
│ gst            Number (percentage)                      │
│ totalAmount    Number                                   │
│ finalAmount    Number (totalAmount + GST)               │
│                                                         │
│ ADVANCE PAYMENT (on proposal)                           │
│ advancePayment {                                        │
│                  amount, paidBy,                        │
│                  paymentDate, paymentMethod,            │
│                  remarks                               │
│                }                                        │
│                                                         │
│ PAYMENT TRACKING                                         │
│ payments       { status, amount, received_at,           │
│                  method, transactionRef }               │
│                                                         │
│ TIMELINE                                                 │
│ sentAt         Date                                     │
│ approvedAt     Date                                     │
│                                                         │
│ METADATA                                                 │
│ version        Number (default: 1)                      │
│ notes          String                                   │
│ createdBy      ObjectId ref User                        │
│ createdAt      Date (auto)                              │
│ updatedAt      Date (auto)                              │
└─────────────────────────────────────────────────────────┘
```

---

### 3.4 BOQ (Bill of Quantities)

**Collection:** `boqs`
**Model file:** `modules/proposal/models/Boq.model.js`

```
┌──────────────────────────────────┐
│             Boq                   │
├──────────────────────────────────┤
│ _id          ObjectId            │
│ proposalId   ObjectId ref Proposal (required) │
│ title        String (default: "BOQ") │
│ totalAmount  Number (default: 0) │
│ gst          Number (default: 0) │
│ finalAmount  Number (default: 0) │
│ status       Enum: draft | finalized │
│ createdAt    Date                │
│ updatedAt    Date                │
└──────────────────────────────────┘
```

**One-to-One with Proposal** (each proposal has at most one BOQ).

---

### 3.5 BOQ_Item

**Collection:** `boq_items`
**Model file:** `modules/proposal/models/Boq_item.model.js`

Line items within a BOQ. Each item represents a specific work item (e.g., "Living Room — Flooring — 400 sq ft at ₹150/sq ft").

---

### 3.6 Template

**Collection:** `templates`
**Model file:** `modules/proposal/models/Template.model.js`

```
┌─────────────────────────────────────────────────┐
│                   Template                       │
├─────────────────────────────────────────────────┤
│ _id          ObjectId                           │
│ name         String (required, trim)            │
│ type         Enum: residential | commercial     │
│ description  String                             │
│ structure    {                                  │
│                columns: [{                      │
│                  id: String,                    │
│                  label: String,                 │
│                  type: text|number|label,       │
│                  width: Number                  │
│                }],                              │
│                rows: [{                         │
│                  id: String,                    │
│                  isGroupHeader: Boolean,        │
│                  cells: Mixed (key-value)       │
│                }]                               │
│              }                                  │
│ createdBy    ObjectId ref User                  │
│ createdAt    Date                               │
│ updatedAt    Date                               │
└─────────────────────────────────────────────────┘
```

---

### 3.7 Approval

**Collection:** `approvals`
**Model file:** `modules/proposal/models/Approval.model.js`

```
┌──────────────────────────────────────┐
│             Approval                  │
├──────────────────────────────────────┤
│ _id          ObjectId                │
│ proposalId   ObjectId ref Proposal   │
│ type         Enum: internal | manager│
│ status       Enum: pending | approved│
│              | rejected              │
│ approvedBy   ObjectId ref User       │
│ note         String                  │
│ createdAt    Date                    │
│ updatedAt    Date                    │
└──────────────────────────────────────┘
```

---

### 3.8 Payment

**Collection:** `payments`
**Model file:** `modules/proposal/models/Payment.model.js`

```
┌──────────────────────────────────────┐
│              Payment                  │
├──────────────────────────────────────┤
│ _id          ObjectId                │
│ proposalId   ObjectId ref Proposal   │
│ leadId       ObjectId ref CRMClient  │
│ amount       Number (required)       │
│ method       Enum: cash|upi|bank     │
│ status       Enum: pending|received  │
│ receivedAt   Date                    │
│ createdAt    Date                    │
│ updatedAt    Date                    │
└──────────────────────────────────────┘
```

---

### 3.9 ESign

**Collection:** `esigns`
**Model file:** `modules/proposal/models/ESign.model.js`

```
┌──────────────────────────────────────┐
│               ESign                   │
├──────────────────────────────────────┤
│ _id            ObjectId              │
│ proposalId     ObjectId ref Proposal │
│ signedBy       String (client name)  │
│ signatureUrl   String (image/file)   │
│ status         Enum: pending|signed  │
│ createdAt      Date                  │
│ updatedAt      Date                  │
└──────────────────────────────────────┘
```

---

### 3.10 Metting (Meeting)

**Collection:** `mettings` (typo is intentional — do not rename)
**Model file:** `modules/crm/models/Metting.model.js`

```
┌──────────────────────────────────────┐
│              Metting                  │
├──────────────────────────────────────┤
│ _id              ObjectId            │
│ leadId           ObjectId ref CRMClient (required) │
│ date             Date (required)     │
│ type             Enum: call|office|site │
│ notes            String              │
│ status           Enum: scheduled     │
│                  |completed|cancelled│
│ durationMinutes  Number (default: 60)│
│ createdBy        ObjectId ref User   │
│ createdAt        Date                │
│ updatedAt        Date                │
└──────────────────────────────────────┘
```

---

### 3.11 FollowUp

**Collection:** `followups`
**Model file:** `modules/crm/models/FollowUp.model.js`

```
┌──────────────────────────────────────┐
│              FollowUp                 │
├──────────────────────────────────────┤
│ _id             ObjectId             │
│ leadId          ObjectId ref CRMClient (required) │
│ date            Date (required)      │
│ note            String               │
│ nextFollowupDate Date                │
│ status          Enum: pending|done   │
│ assignedTo      ObjectId ref User    │
│ createdAt       Date                 │
│ updatedAt       Date                 │
└──────────────────────────────────────┘
```

---

### 3.12 Project (PMS — Stub)

**Collection:** `projects`
**Model file:** `modules/pms/models/Project.model.js`

```
┌──────────────────────────────────────────────┐
│                  Project                      │
├──────────────────────────────────────────────┤
│ _id          ObjectId                        │
│ clientId     ObjectId ref CRMClient (required)│
│ proposalId   ObjectId ref Proposal           │
│ name         String (required)               │
│ projectType  Enum: Residential|Commercial    │
│ siteAddress  String                          │
│ city         String                          │
│ area         Number                          │
│ budget       Number                          │
│ status       Enum: design|execution|completed│
│ designer     ObjectId ref User               │
│ supervisor   ObjectId ref User               │
│ startDate    Date                            │
│ endDate      Date                            │
│ notes        String                          │
│ createdAt    Date                            │
│ updatedAt    Date                            │
└──────────────────────────────────────────────┘
```

---

## 4. ENTITY RELATIONSHIP DIAGRAM

```
User (1)
 ├─→ CRMClient.assignedTo (many)
 ├─→ Proposal.createdBy (many)
 ├─→ Proposal.approved_by (many)
 ├─→ Metting.createdBy (many)
 ├─→ FollowUp.assignedTo (many)
 └─→ Template.createdBy (many)

CRMClient (1)
 ├─→ Metting.leadId (many)
 ├─→ FollowUp.leadId (many)
 ├─→ Proposal.leadId (many)
 ├─→ Payment.leadId (many)
 ├─→ Project.clientId (many) [future]
 ├─→ CRMClient.linkedProjects[] → Project [future]
 └─→ CRMClient.linkedInvoices[] → Invoice [future]

Proposal (1)
 ├─→ Boq.proposalId (1:1)
 ├─→ Approval.proposalId (many)
 ├─→ Payment.proposalId (many)
 ├─→ ESign.proposalId (1:1)
 ├─→ ProposalVersion.proposalId (many)
 └─→ Activity.proposalId (many)

Boq (1)
 └─→ Boq_item.boqId (many)

Template (1)
 └─→ Proposal.templateId (many, optional reference)

Project (1) [future]
 ├─→ Task.projectId (many)
 ├─→ Milestone.projectId (many)
 └─→ SiteVisit.projectId (many)
```

---

## 5. INDEXING STRATEGY

### Current Indexes
```js
// CRMClient
{ phone: 1 }           // Lookups by phone number
{ email: 1 }           // Lookups by email
{ trackingId: 1 }      // Lookups by CLI-YYYY-NNNN
{ status: 1, lifecycleStage: 1 }  // Pipeline queries

// User
{ email: 1 }  // unique (auto-created by Mongoose)
```

### Missing Indexes (Should Be Added)
```js
// Proposals — common queries by client and status
{ leadId: 1 }
{ status: 1 }
{ createdAt: -1 }

// Meetings — common queries by client
{ leadId: 1 }
{ date: 1 }

// FollowUps — pending follow-ups for dashboard
{ leadId: 1 }
{ status: 1, date: 1 }

// Payments — by proposal
{ proposalId: 1 }
```

---

## 6. DATA LIFECYCLE & RETENTION

### Append-only Fields
- `CRMClient.interactionHistory` — Never delete entries. Always use `$push`.
- `CRMClient.communicationLogs` — Audit trail of all comms.
- `CRMClient.relationshipNotes` — Relationship management history.

### Soft Delete
Currently **not implemented**. All deletes are hard deletes. Recommended to add `deletedAt: Date` field to CRMClient to enable soft delete.

### Status Transitions
CRMClient status is designed to be progressed forward but can also be moved backward (e.g., re-opening a lost lead). No hard state machine enforced in schema — business rules in controller.

---

## 7. IMPORTANT QUERY PATTERNS

### Get pipeline counts for dashboard
```js
const stats = await CRMClient.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } }
]);
```

### Get clients due for follow-up
```js
const due = await FollowUp.find({
  status: 'pending',
  date: { $lte: new Date() }
}).populate('leadId', 'name phone').sort({ date: 1 });
```

### Get full proposal with all related data
```js
const proposal = await Proposal
  .findById(id)
  .populate('leadId', 'name phone email trackingId')
  .populate('templateId', 'name structure')
  .populate('createdBy', 'name role')
  .populate('approved_by', 'name');

const boq = await Boq.findOne({ proposalId: id });
const items = await BoqItem.find({ boqId: boq._id });
```

### Get client timeline (most recent first)
```js
const client = await CRMClient.findById(id, {
  interactionHistory: { $slice: -20 }  // Last 20 events
}).populate('assignedTo', 'name role');
```
