const bcrypt = require("bcryptjs");
const Admin = require("../models/admin");

const seedAdmin = async () => {
    const existing = await Admin.findOne({ username: "admin" });

    if (!existing) {
        const hashed = await bcrypt.hash("admin@123", 10);

        await Admin.create({
            username: "admin",
            password: hashed,
            role: "admin"
        });

        console.log("Default admin created");
    } else {
        console.log("Admin already exists");
    }
};

module.exports = seedAdmin;