const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

//Admin Routes
app.use("/api/admin", require("./routes/adminRoute"));

//Subscription Routes
app.use("/api/subscription", require("./routes/subscriptions.Route"));

//Vendor Routes
app.use("/api/vendor", require("./routes/vendorRoute"));

module.exports = app;