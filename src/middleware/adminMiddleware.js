const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");
const MainVendor = require("../models/main-vendor");
const Vendor = require("../models/vendor");

const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes

module.exports = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];
  
  // If no token in headers, check body (useful for navigator.sendBeacon or fetch keepalive)
  if (!token && req.body && req.body.token) {
    token = req.body.token;
    console.log("Token received from body for browser-close");
  }

  if (!token) {
    console.log("No token found in request headers or body");
    return res.status(401).json({ message: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id, role, sessionId } = decoded;

    let userModel;
    if (role === "admin" || role === "sub-admin") {
      userModel = Admin;
    } else if (role === "main-vendor") {
      userModel = MainVendor;
    } else if (role === "vendor") {
      userModel = Vendor;
    } else {
      return res.status(401).json({ message: "Invalid role" });
    }

    const user = await userModel.findById(id);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Single session check
    if (user.sessionId !== sessionId) {
      return res.status(401).json({
        message: "Session expired or logged in elsewhere",
        sessionError: true,
      });
    }

    // Inactivity check
    const now = new Date();
    if (user.lastActive && now - new Date(user.lastActive) > INACTIVITY_LIMIT) {
      user.sessionId = null;
      await user.save();

      return res.status(401).json({
        message: "Session expired due to inactivity",
        sessionError: true,
      });
    }

    // Update last active (only if it's been more than 30 seconds to reduce DB writes)
    if (!user.lastActive || now - new Date(user.lastActive) > 30 * 1000) {
      user.lastActive = now;
      await user.save();
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    res.status(401).json({ message: "Invalid token" });
  }
};
