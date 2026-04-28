const Proposal = require("../models/Proposal.model");
const Lead = require("../models/Lead.model")
const sendEmail = require("../utils/sendEmail");
require("dotenv").config();

//  CREATE PROPOSAL
const createProposal = async (req, res) => {
  try {
    const { leadId, items } = req.body;

    // LeadId check
    if (!leadId) {
      return res.status(400).json({
        message: "Lead ID is required",
      });
    }

    // Items check
    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Items are required",
      });
    }

    //  Lead fetch
    const lead = await Lead.findById(leadId);

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found",
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

    //  create proposal with BOTH IDs
    const proposal = await Proposal.create({
      ...req.body,
      leadId: lead._id,
      clientId: lead.clientId,
      items: updatedItems,
      totalAmount,
      gst,
      finalAmount,
    });

    lead.status = "proposal_sent";
    lead.lifecycleStage = "proposal_sent";
    lead.interactionHistory = Array.isArray(lead.interactionHistory)
      ? lead.interactionHistory
      : [];
    lead.interactionHistory.push({
      type: "proposal",
      title: "Proposal created",
      description: "A new proposal was generated for this lead.",
      createdAt: new Date(),
    });
    await lead.save();

    console.log("Proposal created:", proposal._id);

    res.status(201).json({
      message: "Proposal created successfully",
      proposal,
    });

  } catch (err) {
    console.log(" Error:", err.message);
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
//  SEND PROPOSAL EMAIL
const sendProposalEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await Proposal.findById(id)
      .populate("clientId", "name email");

    if (!proposal) {
      return res.status(404).json({
        message: "Proposal not found",
      });
    }

    if (!proposal.clientId || !proposal.clientId.email) {
      return res.status(400).json({
        message: "Client email not found",
      });
    }

    //  dynamic items HTML
    const itemsHtml = proposal.items.map((item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>₹${item.rate}</td>
        <td>₹${item.amount}</td>
      </tr>
    `).join("");

    //  mail content 
    await sendEmail({
      to: proposal.clientId.email,
      subject: "Your Proposal from JJ Studio",
      html: `
        <h2>Hello ${proposal.clientId.name},</h2>

        <p>Please find your proposal details below:</p>

        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <br/>

        <p><b>Total Amount:</b> ₹${proposal.totalAmount}</p>
        <p><b>GST (18%):</b> ₹${proposal.gst}</p>
        <p><b>Final Amount:</b> ₹${proposal.finalAmount}</p>

        <br/>

        <p>We look forward to working with you.</p>

        <p>Regards,<br/>JJ Studio Team</p>
      `,
    });

    // update status
    proposal.status = "sent";
    await proposal.save();

    await Lead.findByIdAndUpdate(proposal.leadId, {
      status: "proposal_sent",
      lifecycleStage: "proposal_sent",
      $push: {
        interactionHistory: {
          type: "proposal",
          title: "Proposal sent",
          description: "Proposal email was sent to the client.",
          createdAt: new Date(),
        },
      },
    });

    res.status(200).json({
      message: "Proposal email sent successfully",
    });

  } catch (err) {
    console.log(" Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createProposal, getProposals, updateProposalStatus, deleteProposal, getProposalById, updateProposal, sendProposalEmail }