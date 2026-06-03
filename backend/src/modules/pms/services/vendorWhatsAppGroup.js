/**
 * vendorWhatsAppGroup — Phase 2 helper.
 *
 * Creates a per-engagement WhatsAppProjectGroup using the same model + Maytapi
 * conventions as WhatsAppGroup.controller.createGroup, but invoked from inside
 * the engine (no HTTP round-trip).
 *
 * Members assembled from the project team:
 *   - For AC / Automation: Designer C + Principal Designer + Client + Vendor contact + PC
 *   - For Kitchen (outsourced): Designer D + Principal Designer + Client + Vendor contact + PC
 *
 * Phone numbers are pulled from User.phone for team members and Vendor.phone
 * for the vendor contact. Client phone is fetched from CRMClient.
 *
 * Provider sync is intentionally NOT triggered here — the group is created as
 * "unsynced" so the user can confirm members in the UI before pushing to Maytapi.
 * (Mirrors the manual flow.)
 */

const WhatsAppProjectGroup = require("../models/WhatsAppProjectGroup.model");
const Project = require("../models/Project.model");
const Vendor = require("../models/Vendor.model");

// User model lookup is optional — degrades gracefully if missing
let User = null;
try { User = require("../../auth/models/user.model"); } catch (e) { /* noop */ }
let CRMClient = null;
try { CRMClient = require("../../crm/models/CRMClient.model"); } catch (e) { /* noop */ }

const KIND_TO_DESIGNER_SLOT = {
  ac: "designerC",
  automation: "designerC",
  kitchen: "designerD",
};

/**
 * createPerVendorGroup — build and persist the engagement-scoped group.
 *
 * @param {Object} args
 * @param {Object} args.engagement — VendorEngagement doc (must include projectId, vendorId, vendorKind, _id)
 * @param {Object} [args.gate]     — optional ApprovalGate that triggered the creation (engagement.clientApprovalGateId)
 * @param {ObjectId} [args.actorId]
 * @returns {Promise<WhatsAppProjectGroup>}
 */
async function createPerVendorGroup({ engagement, gate, actorId } = {}) {
  if (!engagement?.projectId || !engagement?.vendorId || !engagement?.vendorKind) {
    throw new Error("createPerVendorGroup: engagement is missing required fields");
  }

  const [project, vendor] = await Promise.all([
    Project.findById(engagement.projectId)
      .select("name trackingId clientId primaryDesigner supervisor designerB designerC designerD designerE contractor")
      .lean(),
    Vendor.findById(engagement.vendorId).select("name phone email contactPerson").lean(),
  ]);

  if (!project) throw new Error("createPerVendorGroup: project not found");
  if (!vendor) throw new Error("createPerVendorGroup: vendor not found");

  const groupName =
    `JJ Studio - ${project.name} - ${formatKind(engagement.vendorKind)} - ${vendor.name}`;

  const members = [];

  // Helper to push an ERP user as a member if they have a phone
  const pushUser = async (userId, role) => {
    if (!userId || !User) return;
    const u = await User.findById(userId).select("name email phone role").lean();
    if (u && u.phone) {
      members.push({
        userId: u._id,
        name: u.name,
        phone: u.phone,
        role: role || u.role,
        memberType: "team_member",
        addedBy: actorId || undefined,
        addedAt: new Date(),
      });
    }
  };

  // Designer slot for the kind
  const designerSlot = KIND_TO_DESIGNER_SLOT[engagement.vendorKind];
  if (designerSlot) await pushUser(project[designerSlot], `Designer (${engagement.vendorKind})`);

  // Principal Designer — best-effort: the explicit slot is `primaryDesigner` per current model
  await pushUser(project.primaryDesigner, "Principal Designer");

  // Project coordinator / supervisor
  await pushUser(project.supervisor, "Supervisor / PC");

  // Vendor contact
  if (vendor.phone) {
    members.push({
      userId: null,
      name: vendor.contactPerson || vendor.name,
      phone: vendor.phone,
      role: "Vendor",
      memberType: "external",
      addedBy: actorId || undefined,
      addedAt: new Date(),
    });
  }

  // Client phone via CRMClient
  if (CRMClient && project.clientId) {
    const c = await CRMClient.findById(project.clientId).select("name phone").lean();
    if (c?.phone) {
      members.push({
        userId: null,
        name: c.name,
        phone: c.phone,
        role: "Client",
        memberType: "client",
        addedBy: actorId || undefined,
        addedAt: new Date(),
      });
    }
  }

  // Idempotency: don't create duplicates per (engagement, kind, vendor)
  const existing = await WhatsAppProjectGroup.findOne({
    projectId: engagement.projectId,
    groupType: "custom",
    groupName,
  });
  if (existing) return existing;

  const group = await WhatsAppProjectGroup.create({
    projectId: engagement.projectId,
    groupType: "custom",
    groupName,
    members,
    createdBy: actorId || undefined,
    notes:
      `Auto-created for vendor engagement ${engagement._id} ` +
      `(kind=${engagement.vendorKind}, vendor=${vendor.name})` +
      (gate ? `. Triggered by gate ${gate.gateType}` : ""),
  });

  return group;
}

function formatKind(kind) {
  if (!kind) return "Vendor";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

module.exports = {
  createPerVendorGroup,
};
