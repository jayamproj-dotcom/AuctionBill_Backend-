const mongoose = require("mongoose");

const userSubscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    priceAtPurchase: { type: Number, required: true },
    featuresAtPurchase: { 
        type: mongoose.Schema.Types.Mixed, 
        required: true 
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model("UserSubscription", userSubscriptionSchema);
