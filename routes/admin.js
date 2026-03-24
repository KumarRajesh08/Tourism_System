const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin");
const { isLoggedIn, isAdmin } = require("../middlewares");
const csrf = require("csurf");
const csrfProtection = csrf();

router.get("/", isLoggedIn, isAdmin, adminController.dashboard);
router.post("/users/:id/toggle-role", isLoggedIn, isAdmin, csrfProtection, adminController.toggleUserRole);
router.delete("/listings/:id", isLoggedIn, isAdmin, csrfProtection, adminController.deleteListing);

module.exports = router;
