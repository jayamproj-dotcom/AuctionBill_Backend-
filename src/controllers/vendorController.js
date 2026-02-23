const Vendor = require("../models/vendor");
const Plan = require("../models/subscriptions");
const Admin = require("../models/admin");

exports.createVendor = async (req, res) => {
    try {
        const { name, email, phone, address, plan, status } = req.body;

        // Check if plan exists
        const planExists = await Plan.findById(plan);
        if (!planExists) {
            return res.status(400).json({ status: false, message: "Invalid subscription plan." });
        }

        // Check if vendor email already exists
        const vendorExists = await Vendor.findOne({ email });
        if (vendorExists) {
            return res.status(400).json({ status: false, message: "Vendor with this email already exists." });
        }

        const newVendor = new Vendor({
            name,
            email,
            phone,
            address,
            plan,
            status: status || "Active"
        });

        await newVendor.save();

        res.status(201).json({ status: true, message: "Vendor created successfully", vendor: newVendor });
    } catch (error) {
        console.error("Create vendor error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

exports.getVendors = async (req, res) => {
    try {
        const vendors = await Vendor.find().populate("plan", "name planId");
        res.status(200).json({ status: true, vendors });
    } catch (error) {
        console.error("Get vendors error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, address, plan, status } = req.body;

        const vendor = await Vendor.findById(id);
        if (!vendor) {
            return res.status(404).json({ status: false, message: "Vendor not found" });
        }

        if (plan) {
            const planExists = await Plan.findById(plan);
            if (!planExists) {
                return res.status(400).json({ status: false, message: "Invalid subscription plan." });
            }
            vendor.plan = plan;
        }

        if (name) vendor.name = name;
        if (email) vendor.email = email;
        if (phone) vendor.phone = phone;
        if (address) vendor.address = address;
        if (status) vendor.status = status;

        await vendor.save();
        res.status(200).json({ status: true, message: "Vendor updated successfully", vendor });
    } catch (error) {
        console.error("Update vendor error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await Vendor.findByIdAndDelete(id);

        if (!vendor) {
            return res.status(404).json({ status: false, message: "Vendor not found" });
        }

        res.status(200).json({ status: true, message: "Vendor deleted successfully" });
    } catch (error) {
        console.error("Delete vendor error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};
