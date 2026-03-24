const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    advanceAmount: { type: Number, default: 0 },
    customCommission: { type: Boolean, default: false },
    commissionPercent: { type: Number, default: 0 },
    commissionStartDate: { type: Date, default: null },
    commissionEndDate: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Seller", sellerSchema);
