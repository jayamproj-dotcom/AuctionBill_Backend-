const mongoose = require("mongoose");

const buyerSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true,
        },
        name: { type: String, required: true, trim: true },
        contact: { type: String, trim: true, default: "" },
        address: { type: String, trim: true, default: "" },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Buyer", buyerSchema);
