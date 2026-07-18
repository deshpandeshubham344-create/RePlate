
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
  getRoute,
  confirmPickup,
  getMyFood,
  getVolunteerFood,
  getNearbyVolunteers,
  assignVolunteer,
  acceptRequest,          // ✅ ADD
  rejectRequest,          // ✅ ADD
  requestVolunteers,      // ✅ ADD
  reachedRestaurant,
  reachedNgo
} = require("../controllers/foodController");

const {
  verifyToken,
  authorizeRoles
} = require("../middleware/authMiddleware");

router.post("/create",verifyToken,authorizeRoles("restaurant"), upload.single("image"), createFoodListing);

// 🔥 NGO → View nearby food
router.get("/available", verifyToken, authorizeRoles("ngo"), getAvailableFood);

// 🔥 NGO → Accept food
router.put("/accept/:foodId", verifyToken, authorizeRoles("ngo"), acceptFoodRequest);

router.put("/request-volunteers/:foodId", verifyToken, authorizeRoles("ngo"), requestVolunteers);

router.put("/assign-volunteer/:foodId",verifyToken,authorizeRoles("ngo"),assignVolunteer);

router.put("/accept-request/:foodId", verifyToken, authorizeRoles("volunteer"), acceptRequest);

router.put("/reject-request/:foodId", verifyToken, authorizeRoles("volunteer"), rejectRequest);

// 🔥 VOLUNTEER → Send location
router.put("/location/:foodId", verifyToken, authorizeRoles("volunteer"), updateLocation);

// 🔥 NGO/Restaurant → Get live location
router.get("/location/:foodId",verifyToken,authorizeRoles("restaurant", "ngo", "volunteer"),getLiveLocation);

// 🔥 ROUTE API (VERY IMPORTANT)
router.get("/route/:foodId", verifyToken, authorizeRoles("restaurant", "ngo", "volunteer"), getRoute);

// 🔥 RESTAURANT → Confirm pickup
router.put("/confirm-pickup/:foodId",verifyToken,authorizeRoles("restaurant"),confirmPickup);

// 🔥 VOLUNTEER → Complete delivery
router.put("/complete/:foodId", verifyToken, authorizeRoles("ngo"), completeDelivery);


// 🔥 RESTAURANT → My food
router.get("/my-food", verifyToken, authorizeRoles("restaurant"), getMyFood);

// 🔥 VOLUNTEER → Assigned food
router.get("/volunteer-food", verifyToken, authorizeRoles("volunteer"), getVolunteerFood);

// 🔥 NGO → Nearby volunteers
router.get("/nearby-volunteers/:foodId", verifyToken, authorizeRoles("ngo"), getNearbyVolunteers);

router.put("/reached-restaurant/:foodId",verifyToken,authorizeRoles("volunteer"),reachedRestaurant);

router.put("/reached-ngo/:foodId",verifyToken,authorizeRoles("volunteer"),reachedNgo);


// ⚠️ KEEP THIS LAST (GENERIC ROUTE)
router.get("/:foodId", verifyToken, async (req, res) => {
  const food = await FoodListing.findById(req.params.foodId)
    .populate("restaurantId")
    .populate("ngoId")                // 🔥 ADD THIS
    .populate("volunteerId");   // (optional but good)

  if (!food) {
    return res.status(404).json({ message: "Food not found" });
  }
  res.json(food);
});

module.exports = router;