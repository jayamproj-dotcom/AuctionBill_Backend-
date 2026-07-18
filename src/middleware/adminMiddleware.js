const jwt = require("jsonwebtoken");
const Session = require("../models/session");
const Admin = require("../models/admin");
const MainVendor = require("../models/main-vendor");
const Vendor = require("../models/vendor");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ status: false, message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Check if sub-admin is active and not deleted
    if (decoded.role === "sub-admin") {
      const admin = await Admin.findById(decoded.id);
      if (!admin) {
        return res.status(401).json({
          status: false,
          message: "User account has been deleted. Please contact admin.",
          accountDeleted: true,
        });
      }
      if (admin.status !== "Active") {
        return res.status(403).json({
          status: false,
          message: "User account is inactive. Please contact admin.",
          accountInactive: true,
        });
      }
    }

    // Check if main-vendor is active and not expired
    if (decoded.role === "main-vendor") {
      const mainVendor = await MainVendor.findById(decoded.id);
      if (!mainVendor) {
        return res.status(404).json({
          status: false,
          message: "User account has been deleted. Please contact admin.",
          accountDeleted: true,
        });
      }
      if (mainVendor.status !== "Active") {
        return res.status(403).json({
          status: false,
          message: "User account is inactive. Please contact support.",
          accountInactive: true,
        });
      }
      if (
        mainVendor.planEndDate &&
        new Date() > new Date(mainVendor.planEndDate)
      ) {
        const originalUrl = req.originalUrl;
        const isAllowed =
          originalUrl.includes("/api/subscription") ||
          originalUrl.match(/\/api\/main-vendor\/?(?:\?.*)?$/) ||
          originalUrl.match(/\/api\/main-vendor\/[^/]+\/purchases(?:\?.*)?$/) ||
          originalUrl.match(/\/api\/main-vendor\/[^/]+\/?(?:\?.*)?$/) ||
          originalUrl.includes("/api/main-vendor/profile") ||
          originalUrl.includes("/api/main-vendor/logout") ||
          originalUrl.includes("/api/session/logout") ||
          originalUrl.includes("/api/session/heartbeat");

        if (!isAllowed) {
          return res.status(403).json({
            status: false,
            message:
              "Your subscription plan has expired. Please renew to continue.",
            planExpired: true,
          });
        }
      }
    }

    // Check if vendor (branch) is active
    if (decoded.role === "vendor") {
      const vendor = await Vendor.findById(decoded.id);
      if (!vendor) {
        return res.status(404).json({
          status: false,
          message: "Branch not found",
          accountDeleted: true,
        });
      }
      if (vendor.status !== "Active") {
        return res.status(403).json({
          status: false,
          message: "Branch account disabled",
          accountInactive: true,
        });
      }

      const mainVendor = await MainVendor.findById(vendor.mainVendorId);
      if (!mainVendor) {
        return res.status(403).json({
          status: false,
          message: "Main vendor account deleted",
          mainVendorAccountDeleted: true,
        });
      }
      if (mainVendor.status !== "Active") {
        return res.status(403).json({
          status: false,
          message: "Main vendor account inactive",
          mainVendorAccountInactive: true,
        });
      }

      if (
        mainVendor.planEndDate &&
        new Date() > new Date(mainVendor.planEndDate)
      ) {
        if (decoded.sessionId) {
          await Session.updateOne(
            { sessionId: decoded.sessionId, isActive: true },
            { isActive: false },
          );
        }
        return res.status(403).json({
          status: false,
          message: "Main vendor subscription expired",
          planExpired: true,
        });
      }
    }

    // Session validation
    if (decoded.sessionId) {
      const session = await Session.findOne({ sessionId: decoded.sessionId });

      if (!session || !session.isActive) {
        return res.status(401).json({
          status: false,
          message: "Session expired or invalidated. Please login again.",
          sessionExpired: true,
        });
      }

      // Check inactivity (5 minutes)
      const now = new Date();
      const lastActive = new Date(session.lastActivity);
      const diffMinutes = (now - lastActive) / (1000 * 60);

      if (diffMinutes > 5) {
        session.isActive = false;
        await session.save();
        return res.status(401).json({
          message: "Session timed out due to inactivity. Please login again.",
          sessionExpired: true,
        });
      }
    }

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
