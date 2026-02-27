 const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    vendorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Vendor", 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ["asset_upgrade", "plan_upgrade", "new_registration", "other"],
        default: "other"
    },
    isRead: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
