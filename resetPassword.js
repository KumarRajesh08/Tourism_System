require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/user");

async function resetPassword() {
  await mongoose.connect(process.env.ATLASDB_URL);
  console.log("Connected to DB");

  const user = await User.findOne({ username: "sunny" });
  if (!user) {
    console.log("❌ User not found");
    return mongoose.disconnect();
  }

  await new Promise((resolve, reject) => {
    user.setPassword("admin123", async (err) => {
      if (err) return reject(err);
      await user.save();
      resolve();
    });
  });

  console.log("✅ Password reset successfully!");
  console.log("   Username: sunny");
  console.log("   Password: admin123");
  await mongoose.disconnect();
}

resetPassword().catch(console.error);
