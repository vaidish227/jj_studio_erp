const PurchaseOrder = require("../models/PurchaseOrder.model");

/**
 * @desc Create a new Purchase Order (PO)
 * @route POST /api/pms/po/create
 */
const createPO = async (req, res) => {
  try {
    const { 
      projectId, 
      vendorId, 
      taskId, 
      items, 
      totalAmount, 
      expectedDeliveryDate, 
      deliveryLocation, 
      notes 
    } = req.body;

    const po = await PurchaseOrder.create({
      projectId,
      vendorId,
      taskId,
      items,
      totalAmount,
      expectedDeliveryDate,
      deliveryLocation,
      notes
    });

    res.status(201).json({
      success: true,
      message: `Purchase Order ${po.poNumber} created successfully`,
      po
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all POs for a Project
 * @route GET /api/pms/po/project/:projectId
 */
const getProjectPOs = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find({ projectId: req.params.projectId })
      .populate("vendorId", "name phone category")
      .populate("taskId", "title")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pos.length,
      pos
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update PO Status (Sent/Delivered/Paid)
 * @route PUT /api/pms/po/update/:id
 */
const updatePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!po) return res.status(404).json({ message: "PO not found" });

    res.status(200).json({
      success: true,
      message: "Purchase Order updated successfully",
      po
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Delete PO
 */
const deletePO = async (req, res) => {
  try {
    await PurchaseOrder.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "PO deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createPO,
  getProjectPOs,
  updatePO,
  deletePO
};
