const mongoose = require("mongoose");
const Responsibility = require("../models/Responsibility.model");

/**
 * teamResolver — single source of truth for "who plays role X on project Y".
 *
 * Replaces direct field reads like `project.primaryDesigner` and
 * `project.supervisor` everywhere in the codebase. Downstream services
 * (notifications, vendor groups, workflow engine, handover) look up by
 * stable slug, not by hardcoded field name.
 *
 * Project.assignments shape:
 *   [{ responsibilityId: ObjectId, users: [ObjectId|User] }]
 */

// Small slug → ObjectId cache. Responsibilities collection is tiny and
// changes rarely; invalidated on any admin write.
let slugCache = null;

async function loadSlugCache() {
  if (slugCache) return slugCache;
  const docs = await Responsibility.find({}, { slug: 1 }).lean();
  slugCache = new Map(docs.map((d) => [d.slug, String(d._id)]));
  return slugCache;
}

function invalidateSlugCache() {
  slugCache = null;
}

/**
 * Resolve a slug to its ObjectId. Returns null if no such responsibility.
 */
async function resolveSlugId(slug) {
  if (!slug) return null;
  const cache = await loadSlugCache();
  const id = cache.get(slug);
  return id || null;
}

/**
 * Find the assignment row for a given slug on a project.
 * Handles both populated (responsibilityId is an object with slug) and
 * unpopulated (responsibilityId is an ObjectId) projects.
 *
 * For unpopulated projects we fall back to the slug cache.
 */
async function findAssignment(project, slug) {
  if (!project || !Array.isArray(project.assignments) || !slug) return null;

  // Populated path
  const populatedHit = project.assignments.find(
    (a) => a.responsibilityId && a.responsibilityId.slug === slug
  );
  if (populatedHit) return populatedHit;

  // Unpopulated path — match by ObjectId via slug cache
  const slugId = await resolveSlugId(slug);
  if (!slugId) return null;
  return (
    project.assignments.find(
      (a) =>
        a.responsibilityId &&
        String(a.responsibilityId) === slugId
    ) || null
  );
}

/**
 * Return all users assigned to a responsibility (by slug) on a project.
 * Returns User docs if project was populated with assignmentsPopulate(),
 * otherwise raw ObjectIds.
 */
async function resolveBySlug(project, slug) {
  const assignment = await findAssignment(project, slug);
  if (!assignment || !Array.isArray(assignment.users)) return [];
  return assignment.users.filter(Boolean);
}

/**
 * Return the first user assigned to a slug on a project, or null.
 * Used by single-assignee flows (workflow engine task creation,
 * handover sign-off).
 */
async function resolveFirstBySlug(project, slug) {
  const users = await resolveBySlug(project, slug);
  return users[0] || null;
}

/**
 * Flat dedup'd list of every user assigned to any responsibility on the
 * project. Returns ObjectIds (strings) — used for $in queries and
 * "designer is on this project" membership checks.
 */
function getAllTeamUserIds(project) {
  if (!project || !Array.isArray(project.assignments)) return [];
  const ids = new Set();
  for (const a of project.assignments) {
    if (!Array.isArray(a.users)) continue;
    for (const u of a.users) {
      if (!u) continue;
      const id = u._id ? String(u._id) : String(u);
      if (mongoose.Types.ObjectId.isValid(id)) ids.add(id);
    }
  }
  return Array.from(ids);
}

/**
 * Standard populate spec for reading project assignments.
 * Pass to .populate() in any controller that needs team data.
 */
function assignmentsPopulate() {
  return [
    { path: "assignments.responsibilityId" },
    { path: "assignments.users", select: "name email role phone" },
  ];
}

module.exports = {
  resolveBySlug,
  resolveFirstBySlug,
  resolveSlugId,
  getAllTeamUserIds,
  assignmentsPopulate,
  invalidateSlugCache,
};
