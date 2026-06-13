// User-facts endpoints. Each user manages their own; admins can view and
// delete on behalf of others.

const mongoose = require("mongoose");
const Joi = require("joi");

const AIUserFact = require("../models/AIUserFact.model");
const userFactsService = require("../services/userFacts.service");

const addSchema = Joi.object({
  fact: Joi.string().trim().min(4).max(500).required(),
});

function isAdmin(req) {
  return (req.permissions || []).some((p) => p === "*" || p === "ai.admin");
}

async function listMine(req, res) {
  const facts = await AIUserFact.find({ userId: req.user.id })
    .sort({ source: 1, createdAt: -1 })
    .select("fact source confidence createdAt expiresAt")
    .lean();
  res.json({ facts });
}

async function addMine(req, res) {
  const { value, error } = addSchema.validate(req.body, { stripUnknown: true });
  if (error) return res.status(400).json({ message: error.details[0].message });
  const fact = await userFactsService.addExplicitFact({ userId: req.user.id, fact: value.fact });
  res.status(201).json({ fact });
}

async function removeMine(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id." });
  }
  await userFactsService.removeFact({ userId: req.user.id, factId: req.params.id });
  res.json({ ok: true });
}

async function runSummarizer(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden." });
  const result = await userFactsService.summarizeAllRecentUsers();
  res.json(result);
}

module.exports = { listMine, addMine, removeMine, runSummarizer };
