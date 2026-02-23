const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    status: { type: String, enum: ["Active", "Inactive", "Pending"], default: "Active" },
    joinedDate: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    totalAuctions: { type: Number, default: 0 },
    revenue: { type: String, default: "0" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Vendor", vendorSchema);
