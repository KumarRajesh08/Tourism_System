const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin");
const { isLoggedIn, isAdmin } = require("../middlewares");

router.get("/", isLoggedIn, isAdmin, adminController.dashboard);
router.post("/users/:id/toggle-role", isLoggedIn, isAdmin, adminController.toggleUserRole);
router.delete("/listings/:id", isLoggedIn, isAdmin, adminController.deleteListing);

module.exports = router;
