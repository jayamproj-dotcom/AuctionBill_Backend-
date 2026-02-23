const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");
const sendEmail = require("../utils/sendEmail");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ status: false, message: "User not found" });

    if (admin.role === "sub-admin" && admin.status !== "Active") {
      return res.status(403).json({ status: false, message: "Access denied. Account is not active." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ status: false, message: "Invalid password" });

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      status: true,
      message: "Login successful",
      token,
      data: {
        username: admin.username,
        email: admin.email,
        role: admin.role,
        id: admin._id,
        permissions: admin.permissions
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.updateProfie = async (req, res) => {
  try {
    const { username, email } = req.body;
    console.log(req.user);
    const admin = await Admin.findOne({ _id: req.user.id });
    if (!admin) return res.status(400).json({ status: false, message: "User not found" });
    admin.username = username;
    admin.email = email;
    await admin.save();
    res.status(200).json({ status: true, message: "Profile updated successfully", admin });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}

exports.updatePassword = async (req, res) => {
  try {
    const hashed = await bcrypt.hash(req.body.password, 10);

    await Admin.updateOne(
      { _id: req.user.id },
      { password: hashed }
    );

    res.status(200).json({ status: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select("-password");
    if (!admin) return res.status(404).json({ status: false, message: "User not found" });

    res.status(200).json({ status: true, admin });
  } catch (error) {
    console.error("Get admin error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.verifyPassword = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ status: false, message: "User not found" });

    const isMatch = await bcrypt.compare(req.body.password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ status: false, message: "currect password not match" });
    }

    res.status(200).json({
      status: true,
      message: "currect password is correct",
      currectPassword: true
    });
  } catch (error) {
    console.error("Verify password error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

//sub admin
exports.createSubAdmin = async (req, res) => {
  try {
    let { username, password, email, status, name } = req.body;
    username = username || name;

    if (!username) return res.status(400).json({ status: false, message: "Username is required" });

    const admin = await Admin.findOne({ username });
    if (admin) return res.status(400).json({ status: false, message: "User already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({
      username,
      password: hashed,
      email,
      role: "sub-admin",
      status,
      permissions: {
        vendorAdd: false,
        subscriptionAccess: false,
        passwordChange: false
      },
      createdBy: req.user?.id,
      updatedBy: req.user?.id
    });
    await newAdmin.save();

    // Send email
    await sendEmail(
      email,
      "Sub Admin Account Created",
      `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Account Created</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
    
    <!-- Main Wrapper -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">

          <!-- Email Container -->
          <table width="600" cellpadding="0" cellspacing="0" border="0" 
                 style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">

            <!-- Header -->
            <tr>
              <td align="center" 
                  style="background:#f39c12; padding:25px; color:#ffffff;">
                <h1 style="margin:0; font-size:24px;">
                 ${process.env.COMPANY_NAME}
                </h1>
                <p style="margin:5px 0 0; font-size:14px;">
                  Sub Admin Account Created
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:#333333;">
                <h2 style="margin-top:0;">Hello ${username},</h2>

                <p>
                  Your Sub Admin account has been successfully created.
                  Below are your login details:
                </p>

                <table width="100%" cellpadding="8" cellspacing="0" 
                       style="background:#f8f9fa; border-radius:6px;">
                  <tr>
                    <td><strong>Username:</strong></td>
                    <td>${username}</td>
                  </tr>
                  <tr>
                    <td><strong>Email:</strong></td>
                    <td>${email}</td>
                  </tr>
                  <tr>
                    <td><strong>Password:</strong></td>
                    <td>${password}</td>
                  </tr>
                </table>

                <!-- Button -->
                <div style="text-align:center; margin-top:25px;">
                  <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/auctionbilling/saas-admin" 
                     style="background:#f39c12; color:#ffffff; 
                            padding:12px 25px; text-decoration:none; 
                            border-radius:5px; font-weight:bold;">
                    Login Now
                  </a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" 
                  style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                <p style="margin:0;">
                  © ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.
                </p>
                <p style="margin:5px 0 0;">
                  If you did not request this account, please contact support immediately.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `
    );

    res.status(200).json({ status: true, message: "Sub-admin created successfully", newAdmin });
  } catch (error) {
    console.error("Create sub-admin error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}

exports.getSubAdmins = async (req, res) => {
  try {
    const subAdmins = await Admin.find({ role: "sub-admin" }).select("-password");
    res.status(200).json({ status: true, subAdmins });
  } catch (error) {
    console.error("Get sub-admins error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.updateSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    let { username, email, status, permissions, name, password } = req.body;
    username = username || name;

    const subAdmin = await Admin.findById(id);
    if (!subAdmin || subAdmin.role !== "sub-admin") {
      return res.status(404).json({ status: false, message: "Sub-admin not found" });
    }

    if (username) subAdmin.username = username;
    if (email) subAdmin.email = email;
    if (status) subAdmin.status = status;
    if (permissions) subAdmin.permissions = { ...subAdmin.permissions, ...permissions };

    // Ensure we don't accidentally update the password this way
    if (password) {
      subAdmin.password = await bcrypt.hash(password, 10);
    }

    subAdmin.updatedBy = req.user?.id;
    await subAdmin.save();

    // Send email notification for update
    await sendEmail(
      subAdmin.email,
      "Sub Admin Account Updated",
      `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Account Updated</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" 
                 style="background:#ffffff; margin:40px 0; border-radius:8px; overflow:hidden;">
            <tr>
              <td align="center" 
                  style="background:#f39c12; padding:25px; color:#ffffff;">
                <h1 style="margin:0; font-size:24px;">
                 ${process.env.COMPANY_NAME || 'AuctionBilling'}
                </h1>
                <p style="margin:5px 0 0; font-size:14px;">
                  Sub Admin Account Updated
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333333;">
                <h2 style="margin-top:0;">Hello ${username},</h2>

                <p>
                  Your Sub Admin account has been successfully created.
                  Below are your login details:
                </p>

                <table width="100%" cellpadding="8" cellspacing="0" 
                       style="background:#f8f9fa; border-radius:6px;">
                  <tr>
                    <td><strong>Username:</strong></td>
                    <td>${username}</td>
                  </tr>
                  <tr>
                    <td><strong>Email:</strong></td>
                    <td>${email}</td>
                  </tr>
                  <tr>
                    <td><strong>Password:</strong></td>
                    <td>${password ? password : '<i>(Unchanged)</i>'}</td>
                  </tr>
                </table>
                <p>
                  Your Sub Admin account details or permissions have been updated by the administrator.
                </p>
                <div style="text-align:center; margin-top:25px;">
                  <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/auctionbilling/saas-admin" 
                     style="background:#f39c12; color:#ffffff; 
                            padding:12px 25px; text-decoration:none; 
                            border-radius:5px; font-weight:bold;">
                    Review Account
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" 
                  style="background:#f1f1f1; padding:20px; font-size:12px; color:#777;">
                <p style="margin:0;">
                  © ${new Date().getFullYear()} ${process.env.COMPANY_NAME || 'AuctionBilling'}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
      `
    );

    res.status(200).json({ status: true, message: "Sub-admin updated successfully", subAdmin });
  } catch (error) {
    console.error("Update sub-admin error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.deleteSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const subAdmin = await Admin.findOneAndDelete({ _id: id, role: "sub-admin" });

    if (!subAdmin) {
      return res.status(404).json({ status: false, message: "Sub-admin not found" });
    }

    // Send delete email
    await sendEmail(
      subAdmin.email,
      "Account Deleted",
      `
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
                <p>Hello ${subAdmin.username},</p>
                <p>
                  Your Sub Admin account has been deleted by the administrator.
                </p>
                <p>
                  If you believe this was done by mistake, please contact support.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="background:#f1f1f1; padding:15px; font-size:12px; color:#777;">
                © ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `
    );

    res.status(200).json({ status: true, message: "Sub-admin deleted successfully" });
  } catch (error) {
    console.error("Delete sub-admin error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
