
const Idea = require("../models/Idea");

exports.getIdeas = async (req, res) => {
  try {
    const ideas = await Idea.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.status(200).json(ideas);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createIdea = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const idea = await Idea.create({
      title,
      description,
      category,
      user: req.user.id
    });
    res.status(201).json(idea);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  } 
};
