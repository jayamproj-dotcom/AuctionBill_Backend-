const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    profilePic: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    requestedPlan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    upgradeType: { type: String, enum: ['from_today', 'after_current'] },
    status: { type: String, enum: ["Active", "Inactive", "Pending"], default: "Active" },
    joinedDate: { type: Date, default: Date.now },
    planEndDate: { type: Date },
    totalAuctions: { type: Number, default: 0 },
    revenue: { type: String, default: "0" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    // isDeleted: { type: Boolean, default: false },
    // deletedAt: { type: Date },
    otp: { type: String },
    otpExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Vendor", vendorSchema);
