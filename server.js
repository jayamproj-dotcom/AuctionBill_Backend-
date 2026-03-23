require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");
const seedAdmin = require("./src/utils/seedAdmin");

const PORT = process.env.PORT;

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
