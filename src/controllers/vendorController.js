const Vendor = require("../models/vendor");
const jwt = require("jsonwebtoken");
const Plan = require("../models/subscriptions");
const Admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");
const ExcelJS = require("exceljs");
const Notification = require("../models/notification");
const UserSubscription = require("../models/userSubscription");

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const vendor = await Vendor.findOne({ email }).populate(
      "plan",
      "name planId",
    );
    if (!vendor) {
      return res.status(404).json({
        status: false,
        message: "Account not found. Please create an account.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, vendor.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid email or password" });
    }

    if (vendor.status !== "Active") {
      return res.status(403).json({
        status: false,
        message: "Your account is not active. Please contact support.",
      });
    }

    if (vendor.planEndDate && new Date() > new Date(vendor.planEndDate)) {
      return res.status(403).json({
        status: false,
        message:
          "Your subscription plan has expired. Please renew to continue.",
      });
    }

    const token = jwt.sign(
      { id: vendor._id, role: "vendor" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    const vendorData = vendor.toObject();
    delete vendorData.password;
    delete vendorData.otp;
    delete vendorData.otpExpires;

    const activeSubscription = await UserSubscription.findOne({
      userId: vendor._id,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).sort({ startDate: -1 });

    res.status(200).json({
      status: true,
      message: "Login successful",
      token,
      user: {
        ...vendorData,
        role: "vendor",
        activeSubscription,
      },
    });
  } catch (error) {
    console.error("Vendor login error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.signup = async (req, res) => {
  try {
    let { name, email, password, phone, address, city, state, plan } = req.body;
    let profilePic = "";

    if (req.file) {
      profilePic = `/uploads/vendors/${req.file.filename}`;
    }

    // Check if plan exists
    const planExists = await Plan.findById(plan);
    if (!planExists) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid subscription plan." });
    }

    const vendorEmailExists = await Vendor.findOne({ email });
    if (vendorEmailExists) {
      return res
        .status(400)
        .json({ status: false, message: "Email is already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newVendor = new Vendor({
      name,
      email,
      password: hashedPassword,
      phone,
      profilePic,
      address,
      city,
      state,
      plan,
      status: "Pending", // Initial status for signup
    });

    await newVendor.save();

    // Send Email to Admin/Vendor (Optional, but good for confirmation)
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

    try {
      await sendEmail(
        email,
        "Your Subscription Request Has Been Received",
        emailContent,
      );
    } catch (emailErr) {
      console.error("Email error:", emailErr);
    }

    // Create Admin Notification
    try {
      const adminNotification = new Notification({
        vendorId: newVendor._id,
        title: "New Vendor Registration",
        message: `${name} has requested for ${planExists.name} plan.`,
        type: "new_registration",
      });
      await adminNotification.save();
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    res.status(201).json({
      status: true,
      message:
        "Subscription request submitted successfully. Please wait for admin approval.",
      vendor: newVendor,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.createVendor = async (req, res) => {
  try {
    let { name, email, phone, address, city, state, plan, status, profilePic } =
      req.body;

    if (req.file) {
      profilePic = `/uploads/vendors/${req.file.filename}`;
    }

    // Check if plan exists
    const planExists = await Plan.findById(plan);
    if (!planExists) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid subscription plan." });
    }

    const vendorNameExists = await Vendor.findOne({ name });
    if (vendorNameExists) {
      return res
        .status(400)
        .json({ status: false, message: "Name is already in use" });
    }

    const vendorEmailExists = await Vendor.findOne({ email });
    if (vendorEmailExists) {
      return res
        .status(400)
        .json({ status: false, message: "Email is already in use" });
    }

    // Generate a random 8-character password
    const plainPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    let planEndDate = null;

    if (status === "Active" || !status) {
      planEndDate = new Date();

      if (planExists.durationType === "year") {
        planEndDate.setFullYear(
          planEndDate.getFullYear() + (planExists.durationValue || 1),
        );
      } else {
        planEndDate = addDays(
          planEndDate,
          30 * (planExists.durationValue || 1),
        );
      }
    }

    const newVendor = new Vendor({
      name,
      email,
      password: hashedPassword,
      phone,
      profilePic,
      address,
      city,
      state,
      plan,
      planEndDate,
      status: status || "Active",
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    });

    await newVendor.save();

    if (newVendor.status === "Active") {
      await UserSubscription.create({
        userId: newVendor._id,
        subscriptionId: planExists._id,
        priceAtPurchase: planExists.price,
        featuresAtPurchase: planExists.features || {},
        startDate: new Date(),
        endDate: planEndDate,
      });
    }

    // Send Email to Vendor
    const planName = planExists.name || "Default Plan";
    const planPrice =
      planExists.price !== undefined ? `$${planExists.price}` : "N/A";
    const planDuration = `${planExists.durationValue || 1} ${planExists.durationType === "year" ? "year" : "Month"}(s)`;

    const emailContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Vendor Account Created</title>
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
                <p style="margin:5px 0 0; font-size:14px;">Vendor Account Details</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333333;">
                <h2 style="margin-top:0;">Hello ${name},</h2>
                <p>Welcome! Your Vendor account has been successfully created.</p>
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

                <h3 style="margin-top:20px; margin-bottom:10px;">Your Subscription Plan Info</h3>
                <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa; border-radius:6px; margin-bottom:20px;">
                  <tr>
                    <td><strong>Assigned Plan:</strong></td>
                    <td>${planName}</td>
                  </tr>
                  <tr>
                    <td><strong>Price:</strong></td>
                    <td>${planPrice}</td>
                  </tr>
                  <tr>
                    <td><strong>Duration:</strong></td>
                    <td>${planDuration}</td>
                  </tr>
                </table>
                
                <p>Please log in and change your password for security reasons.</p>
                
                <div style="text-align:center; margin-top:25px;">
                  <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/auctionbilling/" 
                     style="background:#27ae60; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
                    Login to Portal
                  </a>
                </div>
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
      "Your Vendor Account Has Been Created",
      emailContent,
    );

    res.status(201).json({
      status: true,
      message: "Vendor created successfully",
      vendor: newVendor,
    });
  } catch (error) {
    console.error("Create vendor error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find()
      .populate("plan", "name planId price durationType durationValue")
      .populate("requestedPlan", "name planId price");
    const vendorIds = vendors.map((v) => v._id);

    // Fetch active subscriptions for these vendors
    const activeSubscriptions = await UserSubscription.find({
      userId: { $in: vendorIds },
      endDate: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    const vendorsWithSub = vendors.map((vendor) => {
      const sub = activeSubscriptions.find(
        (s) => s.userId.toString() === vendor._id.toString(),
      );
      return {
        ...vendor.toObject(),
        activeSubscription: sub || null,
      };
    });

    res.status(200).json({ status: true, vendors: vendorsWithSub });
  } catch (error) {
    console.error("Get vendors error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id).populate(
      "plan",
      "name planId price durationType durationValue",
    );
    if (!vendor) {
      return res
        .status(404)
        .json({ status: false, message: "Vendor not found" });
    }

    const activeSubscription = await UserSubscription.findOne({
      userId: id,
      endDate: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      status: true,
      vendor: {
        ...vendor.toObject(),
        activeSubscription: activeSubscription || null,
      },
    });
  } catch (error) {
    console.error("Get vendor by id error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getAllPurchases = async (req, res) => {
  try {
    const purchases = await UserSubscription.find()
      .populate("userId", "name status")
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
        vendorId: sub.userId?._id,
        vendorName: sub.userId?.name || "Unknown Vendor",
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

exports.getVendorPurchasesById = async (req, res) => {
  try {
    const { id } = req.params;
    const purchases = await UserSubscription.find({ userId: id })
      .populate("subscriptionId", "name durationType durationValue features")
      .sort({ createdAt: -1 });

    const formattedPurchases = purchases.map((sub) => {
      let durationStr =
        sub.subscriptionId?.durationType === "year" ? "Yearly" : "Month";
      return {
        id: `INV-${new Date(sub.createdAt).getFullYear()}-${sub._id.toString().slice(-4).toUpperCase()}`,
        date: sub.createdAt,
        amount: sub.priceAtPurchase || 0,
        status: "Paid",
        description: `${sub.subscriptionId?.name || "Plan"} - ${durationStr}`,
      };
    });

    res.status(200).json({ status: true, purchases: formattedPurchases });
  } catch (error) {
    console.error("Get vendor purchases by id error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    let {
      name,
      email,
      phone,
      address,
      city,
      state,
      plan,
      status,
      profilePic,
      requestedPlan,
      upgradeType,
    } = req.body;

    if (req.file) {
      profilePic = `/uploads/vendors/${req.file.filename}`;
    }

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res
        .status(404)
        .json({ status: false, message: "Vendor not found" });
    }

    if (name && name !== vendor.name) {
      const nameExists = await Vendor.findOne({ name });
      if (nameExists) {
        return res
          .status(400)
          .json({ status: false, message: "Name is already in use" });
      }
    }

    if (email && email !== vendor.email) {
      const emailExists = await Vendor.findOne({ email });
      if (emailExists) {
        return res
          .status(400)
          .json({ status: false, message: "Email is already in use" });
      }
    }

    let activePlanData = null;
    let oldPlanEndDate = vendor.planEndDate
      ? new Date(vendor.planEndDate)
      : new Date();

    if (plan) {
      const planExists = await Plan.findById(plan);
      if (!planExists) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid subscription plan." });
      }
      vendor.plan = plan;
      activePlanData = planExists;

      let planEndDate = new Date();
      if (
        upgradeType === "after_current" &&
        vendor.planEndDate &&
        new Date(vendor.planEndDate) > new Date()
      ) {
        planEndDate = new Date(vendor.planEndDate);
      }

      if (planExists.durationType === "year") {
        planEndDate.setFullYear(
          planEndDate.getFullYear() + (planExists.durationValue || 1),
        );
      } else {
        planEndDate = addDays(
          planEndDate,
          30 * (planExists.durationValue || 1),
        );
      }
      vendor.planEndDate = planEndDate;
      vendor.requestedPlan = null;
      vendor.upgradeType = null;
    } else {
      // Also fetch to get current active Plan context for email even if not updated during this call
      activePlanData = await Plan.findById(vendor.plan);
    }

    const isProfileChanged =
      (name && vendor.name !== name) ||
      (email && vendor.email !== email) ||
      (phone && vendor.phone !== phone) ||
      (address && vendor.address !== address) ||
      (city && vendor.city !== city) ||
      (state && vendor.state !== state) ||
      (status && vendor.status !== status) ||
      (profilePic !== undefined && vendor.profilePic !== profilePic) ||
      (requestedPlan !== undefined &&
        String(vendor.requestedPlan) !== String(requestedPlan));

    if (requestedPlan !== undefined) {
      if (requestedPlan === null || requestedPlan === "") {
        vendor.requestedPlan = null;
        vendor.upgradeType = null;
      } else {
        const reqPlanExists = await Plan.findById(requestedPlan);
        if (!reqPlanExists) {
          return res.status(400).json({
            status: false,
            message: "Invalid requested subscription plan.",
          });
        }
        vendor.requestedPlan = requestedPlan;
        if (upgradeType) {
          vendor.upgradeType = upgradeType;
        }

        try {
          const adminNotification = new Notification({
            vendorId: vendor._id,
            title: "Plan Upgrade Request",
            message: `${vendor.name} has requested an upgrade to ${reqPlanExists.name} plan.`,
            type: "plan_upgrade",
          });
          await adminNotification.save();
        } catch (notifErr) {
          console.error("Notification error:", notifErr);
        }
      }
    }

    if (name) vendor.name = name;
    if (email) vendor.email = email;
    if (phone) vendor.phone = phone;
    if (address) vendor.address = address;
    if (city) vendor.city = city;
    if (state) vendor.state = state;

    const wasPendingAndNowActive =
      status && status === "Active" && vendor.status === "Pending";

    // Recalculate start and end date if being approved today
    if (wasPendingAndNowActive) {
      vendor.joinedDate = new Date();
      let newEndDate = new Date();
      if (activePlanData && activePlanData.durationType === "year") {
        newEndDate.setFullYear(
          newEndDate.getFullYear() + (activePlanData.durationValue || 1),
        );
      } else if (activePlanData) {
        newEndDate = addDays(
          newEndDate,
          30 * (activePlanData.durationValue || 1),
        );
      }
      vendor.planEndDate = newEndDate;
    }

    if (status) vendor.status = status;
    if (profilePic !== undefined) vendor.profilePic = profilePic;

    vendor.updatedBy = req.user?.id;
    await vendor.save();

    if (vendor.status === "Active" && (wasPendingAndNowActive || plan)) {
      if (activePlanData) {
        let subStartDate = new Date();
        if (wasPendingAndNowActive) {
          subStartDate = vendor.joinedDate;
        } else if (upgradeType === "after_current") {
          subStartDate = oldPlanEndDate;
        }

        await UserSubscription.create({
          userId: vendor._id,
          subscriptionId: activePlanData._id,
          priceAtPurchase: activePlanData.price,
          featuresAtPurchase: activePlanData.features || {},
          startDate: subStartDate,
          endDate: vendor.planEndDate,
        });
      }
    }

    if (isProfileChanged || plan) {
      const planName = activePlanData ? activePlanData.name : "Default Plan";
      const planPrice =
        activePlanData && activePlanData.price !== undefined
          ? `$${activePlanData.price}`
          : "N/A";
      const planDuration = activePlanData
        ? `${activePlanData.durationValue || 1} ${activePlanData.durationType === "year" ? "year" : "Month"}(s)`
        : "N/A";

      const updateEmailContent = `
   <!DOCTYPE html>
   <html>
   <head>
     <meta charset="UTF-8">
     <title>Vendor Account Updated</title>
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
                 <p style="margin:5px 0 0; font-size:14px;">Vendor Account Updated</p>
               </td>
             </tr>
             <tr>
               <td style="padding:30px; color:#333333;">
                 <h2 style="margin-top:0;">Hello ${vendor.name},</h2>
                 <p>Your Vendor account data or subscription settings have been updated.</p>
                 <p>Here is your current profile information:</p>

                 <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa; border-radius:6px; margin-bottom:20px;">
                   <tr>
                     <td><strong>Name:</strong></td>
                     <td>${vendor.name}</td>
                   </tr>
                   <tr>
                     <td><strong>Email (Username):</strong></td>
                     <td>${vendor.email}</td>
                   </tr>
                   <tr>
                     <td><strong>Status:</strong></td>
                     <td>${vendor.status}</td>
                   </tr>
                 </table>
                 
                 <h3 style="margin-top:20px; margin-bottom:10px;">Your Subscription Plan Info</h3>
                 <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa; border-radius:6px; margin-bottom:20px;">
                   <tr>
                     <td><strong>Assigned Plan:</strong></td>
                     <td>${planName}</td>
                   </tr>
                   <tr>
                     <td><strong>Price:</strong></td>
                     <td>${planPrice}</td>
                   </tr>
                   <tr>
                     <td><strong>Duration:</strong></td>
                     <td>${planDuration}</td>
                   </tr>
                 </table>
                 
                 <div style="text-align:center; margin-top:25px;">
                   <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/auctionbilling/" 
                      style="background:#f39c12; color:#ffffff; 
                            padding:12px 25px; text-decoration:none; 
                            border-radius:5px; font-weight:bold;">
                     Review Account
                   </a>
                 </div>
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
        "Your Vendor Account Info Has Been Updated",
        updateEmailContent,
      );
    }

    res
      .status(200)
      .json({ status: true, message: "Vendor updated successfully", vendor });
  } catch (error) {
    console.error("Update vendor error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findByIdAndDelete(id);

    if (!vendor) {
      return res
        .status(404)
        .json({ status: false, message: "Vendor not found" });
    }

    const deleteEmailContent = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial;">
    <table width="100%" align="center">
      <tr>
        <td align="center">
          <table width="600" style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">
            <tr>
              <td style="background:#e74c3c; padding:25px; color:#ffffff;" align="center">
                <h2 style="margin:0;">Account Deleted</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p>Hello ${vendor.name},</p>
                <p>Your Vendor account has been successfully deleted by the administrator, effectively terminating any active subscriptions associated with it.</p>
                <p>If you believe this was done by mistake, please contact support.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background:#f1f1f1; padding:15px; font-size:12px; color:#777;">
                © ${new Date().getFullYear()} ${process.env.COMPANY_NAME || "AuctionBilling"}. All rights reserved.
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
      "Your Vendor Account Has Been Deleted",
      deleteEmailContent,
    );

    res
      .status(200)
      .json({ status: true, message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("Delete vendor error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const vendorId = req.user.id;

    const vendor = await Vendor.findById(vendorId);
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

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    vendor.password = hashedPassword;
    await vendor.save();

    res
      .status(200)
      .json({ status: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const vendor = await Vendor.findOne({ email });

    if (!vendor) {
      return res.status(404).json({
        status: false,
        message: "Vendor with this email does not exist",
      });
    }

    if (vendor.status !== "Active") {
      return res.status(403).json({
        status: false,
        message: "Your account is inactive. Please contact the Admin.",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    vendor.otp = otp;
    vendor.otpExpires = otpExpires;
    await vendor.save();

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Password Reset OTP</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">

        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff; margin:40px 0; border-radius:10px; overflow:hidden;">

          <!-- ===== HEADER ===== -->
          <tr>
            <td align="center" style="background:#f39c12; padding:25px; color:#ffffff;">
              <h1 style="margin:0; font-size:22px;">
                ${process.env.COMPANY_NAME || "AuctionBilling"}
              </h1>
              <p style="margin:5px 0 0; font-size:14px;">Password Reset Request</p>
            </td>
          </tr>

          <!-- ===== BODY ===== -->
          <tr>
            <td style="padding:30px; color:#333;">
              <h2 style="margin-top:0;">Hello ${vendor.name},</h2>
              <p style="font-size:16px; color:#555;">
                You requested a password reset. Use the OTP below to reset your password.
                This OTP is valid for <strong>5 minutes</strong>.
              </p>

              <div style="text-align:center; margin:30px 0;">
                <span style="
                  font-size:32px;
                  font-weight:bold;
                  letter-spacing:6px;
                  color:#f39c12;
                  padding:12px 25px;
                  background:#f9f9f9;
                  border-radius:8px;
                  border:2px dashed #f39c12;
                  display:inline-block;
                ">
                  ${otp}
                </span>
              </div>

              <p style="font-size:14px; color:#888;">
                If you did not request this password reset, please ignore this email.
              </p>
            </td>
          </tr>

          <!-- ===== FOOTER ===== -->
          <tr>
            <td align="center"
              style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
              © ${new Date().getFullYear()}
              ${process.env.COMPANY_NAME || "AuctionBilling"}.
              All rights reserved.
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

    res.status(200).json({ status: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const vendor = await Vendor.findOne({
      email,
      otp,
      otpExpires: { $gt: Date.now() },
    });

    if (!vendor) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    vendor.password = hashedPassword;
    vendor.otp = undefined;
    vendor.otpExpires = undefined;
    await vendor.save();

    res
      .status(200)
      .json({ status: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.exportVendors = async (req, res) => {
  try {
    const { state, city, plan, status, from, to, search } = req.body;

    let query = {};

    if (state) query.state = state;
    if (city) query.city = city;
    if (plan) query.plan = plan;
    if (status) query.status = status;

    if (from || to) {
      query.joinedDate = {};
      if (from) query.joinedDate.$gte = new Date(from);
      if (to) {
        let toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.joinedDate.$lte = toDate;
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const vendors = await Vendor.find(query).populate("plan");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Vendors");

    worksheet.columns = [
      { header: "Vendor Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Address", key: "address", width: 30 },
      { header: "City", key: "city", width: 15 },
      { header: "State", key: "state", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "Plan Name", key: "planName", width: 20 },
      { header: "Plan Price", key: "planPrice", width: 12 },
      { header: "Joined Date", key: "joinedDate", width: 20 },
      { header: "Expiry Date", key: "planEndDate", width: 20 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    vendors.forEach((vendor) => {
      worksheet.addRow({
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address || "N/A",
        city: vendor.city || "N/A",
        state: vendor.state || "N/A",
        status: vendor.status,
        planName: vendor.plan?.name || "N/A",
        planPrice: vendor.plan?.price || "0",
        joinedDate: vendor.joinedDate
          ? new Date(vendor.joinedDate).toLocaleDateString()
          : "N/A",
        planEndDate: vendor.planEndDate
          ? new Date(vendor.planEndDate).toLocaleDateString()
          : "N/A",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=vendors_report_${Date.now()}.xlsx`,
    );

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error("Export vendors error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
