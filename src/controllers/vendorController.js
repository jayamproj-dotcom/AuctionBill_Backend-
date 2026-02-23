const Vendor = require("../models/vendor");
const Plan = require("../models/subscriptions");
const Admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");

exports.createVendor = async (req, res) => {
    try {
        const { name, email, phone, address, plan, status } = req.body;

        // Check if plan exists
        const planExists = await Plan.findById(plan);
        if (!planExists) {
            return res.status(400).json({ status: false, message: "Invalid subscription plan." });
        }

        // Check if vendor email already exists
        const vendorExists = await Vendor.findOne({ email });
        if (vendorExists) {
            return res.status(400).json({ status: false, message: "Vendor with this email already exists." });
        }

        // Generate a random 8-character password
        const plainPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const newVendor = new Vendor({
            name,
            email,
            password: hashedPassword,
            phone,
            address,
            plan,
            status: status || "Active",
            createdBy: req.user?.id,
            updatedBy: req.user?.id
        });

        await newVendor.save();

        // Send Email to Vendor
        const planName = planExists.name || "Default Plan";
        const planPrice = planExists.price !== undefined ? `$${planExists.price}` : "N/A";
        const planDuration = `${planExists.durationValue || 1} ${planExists.durationType || 'month'}(s)`;

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
              <td align="center" style="background:#2c3e50; padding:25px; color:#ffffff;">
                <h1 style="margin:0; font-size:24px;">${process.env.COMPANY_NAME || 'AuctionBilling'}</h1>
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
                    <td><strong>Email (Username):</strong></td>
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
                  <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/auctionbilling/" 
                     style="background:#27ae60; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
                    Login to Portal
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                <p style="margin:0;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || 'AuctionBilling'}. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
        `;

        await sendEmail(email, "Your Vendor Account Has Been Created", emailContent);

        res.status(201).json({ status: true, message: "Vendor created successfully", vendor: newVendor });
    } catch (error) {
        console.error("Create vendor error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

exports.getVendors = async (req, res) => {
    try {
        const vendors = await Vendor.find().populate("plan", "name planId");
        res.status(200).json({ status: true, vendors });
    } catch (error) {
        console.error("Get vendors error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, address, plan, status } = req.body;

        const vendor = await Vendor.findById(id);
        if (!vendor) {
            return res.status(404).json({ status: false, message: "Vendor not found" });
        }

        let activePlanData = null;
        if (plan) {
            const planExists = await Plan.findById(plan);
            if (!planExists) {
                return res.status(400).json({ status: false, message: "Invalid subscription plan." });
            }
            vendor.plan = plan;
            activePlanData = planExists;
        } else {
            // Also fetch to get current active Plan context for email even if not updated during this call
            activePlanData = await Plan.findById(vendor.plan);
        }

        const isProfileChanged = (name && vendor.name !== name) ||
            (email && vendor.email !== email) ||
            (phone && vendor.phone !== phone) ||
            (address && vendor.address !== address) ||
            (status && vendor.status !== status);

        if (name) vendor.name = name;
        if (email) vendor.email = email;
        if (phone) vendor.phone = phone;
        if (address) vendor.address = address;
        if (status) vendor.status = status;

        vendor.updatedBy = req.user?.id;
        await vendor.save();

        if (isProfileChanged || plan) {
            const planName = activePlanData ? activePlanData.name : "Default Plan";
            const planPrice = activePlanData && activePlanData.price !== undefined ? `$${activePlanData.price}` : "N/A";
            const planDuration = activePlanData ? `${activePlanData.durationValue || 1} ${activePlanData.durationType || 'month'}(s)` : "N/A";

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
                 <h1 style="margin:0; font-size:24px;">${process.env.COMPANY_NAME || 'AuctionBilling'}</h1>
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
                   <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/auctionbilling/" 
                      style="background:#f39c12; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
                     Review Account
                   </a>
                 </div>
               </td>
             </tr>
             <tr>
               <td align="center" style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                 <p style="margin:0;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || 'AuctionBilling'}. All rights reserved.</p>
               </td>
             </tr>
           </table>
         </td>
       </tr>
     </table>
   </body>
   </html>
             `;

            await sendEmail(vendor.email, "Your Vendor Account Info Has Been Updated", updateEmailContent);
        }

        res.status(200).json({ status: true, message: "Vendor updated successfully", vendor });
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
            return res.status(404).json({ status: false, message: "Vendor not found" });
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
                © ${new Date().getFullYear()} ${process.env.COMPANY_NAME || 'AuctionBilling'}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
        `;

        await sendEmail(vendor.email, "Your Vendor Account Has Been Deleted", deleteEmailContent);

        res.status(200).json({ status: true, message: "Vendor deleted successfully" });
    } catch (error) {
        console.error("Delete vendor error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};
