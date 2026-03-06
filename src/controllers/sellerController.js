const Seller = require("../models/seller");
const SellerPayment = require("../models/sellerPayment");

// ──────────────────────────────────────────────
//  GET /api/seller/list/:vendorId
//  Get all sellers for a vendor
// ──────────────────────────────────────────────
exports.getSellers = async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Vendors can only see their own sellers
        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const sellers = await Seller.find({ vendorId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: sellers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  GET /api/seller/:sellerId
//  Get a single seller
// ──────────────────────────────────────────────
exports.getSellerById = async (req, res) => {
    try {
        const seller = await Seller.findById(req.params.sellerId);
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });

        // Vendors can only see their own sellers
        if (req.user.role === "vendor" && req.user.id.toString() !== seller.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        res.status(200).json({ success: true, data: seller });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  POST /api/seller/add
//  Create a new seller
// ──────────────────────────────────────────────
exports.createSeller = async (req, res) => {
    try {
        const { vendorId, name, contact, email, state, city, address } = req.body;

        if (!vendorId || !name || !contact) {
            return res.status(400).json({ success: false, message: "vendorId, name, and contact are required" });
        }

        // Vendors can only create sellers for themselves
        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const seller = new Seller({ vendorId, name, contact, email, state, city, address });
        await seller.save();

        res.status(201).json({ success: true, message: "Seller added successfully", data: seller });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  PUT /api/seller/update/:sellerId
//  Update seller details
// ──────────────────────────────────────────────
exports.updateSeller = async (req, res) => {
    try {
        const seller = await Seller.findById(req.params.sellerId);
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== seller.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const allowedFields = ["name", "contact", "email", "state", "city", "address", "status"];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) seller[field] = req.body[field];
        });

        await seller.save();
        res.status(200).json({ success: true, message: "Seller updated successfully", data: seller });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  DELETE /api/seller/delete/:sellerId
//  Delete a seller
// ──────────────────────────────────────────────
exports.deleteSeller = async (req, res) => {
    try {
        const seller = await Seller.findById(req.params.sellerId);
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== seller.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        await Seller.findByIdAndDelete(req.params.sellerId);
        // Also delete all payments for this seller
        await SellerPayment.deleteMany({ sellerId: req.params.sellerId });

        res.status(200).json({ success: true, message: "Seller deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  PATCH /api/seller/status/:sellerId
//  Toggle seller login status
// ──────────────────────────────────────────────
exports.toggleSellerStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be 'active' or 'inactive'" });
        }

        const seller = await Seller.findById(req.params.sellerId);
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== seller.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        seller.status = status;
        await seller.save();

        res.status(200).json({ success: true, message: `Seller ${status === "active" ? "enabled" : "disabled"} successfully`, data: seller });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  POST /api/seller/payment/add
//  Record a payout to a seller
// ──────────────────────────────────────────────
exports.addSellerPayment = async (req, res) => {
    try {
        const { vendorId, sellerId, productId, date, amount, method, type, note, reference } = req.body;

        if (!vendorId || !sellerId || !date || !amount) {
            return res.status(400).json({ success: false, message: "vendorId, sellerId, date, and amount are required" });
        }

        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        // Verify seller belongs to this vendor
        const seller = await Seller.findById(sellerId);
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });
        if (seller.vendorId.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Seller does not belong to this vendor" });
        }

        const payment = new SellerPayment({
            vendorId, sellerId, productId: productId || null,
            date, amount, method, type, note, reference,
        });
        await payment.save();

        res.status(201).json({ success: true, message: "Payment recorded successfully", data: payment });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  GET /api/seller/payment/list/:sellerId
//  Get all payments for a seller
// ──────────────────────────────────────────────
exports.getSellerPayments = async (req, res) => {
    try {
        const payments = await SellerPayment.find({ sellerId: req.params.sellerId }).sort({ date: -1 });
        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
