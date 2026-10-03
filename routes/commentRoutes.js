
const express = require("express");
const router = express.Router();
const { getCommentsByIdea, addComment } = require("../controllers/commentController");
const { protect } = require("../middleware/authMiddleware");

router.get("/:ideaId", getCommentsByIdea);
router.post("/", protect, addComment);

module.exports = router;