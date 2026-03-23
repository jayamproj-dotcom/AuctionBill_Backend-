const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(origin => origin.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// strip /auction prefix
app.use((req, res, next) => {
  if (req.url.startsWith("/auction")) {
    req.url = req.url.replace(/^\/auction/, "");
  }
  next();
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

// Session Routes
app.use("/api/session", require("./routes/sessionRoute"));

app.use("/api/authme", require("./routes/authmeRoute"));

app.get("/api/test", (req, res) => {
  res.send("Auction API Working ✅");
});


module.exports = app;
