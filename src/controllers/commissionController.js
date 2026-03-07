const Commission = require("../models/commission");
const Transaction = require("../models/transaction");
const mongoose = require("mongoose");

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

// Get all commission records (transactions) for a vendor with filtering and stats
exports.getCommissionRecords = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { searchTerm, dateFilter, customDate } = req.query;

        if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        let query = { vendorId: new mongoose.Types.ObjectId(vendorId) };

        // Date Filtering Logic
        if (dateFilter && dateFilter !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let start, end;
            const nextDay = (d) => {
                const nd = new Date(d);
                nd.setDate(nd.getDate() + 1);
                return nd;
            };

            switch (dateFilter) {
                case 'today':
                    start = today;
                    end = nextDay(today);
                    break;
                case 'yesterday':
                    start = new Date(today);
                    start.setDate(start.getDate() - 1);
                    end = today;
                    break;
                case 'week':
                    start = new Date(today);
                    start.setDate(start.getDate() - 7);
                    end = nextDay(today);
                    break;
                case 'month':
                    start = new Date(today.getFullYear(), today.getMonth(), 1);
                    end = nextDay(today);
                    break;
                case 'year':
                    start = new Date(today.getFullYear(), 0, 1);
                    end = nextDay(today);
                    break;
                case 'custom':
                    if (customDate) {
                        start = new Date(customDate);
                        start.setHours(0, 0, 0, 0);
                        end = nextDay(start);
                    }
                    break;
            }

            if (start && end) {
                // Convert to YYYY-MM-DD for string comparison if date is stored as string
                // My Transaction model uses date: { type: String, required: true } // YYYY-MM-DD
                const formatDate = (d) => d.toISOString().split('T')[0];
                query.date = { 
                    $gte: formatDate(start), 
                    $lt: formatDate(end) 
                };
            }
        }

        const transactions = await Transaction.find(query)
            .populate("sellerId", "name")
            .populate("productId", "name")
            .sort({ date: -1, createdAt: -1 });

        // Aggregate by Product
        const productMap = {};
        
        transactions.forEach(t => {
            const pid = t.productId?._id?.toString() || "unknown";
            if (!productMap[pid]) {
                productMap[pid] = {
                    id: pid,
                    productId: t.productId?._id,
                    productName: t.productId?.name || 'Unknown Product',
                    sellerName: t.sellerId?.name || 'Unknown Seller',
                    totalSales: 0,
                    totalCommission: 0,
                    count: 0,
                    commissionPercent: t.commissionPercent || 0,
                    latestDate: t.date
                };
            }
            productMap[pid].totalSales += (t.finalAmount || 0);
            productMap[pid].totalCommission += (t.commissionAmount || 0);
            productMap[pid].count += 1;
        });

        let enriched = Object.values(productMap);

        // Search Filter (on aggregated data)
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            enriched = enriched.filter(c =>
                c.productName.toLowerCase().includes(term) ||
                c.sellerName.toLowerCase().includes(term)
            );
        }

        // Summary Statistics
        const stats = {
            totalCommission: enriched.reduce((s, c) => s + c.totalCommission, 0),
            totalSales: enriched.reduce((s, c) => s + c.totalSales, 0),
            count: enriched.length,
            totalTransactions: enriched.reduce((s, c) => s + c.count, 0)
        };

        res.status(200).json({ 
            success: true, 
            data: enriched,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
