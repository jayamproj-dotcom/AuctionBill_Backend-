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
            return res.status(400).json({ success: false, message: "Invalid Vendor ID" });
        }

        const query = { vendorId: new mongoose.Types.ObjectId(vendorId) };
        if (date)     query.date     = date;
        if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
            query.sellerId = new mongoose.Types.ObjectId(sellerId);
        }

        const products = await AuctionProduct.find(query).sort({ date: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Add new auction product
exports.addAuctionProduct = async (req, res) => {
    try {
        const { vendorId, sellerId, name, date, commissionPercent, variants, image } = req.body;

        const product = new AuctionProduct({
            vendorId,
            sellerId,
            name,
            date,
            commissionPercent,
            variants,
            image
        });

        await product.save();
        res.status(201).json({ success: true, message: "Auction product added successfully", data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Update auction product
exports.updateAuctionProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedProduct = await AuctionProduct.findByIdAndUpdate(id, req.body, { new: true });
        
        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({ success: true, message: "Product updated successfully", data: updatedProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Delete auction product
exports.deleteAuctionProduct = async (req, res) => {
    try {
        const { id } = req.params;
        await AuctionProduct.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Toggle product status (isActive)
exports.toggleProductStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await AuctionProduct.findById(id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        product.isActive = !product.isActive;
        await product.save();

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ── TRANSACTIONS ──────────────────────────────────────────────────────

// Record a sale (Transaction)
exports.recordSale = async (req, res) => {
    try {
        const { 
            vendorId, sellerId, buyerId, productId, variantId, 
            date, quantity, rate, finalAmount, commissionPercent, 
            commissionAmount, netAmount, paymentStatus, amountPaid
        } = req.body;

        const transaction = new Transaction({
            vendorId, sellerId, buyerId, productId, variantId,
            date, quantity, rate, finalAmount, commissionPercent,
            commissionAmount, netAmount, paymentStatus, amountPaid
        });

        await transaction.save();

        // If payment was made at time of sale, record it in BuyerPayment
        let payAmount = 0;
        if (paymentStatus === 'Paid') {
            payAmount = finalAmount;
        } else if (paymentStatus === 'Part Paid') {
            payAmount = amountPaid || 0;
        }

        if (payAmount > 0) {
            const payment = new BuyerPayment({
                vendorId,
                buyerId,
                date,
                amount: payAmount,
                method: 'Cash',
                note: 'Payment at sale',
                reference: `SALE-${transaction._id}`
            });
            await payment.save();
        }

        // Update AuctionProduct sellQuantity
        const product = await AuctionProduct.findById(productId);
        if (product) {
            const vIndex = product.variants.findIndex(v => v._id.toString() === variantId);
            if (vIndex !== -1) {
                product.variants[vIndex].sellQuantity += quantity;
                await product.save();
            }
        }

        res.status(201).json({ success: true, message: "Sale recorded successfully", data: transaction });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
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

        const transactions = await Transaction.find(query).sort({ date: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};


