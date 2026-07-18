const Notification = require("../models/notification");
const Vendor = require("../models/vendor");

exports.getNotifications = async (req, res) => {
  try {
    let notifications = await Notification.find({
      isRead: false,
      recipient: "admin",
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    // ensure senderName is filled so front-end can display easily
    notifications = notifications.map((n) => {
      const obj = n.toObject();
      if (!obj.senderName || obj.senderName === "") {
        obj.senderName = obj.userId?.name || "Unknown Vendor";
      }
      return obj;
    });

    res.status(200).json({ status: true, notifications });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getVendorNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role; // Assuming role is provided in token: 'vendor' or 'main-vendor'

    const MainVendor = require("../models/main-vendor");
    let user = await Vendor.findById(userId);
    if (!user) {
      user = await MainVendor.findById(userId);
    }

    if (user && user.planEndDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expiryDate = new Date(user.planEndDate);
      expiryDate.setHours(0, 0, 0, 0);

      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const recipient = userRole === "main-vendor" ? "main-vendor" : "vendor";
      const userModel = userRole === "main-vendor" ? "MainVendor" : "Vendor";

      // User requested: before two days for plane end only
      if (diffDays === 2) {
        const title = "Subscription Expiry Reminder";
        const message = `Your active plan will expire in 2 days (on ${expiryDate.toLocaleDateString()}). Please renew or upgrade to avoid account suspension.`;

        const existingWarning = await Notification.findOne({
          userId,
          recipient,
          type: "subscription_alert",
          title: title,
        });

        if (!existingWarning) {
          await new Notification({
            userId,
            userModel,
            senderName: user.name || "",
            title,
            message,
            recipient,
            type: "subscription_alert",
          }).save();

          // Send Email
          const sendEmail = require("../utils/sendEmail");
          const emailContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2>Subscription Expiry Reminder</h2>
              <p>Hello ${user.name},</p>
              <p>This is a reminder that your current subscription plan is set to expire in <strong>2 days</strong>.</p>
              <p><strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString()}</p>
              <p>Please log in to your dashboard to renew or upgrade your plan to ensure uninterrupted service.</p>
              <br/>
              <p>Regards,<br/>Auction Billing Team</p>
            </div>
          `;
          await sendEmail(
            user.email,
            "Subscription Expiry Reminder",
            emailContent,
          );
        }
      } else if (diffDays <= 0) {
        const title = "Subscription Expired";
        const existingExpired = await Notification.findOne({
          userId,
          recipient,
          type: "subscription_alert",
          title: title,
        });

        if (!existingExpired) {
          await new Notification({
            userId,
            userModel,
            senderName: user.name || "",
            title,
            message:
              "Your subscription has ended. Please renew immediately to continue using the services.",
            recipient,
            type: "subscription_alert",
          }).save();

          // Optional: Send expiry email too
          const sendEmail = require("../utils/sendEmail");
          await sendEmail(
            user.email,
            "Subscription Expired",
            `Your subscription has expired. Please renew to continue.`,
          );
        }
      } else if (diffDays > 2) {
        // Clear any subscription alerts if the plan has been renewed or is far from expiry
        await Notification.deleteMany({
          userId,
          recipient,
          type: "subscription_alert",
          title: { $ne: "Subscription Expired" }, // Don't delete expired notifications
        });
      }
    }

    const notifications = await Notification.find({
      userId,
      recipient: userRole === "main-vendor" ? "main-vendor" : "vendor",
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
    const userId = req.user.id;
    const userRole = req.user.role;
    const userModel = userRole === "main-vendor" ? "MainVendor" : "Vendor";

    const newNotification = new Notification({
      userId,
      userModel,
      senderName: (req.user && req.user.name) || "",
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
