const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "userModel",
    },
    userModel: {
      type: String,
      enum: ["Vendor", "MainVendor", "Admin"],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "asset_upgrade",
        "plan_upgrade",
        "new_registration",
        "subscription_alert",
        "system",
        "other",
      ],
      default: "other",
    },
    recipient: {
      type: String,
      enum: ["admin", "vendor", "main-vendor"],
      default: "admin",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
