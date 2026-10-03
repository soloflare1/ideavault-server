
const express = require("express");
const router = express.Router();
const { getIdeas, createIdea } = require("../controllers/ideaController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", getIdeas);
router.post("/", protect, createIdea);

module.exports = router;