const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

//Admin Routes
app.use("/api/admin", require("./routes/adminRoute"));


//Subscription Routes
app.use("/api/subscription", require("./routes/subscriptions.Route"));

module.exports = app;