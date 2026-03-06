const AuctionProduct = require("../models/auctionProduct");
const Buyer = require("../models/buyer");
const Transaction = require("../models/transaction");
const BuyerPayment = require("../models/buyerPayment");

// ── AUCTION PRODUCTS ──────────────────────────────────────────────────

// Get auction products by vendor and date
exports.getAuctionProducts = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { date } = req.query; // Expecting YYYY-MM-DD

        const query = { vendorId };
        if (date) query.date = date;

        const products = await AuctionProduct.find(query).sort({ createdAt: -1 });
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
        const { buyerId, date } = req.query;

        const query = { vendorId };
        if (buyerId) query.buyerId = buyerId;
        if (date) query.date = date;

        const transactions = await Transaction.find(query).sort({ date: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: transactions });
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
