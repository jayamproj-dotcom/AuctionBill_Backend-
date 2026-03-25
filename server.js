require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");
const seedAdmin = require("./src/utils/seedAdmin");

const cron = require("node-cron");
const backupMongoDB = require("./src/utils/backup");
const PORT = process.env.PORT;
// Auto Backup Every 1 Hour
// cron.schedule("* * * * *", () => {
//   console.log("Running every 1 minute...");
//   backupMongoDB();
// });
// Allow app to start even if DB fails
connectDB()
  .then(() => {
    console.log("MongoDB Connected");
    seedAdmin();
  })
  .catch((err) => {
    console.error("DB Failed:", err.message);
  });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
