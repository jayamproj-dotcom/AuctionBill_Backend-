const Notification = require("../models/notification");
const Vendor = require("../models/vendor");

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

exports.getVendorNotifications = async (req, res) => {
    try {
        const vendorId = req.user.id;

        const vendor = await Vendor.findById(vendorId);

        if (vendor && vendor.planEndDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expiryDate = new Date(vendor.planEndDate);
            expiryDate.setHours(0, 0, 0, 0);

            const diffTime = expiryDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 5 && diffDays > 0) {
                const title = `Subscription Ends in ${diffDays} Day${diffDays > 1 ? 's' : ''}`;

                const existingWarning = await Notification.findOne({
                    vendorId,
                    type: "subscription_alert",
                    title: title
                });

                if (!existingWarning) {
                    await new Notification({
                        vendorId,
                        title,
                        message: `Your active plan will expire in ${diffDays} day${diffDays > 1 ? 's' : ''}. Please renew to avoid account suspension.`,
                        type: "subscription_alert"
                    }).save();
                }
            } else if (diffDays <= 0) {
                const title = 'Subscription Expired';
                const existingExpired = await Notification.findOne({
                    vendorId,
                    type: "subscription_alert",
                    title: title
                });

                if (!existingExpired) {
                    await new Notification({
                        vendorId,
                        title,
                        message: 'Your subscription has ended. Please renew immediately to continue using the services.',
                        type: "subscription_alert"
                    }).save();
                }
            } else {
                // Clear any subscription alerts if the plan has been renewed (diffDays > 5)
                await Notification.deleteMany({
                    vendorId,
                    type: "subscription_alert"
                });
            }
        }

        const notifications = await Notification.find({ vendorId, isRead: false })
            .sort({ createdAt: -1 });

        res.status(200).json({ status: true, notifications });
    } catch (error) {
        console.error("Get vendor notifications error:", error);
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
