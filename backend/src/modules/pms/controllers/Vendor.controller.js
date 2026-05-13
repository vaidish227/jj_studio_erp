const Vendor = require("../models/Vendor.model");

/**
 * @desc Create a new Vendor (External Agency)
 * @route POST /api/pms/vendor/create
 */
const createVendor = async (req, res) => {
  try {
    const { name, category, contactPerson, phone, email, address, notes } = req.body;

    const vendor = await Vendor.create({
      name,
      category,
      contactPerson,
      phone,
      email,
      address,
      notes
    });

    res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      vendor
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all Vendors with optional category filtering
 * @route GET /api/pms/vendor/all
 */
const getAllVendors = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};

    const vendors = await Vendor.find(filter).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: vendors.length,
      vendors
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get Vendor by ID
 */
const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.status(200).json({ success: true, vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Vendor details
 */
const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      vendor
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Delete Vendor
 */
const deleteVendor = async (req, res) => {
  try {
    await Vendor.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Vendor deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor
};
