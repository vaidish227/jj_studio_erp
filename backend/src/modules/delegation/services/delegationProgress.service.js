/**
 * Derive a delegation's progress percentage from its checklist completion.
 * No checklist → 0%.
 */
const computeProgress = (checklist = []) => {
  if (!Array.isArray(checklist) || checklist.length === 0) return 0;
  const done = checklist.filter((i) => i.isCompleted).length;
  return Math.round((done / checklist.length) * 100);
};

module.exports = { computeProgress };
