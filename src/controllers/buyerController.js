const mongoose = require("mongoose");
const Buyer = require("../models/buyer");
const BuyerPayment = require("../models/buyerPayment");
const Transaction = require("../models/transaction");
const AuctionProduct = require("../models/auctionProduct");

// ──────────────────────────────────────────────
//  GET /api/buyer/list/:vendorId
//  Get all buyers for a vendor with account stats
// ──────────────────────────────────────────────
exports.getBuyers = async (req, res) => {
    try {
        const { vendorId } = req.params;

        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        if (!mongoose.Types.ObjectId.isValid(vendorId)) {
            return res.status(400).json({ success: false, message: "Invalid Vendor ID" });
        }

        const oid = new mongoose.Types.ObjectId(vendorId);
        const buyers = await Buyer.find({ vendorId: oid }).sort({ name: 1 });

        // Augment with summary stats
        const enrichedBuyers = await Promise.all(buyers.map(async (b) => {
            const bid = b._id;
            
            // Transactions (Purchases by this buyer)
            const txns = await Transaction.find({ buyerId: bid });
            const totalPurchases = txns.reduce((sum, t) => sum + (Number(t.finalAmount) || 0), 0);

            // Payments (Money received from this buyer)
            const pmts = await BuyerPayment.find({ buyerId: bid });
            const totalPaid = pmts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            return {
                ...b.toObject(),
                id: bid.toString(),
                totalPurchases,
                totalPaid,
                balance: totalPurchases - totalPaid
            };
        }));

        res.status(200).json({ success: true, data: enrichedBuyers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  GET /api/buyer/summary/:buyerId
//  Get comprehensive summary for a single buyer
// ──────────────────────────────────────────────
exports.getBuyerSummary = async (req, res) => {
    try {
        const { buyerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(buyerId)) {
            return res.status(400).json({ success: false, message: "Invalid Buyer ID" });
        }
        const bid = new mongoose.Types.ObjectId(buyerId);

        const buyer = await Buyer.findById(bid);
        if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== buyer.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        // 1. Fetch related data
        const [transactions, payments] = await Promise.all([
            Transaction.find({ buyerId: bid }).sort({ date: 1 }).populate("productId", "name image date variants"),
            BuyerPayment.find({ buyerId: bid }).sort({ date: 1 })
        ]);

        // 2. Build Ledger Entries
        const ledger = [];
        transactions.forEach(t => {
            ledger.push({
                date: t.date,
                description: `Purchase - ${t.productId?.name || "Unknown Product"}`,
                debit: Number(t.finalAmount) || 0,
                credit: 0,
                type: 'purchase',
                id: t._id
            });
        });

        payments.forEach(p => {
            ledger.push({
                date: p.date,
                description: p.note || 'Payment Received',
                debit: 0,
                credit: Number(p.amount) || 0,
                type: 'payment',
                id: p._id
            });
        });

        // Sort by date
        ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Compute running balance
        let runBalance = 0;
        const processedLedger = ledger.map(entry => {
            runBalance += Number(entry.debit) - Number(entry.credit);
            return { ...entry, balance: runBalance };
        });

        // 3. Totals
        const totalPurchases = transactions.reduce((sum, t) => sum + (Number(t.finalAmount) || 0), 0);
        const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        res.status(200).json({
            success: true,
            data: {
                buyer: {
                    ...buyer.toObject(),
                    id: buyer._id.toString(),
                    totalPurchases,
                    totalPaid,
                    balance: totalPurchases - totalPaid
                },
                transactions,
                payments,
                ledger: processedLedger.reverse() // Newest first for UI
            }
        });

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
