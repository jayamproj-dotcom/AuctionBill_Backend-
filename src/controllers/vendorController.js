const Vendor = require("../models/vendor");
const MainVendor = require("../models/main-vendor");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");
const ExcelJS = require("exceljs");
const Notification = require("../models/notification");

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const generateBranchId = () => {
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `BRC-${randomDigits}`;
};

// Auth functions (login, signup, forgotPassword, etc.) are removed as Vendor model no longer handles password/auth directly.
// These are now managed as branches under MainVendor.

exports.login = async (req, res) => {
  try {
    const { email, password, branchId } = req.body;

    // 1. Find the MainVendor by email
    const mainVendor = await MainVendor.findOne({ email });
    if (!mainVendor) {
      return res.status(404).json({
        status: false,
        message: "Main Vendor account not found.",
      });
    }

    // 2. Verify password (using Main Vendor's password)
    // const isPasswordValid = await bcrypt.compare(password, mainVendor.password);
    // if (!isPasswordValid) {
    //   return res.status(401).json({
    //     status: false,
    //     message: "Invalid email or password",
    //   });
    // }

    // 3. Find the specific Vendor branch using branchId
    const vendorBranch = await Vendor.findOne({
      branchId,
      mainVendorId: mainVendor._id,
    }).populate("mainVendorId", "name email");

    if (!vendorBranch) {
      return res.status(404).json({
        status: false,
        message:
          "Vendor branch not found or does not belong to this Main Vendor.",
      });
    }

    if (vendorBranch.status !== "Active") {
      return res.status(403).json({
        status: false,
        message: "Your branch account is not active. Please contact support.",
      });
    }

    // 4. Generate JWT token (role: vendor)
    const token = jwt.sign(
      { id: vendorBranch._id, role: "vendor", mainVendorId: mainVendor._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    const vendorData = vendorBranch.toObject();

    res.status(200).json({
      status: true,
      message: "Login successful",
      token,
      user: {
        ...vendorData,
        role: "vendor",
      },
    });
  } catch (error) {
    console.error("Vendor branch login error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.createVendor = async (req, res) => {
  try {
    let {
      name,
      email,
      phone,
      address,
      city,
      state,
      status,
      branchId,
      mainVendorId,
    } = req.body;

    const vendorNameExists = await Vendor.findOne({ name });
    if (vendorNameExists) {
      return res.status(400).json({
        status: false,
        message: "Name is already in use",
      });
    }

    if (email) {
      const vendorEmailExists = await Vendor.findOne({ email });
      if (vendorEmailExists) {
        return res.status(400).json({
          status: false,
          message: "Email is already in use",
        });
      }
    }

    const finalBranchId = branchId || generateBranchId();

    const newVendor = new Vendor({
      name,
      email,
      phone,
      address,
      city,
      state,
      branchId: finalBranchId,
      mainVendorId,
      status: status || "Active",
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    });

    await newVendor.save();

    res.status(201).json({
      status: true,
      message: "Vendor (Branch) created successfully",
      vendor: newVendor,
    });
  } catch (error) {
    console.error("Create vendor error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const { mainVendorId } = req.query;
    let query = {};
    if (mainVendorId) {
      query.mainVendorId = mainVendorId;
    }

    const vendors = await Vendor.find(query).populate("mainVendorId", "name");
    const vendorIds = vendors.map((v) => v._id);

    res.status(200).json({ status: true, vendors });
  } catch (error) {
    console.error("Get vendors error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id).populate("mainVendorId", "name");
    if (!vendor) {
      return res
        .status(404)
        .json({ status: false, message: "Vendor not found" });
    }

    res.status(200).json({
      status: true,
      vendor,
    });
  } catch (error) {
    console.error("Get vendor by id error:", error);
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
      status,
      branchId,
      mainVendorId,
    } = req.body;

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

    if (name) vendor.name = name;
    if (email) vendor.email = email;
    if (phone) vendor.phone = phone;
    if (address) vendor.address = address;
    if (city) vendor.city = city;
    if (state) vendor.state = state;
    if (status) vendor.status = status;
    if (branchId !== undefined) vendor.branchId = branchId;
    if (mainVendorId !== undefined) vendor.mainVendorId = mainVendorId;

    vendor.updatedBy = req.user?.id;
    await vendor.save();

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

    res
      .status(200)
      .json({ status: true, message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("Delete vendor error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

// Auth-related logic removed. Individual Branch accounts are managed under Main Vendor.

exports.exportVendors = async (req, res) => {
  try {
    const { state, city, status, from, to, search } = req.body;

    let query = {};

    if (state) query.state = state;
    if (city) query.city = city;
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
      ];
    }

    const vendors = await Vendor.find(query);

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
      { header: "Joined Date", key: "joinedDate", width: 20 },
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
        email: vendor.email || "N/A",
        phone: vendor.phone || "N/A",
        address: vendor.address || "N/A",
        city: vendor.city || "N/A",
        state: vendor.state || "N/A",
        status: vendor.status,
        joinedDate: vendor.joinedDate
          ? new Date(vendor.joinedDate).toLocaleDateString()
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
