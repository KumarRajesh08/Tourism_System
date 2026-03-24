require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/user");

const TARGET_USERNAME = "sunny"; // <-- Change this if needed

async function makeAdmin() {
  await mongoose.connect(process.env.ATLASDB_URL);
  console.log("Connected to DB");

  const user = await User.findOne({ username: TARGET_USERNAME });

  if (!user) {
    console.log(`❌ User "${TARGET_USERNAME}" not found.`);
    const allUsers = await User.find().select("username email role");
    console.log("All users:", allUsers);
  } else {
    user.role = "admin";
    await user.save();
    console.log(`✅ "${TARGET_USERNAME}" is now admin!`);
  }

  await mongoose.disconnect();
}

makeAdmin().catch(console.error);
