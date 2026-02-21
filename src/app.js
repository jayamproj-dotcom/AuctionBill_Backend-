const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

//Admin Routes
app.use("/api/admin", require("./routes/adminRoute"));

module.exports = app;