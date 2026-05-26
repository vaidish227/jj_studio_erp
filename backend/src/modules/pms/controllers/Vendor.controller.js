const Vendor = require("../models/Vendor.model");
const { createVendorSchema, updateVendorSchema } = require("../validator/Vendor.validator");

/**
 * @route POST /api/pms/vendor/create
 */
const createVendor = async (req, res) => {
  try {
    const { error, value } = createVendorSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const vendor = await Vendor.create(value);

    res.status(201).json({ message: "Vendor created successfully", vendor });
  } catch (error) {
    console.error("[createVendor]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/vendor/all
 */
const getAllVendors = async (req, res) => {
  try {
    const { category, status } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (status)   filter.status   = status;

    const vendors = await Vendor.find(filter).sort({ name: 1 });

    res.status(200).json({ count: vendors.length, vendors });
  } catch (error) {
    console.error("[getAllVendors]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/vendor/:id
 */
const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.status(200).json({ vendor });
  } catch (error) {
    console.error("[getVendorById]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/vendor/update/:id
 */
const updateVendor = async (req, res) => {
  try {
    const { error, value } = updateVendorSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );

    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    res.status(200).json({ message: "Vendor updated successfully", vendor });
  } catch (error) {
    console.error("[updateVendor]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/vendor/delete/:id
 */
const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.status(200).json({ message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("[deleteVendor]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createVendor, getAllVendors, getVendorById, updateVendor, deleteVendor };
