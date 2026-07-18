const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    varieties: [{ type: String }],
    units: [{ type: String }],
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }, // Assuming products are vendor-specific
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
