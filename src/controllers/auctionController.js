const mongoose = require("mongoose");
const AuctionProduct = require("../models/auctionProduct");
const Transaction = require("../models/transaction");
const BuyerPayment = require("../models/buyerPayment");

// ── AUCTION PRODUCTS ──────────────────────────────────────────────────

// Get auction products by vendor and optional filters (date, sellerId)
exports.getAuctionProducts = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { date, sellerId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Vendor ID" });
    }

    const query = { vendorId: new mongoose.Types.ObjectId(vendorId) };
    if (date) query.date = date;
    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      query.sellerId = new mongoose.Types.ObjectId(sellerId);
    }

    const products = await AuctionProduct.find(query).sort({
      date: -1,
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Get pending auction products by vendor and date
exports.getPendingProducts = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { beforeDate } = req.query; // Expecting YYYY-MM-DD

    const query = { vendorId, isActive: true, status: { $ne: "soldout" } };
    if (beforeDate) {
      query.date = { $lt: beforeDate };
    }

    const products = await AuctionProduct.find(query).sort({
      date: -1,
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Add new auction product
exports.addAuctionProduct = async (req, res) => {
  try {
    const {
      vendorId,
      sellerId,
      name,
      date,
      commissionPercent,
      variants,
      image,
    } = req.body;

    const roundedCommissionPercent = Math.round(commissionPercent || 0);
    const roundedVariants = (variants || []).map((v) => ({
      ...v,
      quantity: Math.round(v.quantity || 0),
      sellQuantity: Math.round(v.sellQuantity || 0),
    }));

    const product = new AuctionProduct({
      vendorId,
      sellerId,
      name,
      date,
      commissionPercent: roundedCommissionPercent,
      variants: roundedVariants,
      image,
    });

    await product.save();
    res.status(201).json({
      success: true,
      message: "Auction product added successfully",
      data: product,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Update auction product
exports.updateAuctionProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.commissionPercent !== undefined) {
      body.commissionPercent = Math.round(body.commissionPercent || 0);
    }

    if (body.variants && Array.isArray(body.variants)) {
      body.variants = body.variants.map((v) => ({
        ...v,
        quantity: Math.round(v.quantity || 0),
        sellQuantity: Math.round(v.sellQuantity || 0),
      }));
    }

    const updatedProduct = await AuctionProduct.findByIdAndUpdate(id, body, {
      returnDocument: "after",
    });

    if (!updatedProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Delete auction product
exports.deleteAuctionProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await AuctionProduct.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Toggle product status (isActive)
exports.toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await AuctionProduct.findById(id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    product.isActive = !product.isActive;
    await product.save();

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// ── TRANSACTIONS ──────────────────────────────────────────────────────

// Record a sale (Transaction)
exports.recordSale = async (req, res) => {
  try {
    const {
      vendorId,
      sellerId,
      buyerId,
      buyerName,
      productId,
      variantId,
      date,
      quantity,
      rate,
      finalAmount,
      commissionPercent,
      commissionAmount,
      netAmount,
    } = req.body;

    const roundedQuantity = Math.round(quantity || 0);
    const roundedRate = Math.round(rate || 0);
    const roundedFinalAmount = Math.round(finalAmount || 0);
    const roundedCommissionPercent = Math.round(commissionPercent || 0);
    const roundedCommissionAmount = Math.round(commissionAmount || 0);
    const roundedNetAmount = Math.round(netAmount || 0);

    const transaction = new Transaction({
      vendorId,
      sellerId,
      buyerId,
      buyerName,
      productId,
      variantId,
      date,
      quantity: roundedQuantity,
      rate: roundedRate,
      finalAmount: roundedFinalAmount,
      commissionPercent: roundedCommissionPercent,
      commissionAmount: roundedCommissionAmount,
      netAmount: roundedNetAmount,
    });

    await transaction.save();

    // Update AuctionProduct sellQuantity
    const product = await AuctionProduct.findById(productId);
    if (product) {
      const vIndex = product.variants.findIndex(
        (v) => v._id.toString() === variantId,
      );
      if (vIndex !== -1) {
        product.variants[vIndex].sellQuantity += roundedQuantity;
        await product.save();
      }
    }

    res.status(201).json({
      success: true,
      message: "Sale recorded successfully",
      data: transaction,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Get transactions
exports.getTransactions = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { buyerId, sellerId, date } = req.query;

    const query = { vendorId: new mongoose.Types.ObjectId(vendorId) };
    if (buyerId && mongoose.Types.ObjectId.isValid(buyerId)) {
      query.buyerId = new mongoose.Types.ObjectId(buyerId);
    }
    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      query.sellerId = new mongoose.Types.ObjectId(sellerId);
    }
    if (date) query.date = date;

    const transactions = await Transaction.find(query).sort({
      date: -1,
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Get specialized history with specific formatting
exports.getHistory = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { date, startDate, endDate, sellerId, productId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Vendor ID" });
    }

    const query = { vendorId: new mongoose.Types.ObjectId(vendorId) };

    if (date) query.date = date;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      query.sellerId = new mongoose.Types.ObjectId(sellerId);
    }
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      query.productId = new mongoose.Types.ObjectId(productId);
    }

    const transactions = await Transaction.find(query)
      .populate("productId", "name variants")
      .populate("sellerId", "name")
      .populate("buyerId", "name")
      .sort({ date: -1, createdAt: -1 });

    let totalSalesValue = 0;
    let totalCommValue = 0;

    const formattedHistory = transactions.map((t) => {
      const product = t.productId;
      const variant = product?.variants?.find(
        (v) => String(v._id) === String(t.variantId),
      );
      const unit = variant?.unit || "";

      totalSalesValue += t.finalAmount || 0;
      totalCommValue += t.commissionAmount || 0;

      return {
        ...t.toObject(),
        // Standard lowercase keys for frontend defaults
        date: t.date,
        productName: product?.name || "Unknown Product",
        sellerName: t.sellerId?.name || "Unknown Seller",
        buyerName: t.buyerId?.name || t.buyerName || "Unknown Buyer",
        quantity: t.quantity,
        unit: unit,
        QtyType: unit,
        finalAmount: t.finalAmount,
        commissionAmount: t.commissionAmount,
        netAmount: t.netAmount,
      };
    });

    res.status(200).json({
      success: true,
      history: formattedHistory,
      stats: {
        totalTransactions: transactions.length,
        totalSales: totalSalesValue,
        totalCommission: totalCommValue,
      },
      cardStatus: {
        transactions: transactions.length,
        sales: totalSalesValue,
        commission: totalCommValue,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};
