const express = require("express");
const backupMongoDB = require("../utils/backup");

const router = express.Router();

router.get("/backup", async (req, res) => {
    try {
        backupMongoDB();
        res.json({ success: true, message: "Backup process started manually." });
    } catch (err) {
        res.status(500).json({ error: "Manual backup failed." });
    }
});

module.exports = router;
