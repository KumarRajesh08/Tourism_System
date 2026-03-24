require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/user");

async function checkAndSetAdmin() {
  await mongoose.connect(process.env.ATLASDB_URL);
  console.log("Connected to DB");

  const admin = await User.findOne({ role: "admin" });

  if (!admin) {
    console.log("❌ No admin found. Promoting 'sunny' to admin.");
    const user = await User.findOne({ username: "sunny" });
    if (user) {
      user.role = "admin";
      await new Promise((resolve, reject) => {
        user.setPassword("admin123", async (err) => {
          if (err) return reject(err);
          await user.save();
          resolve();
        });
      });
      console.log("✅ 'sunny' is now admin with password: admin123");
    } else {
      console.log("❌ User 'sunny' not found.");
    }
  } else {
    console.log(`✅ Admin found: ${admin.username}`);
    await new Promise((resolve, reject) => {
      admin.setPassword("admin123", async (err) => {
        if (err) return reject(err);
        await admin.save();
        resolve();
      });
    });
    console.log(`✅ Password for ${admin.username} reset to: admin123`);
  }

  await mongoose.disconnect();
}

checkAndSetAdmin().catch(console.error);
