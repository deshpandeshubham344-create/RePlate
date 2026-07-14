const FoodListing = require("../models/FoodListing");
const axios = require("axios");
const polyline = require("@mapbox/polyline");
const User = require("../models/User");


// DISTANCE FUNCTION
function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// CREATE FOOD
exports.createFoodListing = async (req, res) => {
  try {
    const { foodName, quantity, pickupTime, description } = req.body;

    const restaurant = await User.findById(req.user.id);

    if (!restaurant || !restaurant.location) {
      return res.status(400).json({ message: "Restaurant location missing" });
    }

    const food = new FoodListing({
      foodName,
      quantity,
      pickupTime,
      description,

      restaurantId: req.user.id,
      restaurantLocation: restaurant.location,

      status: "pending",

      // ✅ IMAGE FIELD
      image: req.file ? req.file.filename : null
    });

    await food.save();

    res.json({ message: "Food created", food });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
};

// GET AVAILABLE FOOD
exports.getAvailableFood = async (req, res) => {
  try {

    const ngo = await User.findById(req.user.id);

    if (!ngo || !ngo.location) {
      return res.status(400).json({ message: "NGO location missing" });
    }

    const foods = await FoodListing.find({
      status: { 
        $in: ["pending", "accepted", "requested", "assigned", "picked", "completed"] 
      }
    }).populate("restaurantId");

    const nearbyFoods = [];

    for (let food of foods) {

      if (!food.restaurantLocation) continue;

      const dist = getDistance(
        ngo.location.lat,
        ngo.location.lng,
        food.restaurantLocation.lat,
        food.restaurantLocation.lng
      );

      // 🔥 KEEP YOUR 5KM FILTER
      if (dist <= 5) {
        nearbyFoods.push({
          ...food._doc,
          distance: dist
        });
      }
    }

    res.json({ foodListings: nearbyFoods });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
};

// NGO ACCEPT
exports.acceptFoodRequest = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId);

    food.status = "accepted";
    food.ngoId = req.user.id;

    await food.save();

    res.json({ message: "Accepted. Request volunteers." });

  } catch {
    res.status(500).json({ message: "Error" });
  }
};

// REQUEST VOLUNTEERS
exports.requestVolunteers = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId);

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    if (!food.restaurantLocation || food.restaurantLocation.lat == null) {
      return res.status(400).json({ message: "Restaurant location missing" });
    }

    // ✅ ONLY FREE VOLUNTEERS
    const volunteers = await User.find({
      role: "volunteer",
      isAvailable: true,
      isBusy: false
    });

    // 🔥 JUST FOR INFO (UI PURPOSE)
    const nearbyVolunteers = volunteers.filter(v => {
      if (!v.location) return false;

      const dist = getDistance(
        v.location.lat,
        v.location.lng,
        food.restaurantLocation.lat,
        food.restaurantLocation.lng
      );

      return dist <= 5;
    });

    // ✅ SEND TO ALL FREE VOLUNTEERS
    food.requestedVolunteers = volunteers.map(v => v._id);
    food.status = "requested";

    await food.save();

    // 🔔 SOCKET
    const io = req.app.get("io");

    io.emit("newRequest", {
      message: `🚚 Request sent to ${volunteers.length} volunteers (${nearbyVolunteers.length} nearby)`,
      nearbyCount: nearbyVolunteers.length,
      totalVolunteers: volunteers.length
    });

    res.json({
      message: `${volunteers.length} volunteers notified`,
      totalVolunteers: volunteers.length,
      nearbyVolunteers: nearbyVolunteers.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error requesting volunteers" });
  }
};

// VOLUNTEER ACCEPT
exports.acceptRequest = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId)
      .populate("restaurantId");

    const user = await User.findById(req.user.id);
    const userId = req.user.id;

    const existingDelivery = await FoodListing.findOne({
      assignedVolunteer: userId,
      status: { $in: ["assigned", "picked"] }
    });

    if (existingDelivery) {
      return res.status(400).json({
        message: "You already have an active delivery"
      });
    }

    if (user.isBusy) {
      return res.status(400).json({
        message: "You are already busy"
      });
    }

    const allowed = food.requestedVolunteers.some(
      id => id.toString() === userId
    );

    if (!allowed) {
      return res.status(400).json({ message: "Not allowed" });
    }

    if (!user.location || !food.restaurantId?.location) {
      return res.status(400).json({ message: "Location missing" });
    }

    const dist = getDistance(
      user.location.lat,
      user.location.lng,
      food.restaurantId.location.lat,
      food.restaurantId.location.lng
    );

    console.log("📏 Volunteer Distance:", dist);

    const override = req.query.override === "true";

    if (dist > 5 && !override) {
      return res.status(400).json({
        message: "Too far from restaurant",
        requireOverride: true
      });
    }

    food.assignedVolunteer = userId;
    food.status = "assigned";
    food.requestedVolunteers = [];
    food.currentLocation = user.location;

    await food.save();

    user.isBusy = true;
    await user.save();

    const io = req.app.get("io");

    io.emit("volunteerAssigned", {
      message: "✅ Volunteer assigned successfully!",
      volunteerId: userId,
      foodId: food._id
    });

    res.json({ message: "Accepted delivery" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
};

// UPDATE LOCATION
exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    const food = await FoodListing.findById(req.params.foodId);

    food.currentLocation = {
      lat: Number(lat),
      lng: Number(lng)
    };

    await food.save();

    res.json({ message: "Location updated" });

  } catch {
    res.status(500).json({ message: "Error" });
  }
};


// GET LIVE LOCATION

exports.getLiveLocation = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId);

    res.json({
      currentLocation: food?.currentLocation || null
    });

  } catch {
    res.status(500).json({ message: "Error" });
  }
};


// ROUTE API 

exports.getRoute = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId)
      .populate("restaurantId")
      .populate("ngoId")
      .populate("assignedVolunteer");

    if (!food) return res.status(404).json({ message: "Not found" });

    let current = null;

// 🔥 ALWAYS PRIORITIZE currentLocation
if (food.currentLocation && food.currentLocation.lat != null) {
  current = food.currentLocation;
}
    if (!current) {
      return res.json({
        route: [],
        status: food.status,
        currentLocation: null
      });
    }

    let start = [current.lng, current.lat];
    let end;

    if (food.status === "assigned") {
      end = [
        food.restaurantId.location.lng,
        food.restaurantId.location.lat
      ];
    }

    else if (food.status === "picked") {
      end = [
        food.ngoId.location.lng,
        food.ngoId.location.lat
      ];
    }

    else {
      return res.json({
        route: [],
        status: food.status,
        currentLocation: current
      });
    }

    const response = await axios.post(
      "https://api.openrouteservice.org/v2/directions/driving-car",
      { coordinates: [start, end] },
      {
        headers: {
          Authorization: process.env.ORS_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    const routeData = response.data.routes[0];

    res.json({
      route: polyline.decode(routeData.geometry),
      distance: routeData.summary.distance / 1000,
      duration: routeData.summary.duration / 60,
      status: food.status,
      currentLocation: current,
      restaurantLocation: food.restaurantId.location,
      ngoLocation: food.ngoId.location
    });

  } catch (err) {
    res.status(500).json({ message: "Route error" });
  }
};

// PICKED
exports.markPicked = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId)
      .populate("restaurantId");

    const dist = getDistance(
      food.currentLocation?.lat,
      food.currentLocation?.lng,
      food.restaurantId?.location?.lat,
      food.restaurantId?.location?.lng
    );

    if (dist > 0.3) {
      return res.status(400).json({ message: "Too far from restaurant" });
    }

    food.status = "picked";
    await food.save();

    res.json({ message: "Picked" });

  } catch {
    res.status(500).json({ message: "Error" });
  }
};


// COMPLETE DELIVERY 

exports.completeDelivery = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId)
      .populate("ngoId")
      .populate("restaurantId");

    if (!food.ngoId?.location) {
      return res.status(400).json({ message: "NGO location missing" });
    }

    const dist = getDistance(
      food.currentLocation?.lat,
      food.currentLocation?.lng,
      food.ngoId.location.lat,
      food.ngoId.location.lng
    );

    if (dist > 0.3) {
      return res.status(400).json({ message: "Too far from NGO" });
    }

    // ✅ COMPLETE DELIVERY
    food.status = "completed";
    await food.save();

    // 🔥 NEW: FREE VOLUNTEER
    const volunteer = await User.findById(food.assignedVolunteer);

    if (volunteer) {
      volunteer.isBusy = false;
      await volunteer.save();
    }

    // 🔔 SOCKET.IO
    const io = req.app.get("io");

    io.emit("deliveryCompleted", {
      message: "🎉 Delivery completed successfully!",
      foodId: food._id
    });

    res.json({ message: "Completed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
};

// VOLUNTEER FOOD
exports.getVolunteerFood = async (req, res) => {
  try {
    const foods = await FoodListing.find({
      $or: [
        { requestedVolunteers: req.user.id },
        { assignedVolunteer: req.user.id }
      ]
    })
      .populate("restaurantId")
      .populate("ngoId")
      .populate("assignedVolunteer");

    res.json({ foodListings: foods });

  } catch {
    res.status(500).json({ message: "Error" });
  }
};

// RESTAURANT FOOD

exports.getMyFood = async (req, res) => {
  try {
    const foods = await FoodListing.find({
      restaurantId: req.user.id
    });

    res.json({ foodListings: foods });

  } catch {
    res.status(500).json({ message: "Error" });
  }
};

// NEARBY VOLUNTEERS 

exports.getNearbyVolunteers = async (req, res) => {
  try {
    const volunteers = await User.find({ role: "volunteer" });

    res.json({ volunteers });

  } catch (err) {
    res.status(500).json({ message: "Error fetching volunteers" });
  }
};

// VOLUNTEER REJECT REQUEST 
exports.rejectRequest = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId);

    const userId = req.user.id;

    // remove volunteer from requested list
    food.requestedVolunteers = food.requestedVolunteers.filter(
      id => id.toString() !== userId
    );

    await food.save();

    res.json({ message: "Request rejected" });

  } catch (err) {
    res.status(500).json({ message: "Error rejecting request" });
  }
};

exports.updateLocation = async (req, res) => {
  const { lat, lng } = req.body;

  const food = await FoodListing.findById(req.params.foodId);

  food.currentLocation = { lat, lng };

  await food.save();

  res.json({ message: "Location updated" });
  console.log("UPDATE LOCATION HIT", req.body);
};