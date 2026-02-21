require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const seedAdmin = require("./src/utils/seedAdmin");
const connectDB = require("./src/config/db");

connectDB().then(() => {
  seedAdmin();
});