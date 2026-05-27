const PurchaseOrder = require("../models/PurchaseOrder.model");
const { createPOSchema, updatePOSchema } = require("../validator/PurchaseOrder.validator");

/**
 * @route POST /api/pms/po/create
 */
const createPO = async (req, res) => {
  try {
    const { error, value } = createPOSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    if (!value.taskId) delete value.taskId;

    // Auto-compute item amounts if not provided
    const items = value.items.map((item) => ({
      ...item,
      amount: item.amount ?? item.quantity * item.rate,
    }));

    const po = await PurchaseOrder.create({ ...value, items });

    res.status(201).json({ message: `Purchase Order ${po.poNumber} created`, po });
  } catch (error) {
    console.error("[createPO]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/po/project/:projectId
 */
const getProjectPOs = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find({ projectId: req.params.projectId })
      .populate("vendorId", "name phone category")
      .populate("taskId", "title taskType")
      .sort({ createdAt: -1 });

    res.status(200).json({ count: pos.length, pos });
  } catch (error) {
    console.error("[getProjectPOs]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/po/update/:id
 */
const updatePO = async (req, res) => {
  try {
    const { error, value } = updatePOSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    )
      .populate("vendorId", "name phone")
      .populate("taskId", "title");

    if (!po) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }

    res.status(200).json({ message: "Purchase Order updated", po });
  } catch (error) {
    console.error("[updatePO]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/po/delete/:id
 */
const deletePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!po) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }
    res.status(200).json({ message: "Purchase Order deleted" });
  } catch (error) {
    console.error("[deletePO]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createPO,
  getProjectPOs,
  updatePO,
  deletePO,
};
