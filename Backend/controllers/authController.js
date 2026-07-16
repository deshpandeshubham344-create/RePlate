const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER USER
exports.registerUser = async (req, res) => {
  try {

    const { name, email, password, phone, address, role, vehicleType, lat, lng } = req.body;

    // check required fields
    if (!name || !email || !password || !phone || !address || !role ||  lat === undefined ||
    lng === undefined) {
      return res.status(400).json({ message: "Please fill all required fields" });
    }

    if (role === "volunteer" && !vehicleType) {
  return res.status(400).json({
    message: "Vehicle type is required for volunteers"
  });
  }
    // check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role,

      // 🚗 only for volunteer
      vehicleType: role === "volunteer" ? vehicleType : null,

      // 📍 location (safe add)
     location:
    lat !== undefined && lng !== undefined
        ? { lat, lng }
        : null
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully"
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};


// LOGIN USER
exports.loginUser = async (req, res) => {
  try {

    const { email, password } = req.body;

    // check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // ✅ UPDATED RESPONSE (ONLY CHANGE)
    res.json({
      message: "Login successful",
      token: token,
      user: {
    id: user._id,
    name: user.name,
    role: user.role
    }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};