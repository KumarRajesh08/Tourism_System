const User = require("../models/user.js");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const fs = require("fs");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password } = req.body;
    let newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);

    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount === 0) {
      registeredUser.role = "admin";
      await registeredUser.save();
      req.flash("success", "Welcome to Tourism_System! You have been created as Admin.");
    } else {
      req.flash("success", "Welcome to Tourism_System!");
    }

    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      res.redirect("/listings");
    });
  } catch (error) {
    req.flash("error", error.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back to Tourism_System!");
  let redirectUrl = res.locals.redirectUrl || "/listings";
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  });
};

module.exports.renderForgotPasswordForm = (req, res) => {
  res.render("users/forgot.ejs");
};

module.exports.forgotPassword = async (req, res) => {
  const { username } = req.body;
  const user = await User.findOne({ username });

  if (!user) {
    req.flash("error", "No account with that username exists.");
    return res.redirect("/forgot-password");
  }

  const token = crypto.randomBytes(20).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  await user.save();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    to: user.email,
    from: `"Tourism System" <${process.env.SENDER_EMAIL || process.env.EMAIL_USER}>`,
    subject: "Tourism System Password Reset",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #2c3e50; text-align: center;">Password Reset Request</h2>
        <p style="font-size: 16px; color: #555;">You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
        <p style="font-size: 16px; color: #555;">Please click on the following button to complete the process:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://${req.headers.host}/reset/${token}" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Reset Password</a>
        </div>
        <p style="font-size: 14px; color: #888;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <p style="font-size: 14px; color: #888;">This link will expire in 1 hour.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="text-align: center; font-size: 12px; color: #aaa;">&copy; 2026 Tourism System. All rights reserved.</p>
      </div>
    `,
  };

  const logFile = "mail_debug.log";
  try {
    await transporter.sendMail(mailOptions);
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] SUCCESS Reset: ${user.email} - Token: ${token}\n`);
    req.flash("success", `An e-mail has been sent to ${user.email} with further instructions.`);
  } catch (error) {
    console.error("FORGOT PASSWORD MAIL ERROR:", error.message);
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] FAILED Reset: ${user.email} - Error: ${error.message}\n`);
    req.flash("error", "Error sending password reset email. Please try again later.");
  }
  
  res.redirect("/forgot-password");
};

module.exports.renderResetPasswordForm = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "Password reset token is invalid or has expired.");
    return res.redirect("/forgot-password");
  }

  res.render("users/reset.ejs", { token: req.params.token });
};

module.exports.resetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    req.flash("error", "Passwords do not match.");
    return res.redirect("back");
  }

  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "Password reset token is invalid or has expired.");
    return res.redirect("/forgot-password");
  }

  await user.setPassword(password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  req.login(user, (err) => {
    if (err) return next(err);
    req.flash("success", "Success! Your password has been changed.");
    res.redirect("/listings");
  });
};
