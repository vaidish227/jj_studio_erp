const Proposal = require("../models/Proposal.model");

//  CREATE PROPOSAL
const createProposal = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Items are required",
      });
    }

    //  calculate amounts
    let totalAmount = 0;

    const updatedItems = items.map((item) => {
      const amount = item.qty * item.rate;
      totalAmount += amount;

      return {
        ...item,
        amount,
      };
    });

    const gst = totalAmount * 0.18;
    const finalAmount = totalAmount + gst;

    const proposal = await Proposal.create({
      ...req.body,
      items: updatedItems,
      totalAmount,
      gst,
      finalAmount,
    });

    res.status(201).json({
      message: "Proposal created successfully",
      proposal,
    });

  } catch (err) {
    console.log("🔥 Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

//  GET PROPOSALS
const getProposals = async (req, res) => {
  try {
    const { leadId, clientId } = req.query;

    const filter = {};
    if (leadId) filter.leadId = leadId;
    if (clientId) filter.clientId = clientId;

    const proposals = await Proposal.find(filter)
      .populate("leadId", "name")
      .populate("clientId", "name")
      .sort({ createdAt: -1 });

    res.json({
      message: "Proposals fetched",
      proposals,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//----------------update status-----------------
// UPDATE STATUS
const updateProposalStatus = async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    res.json(proposal);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE PROPOSAL
const deleteProposal = async (req, res) => {
  try {
    await Proposal.findByIdAndDelete(req.params.id);

    res.json({ message: "Proposal deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET BY ID
const getProposalById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Proposal ID is required",
      });
    }

    const proposal = await Proposal.findById(id)
      .populate("leadId", "name phone")
      .populate("clientId", "name");

    if (!proposal) {
      return res.status(404).json({
        message: "Proposal not found",
      });
    }

    console.log(" Proposal fetched:", proposal._id);

    res.status(200).json({
      message: "Proposal fetched successfully",
      proposal,
    });

  } catch (err) {
    console.log(" Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

//  UPDATE PROPOSAL (FULL)
const updateProposal = async (req, res) => {
  try {

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Proposal ID is required",
      });
    }

    const proposal = await Proposal.findById(id);

    if (!proposal) {
      return res.status(404).json({
        message: "Proposal not found",
      });
    }

    const { items } = req.body;

    let totalAmount = 0;

    let updatedItems = proposal.items;

    //  recalculate if items updated
    if (items && items.length > 0) {
      updatedItems = items.map((item) => {
        const amount = item.qty * item.rate;
        totalAmount += amount;

        return {
          ...item,
          amount,
        };
      });
    } else {
      totalAmount = proposal.totalAmount;
    }

    const gst = totalAmount * 0.18;
    const finalAmount = totalAmount + gst;

    Object.assign(proposal, {
      ...req.body,
      items: updatedItems,
      totalAmount,
      gst,
      finalAmount,
    });

    await proposal.save();

    res.status(200).json({
      message: "Proposal updated successfully",
      proposal,
    });

  } catch (err) {
    console.log(" Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {createProposal, getProposals, updateProposalStatus, deleteProposal, getProposalById, updateProposal }