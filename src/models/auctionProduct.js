const mongoose = require("mongoose");

const auctionProductSchema = new mongoose.Schema(
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
        name: { type: String, required: true },
        date: { type: String, required: true }, // Store as YYYY-MM-DD
        status: {
            type: String,
            enum: ["available", "soldout"],
            default: "available",
        },
        isActive: { type: Boolean, default: true },
        commissionPercent: { type: Number, default: 0 },
        image: { type: String, default: "" },
        variants: [
            {
                variety: { type: String },
                quality: { type: String },
                quantity: { type: Number },
                sellQuantity: { type: Number, default: 0 },
                unit: { type: String },
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("AuctionProduct", auctionProductSchema);
