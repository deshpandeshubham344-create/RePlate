require("dotenv").config();   // 🔥 MUST BE FIRST

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const foodRoutes = require("./routes/foodRoutes");
const statsRoutes = require("./routes/stats");
const locationRoutes = require("./routes/locationRoutes");

const app = express();

// 👇 create HTTP server
const server = http.createServer(app);

// 👇 socket setup
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// 👇 make io available in routes
app.set("io", io);

// DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/stats", statsRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/api/location", locationRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("RePlate API is running");
});

// Socket connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get("/api/config", (req, res) => {
    res.json({
        TEST_MODE: process.env.TEST_MODE === "true"
    });
});