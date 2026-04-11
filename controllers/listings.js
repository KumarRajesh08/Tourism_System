const Listing = require("../models/listing");
const Reservation = require("../models/reservation");
const nodemailer = require("nodemailer");

module.exports.index = async (req, res) => {
  let allListings = await Listing.find();
  res.render("./listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res, next) => {
  try {
    if (!req.file) {
      req.flash("error", "Please upload an image!");
      return res.redirect("/listings/new");
    }
    if (!req.body.listing.category) {
      req.flash("error", "Please select a category!");
      return res.redirect("/listings/new");
    }
    let url = req.file.path;
    let filename = req.file.filename;
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = { filename, url };
    await newListing.save();
    req.flash("success", "New listing created!");
    res.redirect("/listings");
  } catch (err) {
    console.log("CREATE LISTING ERROR:", err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");
      req.flash("error", messages);
      return res.redirect("/listings/new");
    }
    next(err);
  }
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you trying to edit for does not exist!");
    return res.redirect("/listings");
  }
  let imageUrl = listing.image.url;
  imageUrl = imageUrl.replace("/upload", "/upload/w_250,h_160");
  res.render("listings/edit.ejs", { listing, imageUrl });
};

module.exports.updateListing = async (req, res, next) => {
  try {
    let { id } = req.params;
    let updatedListing = await Listing.findByIdAndUpdate(id, {
      ...req.body.listing,
    });
    if (typeof req.file !== "undefined") {
      let url = req.file.path;
      let filename = req.file.filename;
      updatedListing.image = { url, filename };
      await updatedListing.save();
    }
    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.log("UPDATE LISTING ERROR:", err);
    next(err);
  }
};

module.exports.filter = async (req, res, next) => {
  let { id } = req.params;
  let allListings = await Listing.find({ category: { $all: [id] } });
  if (allListings.length != 0) {
    res.locals.success = `Listings Filtered by ${id}!`;
    return res.render("listings/index.ejs", { allListings });
  } else {
    req.flash("error", `There is no any Listing for ${id}!`);
    return res.redirect("/listings");
  }
};

module.exports.search = async (req, res) => {
  let input = req.query.q.trim().replace(/\s+/g, " ");
  if (input == "" || input == " ") {
    req.flash("error", "Please enter search query!");
    return res.redirect("/listings");
  }

  let data = input.split("");
  let element = "";
  let flag = false;
  for (let index = 0; index < data.length; index++) {
    if (index == 0 || flag) {
      element = element + data[index].toUpperCase();
    } else {
      element = element + data[index].toLowerCase();
    }
    flag = data[index] == " ";
  }

  let allListings = await Listing.find({
    title: { $regex: element, $options: "i" },
  });
  if (allListings.length != 0) {
    res.locals.success = "Listings searched by Title!";
    return res.render("listings/index.ejs", { allListings });
  }

  allListings = await Listing.find({
    category: { $regex: element, $options: "i" },
  }).sort({ _id: -1 });
  if (allListings.length != 0) {
    res.locals.success = "Listings searched by Category!";
    return res.render("listings/index.ejs", { allListings });
  }

  allListings = await Listing.find({
    country: { $regex: element, $options: "i" },
  }).sort({ _id: -1 });
  if (allListings.length != 0) {
    res.locals.success = "Listings searched by Country!";
    return res.render("listings/index.ejs", { allListings });
  }

  allListings = await Listing.find({
    location: { $regex: element, $options: "i" },
  }).sort({ _id: -1 });
  if (allListings.length != 0) {
    res.locals.success = "Listings searched by Location!";
    return res.render("listings/index.ejs", { allListings });
  }

  const intValue = parseInt(element, 10);
  const intDec = Number.isInteger(intValue);

  if (intDec) {
    allListings = await Listing.find({ price: { $lte: element } }).sort({
      price: 1,
    });
    if (allListings.length != 0) {
      res.locals.success = `Listings searched by price less than Rs ${element}!`;
      return res.render("listings/index.ejs", { allListings });
    }
  }

  req.flash("error", "No listings found based on your search!");
  return res.redirect("/listings");
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};

module.exports.reserveListing = async (req, res) => {
  let { id } = req.params;
  try {
    // Guard: must be logged in
    if (!req.user) {
      req.flash("error", "You must be logged in to reserve a listing!");
      return res.redirect("/login");
    }

    let listing = await Listing.findById(id).populate("owner");

    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    if (!listing.owner) {
      req.flash("error", "This listing has no owner assigned!");
      return res.redirect(`/listings/${id}`);
    }

    const guest = req.user;

    // ── Generate Unique Booking ID ──
    const bookingId = `RSVN-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    // ── Save Reservation to Database ──
    const newReservation = new Reservation({
      listing: listing._id,
      guest: guest._id,
      owner: listing.owner._id,
      price: listing.price,
      bookingId: bookingId,
    });
    await newReservation.save();

    // ── Transporter Setup (Gmail) ──
    const emailUser = (process.env.EMAIL_USER || "").trim();
    const emailPass = (process.env.EMAIL_PASS || "").trim();
    const senderEmail = (process.env.SENDER_EMAIL || emailUser || "noreply@tourism.com").trim();

    if (!emailUser || !emailPass) {
      console.error("CRITICAL: Gmail Credentials missing in .env");
      req.flash("success", `Reservation confirmed (ID: ${bookingId}), but we couldn't send the email report because of a server configuration issue.`);
      return res.redirect(`/listings/${id}`);
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    // ── Email Content (3D Animation Style) ──
    const assetUrl = "https://res.cloudinary.com/dc7sk6jgs/image/upload/v1775876881/tourism_system_assets/jyhixjul2c8gpoeo34ku.jpg";

    const guestMail = {
      from: `"Tourism System" <${senderEmail}>`,
      to: guest.email,
      subject: `✨ Your 3D Booking Report — ${listing.title}`,
      html: `
        <div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border-radius: 30px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.5);">
            <!-- 3D Header Image -->
            <div style="width: 100%; height: 260px; overflow: hidden; background: #1D9E75;">
              <img src="${assetUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="3D Vacation Header">
            </div>
            
            <div style="padding: 40px;">
              <div style="display: inline-block; background: #E6F4EA; color: #1D9E75; padding: 6px 16px; border-radius: 50px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">
                Confirmed Booking
              </div>
              <h1 style="color: #111827; margin: 0; font-size: 28px; font-weight: 800; line-height: 1.2;">Pack your bags, ${guest.username}!</h1>
              <p style="color: #4b5563; font-size: 16px; margin: 15px 0 30px 0; line-height: 1.6;">Your 3D reservation report for <b>${listing.title}</b> is ready. Here are the details of your stay:</p>
              
              <!-- Glass Card for Info -->
              <div style="background: white; border-radius: 20px; padding: 25px; border: 1px solid #f1f5f9; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Booking ID</td>
                    <td style="padding: 10px 0; color: #111827; font-size: 15px; font-weight: 700; text-align: right; font-family: monospace;">${bookingId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Price Nightly</td>
                    <td style="padding: 10px 0; color: #111827; font-size: 15px; font-weight: 700; text-align: right;">₹${listing.price.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Location</td>
                    <td style="padding: 10px 0; color: #111827; font-size: 15px; font-weight: 700; text-align: right;">${listing.location}</td>
                  </tr>
                </table>
              </div>

              <!-- 3D CTA Button -->
              <div style="text-align: center; margin-top: 40px;">
                <a href="${process.env.APP_URL || "http://localhost:3000"}/listings/${listing._id}" 
                  style="display: inline-block; padding: 18px 45px; background: linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%); color: white; text-decoration: none; border-radius: 15px; font-weight: 700; font-size: 16px; box-shadow: 0 10px 20px rgba(29, 158, 117, 0.3), inset 0 -3px 0 rgba(0,0,0,0.1); transition: all 0.3s ease;">
                  View Live Listing
                </a>
              </div>
            </div>
            
            <div style="padding: 20px; background: rgba(0,0,0,0.02); text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid rgba(0,0,0,0.05);">
              © ${new Date().getFullYear()} Tourism System. Interactive 3D Experience.
            </div>
          </div>
        </div>
      `,
    };

    const ownerMail = {
      from: `"Tourism System" <${senderEmail}>`,
      to: listing.owner.email,
      subject: `🚀 New Booking Activity — ${listing.title}`,
      html: `
        <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: rgba(30, 41, 59, 0.9); backdrop-filter: blur(10px); border-radius: 30px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05);">
            <div style="width: 100%; height: 260px; overflow: hidden; background: #111827;">
              <img src="${assetUrl}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" alt="3D Activity Header">
            </div>
            <div style="padding: 40px;">
              <div style="display: inline-block; background: rgba(29, 158, 117, 0.1); color: #1D9E75; padding: 6px 16px; border-radius: 50px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px;">
                New Activity Detected
              </div>
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; line-height: 1.2;">Host Alert: New Booking!</h1>
              <p style="color: #94a3b8; font-size: 16px; margin: 15px 0 30px 0; line-height: 1.6;">Your property <b>${listing.title}</b> has received an interactive reservation from <b>${guest.username}</b>.</p>
              
              <div style="background: rgba(15, 23, 42, 0.5); border-radius: 20px; padding: 25px; border: 1px solid rgba(255,255,255,0.05);">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Estimated Earnings</td>
                    <td style="padding: 10px 0; color: #1D9E75; font-size: 18px; font-weight: 800; text-align: right;">₹${listing.price.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Guest Reference</td>
                    <td style="padding: 10px 0; color: #e2e8f0; font-size: 14px; text-align: right;">${guest.email}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin-top: 40px;">
                <a href="${process.env.APP_URL || "http://localhost:3000"}/listings/${listing._id}" 
                  style="display: inline-block; padding: 18px 45px; background: white; color: #0f172a; text-decoration: none; border-radius: 15px; font-weight: 700; font-size: 16px; box-shadow: 0 10px 25px rgba(255,255,255,0.1); transition: all 0.3s ease;">
                  Manage Booking
                </a>
              </div>
            </div>
            <div style="padding: 20px; background: rgba(0,0,0,0.2); text-align: center; color: #475569; font-size: 11px;">
              PARTNER ECOSYSTEM • 3D INTERACTIVE REPORTS
            </div>
          </div>
        </div>
      `,
    };


    // ── Send Mails ──
    const fs = require("fs");
    const logFile = "mail_debug.log";
    let guestMailSent = false;

    try {
      await transporter.sendMail(guestMail);
      guestMailSent = true;
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] SUCCESS Guest: ${guest.email} - ID: ${bookingId}\n`);
      
      // Send to owner as well (background)
      transporter.sendMail(ownerMail).then(() => {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] SUCCESS Owner: ${listing.owner.email} - ID: ${bookingId}\n`);
      }).catch(err => {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] FAILED Owner: ${listing.owner.email} - Error: ${err.message}\n`);
      });

    } catch (mailErr) {
      console.error("MAIL ERROR:", mailErr.message);
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] FAILED Guest: ${guest.email} - Error: ${mailErr.message}\n`);
    }

    if (guestMailSent) {
      req.flash("success", `Reservation confirmed! Booking ID: ${bookingId}. The report has been sent to your email.`);
    } else {
      req.flash("success", `Reservation confirmed! (Booking ID: ${bookingId}). Note: We had trouble sending the email report, please check your reservation history.`);
    }
    
    res.redirect(`/listings/${id}`);

  } catch (err) {
    console.error("RESERVE ROUTE ERROR:", err);
    req.flash("error", `Something went wrong: ${err.message}`);
    res.redirect(`/listings/${id}`);
  }
};