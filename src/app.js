const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api", (req, res) => {
  res.json({ message: "API working" });
});

//Admin Routes
app.use("/api/admin", require("./routes/adminRoute"));

//Main Vendor Routes
app.use("/api/main-vendor", require("./routes/mainVendorRoute"));

//Subscription Routes
app.use("/api/subscription", require("./routes/subscriptionsRoute"));

//Vendor Routes
app.use("/api/vendor", require("./routes/vendorRoute"));

//Notification Routes
app.use("/api/notification", require("./routes/notificationRoute"));

//Product Routes
app.use("/api/product", require("./routes/productRoute"));

//Commission Routes
app.use("/api/commission", require("./routes/commissionRoute"));

//Seller Routes
app.use("/api/seller", require("./routes/sellerRoute"));

//Buyer Routes
app.use("/api/buyer", require("./routes/buyerRoute"));

//Auction Routes
app.use("/api/auction", require("./routes/auctionRoute"));

//Dashboard Routes
app.use("/api/dashboard", require("./routes/dashboardRoute"));

//Billing Routes
app.use("/api/billing", require("./routes/billingRoutes"));

module.exports = app;
