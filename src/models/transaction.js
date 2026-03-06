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
        
        variantId: { type: String, required: true }, // Sub-doc ID of variants array
        date: { type: String, required: true }, // Store as YYYY-MM-DD
        quantity: { type: Number, required: true },
   
        finalAmount: { type: Number, required: true },
     

      
        paymentStatus: {
            type: String,
            enum: ["Paid", "Part Paid", "Pending"],
            default: "Pending",
        },
       
    },
    { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
