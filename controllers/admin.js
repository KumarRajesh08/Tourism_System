const User = require("../models/user");
const Listing = require("../models/listing");
const Reservation = require("../models/reservation");
const nodemailer = require("nodemailer");

module.exports.dashboard = async (req, res) => {
  const users = await User.find().select("username email role").sort({ role: -1, username: 1 });
  const listings = await Listing.find().populate("owner").sort({ createdAt: -1 });
  const reservations = await Reservation.find()
    .populate("guest")
    .populate("owner")
    .populate("listing")
    .sort({ createdAt: -1 });

  res.render("admin/dashboard", { users, listings, reservations });
};

module.exports.generateReport = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate("guest")
      .populate("owner")
      .populate("listing")
      .sort({ createdAt: -1 });

    if (reservations.length === 0) {
      req.flash("error", "No reservations found to generate a report.");
      return res.redirect("/admin");
    }

    const emailUser = (process.env.EMAIL_USER || "").trim();
    const emailPass = (process.env.EMAIL_PASS || "").trim();
    const senderEmail = (process.env.SENDER_EMAIL || emailUser).trim();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: emailUser, pass: emailPass },
    });

    const assetUrl = "https://res.cloudinary.com/dc7sk6jgs/image/upload/v1775876881/tourism_system_assets/jyhixjul2c8gpoeo34ku.jpg";

    let tableRows = reservations.map(r => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 15px; font-family: monospace; font-weight: bold; color: #1D9E75;">${r.bookingId}</td>
        <td style="padding: 15px; color: #1e293b; font-weight: 600;">${r.listing ? r.listing.title : 'Deleted'}</td>
        <td style="padding: 15px; color: #64748b;">${r.guest ? r.guest.username : 'N/A'}</td>
        <td style="padding: 15px; color: #1e293b; font-weight: 700; text-align: right;">₹${r.price.toLocaleString('en-IN')}</td>
      </tr>
    `).join("");

    const reportMail = {
      from: `"Tourism Global Admin" <${senderEmail}>`,
      to: req.user.email,
      subject: `📊 3D Analytics Report — ${new Date().toLocaleDateString()}`,
      html: `
        <div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 30px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.08);">
            
            <!-- 3D Analysis Header -->
            <div style="position: relative; height: 300px; background: #0f172a;">
              <img src="${assetUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Analytics Header">
              <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);">
                <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 800;">Global Analytics Report</h1>
                <p style="color: rgba(255,255,255,0.7); margin-top: 10px;">Snapshot generated on ${new Date().toLocaleString()}</p>
              </div>
            </div>

            <div style="padding: 40px;">
              <div style="display: flex; gap: 20px; margin-bottom: 40px;">
                <div style="flex: 1; background: #f1f5f9; padding: 20px; border-radius: 20px; text-align: center;">
                  <div style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700;">Total Net</div>
                  <div style="color: #1D9E75; font-size: 24px; font-weight: 800;">₹${reservations.reduce((sum, r) => sum + r.price, 0).toLocaleString('en-IN')}</div>
                </div>
                <div style="flex: 1; background: #f1f5f9; padding: 20px; border-radius: 20px; text-align: center;">
                  <div style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700;">Volume</div>
                  <div style="color: #1e293b; font-size: 24px; font-weight: 800;">${reservations.length} Bookings</div>
                </div>
              </div>

              <h3 style="color: #1e293b; margin-bottom: 20px; font-size: 18px;">Recent Transaction Log</h3>
              <div style="border: 1px solid #f1f5f9; border-radius: 20px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f8fafc; border-bottom: 1px solid #f1f5f9;">
                      <th style="padding: 15px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">ID</th>
                      <th style="padding: 15px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Listing</th>
                      <th style="padding: 15px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Guest</th>
                      <th style="padding: 15px; text-align: right; color: #64748b; font-size: 12px; text-transform: uppercase;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                </table>
              </div>

              <div style="text-align: center; margin-top: 40px;">
                <a href="${process.env.APP_URL || "http://localhost:3000"}/admin" 
                  style="display: inline-block; padding: 15px 35px; background: #0f172a; color: white; text-decoration: none; border-radius: 12px; font-weight: 700;">
                  Launch Admin Console
                </a>
              </div>
            </div>

            <div style="background: #0f172a; padding: 25px; text-align: center; color: #475569; font-size: 12px;">
              SECURE ADMIN MODULE • DATA VISUALIZATION ENGINE 
            </div>
          </div>
        </div>
      `
    };


    await transporter.sendMail(reportMail);
    req.flash("success", "Full reservations report generated and sent to your email!");
    res.redirect("/admin");

  } catch (err) {
    console.error("REPORT GENERATION ERROR:", err);
    req.flash("error", `Failed to generate report: ${err.message}`);
    res.redirect("/admin");
  }
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
