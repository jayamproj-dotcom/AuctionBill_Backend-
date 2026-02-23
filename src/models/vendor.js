const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    status: { type: String, enum: ["Active", "Inactive", "Pending"], default: "Active" },
    joinedDate: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    totalAuctions: { type: Number, default: 0 },
    revenue: { type: String, default: "0" }
}, { timestamps: true });

module.exports = mongoose.model("Vendor", vendorSchema);
