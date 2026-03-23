const Listing = require("../models/listing");
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
  try {
    let { id } = req.params;
    let listing = await Listing.findById(id).populate("owner");

    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    const guest = req.user;

    // ── Transporter Setup — Explicit IPv4 and Timeouts ✅ ──
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Strictly force IPv4 resolution to prevent connection timeout on some environments
      family: 4,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
      tls: {
        rejectUnauthorized: false
      }
    });





    // ── Mail to Guest ──
    const guestMail = {
      from: `"Tourism System" <${process.env.EMAIL_USER}>`,
      to: guest.email,
      subject: `✅ Reservation Confirmed — ${listing.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background: #1D9E75; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🏡 Reservation Confirmed!</h1>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px;">Hi <b>${guest.username}</b>,</p>
            <p>Your reservation request has been sent successfully. Here are your booking details:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="background: #f9fafb;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Property</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${listing.title}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Location</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${listing.location}, ${listing.country}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Price</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">₹${listing.price.toLocaleString("en-IN")} / night</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Category</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${listing.category}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Owner</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${listing.owner.username}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">The property owner will contact you shortly to confirm the dates.</p>
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.APP_URL || 'http://localhost:8080'}/listings/${listing._id}"
                style="background: #1D9E75; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View Listing
              </a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 14px; text-align: center; font-size: 12px; color: #9ca3af;">
            Tourism System &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    };

    // ── Mail to Owner ──
    const ownerMail = {
      from: `"Tourism System" <${process.env.EMAIL_USER}>`,
      to: listing.owner.email,
      subject: `🔔 New Reservation Request — ${listing.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background: #111827; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🔔 New Reservation Request!</h1>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px;">Hi <b>${listing.owner.username}</b>,</p>
            <p>Someone is interested in your property. Here are the details:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="background: #f9fafb;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Property</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${listing.title}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Guest Name</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${guest.username}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Guest Email</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${guest.email}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Price</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">₹${listing.price.toLocaleString("en-IN")} / night</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">Please contact the guest at <b>${guest.email}</b> to confirm booking dates.</p>
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.APP_URL || 'http://localhost:8080'}/listings/${listing._id}"
                style="background: #111827; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View Listing
              </a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 14px; text-align: center; font-size: 12px; color: #9ca3af;">
            Tourism System &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    };

    // ── Send Both Mails ──
    await transporter.sendMail(guestMail);
    await transporter.sendMail(ownerMail);

    req.flash("success", "Reservation confirmed! Details sent to your email.");
    res.redirect(`/listings/${id}`);

  } catch (err) {
    console.log("RESERVE ERROR:", err);
    req.flash("error", "Reservation failed. Please try again!");
    res.redirect(`/listings/${id}`);
  }
};
