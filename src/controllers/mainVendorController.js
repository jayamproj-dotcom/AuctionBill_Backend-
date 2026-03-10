const MainVendor = require("../models/main-vendor");
const Plan = require("../models/subscriptions");
const bcrypt = require("bcryptjs");
const UserSubscription = require("../models/userSubscription");
const ExcelJS = require("exceljs");
const Notification = require("../models/notification");
const sendEmail = require("../utils/sendEmail");

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
    const updateData = req.body;

    // Remove protected fields
    delete updateData.password;
    delete updateData.role;

    const updatedVendor = await MainVendor.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!updatedVendor)
      return res
        .status(404)
        .json({ status: false, message: "Main vendor not found" });

    res.status(200).json({
      status: true,
      message: "Main vendor updated",
      mainVendor: updatedVendor,
    });
  } catch (error) {
    console.error("Update main vendor error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
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
