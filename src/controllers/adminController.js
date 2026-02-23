const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(400).json({ status: false, message: "User not found" });

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
                id: admin._id
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
