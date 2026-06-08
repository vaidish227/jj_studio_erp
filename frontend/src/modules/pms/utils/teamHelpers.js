/**
 * teamHelpers — pure read helpers for project.assignments.
 *
 * Mirrors backend/teamResolver.js: every UI lookup goes through these so
 * "who is the lead designer?" never hardcodes a field name again.
 *
 * Project.assignments shape:
 *   [{ responsibilityId: { _id, slug, name, icon, color }, users: [User] }]
 */

const isPopulated = (assignment) =>
  assignment &&
  assignment.responsibilityId &&
  typeof assignment.responsibilityId === "object";

export function getAssignmentBySlug(project, slug) {
  if (!project || !Array.isArray(project.assignments) || !slug) return null;
  return (
    project.assignments.find(
      (a) => isPopulated(a) && a.responsibilityId.slug === slug
    ) || null
  );
}

export function getUsersBySlug(project, slug) {
  const a = getAssignmentBySlug(project, slug);
  return Array.isArray(a?.users) ? a.users.filter(Boolean) : [];
}

export function getFirstUserBySlug(project, slug) {
  return getUsersBySlug(project, slug)[0] || null;
}

export function getLeadDesigner(project) {
  return getFirstUserBySlug(project, "lead_designer");
}

export function getSupervisor(project) {
  return getFirstUserBySlug(project, "supervisor");
}

export function getAllAssignedUsers(project) {
  if (!project || !Array.isArray(project.assignments)) return [];
  const seen = new Set();
  const out = [];
  for (const a of project.assignments) {
    for (const u of a.users || []) {
      if (!u || !u._id) continue;
      const id = String(u._id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(u);
    }
  }
  return out;
}

/**
 * Build a display-friendly work item from an assignment row.
 * Returns a uniform shape regardless of whether the row is a saved
 * responsibility (populated) or a per-project custom name.
 */
export function assignmentWorkItem(assignment) {
  if (!assignment) return null;
  if (isPopulated(assignment)) {
    const r = assignment.responsibilityId;
    return {
      _id: r._id,
      key: `r:${r._id}`,
      kind: 'master',
      name: r.name,
      icon: r.icon,
      color: r.color,
    };
  }
  if (assignment.customName) {
    return {
      _id: `c:${assignment.customName.trim().toLowerCase()}`,
      key: `c:${assignment.customName.trim().toLowerCase()}`,
      kind: 'custom',
      name: assignment.customName,
      icon: 'Layers',
      color: 'text-[var(--text-muted)]',
    };
  }
  return null;
}

/**
 * Returns rows for the "By Person" view: each user once, with the list of
 * work items (master responsibility OR custom) they hold on this project.
 */
export function groupAssignmentsByUser(project) {
  if (!project || !Array.isArray(project.assignments)) return [];
  const byUser = new Map();
  for (const a of project.assignments) {
    const item = assignmentWorkItem(a);
    if (!item) continue;
    for (const u of a.users || []) {
      if (!u || !u._id) continue;
      const id = String(u._id);
      if (!byUser.has(id)) {
        byUser.set(id, { user: u, responsibilities: [] });
      }
      byUser.get(id).responsibilities.push(item);
    }
  }
  return Array.from(byUser.values());
}

export function countAssignedUsers(project) {
  return getAllAssignedUsers(project).length;
}
