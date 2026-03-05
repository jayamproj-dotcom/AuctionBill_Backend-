const Commission = require("../models/commission");

// Get all vendor commissions
exports.getAllCommissions = async (req, res) => {
    try {
        const commissions = await Commission.find().populate("vendorId", "name email");
        res.status(200).json({ success: true, data: commissions });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Get commission for a specific vendor
exports.getVendorCommission = async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Authorization check: vendors can only see their own commission
        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const commission = await Commission.findOne({ vendorId });
        res.status(200).json({ success: true, data: commission ? commission.value : 0 });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Update or create commission for a vendor
exports.updateVendorCommission = async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Authorization check: vendors can only update their own commission
        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const { value } = req.body;

        if (value === undefined || value === null) {
            return res.status(400).json({ success: false, message: "Commission value is required" });
        }
        
        let commission = await Commission.findOne({ vendorId });
        if (commission) {
            commission.value = value;
            await commission.save();
        } else {
            commission = new Commission({ vendorId, value });
            await commission.save();
        }
        res.status(200).json({ success: true, message: "Commission updated successfully", data: commission.value });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Delete/Reset commission for a vendor
exports.deleteCommission = async (req, res) => {
    try {
        const { vendorId } = req.params;
        await Commission.findOneAndDelete({ vendorId });
        res.status(200).json({ success: true, message: "Commission deleted/reset successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
