const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
    name: {
    type: String,
    required: true,
    trim: true
},

   email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
},

    password: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true,
        trim:true
    },

   address: {
    type: String,
    required: true,
    trim: true
},

    role: {
        type: String,
        enum: ["restaurant", "ngo", "volunteer"],
        required: true
    },

    vehicleType: {
    type: String,
    enum: ["bike", "scooter", "car", ""],
    default: ""
},

    location: {
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    }
},
    isAvailable: {
  type: Boolean,
  default: true
},
isBusy: { type: Boolean, default: false }

},
{ timestamps: true }
);

module.exports = mongoose.model("User", userSchema);