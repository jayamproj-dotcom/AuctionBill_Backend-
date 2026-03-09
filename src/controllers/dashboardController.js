const mongoose = require("mongoose");
const Seller = require("../models/seller");
const Buyer = require("../models/buyer");
const Transaction = require("../models/transaction");
const BuyerPayment = require("../models/buyerPayment");
const SellerPayment = require("../models/sellerPayment");

exports.getDashboardData = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { startDate, endDate, date } = req.query;

        if (!mongoose.Types.ObjectId.isValid(vendorId)) {
            return res.status(400).json({ success: false, message: "Invalid Vendor ID" });
        }

        const vId = new mongoose.Types.ObjectId(vendorId);

        // Date filter for transactions and payments
        let dateQuery = { vendorId: vId };
        if (date) {
            dateQuery.date = date;
        } else if (startDate || endDate) {
            dateQuery.date = {};
            if (startDate) dateQuery.date.$gte = startDate;
            if (endDate) dateQuery.date.$lte = endDate;
        }

        // Today's date string format typically YYYY-MM-DD for comparing todayAuctions
        const todayStr = new Date().toISOString().split("T")[0];

        const [
            totalSellers,
            totalBuyers,
            transactions,
            todayTransactionsCount,
            buyerPayments,
            sellerPayments
        ] = await Promise.all([
            // Total sellers for the vendor (unfiltered by date)
            Seller.countDocuments({ vendorId: vId }),
            // Total buyers for the vendor (unfiltered by date)
            Buyer.countDocuments({ vendorId: vId }),
            // Fetch ALL matching transactions to calculate sales, comm, and qty
            Transaction.find(dateQuery).populate("productId", "name").populate("sellerId", "name").populate("buyerId", "name").sort({ date: -1, createdAt: -1 }),
            // Count today's auctions specifically
            Transaction.countDocuments({ vendorId: vId, date: { $regex: `^${todayStr}` } }),
            // Fetch matching buyer payments (Pay In)
            BuyerPayment.find(dateQuery),
            // Fetch matching seller payments (Pay Out)
            SellerPayment.find(dateQuery)
        ]);

        // Calculations
        let totalSales = 0;
        let totalCommission = 0;
        let totalQty = 0;

        transactions.forEach(t => {
            totalSales += (t.finalAmount || 0);
            totalCommission += (t.commissionAmount || 0);
            totalQty += (t.quantity || 0);
        });

        const totalPayIn = buyerPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const totalPayOut = sellerPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        // Format transactions for frontend display (only top 5)
        const recentTransactions = transactions.slice(0, 5).map(t => ({
            _id: t._id,
            date: t.date,
            productId: t.productId?._id,
            productName: t.productId?.name || "Unknown Product",
            sellerId: t.sellerId?._id,
            sellerName: t.sellerId?.name || "Unknown Seller",
            buyerId: t.buyerId?._id,
            buyerName: t.buyerId?.name || t.buyerName || "Unknown Buyer",
            quantity: t.quantity,
            finalAmount: t.finalAmount,
            commissionAmount: t.commissionAmount
        }));

        res.status(200).json({
            success: true,
            data: {
                totalSellers,
                totalBuyers,
                totalSales,
                totalCommission,
                totalQty,
                todayAuctions: todayTransactionsCount,
                totalPayIn,
                totalPayOut,
                recentTransactions
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
