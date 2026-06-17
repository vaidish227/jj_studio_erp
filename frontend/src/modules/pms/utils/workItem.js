/**
 * Shared helpers that centralize the designer Task ↔ Drawing ↔ Revision
 * workflow so the Tasks tab, Drawings tab, Task detail page, and Master Sheet
 * all act on the SAME underlying work item with one code path.
 */
import { pmsService } from '../../../shared/services/pmsService';

/**
 * Resolve the parent Task id for a drawing, tolerating both the populated
 * (`{ _id, ... }`) and raw-ObjectId shapes the API returns. Null when the
 * drawing is an orphan (legacy upload with no taskId).
 */
export const getParentTaskId = (drawing) =>
  drawing?.taskId?._id || drawing?.taskId || null;

/**
 * Latest drawing for a task = highest version. `getDrawingsByTask` already
 * sorts version desc, so the first element is normally latest — but sort
 * defensively in case the array arrives unsorted.
 */
export const getLatestDrawingForTask = (drawings = []) =>
  [...drawings].sort((a, b) => (b?.version || 0) - (a?.version || 0))[0] || null;

/**
 * Map a planner Task.taskType → the closest Drawing.drawingType enum so an
 * upload lands in the right S3 folder + filter group. Mirrors the backend
 * DRAWING_TO_TASK_TYPE intent in reverse. Single source for both the Master
 * Sheet inline upload and the Upload modal prefill.
 */
export const taskTypeToDrawingType = (taskType) => {
  switch (taskType) {
    case 'civil_drawing':           return 'civil';
    case 'technical_drawing':       return 'technical_detail';
    case 'ac_coordination':         return 'ac_coordination';
    case 'automation_coordination': return 'automation';
    case 'kitchen_drawing':         return 'kitchen';
    case 'bathroom_drawing':        return 'bathroom';
    case '3d_render':               return '3d_render';
    case 'concept_making':          return 'concept';
    case 'site_measurement':        return 'site_photo';
    case 'furniture_layout':        return 'plan';
    default:                        return 'plan';
  }
};

/**
 * Build the multipart FormData for a drawing upload/revision. Empty optional
 * fields are omitted so the backend keeps its existing defaults. Used by both
 * the Upload modal and the Master Sheet inline upload.
 */
export const buildDrawingUploadFormData = ({
  projectId, taskId, title, zoneName, floor, area,
  drawingType, description, revisionNotes, file,
}) => {
  const fd = new FormData();
  fd.append('projectId', projectId);
  if (taskId)       fd.append('taskId', taskId);
  fd.append('title', (title || '').trim());
  if (zoneName)     fd.append('zoneName', String(zoneName).trim());
  if (floor)        fd.append('floor', String(floor).trim());
  if (area)         fd.append('area', String(area).trim());
  if (drawingType)  fd.append('drawingType', drawingType);
  if (description)  fd.append('description', String(description).trim());
  if (revisionNotes) fd.append('revisionNotes', String(revisionNotes).trim());
  if (file)         fd.append('file', file, file.name);
  return fd;
};

/**
 * Submit a task for review with notes coerced to a safe string — never sends
 * `undefined`, so the backend always stores a clean string. Centralizes the
 * `submissionNotes ?? ''` defaulting that protects against the prior crash.
 */
export const submitTaskForReview = (taskId, notes) =>
  pmsService.submitTask(taskId, { submissionNotes: notes ?? '' });
