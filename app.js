if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION:', err);
});

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const csrf = require("csurf");                          

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

app.use(express.static(path.join(__dirname, "/public")));
app.engine("ejs", ejsMate);
app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));

const dbUrl = process.env.ATLASDB_URL;

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,                           
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",     
    sameSite: "strict",                                
  },
};

// ── Session & Flash ───────────────────────────────────────────
app.use(session(sessionOptions));
app.use(flash());

// ── Passport ──────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ── CSRF (session ke baad, passport ke baad lagao) ────────────
const csrfProtection = csrf();                        
app.use(csrfProtection);                              

// ── Global locals (flash + user + csrfToken) ──────────────────
app.use((req, res, next) => {
  res.locals.success    = req.flash("success");
  res.locals.error      = req.flash("error");
  res.locals.currUser   = req.user;
  res.locals.csrfToken  = req.csrfToken();             
});

// ── Routes ────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// ── CSRF Error Handler ────────────────────────────────────────
app.use((err, req, res, next) => {                     
  if (err.code === "EBADCSRFTOKEN") {
    req.flash("error", "Form expired ya invalid request. Please try again.");
    return res.redirect("back");
  }
  next(err);
});

// ── 404 Handler ───────────────────────────────────────────────
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Some Error Occured!" } = err;
  res.status(statusCode).render("./listings/error.ejs", { message });
});

// ── Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});