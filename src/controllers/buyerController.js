const Buyer = require("../models/buyer");
const BuyerPayment = require("../models/buyerPayment");

// ── BUYERS ────────────────────────────────────────────────────────────

// Get all buyers for a vendor
exports.getBuyers = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const buyers = await Buyer.find({ vendorId }).sort({ name: 1 });
        res.status(200).json({ success: true, data: buyers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Add new buyer
exports.addBuyer = async (req, res) => {
    try {
        const { vendorId, name, contact, address, state, city, email, buyerType } = req.body;
        const buyer = new Buyer({ 
            vendorId, 
            name, 
            contact, 
            address, 
            state, 
            city, 
            email, 
            buyerType: buyerType || 'Retailer'
        });
        await buyer.save();
        res.status(201).json({ success: true, message: "Buyer added successfully", data: buyer });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Update buyer
exports.updateBuyer = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedBuyer = await Buyer.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedBuyer) return res.status(404).json({ success: false, message: "Buyer not found" });
        res.status(200).json({ success: true, message: "Buyer updated successfully", data: updatedBuyer });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Delete buyer
exports.deleteBuyer = async (req, res) => {
    try {
        const { id } = req.params;
        await Buyer.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Buyer deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ── PAYMENTS ──────────────────────────────────────────────────────────

// Record a payment
exports.addBuyerPayment = async (req, res) => {
    try {
        const { vendorId, buyerId, date, amount, method, note, reference } = req.body;
        const payment = new BuyerPayment({ vendorId, buyerId, date, amount, method, note, reference });
        await payment.save();
        res.status(201).json({ success: true, message: "Payment recorded successfully", data: payment });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Get payments
exports.getBuyerPayments = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { buyerId } = req.query;

        const query = { vendorId };
        if (buyerId) query.buyerId = buyerId;

        const payments = await BuyerPayment.find(query).sort({ date: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
