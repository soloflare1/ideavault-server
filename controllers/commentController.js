
const Comment = require("../models/Comment");

exports.getCommentsByIdea = async (req, res) => {
  try {
    const comments = await Comment.find({ idea: req.params.ideaId }).populate('user', 'name').sort({ createdAt: -1 });  
    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { text, ideaId } = req.body;
    const comment = await Comment.create({
      text,
      idea: ideaId,
      user: req.user.id
    });
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
