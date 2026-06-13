const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const { createProposal , getProposals, updateProposalStatus, deleteProposal , getProposalById, updateProposal, sendProposalEmail, downloadProposalPdf, saveProposalToDocuments} = require("../controllers/Proposal.controller");

// NOTE: verifyToken is applied app-wide. These permission slugs follow the
// repo convention (whatsapp.send, tasks.approve, etc). Non-admin roles need
// these added to their Role document — admin's `*` already covers them.
router.get("/get",            requirePermission("proposal.read"),   getProposals);
router.get("/get/:id",        requirePermission("proposal.read"),   getProposalById);
router.post("/create",        requirePermission("proposal.create"), createProposal);
router.put("/update/:id",     requirePermission("proposal.update"), updateProposal);
// Status changes route through a single endpoint; an extra check for the sensitive
// transitions (manager_approved / rejected / revision_requested) lives in the controller.
router.patch("/updatestatus/:id", requirePermission("proposal.update"), updateProposalStatus);
router.post("/send/:id",      requirePermission("proposal.send"),   sendProposalEmail);
// Streams the same letter-format PDF the review screen renders.
router.get("/pdf/:id",        requirePermission("proposal.read"),   downloadProposalPdf);
// Files that PDF into the linked project's Document Repository (idempotent).
router.post("/save-to-documents/:id", requirePermission("documents.upload"), saveProposalToDocuments);
router.delete("/delete/:id",  requirePermission("proposal.delete"), deleteProposal);

module.exports = router;
