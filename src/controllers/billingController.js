const Seller = require("../models/seller");
const Buyer = require("../models/buyer");
const Transaction = require("../models/transaction");
const SellerPayment = require("../models/sellerPayment");
const BuyerPayment = require("../models/buyerPayment");
const Vendor = require("../models/vendor");
const mongoose = require("mongoose");

// Get data for billing export
exports.getBillingData = async (req, res) => {
  try {
    const { type, subType, id, startDate, endDate, vendorId } = req.query;

    if (!vendorId) {
      return res
        .status(400)
        .json({ success: false, message: "Vendor ID is required" });
    }

    // Authorization check
    if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    const vendor = await Vendor.findById(vendorId).select("-password");
    if (!vendor) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    }

    let data = {};
    let query = { vendorId: new mongoose.Types.ObjectId(vendorId) };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    switch (type) {
      case "seller":
        if (!id)
          return res
            .status(400)
            .json({ success: false, message: "Seller ID is required" });
        const seller = await Seller.findById(id);
        if (!seller)
          return res
            .status(404)
            .json({ success: false, message: "Seller not found" });

        data.seller = seller;
        if (subType === "selling_product") {
          data.records = await Transaction.find({
            sellerId: id,
            ...(query.date ? { date: query.date } : {}),
          }).populate("productId", "name variants");
          data.totalValue = data.records.reduce(
            (sum, r) => sum + (Number(r.finalAmount) || 0),
            0,
          );
          data.totalLabel = "TOTAL";
        } else {
          // Payments History (Ledger)
          const payments = await SellerPayment.find({
            sellerId: id,
            ...(query.date ? { date: query.date } : {}),
          }).sort({ date: 1 });

          const txns = await Transaction.find({
            sellerId: id,
            ...(query.date ? { date: query.date } : {}),
          })
            .populate("productId", "name")
            .sort({ date: 1 });

          const ledger = [];
          txns.forEach((t) => {
            ledger.push({
              date: t.date,
              description: `Sale - ${t.productId?.name || "Product"}`,
              credit: Number(t.netAmount) || 0,
              debit: 0,
            });
          });

          payments.forEach((p) => {
            ledger.push({
              date: p.date ? p.date.toISOString().split("T")[0] : "",
              description: p.note || `Payment (${p.method})`,
              credit: 0,
              debit: Number(p.amount) || 0,
            });
          });

          ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

          let balance = 0;
          data.records = ledger.map((rec) => {
            balance += rec.credit - rec.debit;
            return { ...rec, balance };
          });
          data.totalValue = balance;
          data.totalLabel = "CLOSING BALANCE";
        }
        break;

      case "buyer":
        if (!id)
          return res
            .status(400)
            .json({ success: false, message: "Buyer ID is required" });
        const buyer = await Buyer.findById(id);
        if (!buyer)
          return res
            .status(404)
            .json({ success: false, message: "Buyer not found" });

        data.buyer = buyer;
        if (subType === "purchase_history") {
          data.records = await Transaction.find({
            buyerId: id,
            ...(query.date ? { date: query.date } : {}),
          }).populate("productId", "name variants");
          data.totalValue = data.records.reduce(
            (sum, r) => sum + (Number(r.finalAmount) || 0),
            0,
          );
          data.totalLabel = "TOTAL";
        } else {
          // Payments History (Ledger)
          const txns = await Transaction.find({
            buyerId: id,
            ...(query.date ? { date: query.date } : {}),
          })
            .populate("productId", "name")
            .sort({ date: 1 });

          const payments = await BuyerPayment.find({
            buyerId: id,
            ...(query.date ? { date: query.date } : {}),
          }).sort({ date: 1 });

          const ledger = [];
          txns.forEach((t) => {
            ledger.push({
              date: t.date,
              description: `Purchase - ${t.productId?.name || "Product"}`,
              debit: Number(t.finalAmount) || 0,
              credit: 0,
            });
          });

          payments.forEach((p) => {
            ledger.push({
              date: p.date ? p.date.toISOString().split("T")[0] : "",
              description: p.note || `Payment Received (${p.method})`,
              debit: 0,
              credit: Number(p.amount) || 0,
            });
          });

          ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

          let balance = 0;
          data.records = ledger.map((rec) => {
            balance += rec.debit - rec.credit;
            return { ...rec, balance };
          });
          data.totalValue = balance;
          data.totalLabel = "CLOSING BALANCE";
        }
        break;

      case "history":
        data.records = await Transaction.find(query)
          .populate("productId", "name variants")
          .populate("sellerId", "name")
          .populate("buyerId", "name")
          .sort({ date: -1 });
        data.totalValue = data.records.reduce(
          (sum, r) => sum + (Number(r.finalAmount) || 0),
          0,
        );
        data.totalLabel = "TOTAL";
        break;

      case "commission":
        const transactions = await Transaction.find(query)
          .populate("productId", "name variants")
          .populate("sellerId", "name")
          .sort({ date: -1 });

        data.records = transactions;
        data.totalValue = data.records.reduce(
          (sum, r) => sum + (Number(r.commissionAmount) || 0),
          0,
        );
        data.totalLabel = "TOTAL COMMISSION";
        break;

      default:
        return res
          .status(400)
          .json({ success: false, message: "Invalid export type" });
    }

    res.status(200).json({
      success: true,
      vendor,
      data,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};
