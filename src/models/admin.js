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
  }
}, { timestamps: true });

module.exports = mongoose.model("Admin", adminSchema);