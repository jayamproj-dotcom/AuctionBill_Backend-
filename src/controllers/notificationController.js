const Notification = require("../models/notification");
const Vendor = require("../models/vendor");

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      isRead: false,
      recipient: "admin",
    })
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

      // User requested: before two days for plane end only
      if (diffDays === 2) {
        const title = "Subscription Expiry Reminder";
        const message = `Your active plan will expire in 2 days (on ${expiryDate.toLocaleDateString()}). Please renew or upgrade to avoid account suspension.`;

        const existingWarning = await Notification.findOne({
          vendorId,
          recipient: "vendor",
          type: "subscription_alert",
          title: title,
        });

        if (!existingWarning) {
          await new Notification({
            vendorId,
            title,
            message,
            recipient: "vendor",
            type: "subscription_alert",
          }).save();

          // Send Email to Vendor
          const sendEmail = require("../utils/sendEmail");
          const emailContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2>Subscription Expiry Reminder</h2>
              <p>Hello ${vendor.name},</p>
              <p>This is a reminder that your current subscription plan is set to expire in <strong>2 days</strong>.</p>
              <p><strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString()}</p>
              <p>Please log in to your dashboard to renew or upgrade your plan to ensure uninterrupted service.</p>
              <br/>
              <p>Regards,<br/>Auction Billing Team</p>
            </div>
          `;
          await sendEmail(
            vendor.email,
            "Subscription Expiry Reminder",
            emailContent,
          );
        }
      } else if (diffDays <= 0) {
        const title = "Subscription Expired";
        const existingExpired = await Notification.findOne({
          vendorId,
          recipient: "vendor",
          type: "subscription_alert",
          title: title,
        });

        if (!existingExpired) {
          await new Notification({
            vendorId,
            title,
            message:
              "Your subscription has ended. Please renew immediately to continue using the services.",
            recipient: "vendor",
            type: "subscription_alert",
          }).save();

          // Optional: Send expiry email too
          const sendEmail = require("../utils/sendEmail");
          await sendEmail(
            vendor.email,
            "Subscription Expired",
            `Your subscription has expired. Please renew to continue.`,
          );
        }
      } else if (diffDays > 2) {
        // Clear any subscription alerts if the plan has been renewed or is far from expiry
        await Notification.deleteMany({
          vendorId,
          recipient: "vendor",
          type: "subscription_alert",
          title: { $ne: "Subscription Expired" }, // Don't delete expired notifications
        });
      }
    }

    const notifications = await Notification.find({
      vendorId,
      recipient: "vendor",
      isRead: false,
    }).sort({ createdAt: -1 });

    res.status(200).json({ status: true, notifications });
  } catch (error) {
    console.error("Get vendor notifications error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { returnDocument: "after" },
    );

    if (!notification) {
      return res
        .status(404)
        .json({ status: false, message: "Notification not found" });
    }

    res
      .status(200)
      .json({ status: true, message: "Notification marked as read" });
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
      title: `Upgrade Request: ${type === "asset_upgrade" ? "Asset" : "Plan"}`,
      message,
      type,
      recipient: "admin",
    });

    await newNotification.save();
    res
      .status(201)
      .json({ status: true, message: "Upgrade request sent successfully" });
  } catch (error) {
    console.error("Create upgrade request error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
