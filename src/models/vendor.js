const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    branchId: { type: String },
    mainVendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainVendor",
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    joinedDate: { type: Date, default: Date.now },
    planEndDate: { type: Date },
    totalAuctions: { type: Number, default: 0 },
    revenue: { type: String, default: "0" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    // isDeleted: { type: Boolean, default: false },
    // deletedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Vendor", vendorSchema);
