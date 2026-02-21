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

        res.status(200).json({ status: true, message: "Login successful", token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const hashed = await bcrypt.hash(req.body.password, 10);

        await Admin.updateOne(
            { username: "admin" },
            { password: hashed }
        );

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Update password error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};