const mongoose = require("mongoose");

const foodListingSchema = new mongoose.Schema(
{
  foodName: {
    type: String,
    required: true,
    trim:true
  },

  quantity: {
    type: Number,
    required: true
  },

  pickupTime: {
    type: String,
    required: true
  },

  restaurantLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },

  // ✅ ONLY ONE currentLocation
 volunteerCurrentLocation: {
  lat: { type: Number, default: null },
  lng: { type: Number, default: null }
},

currentLocation: {
  lat: { type: Number, default: null },
  lng: { type: Number, default: null }
},

  description: {
    type: String,
    trim:true
  },

  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
     required: true
  },

  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  volunteerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  status: {
    type: String,
    enum: ["pending","accepted","volunteer_requested","volunteer_assigned","picked","completed"],
    default: "pending"
  },

  // ✅ NEW IMAGE FIELD (IMPORTANT)
  image: {
    type: String,
    default: null
  },

  requestedVolunteers: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  ],

},
{ timestamps: true }
);

module.exports = mongoose.model("FoodListing", foodListingSchema);