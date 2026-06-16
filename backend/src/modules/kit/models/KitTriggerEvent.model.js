const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { SOURCE_MODULES, ENTITY_TYPES } = require("../constants/enums");

/**
 * KitTriggerEvent (kit_trigger_events) — append-only log of every business
 * event emitted into the KIT trigger system, plus which workflows matched it.
 *
 * Purpose: audit, debugging, and replay. Writing the event is fire-and-forget
 * (like activityLogger) so emitting never blocks the originating request.
 */
const kitTriggerEventSchema = new mongoose.Schema(
  {
    eventType:    { type: String, required: true }, // e.g. "lead.created"
    sourceModule: { type: String, enum: SOURCE_MODULES, required: true },

    entityType: { type: String, enum: ENTITY_TYPES },
    entityId:   { type: ObjectId },

    payload:          { type: mongoose.Schema.Types.Mixed, default: {} },
    matchedWorkflows: [{ type: ObjectId, ref: "KitWorkflow" }],

    firedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "kit_trigger_events" }
);

kitTriggerEventSchema.index({ eventType: 1, firedAt: -1 });
kitTriggerEventSchema.index({ entityType: 1, entityId: 1 });
// Analytics — events-fired counts within a date range
kitTriggerEventSchema.index({ createdAt: 1 });

module.exports = mongoose.model("KitTriggerEvent", kitTriggerEventSchema);
