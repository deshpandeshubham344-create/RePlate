
const FoodListing = require("../models/FoodListing");
const express = require("express");
const router = express.Router();
const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

const {
  createFoodListing,
  getAvailableFood,
  acceptFoodRequest,
  completeDelivery,
  updateLocation,
  getLiveLocation,
  assignVolunteer,
  getRoute,
  markPicked,
  getMyFood,
  getVolunteerFood,
  getNearbyVolunteers,
  acceptRequest,          // ✅ ADD
  rejectRequest,          // ✅ ADD
  requestVolunteers       // ✅ ADD
} = require("../controllers/foodController");

const {
  verifyToken,
  authorizeRoles
} = require("../middleware/authMiddleware");

console.log("getAvailableFood:", typeof getAvailableFood);
console.log("getLiveLocation:", typeof getLiveLocation);
console.log("getRoute:", typeof getRoute);
console.log("getNearbyVolunteers:", typeof getNearbyVolunteers);
console.log("getMyFood:", typeof getMyFood);
console.log("getVolunteerFood:", typeof getVolunteerFood);



router.post("/create",verifyToken,authorizeRoles("restaurant"), upload.single("image"), createFoodListing);

// 🔥 NGO → View nearby food
router.get("/available", verifyToken, authorizeRoles("ngo"), getAvailableFood);

// 🔥 NGO → Accept food
router.put("/accept/:foodId", verifyToken, authorizeRoles("ngo"), acceptFoodRequest);


// 🔥 VOLUNTEER → Mark picked
router.put("/picked/:foodId", verifyToken, authorizeRoles("volunteer"), markPicked);

// 🔥 VOLUNTEER → Complete delivery
router.put("/complete/:foodId", verifyToken, authorizeRoles("volunteer"), completeDelivery);

// 🔥 VOLUNTEER → Send location
router.put("/location/:foodId", verifyToken, authorizeRoles("volunteer"), updateLocation);

// 🔥 NGO/Restaurant → Get live location
router.get("/location/:foodId",verifyToken,authorizeRoles("restaurant", "ngo", "volunteer"),getLiveLocation);

// 🔥 ROUTE API (VERY IMPORTANT)
router.get("/route/:foodId", verifyToken, authorizeRoles("restaurant", "ngo", "volunteer"), getRoute);

// 🔥 NGO → Nearby volunteers
router.get("/nearby-volunteers/:foodId", verifyToken, authorizeRoles("ngo"), getNearbyVolunteers);

// 🔥 RESTAURANT → My food
router.get("/my-food", verifyToken, authorizeRoles("restaurant"), getMyFood);

// 🔥 VOLUNTEER → Assigned food
router.get("/volunteer-food", verifyToken, authorizeRoles("volunteer"), getVolunteerFood);


// ⚠️ KEEP THIS LAST (GENERIC ROUTE)
router.get("/:foodId", verifyToken, async (req, res) => {
  const food = await FoodListing.findById(req.params.foodId)
    .populate("restaurantId")
    .populate("ngoId")                // 🔥 ADD THIS
    .populate("assignedVolunteer");   // (optional but good)

  if (!food) {
    return res.status(404).json({ message: "Food not found" });
  }
console.log("FOOD DATA:", food);
  res.json(food);
});

router.put("/request-volunteers/:foodId", verifyToken, authorizeRoles("ngo"), requestVolunteers);

router.put("/accept-request/:foodId", verifyToken, authorizeRoles("volunteer"), acceptRequest);

router.put("/reject-request/:foodId", verifyToken, authorizeRoles("volunteer"), rejectRequest);

router.put('/update-location/:foodId', async (req, res) => {
  console.log("📍 API HIT");
  console.log("BODY:", req.body);

  const { lat, lng } = req.body;

  if (lat == null || lng == null) {
    console.log("❌ Invalid data received");
    return res.status(400).json({ error: "Invalid location data" });
  }

  try {
    const food = await FoodListing.findByIdAndUpdate(
      req.params.foodId,
      { currentLocation: { lat, lng } },
      { new: true }
    );

    console.log("✅ UPDATED:", food.currentLocation);

    res.json(food);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;