const Admin = require("../models/admin");

module.exports = async (req, res, next) => {
    try {
        const admin = await Admin.findById(req.user.id);
        if (!admin) {
            return res.status(401).json({ message: "User not found" });
        }

        if (admin.role === "admin") {
            return next();
        }

        if (admin.role === "sub-admin" && admin.permissions && admin.permissions.subscriptionAccess) {
            return next();
        }

        return res.status(403).json({ message: "Access denied: Missing subscription access permissions" });
    } catch (error) {
        console.error("Subscription access middleware error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
