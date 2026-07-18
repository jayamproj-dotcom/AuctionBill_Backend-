const express = require("express");
const router = express.Router();
const authmeController = require("../controllers/authmeController");
const adminMiddleware = require("../middleware/adminMiddleware");

router.get("/", adminMiddleware, authmeController.getMe);

module.exports = router;