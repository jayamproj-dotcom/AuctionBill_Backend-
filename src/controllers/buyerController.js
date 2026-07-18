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
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Vendor ID" });
    }

    const oid = new mongoose.Types.ObjectId(vendorId);
    const buyers = await Buyer.find({ vendorId: oid }).sort({ name: 1 });

    // Augment with summary stats
    const enrichedBuyers = await Promise.all(
      buyers.map(async (b) => {
        const bid = b._id;

        // Transactions (Purchases by this buyer)
        const txns = await Transaction.find({ buyerId: bid });
        const totalPurchases = txns.reduce(
          (sum, t) => sum + (Number(t.finalAmount) || 0),
          0,
        );

        // Payments (Money received from this buyer)
        const pmts = await BuyerPayment.find({ buyerId: bid });
        const totalPaid = pmts.reduce(
          (sum, p) => sum + (Number(p.amount) || 0),
          0,
        );

        return {
          ...b.toObject(),
          id: bid.toString(),
          totalPurchases,
          totalPaid,
          balance: totalPurchases - totalPaid,
        };
      }),
    );

    res.status(200).json({ success: true, data: enrichedBuyers });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid Buyer ID" });
    }
    const bid = new mongoose.Types.ObjectId(buyerId);

    const buyer = await Buyer.findById(bid);
    if (!buyer)
      return res
        .status(404)
        .json({ success: false, message: "Buyer not found" });

    if (
      req.user.role === "vendor" &&
      req.user.id.toString() !== buyer.vendorId.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    // 1. Fetch related data
    const [transactions, payments] = await Promise.all([
      Transaction.find({ buyerId: bid })
        .sort({ date: 1 })
        .populate("productId", "name image date variants"),
      BuyerPayment.find({ buyerId: bid }).sort({ date: 1 }),
    ]);

    // 2. Build Ledger Entries
    const ledger = [];
    transactions.forEach((t) => {
      ledger.push({
        date: t.date,
        createdAt: t.createdAt,
        description: `${t.productId?.name || "Unknown Product"} ${t.quantity || 0} * ${t.rate || 0}`,
        debit: Number(t.finalAmount) || 0,
        credit: 0,
        type: "purchase",
        id: t._id,
      });
    });

    payments.forEach((p) => {
      ledger.push({
        date: p.date,
        createdAt: p.createdAt,
        description: p.note || "Payment Received",
        debit: 0,
        credit: Number(p.amount) || 0,
        type: "payment",
        id: p._id,
      });
    });

    // Sort by date then createdAt (actual time) ascending for running balance
    ledger.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // Compute running balance
    let runBalance = 0;
    const processedLedger = ledger.map((entry) => {
      runBalance += Number(entry.debit) - Number(entry.credit);
      return { ...entry, balance: runBalance };
    });

    // Keep chronological order (first in first)

    // 3. Enrich Products with stats
    const pIds = [
      ...new Set(
        transactions
          .map((t) => t.productId?._id?.toString() || t.productId?.toString())
          .filter((id) => id),
      ),
    ];
    const products = await AuctionProduct.find({ _id: { $in: pIds } });

    const enrichedProducts = products.map((p) => {
      const pid = p._id.toString();
      const pTxns = transactions.filter(
        (t) =>
          (t.productId?._id?.toString() || t.productId?.toString()) === pid,
      );

      const variantsWithStats = (p.variants || []).map((v) => {
        const vid = v._id?.toString();
        const vTxns = pTxns.filter(
          (t) => t.variantId && t.variantId.toString() === vid,
        );

        const vAmount = vTxns.reduce((s, t) => s + (Number(t.finalAmount) || 0), 0);
        return {
          ...v.toObject(),
          id: vid,
          purchaseQuantity: vTxns.reduce(
            (s, t) => s + (Number(t.quantity) || 0),
            0,
          ),
          stats: {
            amount: vAmount,
            paid: 0,
            balance: vAmount,
          },
        };
      });

      const totalGross = pTxns.reduce(
        (s, t) => s + (Number(t.finalAmount) || 0),
        0,
      );

      return {
        ...p.toObject(),
        id: pid,
        variants: variantsWithStats,
        totalGross,
        totalPaid: 0,
        totalBalance: totalGross,
      };
    });

    // Sum of all payments (they are general payments)
    const totalPayments = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    let remainingPaidPool = totalPayments;

    // Sort products by date oldest first to apply payment pool
    enrichedProducts.sort((a, b) => new Date(a.date) - new Date(b.date));

    const finalProducts = enrichedProducts.map((p) => {
      let pBal = p.totalGross;
      if (pBal > 0 && remainingPaidPool > 0) {
        const deduction = Math.min(pBal, remainingPaidPool);
        p.totalPaid = deduction;
        p.totalBalance = p.totalGross - deduction;

        // Distribute deduction to variants
        let remDed = deduction;
        p.variants = p.variants.map((v) => {
          const vAmount = v.stats.amount;
          const vDed = Math.min(vAmount, remDed);
          remDed -= vDed;
          return {
            ...v,
            stats: {
              ...v.stats,
              paid: vDed,
              balance: vAmount - vDed,
            },
          };
        });

        remainingPaidPool -= deduction;
      }
      return p;
    });
    // Sort back to newest first
    finalProducts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 4. Totals
    const totalPurchases = transactions.reduce(
      (sum, t) => sum + (Number(t.finalAmount) || 0),
      0,
    );
    const totalPaidGlobal = payments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0,
    );

    res.status(200).json({
      success: true,
      data: {
        buyer: {
          ...buyer.toObject(),
          id: buyer._id.toString(),
          totalPurchases,
          totalPaid: totalPaidGlobal,
          balance: totalPurchases - totalPaidGlobal,
          advanceAmount: remainingPaidPool, // Show remaining advance after balancing
        },
        products: finalProducts,
        transactions,
        payments,
        ledger: processedLedger,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// ──────────────────────────────────────────────
//  GET /api/buyer/:buyerId
//  Get a single buyer
// ──────────────────────────────────────────────
exports.getBuyerById = async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.buyerId);
    if (!buyer)
      return res
        .status(404)
        .json({ success: false, message: "Buyer not found" });

    if (
      req.user.role === "vendor" &&
      req.user.id.toString() !== buyer.vendorId.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    res.status(200).json({ success: true, data: buyer });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
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
      return res.status(400).json({
        success: false,
        message: "vendorId, name, and contact are required",
      });
    }

    if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    const buyer = new Buyer({
      vendorId,
      name,
      contact,
      email,
      state,
      city,
      address,
    });
    await buyer.save();
    res.status(201).json({
      success: true,
      message: "Buyer added successfully",
      data: buyer,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// ──────────────────────────────────────────────
//  PUT /api/buyer/update/:id
//  Update buyer details
// ──────────────────────────────────────────────
exports.updateBuyer = async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer)
      return res
        .status(404)
        .json({ success: false, message: "Buyer not found" });

    if (
      req.user.role === "vendor" &&
      req.user.id.toString() !== buyer.vendorId.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    const allowedFields = [
      "name",
      "contact",
      "email",
      "state",
      "city",
      "address",
      "status",
      "password",
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) buyer[field] = req.body[field];
    });

    await buyer.save();
    res.status(200).json({
      success: true,
      message: "Buyer updated successfully",
      data: buyer,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// ──────────────────────────────────────────────
//  DELETE /api/buyer/delete/:id
//  Delete a buyer (cascades payments)
// ──────────────────────────────────────────────
exports.deleteBuyer = async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer)
      return res
        .status(404)
        .json({ success: false, message: "Buyer not found" });

    if (
      req.user.role === "vendor" &&
      req.user.id.toString() !== buyer.vendorId.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    await Buyer.findByIdAndDelete(req.params.id);
    // Cascade delete all payments for this buyer
    await BuyerPayment.deleteMany({ buyerId: req.params.id });

    res
      .status(200)
      .json({ success: true, message: "Buyer deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
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
      return res.status(400).json({
        success: false,
        message: "Status must be 'active' or 'inactive'",
      });
    }

    const buyer = await Buyer.findById(req.params.id);
    if (!buyer)
      return res
        .status(404)
        .json({ success: false, message: "Buyer not found" });

    if (
      req.user.role === "vendor" &&
      req.user.id.toString() !== buyer.vendorId.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    buyer.status = status;
    await buyer.save();

    res.status(200).json({
      success: true,
      message: `Buyer ${status === "active" ? "enabled" : "disabled"} successfully`,
      data: buyer,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// ──────────────────────────────────────────────
//  POST /api/buyer/payments/add
//  Record a payment received from buyer
// ──────────────────────────────────────────────
exports.addBuyerPayment = async (req, res) => {
  try {
    const {
      vendorId,
      buyerId,
      transactionId,
      date,
      amount,
      method,
      note,
      reference,
    } = req.body;

    if (!vendorId || !buyerId || !date || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "vendorId, buyerId, date, and amount are required",
      });
    }

    if (req.user.role === "vendor" && req.user.id.toString() !== vendorId) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    // Verify buyer belongs to this vendor
    const buyer = await Buyer.findById(buyerId);
    if (!buyer)
      return res
        .status(404)
        .json({ success: false, message: "Buyer not found" });
    if (buyer.vendorId.toString() !== vendorId) {
      return res.status(403).json({
        success: false,
        message: "Buyer does not belong to this vendor",
      });
    }

    const payAmount = Number(amount);

    const payment = new BuyerPayment({
      vendorId,
      buyerId,
      productId: null, // Always general payment/advance
      date,
      amount: payAmount,
      method,
      note: note || "Payment Received",
      reference: reference || `PAY-${Date.now()}`,
    });

    await payment.save();

    // Update buyer's advanceAmount
    buyer.advanceAmount = (Number(buyer.advanceAmount) || 0) + payAmount;
    await buyer.save();

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: payment,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
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
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    const query = { vendorId };
    if (buyerId) query.buyerId = buyerId;

    const payments = await BuyerPayment.find(query).sort({
      date: -1,
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};
