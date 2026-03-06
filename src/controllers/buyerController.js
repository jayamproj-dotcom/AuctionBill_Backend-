const Buyer = require("../models/buyer");
const BuyerPayment = require("../models/buyerPayment");

// ──────────────────────────────────────────────
//  GET /api/buyer/list/:vendorId
//  Get all buyers for a vendor
// ──────────────────────────────────────────────
exports.getBuyers = async (req, res) => {
    try {
        const { vendorId } = req.params;

        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const buyers = await Buyer.find({ vendorId }).sort({ name: 1 });
        res.status(200).json({ success: true, data: buyers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  GET /api/buyer/:buyerId
//  Get a single buyer
// ──────────────────────────────────────────────
exports.getBuyerById = async (req, res) => {
    try {
        const buyer = await Buyer.findById(req.params.buyerId);
        if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== buyer.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        res.status(200).json({ success: true, data: buyer });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  POST /api/buyer/add
//  Add a new buyer
// ──────────────────────────────────────────────
exports.addBuyer = async (req, res) => {
    try {
        const { vendorId, name, contact, email, state, city, address } = req.body;

        if (!vendorId || !name || !contact) {
            return res.status(400).json({ success: false, message: "vendorId, name, and contact are required" });
        }

        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const buyer = new Buyer({ vendorId, name, contact, email, state, city, address });
        await buyer.save();
        res.status(201).json({ success: true, message: "Buyer added successfully", data: buyer });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  PUT /api/buyer/update/:id
//  Update buyer details
// ──────────────────────────────────────────────
exports.updateBuyer = async (req, res) => {
    try {
        const buyer = await Buyer.findById(req.params.id);
        if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== buyer.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const allowedFields = ["name", "contact", "email", "state", "city", "address", "status", "password"];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) buyer[field] = req.body[field];
        });

        await buyer.save();
        res.status(200).json({ success: true, message: "Buyer updated successfully", data: buyer });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  DELETE /api/buyer/delete/:id
//  Delete a buyer (cascades payments)
// ──────────────────────────────────────────────
exports.deleteBuyer = async (req, res) => {
    try {
        const buyer = await Buyer.findById(req.params.id);
        if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== buyer.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        await Buyer.findByIdAndDelete(req.params.id);
        // Cascade delete all payments for this buyer
        await BuyerPayment.deleteMany({ buyerId: req.params.id });

        res.status(200).json({ success: true, message: "Buyer deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  PATCH /api/buyer/status/:id
//  Toggle buyer login status
// ──────────────────────────────────────────────
exports.toggleBuyerStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be 'active' or 'inactive'" });
        }

        const buyer = await Buyer.findById(req.params.id);
        if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== buyer.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        buyer.status = status;
        await buyer.save();

        res.status(200).json({
            success: true,
            message: `Buyer ${status === "active" ? "enabled" : "disabled"} successfully`,
            data: buyer,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  POST /api/buyer/payments/add
//  Record a payment received from buyer
// ──────────────────────────────────────────────
exports.addBuyerPayment = async (req, res) => {
    try {
        const { vendorId, buyerId, transactionId, date, amount, method, note, reference } = req.body;

        if (!vendorId || !buyerId || !date || amount === undefined) {
            return res.status(400).json({ success: false, message: "vendorId, buyerId, date, and amount are required" });
        }

        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        // Verify buyer belongs to this vendor
        const buyer = await Buyer.findById(buyerId);
        if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });
        if (buyer.vendorId.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Buyer does not belong to this vendor" });
        }

        const payment = new BuyerPayment({
            vendorId,
            buyerId,
            transactionId: transactionId || null,
            date,
            amount,
            method,
            note,
            reference,
        });
        await payment.save();

        res.status(201).json({ success: true, message: "Payment recorded successfully", data: payment });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  GET /api/buyer/payments/list/:vendorId
//  Get payments - all for vendor OR filter by buyerId
// ──────────────────────────────────────────────
exports.getBuyerPayments = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { buyerId } = req.query;

        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const query = { vendorId };
        if (buyerId) query.buyerId = buyerId;

        const payments = await BuyerPayment.find(query).sort({ date: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
