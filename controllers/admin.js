const User = require("../models/user");
const Listing = require("../models/listing");

module.exports.dashboard = async (req, res) => {
  const users = await User.find().select("username email role").sort({ role: -1, username: 1 });
  const listings = await Listing.find().populate("owner").sort({ createdAt: -1 });

  res.render("admin/dashboard", { users, listings });
};

module.exports.toggleUserRole = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    req.flash("error", "User not found.");
    return res.redirect("/admin");
  }
  if (user.role === "admin") {
    user.role = "user";
    req.flash("success", `${user.username} changed to user.`);
  } else {
    user.role = "admin";
    req.flash("success", `${user.username} promoted to admin.`);
  }
  await user.save();
  res.redirect("/admin");
};

module.exports.deleteListing = async (req, res) => {
  const { id } = req.params;
  const deleted = await Listing.findByIdAndDelete(id);
  if (!deleted) {
    req.flash("error", "Listing not found.");
    return res.redirect("/admin");
  }
  req.flash("success", "Listing deleted by admin.");
  res.redirect("/admin");
};
