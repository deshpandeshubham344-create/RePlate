const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected");
  } catch (error) {
  console.error("========== FULL ERROR ==========");
  console.error(error);
  console.error("===============================");
  process.exit(1);
}
};

module.exports = connectDB;