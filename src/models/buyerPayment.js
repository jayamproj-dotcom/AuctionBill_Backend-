const mongoose = require("mongoose");

const buyerPaymentSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true,
        },
        buyerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Buyer",
            required: true,
        },
        date: { type: String, required: true }, // Store as YYYY-MM-DD
        amount: { type: Number, required: true, min: 0 },
        method: {
            type: String,
            enum: ["Cash", "Gpay", "UPI", "Check"],
            default: "Cash",
        },
        note: { type: String, default: "" },
        reference: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("BuyerPayment", buyerPaymentSchema);
