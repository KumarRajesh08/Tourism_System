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

    // ── Transporter: Brevo SMTP ──
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER.trim(),
        pass: process.env.BREVO_SMTP_KEY.trim(),
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
    });

    // ── Pre-Check Configuration ──
    const senderEmail = (process.env.SENDER_EMAIL || process.env.EMAIL_USER).trim();

    // ── Mail to Guest (Report Format) ──
    const guestMail = {
      from: `"Tourism System" <${senderEmail}>`,
      to: guest.email,
      subject: `🏡 Reservation Confirmed — ${listing.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background: #1D9E75; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏡 Reservation Confirmed!</h1>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 18px; color: #111827;">Hi <b>${guest.username}</b>,</p>
            <p style="color: #4b5563;">Your reservation request has been sent successfully. Here are your booking details:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e5e7eb;">
              <tr style="background: #f9fafb;">
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; color: #374151;">Property</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${listing.title}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; color: #374151;">Location</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${listing.location}, ${listing.country}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; color: #374151;">Price</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">₹${listing.price.toLocaleString("en-IN")} / night</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; color: #374151;">Category</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${listing.category}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 12px; font-weight: bold; color: #374151;">Owner</td>
                <td style="padding: 12px; color: #111827;">${listing.owner.username}</td>
              </tr>
            </table>

            <p style="color: #6b7280; font-size: 14px;">The property owner will contact you shortly to confirm the dates.</p>
            
            <div style="text-align: center; margin-top: 24px;">
              <a href="${process.env.APP_URL || "http://localhost:8080"}/listings/${listing._id}"
                style="background: #1D9E75; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                View Listing
              </a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 14px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
            Tourism System &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    };

    // ── Mail to Owner (Report Format) ──
    const ownerMail = {
      from: `"Tourism System" <${senderEmail}>`,
      to: listing.owner.email,
      subject: `🔔 New Reservation — ${listing.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background: #111827; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔔 New Reservation Request!</h1>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 18px; color: #111827;">Hi <b>${listing.owner.username}</b>,</p>
            <p style="color: #4b5563;">Someone is interested in your property. Here are the booking details:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e5e7eb;">
              <tr style="background: #f9fafb;">
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; color: #374151;">Property</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${listing.title}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; color: #374151;">Guest Name</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${guest.username}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; color: #374151;">Guest Email</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${guest.email}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #374151;">Earnings</td>
                <td style="padding: 12px; color: #1D9E75; font-weight: bold;">₹${listing.price.toLocaleString("en-IN")}</td>
              </tr>
            </table>

            <p style="color: #6b7280; font-size: 14px;">Please contact the guest to confirm the dates and stay details.</p>
            
            <div style="text-align: center; margin-top: 24px;">
              <a href="${process.env.APP_URL || "http://localhost:8080"}/listings/${listing._id}"
                style="background: #111827; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                Manage Listing
              </a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 14px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
            Tourism System &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    };

    // ── Send Both Mails ──
    const fs = require("fs");
    const logFile = "mail_debug.log";
    try {
      const guestResult = await transporter.sendMail(guestMail);
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] SUCCESS Guest: ${guest.email} - ID: ${guestResult.messageId}\n`);
      console.log(`✓ Mail sent to guest: ${guest.email}`);

      try {
        const ownerResult = await transporter.sendMail(ownerMail);
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] SUCCESS Owner: ${listing.owner.email} - ID: ${ownerResult.messageId}\n`);
        console.log(`✓ Mail sent to owner: ${listing.owner.email}`);
      } catch (ownerErr) {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] FAILED Owner: ${listing.owner.email} - Error: ${ownerErr.message}\n`);
        console.log("✓ Owner mail failed but guest mail was sent.");
      }
    } catch (guestErr) {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] FAILED Guest: ${guest.email} - Error: ${guestErr.message}\n`);
      console.log("RESERVE MAIL ERROR:", guestErr.message);
    }

    req.flash("success", `Reservation confirmed! ID: ${bookingId}. Report sent to your email.`);
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.log("RESERVE ERROR:", err);
    req.flash("error", `Reservation failed: ${err.message}`);
    res.redirect(`/listings/${id}`);
  }
};