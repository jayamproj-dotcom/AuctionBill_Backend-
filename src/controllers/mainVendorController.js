const MainVendor = require("../models/main-vendor");
const Plan = require("../models/subscriptions");
const bcrypt = require("bcryptjs");
const UserSubscription = require("../models/userSubscription");
const ExcelJS = require("exceljs");
const Notification = require("../models/notification");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");
const Vendor = require("../models/vendor");
const Seller = require("../models/seller");
const Buyer = require("../models/buyer");
const Transaction = require("../models/transaction");

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

    // Send Email (HTML formatted)
    try {
      const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Main Vendor Account Created</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">
                <tr>
                  <td align="center" style="background:#F39C12; padding:25px; color:#ffffff;">
                    <h1 style="margin:0; font-size:24px;">${process.env.COMPANY_NAME || "AuctionBilling"}</h1>
                    <p style="margin:5px 0 0; font-size:14px;">Main Vendor Account Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px; color:#333333;">
                    <h2 style="margin-top:0;">Hello ${name},</h2>
                    <p>Welcome! Your Main Vendor account has been successfully created.</p>
                    <p>Below are your login and plan details:</p>
                    <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa; border-radius:6px; margin-bottom:20px;">
                      <tr>
                        <td><strong>Email:</strong></td>
                        <td>${email}</td>
                      </tr>
                      <tr>
                        <td><strong>Password:</strong></td>
                        <td>${plainPassword}</td>
                      </tr>
                    </table>
                    <p>Your subscription plan is <strong>${planExists.name}</strong> and will expire on <strong>${planEndDate.toLocaleDateString()}</strong>.</p>
                    <br/>
                    <p>Regards,<br/>${process.env.COMPANY_NAME || "AuctionBilling"} Team</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                    <p style="margin:0;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || "AuctionBilling"}. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;
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

    // Notify Admin if requestedPlan is being set (upgrade/renewal request)
    if (
      updateData.requestedPlan &&
      updateData.requestedPlan.toString() !==
        vendorBeforeUpdate.requestedPlan?.toString()
    ) {
      const requestedPlanExists = await Plan.findById(updateData.requestedPlan);
      if (requestedPlanExists) {
        try {
          await Notification.create({
            userId: id,
            userModel: "MainVendor",
            senderName: vendorBeforeUpdate.name,
            title: "Plan Renewal/Upgrade Request",
            message: `Main Vendor ${vendorBeforeUpdate.name} has requested for ${requestedPlanExists.name} plan.`,
            type: "plan_upgrade",
            recipient: "admin",
          });
        } catch (e) {
          console.error("Admin notification error:", e);
        }
      }
    }

    const wasPendingAndNowActive =
      updateData.status &&
      updateData.status === "Active" &&
      vendorBeforeUpdate.status === "Pending";

    let planToActivate = null;
    let newPlanEndDate = null;

    // Case 1: Plan Update/Upgrade Approval OR Renewal
    // We allow it if plan is provided (even if same ID) to handle renewals
    if (
      updateData.plan &&
      updateData.plan !== "null" &&
      updateData.plan !== ""
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
        planToActivate = newPlan;
        newPlanEndDate = planEndDate;

        // Clear request fields when admin sets a plan
        updateData.requestedPlan = null;
        updateData.upgradeType = null;
      }
    }
    // Case 2: Activation from Pending (First time approval)
    else if (wasPendingAndNowActive) {
      updateData.joinedDate = new Date();
      const currentPlan = await Plan.findById(vendorBeforeUpdate.plan);
      if (currentPlan) {
        let planEndDate = new Date();
        if (currentPlan.durationType === "year") {
          planEndDate.setFullYear(
            planEndDate.getFullYear() + (currentPlan.durationValue || 1),
          );
        } else {
          planEndDate.setDate(
            planEndDate.getDate() + 30 * (currentPlan.durationValue || 1),
          );
        }
        updateData.planEndDate = planEndDate;
        planToActivate = currentPlan;
        newPlanEndDate = planEndDate;
      }
    }

    const updatedVendor = await MainVendor.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
    }).populate("plan");

    console.log(
      `Update Main Vendor ${id}: status changed from ${vendorBeforeUpdate.status} to ${updateData.status || vendorBeforeUpdate.status}. Activation detected: ${wasPendingAndNowActive}. Plan to activate: ${planToActivate ? planToActivate.name || planToActivate._id : "none"}`,
    );

    // Create UserSubscription entry if plan changed or account activated
    if (planToActivate) {
      try {
        await UserSubscription.create({
          userId: id,
          subscriptionId: planToActivate._id,
          priceAtPurchase: planToActivate.price,
          featuresAtPurchase: planToActivate.features || {},
          startDate: new Date(),
          endDate: newPlanEndDate,
        });
        console.log(
          `UserSubscription stored successfully for Main Vendor ${id}`,
        );
      } catch (subErr) {
        console.error(
          `Failed to store UserSubscription for Main Vendor ${id}:`,
          subErr,
        );
        // We don't necessarily want to fail the whole update if only the sub record failed,
        // but it's important to know.
      }
    }

    // send notification/email if there was a plan change or status activation
    try {
      const vendorObj = updatedVendor.toObject();
      let notifyTitle = null;
      let notifyMessage = null;
      let emailSubject = null;
      let emailHtml = null;

      if (planToActivate && !wasPendingAndNowActive) {
        notifyTitle = "Subscription Plan Updated";
        notifyMessage = `Your subscription has been changed to ${planToActivate.name}.`;
        emailSubject = "Your Subscription Plan Has Been Updated";
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Subscription Updated</title>
          </head>
          <body style="margin:0; padding:0; background-color:#F39C12; font-family:Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">
                    <tr>
                      <td align="center" style="background:#F39C12; padding:25px; color:#ffffff;">
                        <h1 style="margin:0; font-size:24px;">${process.env.COMPANY_NAME || "AuctionBilling"}</h1>
                        <p style="margin:5px 0 0; font-size:14px;">Subscription Plan Updated</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:30px; color:#333333;">
                        <h2 style="margin-top:0;">Hello ${vendorObj.name},</h2>
                        <p>Your subscription plan has been successfully updated or renewed.</p>
                        <p>Below are the details of your active subscription:</p>
                        
                        <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa; border-radius:6px; margin-bottom:20px;">
                          <tr>
                            <td><strong>Updated Plan:</strong></td>
                            <td>${planToActivate.name}</td>
                          </tr>
                          <tr>
                            <td><strong>Price:</strong></td>
                            <td>${planToActivate.price || "N/A"}</td>
                          </tr>
                          <tr>
                            <td><strong>Expiry Date:</strong></td>
                            <td>${newPlanEndDate.toLocaleDateString()}</td>
                          </tr>
                        </table>
                        
                        <p>Thank you for continuing with ${process.env.COMPANY_NAME || "AuctionBilling"}! You can manage your auctions and view your billing history via the link below.</p>

                        <div style="text-align:center; margin:30px 0;">
                          <a href="${process.env.CLIENT_URL || "http://localhost:5173"}" style="background:#F39C12; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">Go to Dashboard</a>
                        </div>
                        <br/>
                        <p>Regards,<br/>${process.env.COMPANY_NAME || "AuctionBilling"} Team</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                        <p style="margin:0;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || "AuctionBilling"}. All rights reserved.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
      }

      // Activation from pending?
      if (wasPendingAndNowActive) {
        notifyTitle = "Account Activated";
        notifyMessage = "Your account status has been changed to Active.";
        emailSubject = "Your Account Has Been Activated";

        const planName = planToActivate
          ? planToActivate.name
          : updatedVendor.plan?.name || "Standard Plan";
        const expiryStr = newPlanEndDate
          ? newPlanEndDate.toLocaleDateString()
          : updatedVendor.planEndDate
            ? new Date(updatedVendor.planEndDate).toLocaleDateString()
            : "N/A";

        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Account Activated</title>
          </head>
          <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">
                    <tr>
                      <td align="center" style="background:#F39C12; padding:25px; color:#ffffff;">
                        <h1 style="margin:0; font-size:24px;">${process.env.COMPANY_NAME || "AuctionBilling"}</h1>
                        <p style="margin:5px 0 0; font-size:14px;">Account Activated</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:30px; color:#333333;">
                        <h2 style="margin-top:0;">Hello ${vendorObj.name},</h2>
                        <p>Great news! Your Main Vendor account has been reviewed and successfully activated.</p>
                        <p>You can now log in to your dashboard and start managing your auctions.</p>
                        
                        <div style="text-align:center; margin:30px 0;">
                          <a href="${process.env.CLIENT_URL || "http://localhost:5173"}" style="background:#F39C12; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">Login to Your Account</a>
                        </div>

                        <p>Details of your assigned plan:</p>
                        <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa; border-radius:6px; margin-bottom:20px;">
                          <tr>
                            <td><strong>Current Plan:</strong></td>
                            <td>${planName}</td>
                          </tr>
                          <tr>
                            <td><strong>Expiry Date:</strong></td>
                            <td>${expiryStr}</td>
                          </tr>
                        </table>
                        
                        <p>If you have any questions, feel free to reply to this email.</p>
                        <br/>
                        <p>Regards,<br/>${process.env.COMPANY_NAME || "AuctionBilling"} Team</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                        <p style="margin:0;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || "AuctionBilling"}. All rights reserved.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
      }

      if (notifyTitle && notifyMessage) {
        await new Notification({
          userId: id,
          userModel: "MainVendor",
          title: notifyTitle,
          message: notifyMessage,
          type: "plan_upgrade",
          recipient: "main-vendor",
        }).save();
      }
      if (emailSubject && emailHtml) {
        await sendEmail(vendorObj.email, emailSubject, emailHtml);
      }
    } catch (notifyErr) {
      console.error("Post-update notification/email error:", notifyErr);
    }

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
    const vendor = await MainVendor.findById(id);
    if (!vendor) {
      return res
        .status(404)
        .json({ status: false, message: "Main vendor not found" });
    }

    await MainVendor.findByIdAndDelete(id);

    // optional email informing deletion
    try {
      const deleteEmail = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Account Deleted</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">
                  <tr>
                    <td align="center" style="background:#e74c3c; padding:25px; color:#ffffff;">
                      <h1 style="margin:0; font-size:24px;">${process.env.COMPANY_NAME || "AuctionBilling"}</h1>
                      <p style="margin:5px 0 0; font-size:14px;">Account Deletion Notice</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px; color:#333333;">
                      <h2 style="margin-top:0;">Hello ${vendor.name},</h2>
                      <p>This is to inform you that your Main Vendor account has been deleted by the administrator.</p>
                      
                      <p>If you believe this was done in error or if you have questions regarding this action, please contact our support team immediately.</p>
                      
                      <p>Thank you for the time you spent with us.</p>
                      <br/>
                      <p>Regards,<br/>${process.env.COMPANY_NAME || "AuctionBilling"} Team</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                      <p style="margin:0;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || "AuctionBilling"}. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
      await sendEmail(
        vendor.email,
        "Your Account Has Been Deleted",
        deleteEmail,
      );
    } catch (emailErr) {
      console.error("Deletion email error:", emailErr);
    }

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
    // Fetch all subscriptions and populate userId from MainVendor model.
    // This allows us to filter for subscriptions that actually belong to MainVendors.
    const purchases = await UserSubscription.find()
      .populate({
        path: "userId",
        model: "MainVendor",
        select: "name status",
      })
      .populate("subscriptionId", "name")
      .sort({ createdAt: -1 });

    // Filter to only include those where userId was successfully populated from MainVendor
    const filteredPurchases = purchases.filter((sub) => sub.userId !== null);

    const formattedPurchases = filteredPurchases.map((sub) => {
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
        senderName: name,
        title: "New Main Vendor Signup Request",
        message: `New Main Vendor ${name} (${email}) has requested access.`,
        type: "new_registration",
        recipient: "admin",
      });
    } catch (e) {
      console.error("Notification error:", e);
    }

    // send acknowledgement email to user using vendor-style template
    try {
      const emailContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Subscription Request Received</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" 
                 style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">
            <tr>
              <td align="center" style="background:#f39c12; padding:25px; color:#ffffff;">
                <h1 style="margin:0; font-size:24px;">${process.env.COMPANY_NAME || "AuctionBilling"}</h1>
                <p style="margin:5px 0 0; font-size:14px;">Subscription Request</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333333;">
                <h2 style="margin-top:0;">Hello ${name},</h2>
                <p>Thank you for choosing ${process.env.COMPANY_NAME || "AuctionBilling"}! Your subscription request has been received and is currently being processed.</p>
                <p>Our administrator will review your application and activate your account soon.</p>
                
                <h3 style="margin-top:20px; margin-bottom:10px;">Request Details:</h3>
                <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa; border-radius:6px; margin-bottom:20px;">
                  <tr>
                    <td><strong>Email:</strong></td>
                    <td>${email}</td>
                  </tr>
                  <tr>
                    <td><strong>Assigned Plan:</strong></td>
                    <td>${planExists.name || "Default Plan"}</td>
                  </tr>
                  <tr>
                    <td><strong>Location:</strong></td>
                    <td>${city}, ${state}</td>
                  </tr>
                </table>
                
                <p>We'll notify you once your account is active.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                <p style="margin:0;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || "AuctionBilling"}. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
        `;
      await sendEmail(
        email,
        "Your Subscription Request Has Been Received",
        emailContent,
      );
    } catch (emailErr) {
      console.error("Signup acknowledgement email error:", emailErr);
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
        .json({ status: false, message: "Main vendor not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    vendor.otp = otp;
    vendor.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await vendor.save();

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Reset OTP</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">
                <tr>
                  <td align="center" style="background:#F39C12; padding:25px; color:#ffffff;">
                    <h1 style="margin:0; font-size:24px;">${process.env.COMPANY_NAME || "AuctionBilling"}</h1>
                    <p style="margin:5px 0 0; font-size:14px;">Password Reset Request</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px; color:#333333;">
                    <h2 style="margin-top:0;">Hello,</h2>
                    <p>We received a request to reset your password. Use the OTP code below to proceed:</p>
                    
                    <div style="text-align:center; margin:30px 0;">
                      <span style="background:#f8f9fa; border:2px dashed #F39C12; color:#F39C12; padding:15px 30px; font-size:28px; font-weight:bold; letter-spacing:5px; border-radius:5px;">${otp}</span>
                    </div>

                    <p style="color:#777; font-size:14px;">This code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email.</p>
                    <br/>
                    <p>Regards,<br/>${process.env.COMPANY_NAME || "AuctionBilling"} Team</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                    <p style="margin:0;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || "AuctionBilling"}. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await sendEmail(email, "Password Reset OTP", emailContent);

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
        .json({ status: false, message: "Main vendor not found" });
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
        .json({ status: false, message: "Main vendor not found" });
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

exports.getSellers = async (req, res) => {
  try {
    const mainVendorId = req.user.id;
    const { branchId } = req.query;

    let vendorQuery = { mainVendorId };
    if (branchId && branchId !== "all") {
      vendorQuery._id = branchId;
    }

    const branches = await Vendor.find(vendorQuery).select("_id name");
    const branchIds = branches.map((b) => b._id);

    const sellers = await Seller.find({ vendorId: { $in: branchIds } })
      .populate("vendorId", "name")
      .sort({ createdAt: -1 });

    const formattedSellers = sellers.map((s) => ({
      id: s._id,
      name: s.name,
      email: s.email,
      phone: s.contact,
      branch: s.vendorId?.name || "N/A",
      branchId: s.vendorId?._id,
      city: s.city,
      state: s.state,
      address: s.address,
      status: s.status,
    }));

    res.status(200).json({ status: true, sellers: formattedSellers });
  } catch (error) {
    console.error("Get sellers error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getBranches = async (req, res) => {
  try {
    const mainVendorId = req.user.id;
    const branches = await Vendor.find({ mainVendorId }).sort({ name: 1 });
    res.status(200).json({ status: true, vendors: branches });
  } catch (error) {
    console.error("Get main vendor branches error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getBuyers = async (req, res) => {
  try {
    const mainVendorId = req.user.id;
    const { branchId } = req.query;

    let vendorQuery = { mainVendorId };
    if (branchId && branchId !== "all") {
      vendorQuery._id = branchId;
    }

    const branches = await Vendor.find(vendorQuery).select("_id name");
    const branchIds = branches.map((b) => b._id);

    const buyers = await Buyer.find({ vendorId: { $in: branchIds } })
      .populate("vendorId", "name")
      .sort({ createdAt: -1 });

    const formattedBuyers = buyers.map((b) => ({
      id: b._id,
      name: b.name,
      email: b.email,
      phone: b.contact,
      branch: b.vendorId?.name || "N/A",
      branchId: b.vendorId?._id,
      city: b.city,
      state: b.state,
      address: b.address,
      status: b.status,
    }));

    res.status(200).json({ status: true, buyers: formattedBuyers });
  } catch (error) {
    console.error("Get buyers error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const mainVendorId = req.user.id;
    const { branchId, startDate, endDate } = req.query;

    let vendorQuery = { mainVendorId };
    if (branchId && branchId !== "all") {
      vendorQuery._id = branchId;
    }

    const branches = await Vendor.find(vendorQuery).select("_id name");
    const branchIds = branches.map((b) => b._id);

    let transactionQuery = { vendorId: { $in: branchIds } };
    
    // Add date filtering if provided
    if (startDate && endDate) {
      transactionQuery.createdAt = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    } else if (startDate) {
      transactionQuery.createdAt = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0))
      };
    } else if (endDate) {
      transactionQuery.createdAt = {
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const transactions = await Transaction.find(transactionQuery)
      .populate("vendorId", "name")
      .populate("sellerId", "name")
      .populate("buyerId", "name")
      .populate("productId", "name")
      .sort({ createdAt: -1 });

    const formattedTransactions = transactions.map((t) => ({
      id: t._id,
      date: t.date,
      branch: t.vendorId?.name || "N/A",
      branchId: t.vendorId?._id,
      sellerName: t.sellerId?.name || "N/A",
      buyerName: t.buyerId?.name || t.buyerName || "N/A",
      productName: t.productId?.name || "N/A",
      quantity: t.quantity,
      rate: t.rate,
      totalAmount: t.finalAmount,
      commissionAmount: t.commissionAmount,
      netAmount: t.netAmount,
    }));

    res.status(200).json({ status: true, transactions: formattedTransactions });
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getCommissionRecords = async (req, res) => {
  try {
    const mainVendorId = req.user.id;
    const { branchId, startDate, endDate } = req.query;

    let vendorQuery = { mainVendorId };
    if (branchId && branchId !== "all") {
      vendorQuery._id = branchId;
    }

    const branches = await Vendor.find(vendorQuery).select("_id name");
    const branchIds = branches.map((b) => b._id);

    let transactionQuery = { vendorId: { $in: branchIds } };
    
    // Add date filtering if provided
    if (startDate && endDate) {
      transactionQuery.createdAt = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    } else if (startDate) {
      transactionQuery.createdAt = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0))
      };
    } else if (endDate) {
      transactionQuery.createdAt = {
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const transactions = await Transaction.find(transactionQuery)
      .populate("vendorId", "name")
      .populate("sellerId", "name")
      .populate("productId", "name")
      .sort({ createdAt: -1 });

    let totalCommission = 0;
    const formattedRecords = transactions.map((t) => {
      totalCommission += t.commissionAmount || 0;
      return {
        id: t._id,
        date: t.date,
        branch: t.vendorId?.name || "N/A",
        seller: t.sellerId?.name || "N/A",
        productName: t.productId?.name || "N/A",
        saleAmount: t.finalAmount,
        commissionPercent: t.commissionPercent || 0,
        amount: t.commissionAmount || 0,
      };
    });

    res.status(200).json({ 
      status: true, 
      commissions: formattedRecords,
      totalCommission
    });
  } catch (error) {
    console.error("Get commission records error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const mainVendorId = req.user.id;
    const { branchId, startDate, endDate, date } = req.query;

    let vendorQuery = { mainVendorId };
    if (branchId && branchId !== "all") {
      vendorQuery._id = branchId;
    }

    const branches = await Vendor.find(vendorQuery).select("_id name");
    const branchIds = branches.map((b) => b._id);
    const totalBranches = branchIds.length;

    // Build common date filter
    let dateFilter = {};
    if (date) {
      dateFilter = {
        $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
      };
    } else if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    } else if (startDate) {
      dateFilter = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
      };
    } else if (endDate) {
      dateFilter = {
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const sellerQuery = { vendorId: { $in: branchIds } };
    const buyerQuery = { vendorId: { $in: branchIds } };
    const transactionQuery = { vendorId: { $in: branchIds } };

    if (Object.keys(dateFilter).length > 0) {
      sellerQuery.createdAt = dateFilter;
      buyerQuery.createdAt = dateFilter;
      transactionQuery.createdAt = dateFilter;
    }

    const [totalSellers, totalBuyers, transactions] = await Promise.all([
      Seller.countDocuments(sellerQuery),
      Buyer.countDocuments(buyerQuery),
      Transaction.find(transactionQuery).populate("sellerId buyerId vendorId productId").sort({ createdAt: -1 }),
    ]);

    let totalSales = 0;
    let totalCommission = 0;
    let todayAuctions = 0; // Number of unique transactions for today or selected date
    let totalQty = 0;
    let totalPayIn = 0;
    let totalPayOut = 0;

    const recentTransactions = transactions.slice(0, 5).map(t => ({
      _id: t._id,
      date: t.date || t.createdAt,
      productName: t.productId?.name || t.productName || "N/A",
      sellerName: t.sellerId?.name || t.sellerName || "N/A",
      buyerName: t.buyerId?.name || t.buyerName || "N/A",
      branchName: t.vendorId?.name || "N/A",
      quantity: t.quantity,
      unit: t.unit || "qty",
      finalAmount: t.finalAmount,
      commissionAmount: t.commissionAmount
    }));

    transactions.forEach(t => {
      totalSales += t.finalAmount || 0;
      totalCommission += t.commissionAmount || 0;
      todayAuctions += 1;
      totalQty += t.quantity || 0;
      // In this system, commission belongs to the vendor. Pay in/out logic:
      // totalPayIn is from buyers (finalAmount)
      totalPayIn += t.finalAmount || 0;
      // totalPayOut is to sellers (netAmount)
      totalPayOut += t.netAmount || 0;
    });

    res.status(200).json({
      success: true,
      data: {
        totalBranches,
        totalSellers,
        totalBuyers,
        totalSales,
        totalCommission,
        todayAuctions,
        totalQty,
        totalPayIn,
        totalPayOut,
        recentTransactions
      }
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
