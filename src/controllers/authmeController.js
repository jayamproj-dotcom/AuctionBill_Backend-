const Admin = require("../models/admin");

exports.getMe = async (req, res) => {
  try {
    // req.user is set by adminMiddleware (contains decoded id and role)
    const admin = await Admin.findById(req.user.id).select("-password");

    if (!admin) {
      return res.status(401).json({
        status: false,
        message: "Account not found or deleted.",
        accountDeleted: true,
      });
    }

    if (admin.role === "sub-admin" && admin.status !== "Active") {
      return res.status(403).json({
        status: false,
        message: "User account is inactive. Please contact admin.",
        accountInactive: true,
      });
    }

    res.status(200).json({
      status: true,
      data: admin,
    });
  } catch (error) {
    console.error("AuthMe error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
