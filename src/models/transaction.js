const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true,
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
        },
        buyerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Buyer",
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AuctionProduct",
            required: true,
        },
        variantId: { type: String, required: true }, // Sub-doc ID of variants array
        date: { type: String, required: true },      // YYYY-MM-DD
        quantity: { type: Number, required: true },
        rate: { type: Number, default: 0 },          // price per unit
        finalAmount: { type: Number, required: true }, // gross = rate × qty
        commissionPercent: { type: Number, default: 0 },
        commissionAmount:  { type: Number, default: 0 }, // finalAmount × commissionPercent/100
        netAmount: { type: Number, default: 0 },          // finalAmount - commissionAmount
    },
    { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
