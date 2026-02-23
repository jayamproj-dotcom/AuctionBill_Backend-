const Subscription = require("../models/subscriptions");

exports.createSubscription = async (req, res) => {
    try {
        const data = { ...req.body, createdBy: req.user?.id, updatedBy: req.user?.id };
        const subscription = await Subscription.create(data);
        res.status(201).json({ status: true, message: "Subscription created successfully", subscription });
    } catch (error) {
        console.error("Create subscription error:", error);
        res.status(500).json({ status: false, message: error.message || "Internal server error" });
    }
};

exports.getAllSubscriptions = async (req, res) => {
    try {
        const subscriptions = await Subscription.find();
        res.status(200).json({ status: true, subscriptions });
    } catch (error) {
        console.error("Get all subscriptions error:", error);
        res.status(500).json({ status: false, message: error.message || "Internal server error" });
    }
};

exports.getSubscriptionById = async (req, res) => {
    try {
        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) return res.status(404).json({ status: false, message: "Subscription not found" });
        res.status(200).json({ status: true, subscription });
    } catch (error) {
        console.error("Get subscription by ID error:", error);
        res.status(500).json({ status: false, message: error.message || "Internal server error" });
    }
};

exports.updateSubscription = async (req, res) => {
    try {
        const data = { ...req.body, updatedBy: req.user?.id };
        const subscription = await Subscription.findByIdAndUpdate(req.params.id, data, { returnDocument: 'after' });
        if (!subscription) return res.status(404).json({ status: false, message: "Subscription not found" });
        res.status(200).json({ status: true, message: "Subscription updated successfully", subscription });
    } catch (error) {
        console.error("Update subscription error:", error);
        res.status(500).json({ status: false, message: error.message || "Internal server error" });
    }
};

exports.deleteSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findByIdAndDelete(req.params.id);
        if (!subscription) return res.status(404).json({ status: false, message: "Subscription not found" });

        res.status(200).json({ status: true, message: "Subscription deleted successfully", subscription });
    } catch (error) {
        console.error("Delete subscription error:", error);
        res.status(500).json({ status: false, message: error.message || "Internal server error" });
    }
};
