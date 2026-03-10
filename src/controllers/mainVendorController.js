const MainVendor = require("../models/main-vendor");
const Plan = require("../models/subscriptions");
const bcrypt = require("bcryptjs");
const UserSubscription = require("../models/userSubscription");
const ExcelJS = require("exceljs");
const Notification = require("../models/notification");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

exports.getMainVendors = async (req, res) => {
  try {
    const mainVendors = await MainVendor.find()
      .populate("plan", "name planId price durationType durationValue")
      .populate("requestedPlan", "name planId price");

    const mainVendorIds = mainVendors.map((v) => v._id);

    const activeSubscriptions = await UserSubscription.find({
      userId: { $in: mainVendorIds },
      endDate: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    const mainVendorsWithSub = mainVendors.map((vendor) => {
      const sub = activeSubscriptions.find(
        (s) => s.userId.toString() === vendor._id.toString(),
      );
      return {
        ...vendor.toObject(),
        activeSubscription: sub || null,
      };
    });

    res.status(200).json({ status: true, mainVendors: mainVendorsWithSub });
  } catch (error) {
    console.error("Get main vendors error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.createMainVendor = async (req, res) => {
  try {
    let { name, email, phone, address, city, state, plan, status } = req.body;

    const planExists = await Plan.findById(plan);
    if (!planExists) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid subscription plan." });
    }

    const emailExists = await MainVendor.findOne({ email });
    if (emailExists) {
      return res
        .status(400)
        .json({ status: false, message: "Email is already in use" });
    }

    const plainPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    let planEndDate = new Date();
    if (planExists.durationType === "year") {
      planEndDate.setFullYear(
        planEndDate.getFullYear() + (planExists.durationValue || 1),
      );
    } else {
      planEndDate = addDays(planEndDate, 30 * (planExists.durationValue || 1));
    }

    const newMainVendor = new MainVendor({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      city,
      state,
      plan,
      planEndDate,
      status: status || "Active",
      joinedDate: new Date(),
    });

    await newMainVendor.save();

    await UserSubscription.create({
      userId: newMainVendor._id,
      subscriptionId: planExists._id,
      priceAtPurchase: planExists.price,
      featuresAtPurchase: planExists.features || {},
      startDate: new Date(),
      endDate: planEndDate,
    });

    // Send Email
    try {
      const emailContent = `<h1>Welcome ${name}</h1><p>Your Main Vendor account has been created.</p><p>Email: ${email}</p><p>Password: ${plainPassword}</p>`;
      await sendEmail(email, "Main Vendor Account Created", emailContent);
    } catch (e) {
      console.error("Email error:", e);
    }

    res.status(201).json({ status: true, message: "Main Vendor created" });
  } catch (error) {
    console.error("Create main vendor error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.updateMainVendor = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = req.body;

    // Remove protected fields
    delete updateData.password;
    delete updateData.role;

    // Safe handle for ObjectId fields (avoid empty string errors)
    if (
      updateData.requestedPlan === "" ||
      updateData.requestedPlan === "null"
    ) {
      updateData.requestedPlan = null;
    }
    if (updateData.plan === "" || updateData.plan === "null") {
      delete updateData.plan;
    }

    // Capture the vendor before update to check for plan changes
    const vendorBeforeUpdate = await MainVendor.findById(id);
    if (!vendorBeforeUpdate) {
      return res
        .status(404)
        .json({ status: false, message: "Main vendor not found" });
    }

    // Process plan upgrade approval if requested
    if (
      updateData.plan &&
      updateData.plan.toString() !== vendorBeforeUpdate.plan?.toString()
    ) {
      const newPlan = await Plan.findById(updateData.plan);
      if (newPlan) {
        // Recalculate planEndDate
        let planEndDate = new Date();
        if (
          vendorBeforeUpdate.upgradeType === "after_current" &&
          vendorBeforeUpdate.planEndDate > new Date()
        ) {
          planEndDate = new Date(vendorBeforeUpdate.planEndDate);
        }

        if (newPlan.durationType === "year") {
          planEndDate.setFullYear(
            planEndDate.getFullYear() + (newPlan.durationValue || 1),
          );
        } else {
          planEndDate.setDate(
            planEndDate.getDate() + 30 * (newPlan.durationValue || 1),
          );
        }

        updateData.planEndDate = planEndDate;

        // Create new UserSubscription record
        await UserSubscription.create({
          userId: id,
          subscriptionId: newPlan._id,
          priceAtPurchase: newPlan.price,
          featuresAtPurchase: newPlan.features || {},
          startDate: new Date(),
          endDate: planEndDate,
        });
      }
    }

    const updatedVendor = await MainVendor.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.status(200).json({
      status: true,
      message: "Main vendor updated",
      mainVendor: updatedVendor,
    });
  } catch (error) {
    console.error("Update main vendor error:", error);
    res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.deleteMainVendor = async (req, res) => {
  try {
    const { id } = req.params;
    await MainVendor.findByIdAndDelete(id);
    res.status(200).json({ status: true, message: "Main vendor deleted" });
  } catch (error) {
    console.error("Delete main vendor error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.exportMainVendors = async (req, res) => {
  try {
    const mainVendors = await MainVendor.find().populate("plan");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Main Vendors");

    worksheet.columns = [
      { header: "Name", key: "name", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Plan", key: "plan", width: 15 },
      { header: "Status", key: "status", width: 10 },
    ];

    mainVendors.forEach((v) => {
      worksheet.addRow({
        name: v.name,
        email: v.email,
        phone: v.phone,
        plan: v.plan?.name || "N/A",
        status: v.status,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=main_vendors.xlsx",
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getMainVendorPurchases = async (req, res) => {
  try {
    const mainVendors = await MainVendor.find().select("_id");
    const mainVendorIds = mainVendors.map((v) => v._id);

    const purchases = await UserSubscription.find({
      userId: { $in: mainVendorIds },
    })
      .populate({
        path: "userId",
        model: "MainVendor",
        select: "name status",
      })
      .populate("subscriptionId", "name")
      .sort({ createdAt: -1 });

    const formattedPurchases = purchases.map((sub) => {
      const currentDate = new Date();
      const isExpired = new Date(sub.endDate) < currentDate;
      const currentSubStatus = isExpired
        ? "Expired"
        : sub.userId?.status || "Active";

      return {
        id: sub._id,
        mainVendorId: sub.userId?._id,
        mainVendorName: sub.userId?.name || "Unknown Main Vendor",
        plan: sub.subscriptionId?.name || "Unknown Plan",
        price: sub.priceAtPurchase || 0,
        status: currentSubStatus,
        paymentStatus: "Paid",
        startDate: sub.startDate,
        expiryDate: sub.endDate,
        transactionId: `TXN_${sub._id.toString().slice(-6).toUpperCase()}`,
      };
    });

    res.status(200).json({ status: true, purchases: formattedPurchases });
  } catch (error) {
    console.error("Get all purchases error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getMainVendorPurchasesById = async (req, res) => {
  try {
    const { id } = req.params;
    const purchases = await UserSubscription.find({ userId: id })
      .populate("subscriptionId", "name")
      .sort({ createdAt: -1 });

    const formattedPurchases = purchases.map((sub) => {
      return {
        id: sub._id,
        plan: sub.subscriptionId?.name || "Unknown Plan",
        amount: sub.priceAtPurchase || 0,
        status: "Paid", // Assuming all entries in UserSubscription are paid
        date: sub.startDate,
        expiryDate: sub.endDate,
        description: `${sub.subscriptionId?.name || "Subscription"} Plan`,
      };
    });

    res.status(200).json({ status: true, purchases: formattedPurchases });
  } catch (error) {
    console.error("Get vendor purchases error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

// --- AUTH METHODS ---

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const mainVendor = await MainVendor.findOne({ email }).populate("plan");
    if (!mainVendor) {
      return res.status(404).json({
        status: false,
        message: "Account not found. Please create an account.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, mainVendor.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid email or password" });
    }

    if (mainVendor.status !== "Active") {
      return res.status(403).json({
        status: false,
        message: "Your account is not active. Please contact support.",
      });
    }

    if (
      mainVendor.planEndDate &&
      new Date() > new Date(mainVendor.planEndDate)
    ) {
      return res.status(403).json({
        status: false,
        message:
          "Your subscription plan has expired. Please renew to continue.",
      });
    }

    const token = jwt.sign(
      { id: mainVendor._id, role: "main-vendor" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    const vendorData = mainVendor.toObject();
    delete vendorData.password;
    delete vendorData.otp;
    delete vendorData.otpExpires;

    const activeSubscription = await UserSubscription.findOne({
      userId: mainVendor._id,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).sort({ startDate: -1 });

    res.status(200).json({
      status: true,
      message: "Login successful",
      token,
      user: {
        ...vendorData,
        role: "main-vendor",
        activeSubscription,
      },
    });
  } catch (error) {
    console.error("Main Vendor login error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password, phone, address, city, state, plan } =
      req.body;

    if (!plan) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid subscription plan." });
    }

    const planExists = await Plan.findById(plan);
    if (!planExists) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid subscription plan." });
    }

    const emailExists = await MainVendor.findOne({ email });
    if (emailExists) {
      return res
        .status(400)
        .json({ status: false, message: "Email is already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newMainVendor = new MainVendor({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      city,
      state,
      plan,
      status: "Pending",
    });

    await newMainVendor.save();

    // Notify Admin
    try {
      await Notification.create({
        userId: newMainVendor._id,
        userModel: "MainVendor",
        title: "New Main Vendor Signup Request",
        message: `New Main Vendor ${name} (${email}) has requested access.`,
        type: "new_registration",
        recipient: "admin",
      });
    } catch (e) {
      console.error("Notification error:", e);
    }

    res.status(201).json({
      status: true,
      message: "Registration request submitted. Please wait for admin review.",
    });
  } catch (error) {
    console.error("Main Vendor signup error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const vendor = await MainVendor.findOne({ email });

    if (!vendor) {
      return res
        .status(404)
        .json({ status: false, message: "Vendor not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    vendor.otp = otp;
    vendor.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await vendor.save();

    await sendEmail(
      email,
      "Password Reset OTP",
      `Your OTP for password reset is ${otp}. Valid for 10 minutes.`,
    );

    res.status(200).json({ status: true, message: "OTP sent to email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const vendor = await MainVendor.findOne({
      email,
      otp,
      otpExpires: { $gt: Date.now() },
    });

    if (!vendor) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid or expired OTP" });
    }

    vendor.password = await bcrypt.hash(newPassword, 10);
    vendor.otp = undefined;
    vendor.otpExpires = undefined;
    await vendor.save();

    res
      .status(200)
      .json({ status: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getMainVendorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await MainVendor.findById(id).populate("plan");
    if (!vendor) {
      return res
        .status(404)
        .json({ status: false, message: "Vendor not found" });
    }

    const vendorData = vendor.toObject();
    delete vendorData.password;

    res.status(200).json({ status: true, vendor: vendorData });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const vendor = await MainVendor.findById(req.user.id);
    if (!vendor) {
      return res
        .status(404)
        .json({ status: false, message: "Vendor not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, vendor.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ status: false, message: "Incorrect current password" });
    }

    vendor.password = await bcrypt.hash(newPassword, 10);
    await vendor.save();

    res
      .status(200)
      .json({ status: true, message: "Password changed successful" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
