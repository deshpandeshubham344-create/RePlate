const express = require("express");
const router = express.Router();

const Food = require("../models/FoodListing");
const User = require("../models/User");

// GET /api/stats
router.get("/", async (req, res) => {
  try {
    const meals = await Food.countDocuments();
    const volunteers = await User.countDocuments({ role: "volunteer" });
    const restaurants = await User.countDocuments({ role: "restaurant" });
    const ngos = await User.countDocuments({ role: "ngo" }); // 👈 NEW

    res.json({
      meals,
      volunteers,
      restaurants,
      ngos
    });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;