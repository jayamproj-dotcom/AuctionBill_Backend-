const Seller = require("../models/seller");
const SellerPayment = require("../models/sellerPayment");
const AuctionProduct = require("../models/auctionProduct");
const Transaction = require("../models/transaction");
const mongoose = require("mongoose");

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

        if (!mongoose.Types.ObjectId.isValid(vendorId)) {
            return res.status(400).json({ success: false, message: "Invalid Vendor ID" });
        }

        const oid = new mongoose.Types.ObjectId(vendorId);
        const sellers = await Seller.find({ vendorId: oid }).sort({ createdAt: -1 });

        // Augment each seller with summary stats
        const enrichedSellers = await Promise.all(sellers.map(async (s) => {
            const sid = s._id;
            
            // Transactions (Sales)
            const txns = await Transaction.find({ sellerId: sid });
            const totalNetSales = txns.reduce((sum, t) => sum + (Number(t.netAmount) || 0), 0);
            const totalGrossSales = txns.reduce((sum, t) => sum + (Number(t.finalAmount) || 0), 0);

            // Payments (Payouts)
            const pmts = await SellerPayment.find({ sellerId: sid });
            const totalPaid = pmts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            return {
                ...s.toObject(),
                id: sid.toString(),
                totalSales: totalNetSales,
                totalGrossSales,
                totalPaid,
                balance: totalNetSales - totalPaid
            };
        }));


        res.status(200).json({ success: true, data: enrichedSellers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ──────────────────────────────────────────────
//  GET /api/seller/summary/:sellerId
//  Get a comprehensive summary for a single seller
// ──────────────────────────────────────────────
exports.getSellerSummary = async (req, res) => {
    try {
        const { sellerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(sellerId)) {
            return res.status(400).json({ success: false, message: "Invalid Seller ID" });
        }
        const sid = new mongoose.Types.ObjectId(sellerId);

        const seller = await Seller.findById(sid);
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });

        if (req.user.role === "vendor" && req.user.id.toString() !== seller.vendorId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        // 1. Fetch related data
        const [products, payments, transactions] = await Promise.all([
            AuctionProduct.find({ sellerId: sid }).sort({ date: -1 }),
            SellerPayment.find({ sellerId: sid }).sort({ date: 1 }),
            Transaction.find({ sellerId: sid }).sort({ date: 1 }).populate("productId", "name")
        ]);

        // 2. Build Ledger Entries
        const ledger = [];
        transactions.forEach(t => {
            ledger.push({
                date: t.date,
                description: `Sale recorded - ${t.productId?.name || "Unknown Product"}`,
                credit: Number(t.netAmount) || 0,
                debit: 0,
                type: 'sale',
                id: t._id
            });
        });
        payments.forEach(p => {
            ledger.push({
                date: p.date,
                description: p.note || 'Payment',
                credit: 0,
                debit: Number(p.amount) || 0,
                type: 'payment',
                id: p._id
            });
        });

        // Sort by date then type (sales before payments if same date)
        ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Compute running balance
        let balance = 0;
        const processedLedger = ledger.map(entry => {
            balance += Number(entry.credit) - Number(entry.debit);
            return { ...entry, balance };
        });

        // 3. Enrich Products with stats (including variants)
        const enrichedProducts = products.map(p => {
            const pid = p._id.toString();
            // Filter transactions for this product (handle populated or unpopulated productId)
            const pTxns = transactions.filter(t => {
                const targetId = t.productId?._id?.toString() || t.productId?.toString();
                return targetId === pid;
            });
            const pPmts = payments.filter(pm => pm.productId && pm.productId.toString() === pid);

            // Calculate variant-level stats
            const variantsWithStats = (p.variants || []).map(v => {
                const vid = v._id?.toString();
                const vTxns = pTxns.filter(t => t.variantId && t.variantId.toString() === vid);
                
                return {
                    ...v.toObject(),
                    id: vid,
                    sellQuantity: vTxns.reduce((s, t) => s + (Number(t.quantity) || 0), 0),
                    stats: {
                        price:      vTxns.reduce((s, t) => s + (Number(t.finalAmount)      || 0), 0),
                        commission: vTxns.reduce((s, t) => s + (Number(t.commissionAmount)  || 0), 0),
                        net:        vTxns.reduce((s, t) => s + (Number(t.netAmount)         || 0), 0),
                    }
                };
            });

            const totalNet = pTxns.reduce((s, t) => s + (Number(t.netAmount) || 0), 0);
            const totalCommission = pTxns.reduce((s, t) => s + (Number(t.commissionAmount) || 0), 0);
            const totalPaid = pPmts.reduce((s, pm) => s + (Number(pm.amount) || 0), 0);

            return {
                ...p.toObject(),
                id: pid,
                variants: variantsWithStats,
                totalNet,
                totalCommission,
                totalPaid,
                totalBalance: totalNet - totalPaid // Changed to more descriptive key
            };
        });

        // 4. Totals
        const totalNetSales = transactions.reduce((s, t) => s + (Number(t.netAmount) || 0), 0);
        const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

        res.status(200).json({
            success: true,
            data: {
                seller: {
                    ...seller.toObject(),
                    id: seller._id.toString(),
                    totalSales: totalNetSales,
                    totalPaid,
                    balance: totalNetSales - totalPaid
                },
                products: enrichedProducts,
                payments,
                transactions,
                ledger: processedLedger
            }
        });

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
