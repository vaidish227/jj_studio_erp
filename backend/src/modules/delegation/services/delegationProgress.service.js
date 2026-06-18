/**
 * Derive a delegation's progress percentage.
 *   - Checklist has items → percentage of completed items (authoritative).
 *   - No checklist        → derive from workflow status: completed → 100, else 0.
 * `status` is optional; when omitted the empty-checklist case stays at 0
 * (preserves the pre-existing contract for callers that don't pass it).
 */
const computeProgress = (checklist = [], status) => {
  if (!Array.isArray(checklist) || checklist.length === 0) {
    return status === "completed" ? 100 : 0;
  }
  const done = checklist.filter((i) => i.isCompleted).length;
  return Math.round((done / checklist.length) * 100);
};

module.exports = { computeProgress };
