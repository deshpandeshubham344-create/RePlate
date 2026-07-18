const FoodListing = require("../models/FoodListing");
const axios = require("axios");
const polyline = require("@mapbox/polyline");
const User = require("../models/User");
const TEST_MODE = process.env.TEST_MODE === "true";


// DISTANCE FUNCTION
function getDistance(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null
) {
    return Infinity;
}

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

  // ✅ Food initially stays at the restaurant
  currentLocation: {
    lat: restaurant.location.lat,
    lng: restaurant.location.lng
  },

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
        $in: [
    "pending",
    "accepted_by_ngo",
    "volunteer_requested",
    "volunteer_assigned",
    "picked",
    "completed"
] 
      }
    }).populate("restaurantId")
.populate("ngoId")
.populate("volunteerResponses.volunteer")

    const nearbyFoods = [];

   for (let food of foods) {

    if (!food.restaurantLocation) continue;

    const dist = getDistance(
        ngo.location.lat,
        ngo.location.lng,
        food.restaurantLocation.lat,
        food.restaurantLocation.lng
    );

    nearbyFoods.push({
        ...food._doc,
        distance: Number(dist.toFixed(2))
    });

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

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    const ngo = await User.findById(req.user.id);

    if (!ngo.location || !food.restaurantLocation) {
      return res.status(400).json({
        message: "Location missing"
      });
    }

    const distance = getDistance(
      ngo.location.lat,
      ngo.location.lng,
      food.restaurantLocation.lat,
      food.restaurantLocation.lng
    );

    const override = req.query.override === "true";

    if (distance > 5 && !override) {
      return res.status(400).json({
        message: `Food is ${distance.toFixed(1)} km away`,
        distance,
        requireOverride: true
      });
    }

    food.status = "accepted_by_ngo";
    food.ngoId = req.user.id;

    await food.save();

    res.json({
      message: "Food accepted successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error"
    });
  }
};


// REQUEST VOLUNTEERS
exports.requestVolunteers = async (req, res) => {
  try {

    const food = await FoodListing.findById(req.params.foodId);

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    if (!food.restaurantLocation) {
      return res.status(400).json({
        message: "Restaurant location missing"
      });
    }

    const volunteers = await User.find({
      role: "volunteer",
      isAvailable: true,
      isBusy: false
    });

    // 🔥 Reset previous request
    food.volunteerResponses = [];
    food.volunteerId = null;

    food.requestedVolunteers = volunteers.map(v => v._id);
    // NGO is waiting for volunteer responses
    food.status = "volunteer_requested";

    console.log("Requested Volunteers:", food.requestedVolunteers);
console.log("Status:", food.status);

    await food.save();

    const verify = await FoodListing.findById(food._id);

console.log("Saved Requested Volunteers:", verify.requestedVolunteers);
console.log("Saved Status:", verify.status);

    const io = req.app.get("io");

    io.emit("newRequest", {
      foodId: food._id,
      message: "New delivery request"
    });

    res.json({
      message: `${volunteers.length} volunteers notified`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error requesting volunteers"
    });
  }
};

// NGO ASSIGNS A VOLUNTEER
exports.assignVolunteer = async (req, res) => {
  try {

    const { volunteerId } = req.body;

    const food = await FoodListing.findById(req.params.foodId);

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    // Food should still be waiting for assignment
    if (food.status !== "volunteer_requested") {
      return res.status(400).json({
        message: "Volunteer can no longer be assigned."
      });
    }

    // Volunteer must have accepted
    const response = food.volunteerResponses.find(
      v => String(v.volunteer) === String(volunteerId)
    );

    if (!response) {
      return res.status(400).json({
        message: "This volunteer has not accepted the request."
      });
    }

    const volunteer = await User.findById(volunteerId);

    if (!volunteer) {
      return res.status(404).json({
        message: "Volunteer not found"
      });
    }

    // Volunteer became busy meanwhile
    if (volunteer.isBusy) {
      return res.status(400).json({
        message: "Volunteer is already busy."
      });
    }

    // Assign volunteer
    food.volunteerId = volunteer._id;
    food.status = "volunteer_assigned";

    // Update volunteer responses
    food.volunteerResponses.forEach(v => {

      if (String(v.volunteer) === String(volunteerId)) {
        v.status = "assigned";
      } else if (v.status === "accepted") {
        v.status = "not_selected";
      }

    });

    // Volunteer is now busy
    volunteer.isBusy = true;
    volunteer.isAvailable = false;

    await volunteer.save();
    await food.save();

    res.json({
      message: "Volunteer assigned successfully",
      volunteerId: volunteer._id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error assigning volunteer"
    });
  }
};
// VOLUNTEER ACCEPT REQUEST
exports.acceptRequest = async (req, res) => {
  try {

    const food = await FoodListing.findById(req.params.foodId)
      .populate("restaurantId");

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "Volunteer not found"
      });
    }

    const userId = req.user.id;

    // Volunteer already delivering?
    const existingDelivery = await FoodListing.findOne({
      volunteerId: userId,
      status: {
        $in: ["volunteer_assigned", "picked"]
      }
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

    // Food should still be requesting volunteers
    if (food.status !== "volunteer_requested") {
      return res.status(400).json({
        message: "This request is no longer accepting volunteers"
      });
    }

    if (!user.location || !food.restaurantId?.location) {
      return res.status(400).json({
        message: "Location missing"
      });
    }

    // Already responded?
    const alreadyAccepted = food.volunteerResponses.find(
      v => String(v.volunteer) === String(userId)
    );

    if (alreadyAccepted) {
      return res.status(400).json({
        message: "You already responded"
      });
    }

    // Calculate distance
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
        message: "You are far away from the restaurant.",
        requireOverride: true
      });
    }

    // ETA calculation
    const eta = Math.ceil(dist * 3);

    // Store volunteer response
    food.volunteerResponses.push({
      volunteer: user._id,
      status: "accepted",
      distance: Number(dist.toFixed(2)),
      eta,
      vehicleType: user.vehicleType
    });

    // Store volunteer's latest location
    food.volunteerCurrentLocation = user.location;

    await food.save();

    res.json({
      message: "Response sent to NGO successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error accepting request"
    });
  }
};

// UPDATE LOCATION
exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    const food = await FoodListing.findById(req.params.foodId);

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    if (!TEST_MODE) {

    food.volunteerCurrentLocation = {
        lat: Number(lat),
        lng: Number(lng)
    };

    await User.findByIdAndUpdate(req.user.id, {
        location: {
            lat: Number(lat),
            lng: Number(lng)
        }
    });

}
    // After pickup, food moves with volunteer
    if (food.status === "picked") {
      food.currentLocation = {
        lat: Number(lat),
        lng: Number(lng)
      };
    }
    console.log("updateLocation before save");
console.log("restaurantReached =", food.restaurantReached);
console.log("status =", food.status);

    await food.save();

    res.json({
      message: "Location updated"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error updating location"
    });
  }
};


// GET LIVE LOCATION
exports.getLiveLocation = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId);

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    res.json({
      status: food.status,
      volunteerCurrentLocation: food.volunteerCurrentLocation,
      currentLocation: food.currentLocation
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error getting live location"
    });
  }
};

// ROUTE API 

exports.getRoute = async (req, res) => {
  try {
    const food = await FoodListing.findById(req.params.foodId)
      .populate("restaurantId")
      .populate("ngoId")
      .populate("volunteerId");

    if (!food) return res.status(404).json({ message: "Not found" });

    let current = null;

// 🔥 ALWAYS PRIORITIZE currentLocation
if (food.status === "volunteer_assigned") {
    current = food.volunteerCurrentLocation;
}
else if (food.status === "picked") {
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

    if (food.status === "volunteer_assigned") {
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

    console.log({
    status: food.status,
    current,
    volunteerCurrentLocation: food.volunteerCurrentLocation,
    foodCurrentLocation: food.currentLocation
});

    res.json({
    route: polyline.decode(routeData.geometry),
    distance: routeData.summary.distance / 1000,
    duration: routeData.summary.duration / 60,
    status: food.status,

    currentLocation: current,
    volunteerCurrentLocation: food.volunteerCurrentLocation,

    restaurantLocation: food.restaurantId.location,
    ngoLocation: food.ngoId.location
});

  } catch (err) {
    res.status(500).json({ message: "Route error" });
  }
};

// PICKED
exports.confirmPickup = async (req, res) => {
  try {

    const food = await FoodListing.findById(req.params.foodId);

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    if (food.status !== "volunteer_assigned") {
      return res.status(400).json({
        message: "Volunteer has not been assigned yet"
      });
    }

    if (!food.restaurantReached) {
    return res.status(400).json({
        message: "Volunteer has not reached the restaurant"
    });
}

// Food now starts moving with the volunteer
food.currentLocation = {
    lat: food.volunteerCurrentLocation.lat,
    lng: food.volunteerCurrentLocation.lng
};

food.status = "picked";
food.restaurantReached = false;

    await food.save();

    res.json({
      message: "Pickup confirmed successfully",
      food
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Error confirming pickup"
    });
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
    const volunteer = await User.findById(food.volunteerId);

    if (volunteer) {
      volunteer.isBusy = false;
      volunteer.isAvailable = true;
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
  console.log("Logged-in Volunteer ID:", req.user.id);
  try {
    const foods = await FoodListing.find({
      $or: [
        { requestedVolunteers: req.user.id },
        { volunteerId: req.user.id }
      ]
    })
      .populate("restaurantId")
      .populate("ngoId")
      .populate("volunteerId");

      console.log("Logged-in Volunteer ID:", req.user.id);
      console.log("Foods Found:", foods.length);
      console.log(foods);
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

// Volunteer reached restaurant
exports.reachedRestaurant = async (req, res) => {
  try {
    console.log("Reached Restaurant API HIT");
    const food = await FoodListing.findById(req.params.foodId);

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    food.restaurantReached = true;
    console.log("Reached API ->", food.restaurantReached);

    await food.save();

    res.json({
      message: "Restaurant reached successfully."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error"
    });
  }
};

// Volunteer reached NGO
exports.reachedNgo = async (req, res) => {
  try {

    const food = await FoodListing.findById(req.params.foodId);

    if (!food) {
      return res.status(404).json({
        message: "Food not found"
      });
    }

    food.ngoReached = true;
    await food.save();

    res.json({
      message: "NGO reached successfully."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error"
    });
  }
};