const mongoose = require("mongoose");

const sellerPaymentSchema = new mongoose.Schema(
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
        productId: {
            type: String,   // local product id (localStorage-based product)
            default: null,
        },
        date: { type: Date, required: true },
        amount: { type: Number, required: true, min: 0 },
        method: {
            type: String,
            enum: ["Cash", "Gpay", "UPI", "Check"],
            default: "Cash",
        },
        type: { type: String, default: "Payment" },  // 'Sale' | 'Payment'
        note: { type: String, default: "" },
        reference: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("SellerPayment", sellerPaymentSchema);
