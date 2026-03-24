require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/user");

async function resetAdmin() {
  await mongoose.connect(process.env.ATLASDB_URL);
  console.log("Connected to DB");

  // Reset all other admins to users
  await User.updateMany({ role: "admin" }, { role: "user" });

  let user = await User.findOne({ username: "sunny6231" });

  if (!user) {
    console.log("Creating new user: sunny6231");
    // PassportLocalMongoose requires username and salt/hash, but we'll use register
    user = new User({ 
      username: "sunny6231", 
      email: "sunny6231@example.com",
      role: "admin"
    });
    // The register method is from passport-local-mongoose
    await User.register(user, "sunny6231");
    console.log("✅ User sunny6231 registered and set as admin.");
  } else {
    console.log("Updating existing user: sunny6231");
    user.role = "admin";
    await new Promise((resolve, reject) => {
      user.setPassword("sunny6231", async (err) => {
        if (err) return reject(err);
        await user.save();
        resolve();
      });
    });
    console.log("✅ User sunny6231 updated and set as admin.");
  }

  await mongoose.disconnect();
}

resetAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
