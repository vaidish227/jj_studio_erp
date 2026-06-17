const mongoose = require("mongoose");

/**
 * Counter — generic atomic sequence store for human-readable IDs.
 * One document per sequence key (e.g. "delegation:2026"). `nextSeq` uses an
 * atomic findOneAndUpdate($inc) so concurrent creates never collide.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String }, // sequence key, e.g. "delegation:2026"
    seq: { type: Number, default: 0 },
  },
  { collection: "counters", versionKey: false }
);

/**
 * Atomically increment and return the next value for `key`.
 * @param {string} key
 * @returns {Promise<number>}
 */
counterSchema.statics.nextSeq = async function (key) {
  const doc = await this.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model("Counter", counterSchema, "counters");
