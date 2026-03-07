const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, default: "admin" },
  status: { type: String, default: "Active" },
  permissions: {
    vendorAdd: { type: Boolean, default: false },
    subscriptionAccess: { type: Boolean, default: false },
    passwordChange: { type: Boolean, default: false }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  // isDeleted: { type: Boolean, default: false },
  // deletedAt: { type: Date }
  otp: { type: String },
  otpExpires: { type: Date }
}, { timestamps: true });


module.exports = mongoose.model("Admin", adminSchema);