const Notification = require("../models/notification");

exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ isRead: false })
            .populate("vendorId", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({ status: true, notifications });
    } catch (error) {
        console.error("Get notifications error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });

        if (!notification) {
            return res.status(404).json({ status: false, message: "Notification not found" });
        }

        res.status(200).json({ status: true, message: "Notification marked as read" });
    } catch (error) {
        console.error("Mark as read error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

exports.createUpgradeRequest = async (req, res) => {
    try {
        const { type, message } = req.body;
        const vendorId = req.user.id; // Assuming vendor is logged in

        const newNotification = new Notification({
            vendorId,
            title: `Upgrade Request: ${type === 'asset_upgrade' ? 'Asset' : 'Plan'}`,
            message,
            type
        });

        await newNotification.save();
        res.status(201).json({ status: true, message: "Upgrade request sent successfully" });
    } catch (error) {
        console.error("Create upgrade request error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};
