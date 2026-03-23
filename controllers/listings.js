const Listing = require("../models/listing");
const nodemailer = require("nodemailer");

// ── ✅ Brevo SMTP Transporter ──
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: "a5ccd4001@smtp-brevo.com", // Brevo login
    pass: process.env.BREVO_SMTP_KEY, // SMTP key
  },
});

// ── All Listings ──
module.exports.index = async (req, res) => {
  let allListings = await Listing.find();
  res.render("./listings/index.ejs", { allListings });
};

// ── New Form ──
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

// ── Show Listing ──
module.exports.showListing = async (req, res) => {
  let { id } = req.params;

  let listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  res.render("listings/show.ejs", { listing });
};

// ── Create Listing ──
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
    console.log("CREATE ERROR:", err);
    next(err);
  }
};

// ── Edit Form ──
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;

  let listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  let imageUrl = listing.image.url.replace("/upload", "/upload/w_250,h_160");

  res.render("listings/edit.ejs", { listing, imageUrl });
};

// ── Update Listing ──
module.exports.updateListing = async (req, res, next) => {
  try {
    let { id } = req.params;

    let updatedListing = await Listing.findByIdAndUpdate(id, {
      ...req.body.listing,
    });

    if (req.file) {
      updatedListing.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
      await updatedListing.save();
    }

    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);

  } catch (err) {
    console.log("UPDATE ERROR:", err);
    next(err);
  }
};

// ── Delete Listing ──
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;

  await Listing.findByIdAndDelete(id);

  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};

// ── 🔥 RESERVE (EMAIL FEATURE) ──
module.exports.reserveListing = async (req, res) => {
  let listingId = req.params.id;

  try {
    let listing = await Listing.findById(listingId).populate("owner");

    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    const guest = req.user;

    if (!guest.email || !listing.owner.email) {
      req.flash("error", "Email missing!");
      return res.redirect(`/listings/${listingId}`);
    }

    const appUrl = process.env.APP_URL || "https://tourism-system-2.onrender.com";

    // ── Mail to Guest ──
    await transporter.sendMail({
      from: `"Tourism System" systemt911@gmail.com`,
      to: guest.email,
      subject: `Reservation Confirmed - ${listing.title}`,
      html: `
        <h2>Reservation Confirmed!</h2>
        <p>Hello ${guest.username},</p>
        <p>Your booking request has been sent successfully.</p>
        <p><b>${listing.title}</b></p>
        <p>${listing.location}, ${listing.country}</p>
        <p>₹${listing.price}</p>
        <a href="${appUrl}/listings/${listing._id}">View Listing</a>
      `,
    });

    // ── Mail to Owner ──
    await transporter.sendMail({
      from: `"Tourism System" <your_verified_email@gmail.com>`,
      to: listing.owner.email,
      subject: `New Booking Request - ${listing.title}`,
      html: `
        <h2>New Booking Request</h2>
        <p>${guest.username} is interested in your property.</p>
        <p>Email: ${guest.email}</p>
        <p><b>${listing.title}</b></p>
      `,
    });

    req.flash("success", "Reservation successful! Email sent.");
    res.redirect(`/listings/${listingId}`);

  } catch (err) {
    console.log("EMAIL ERROR:", err);
    req.flash("error", "Email failed!");
    res.redirect(`/listings/${listingId}`);
  }
};