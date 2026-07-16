const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected");
    console.log("Database:", mongoose.connection.name);
console.log("Host:", mongoose.connection.host);
  } 
  catch (error) {
  console.error("========== FULL ERROR ==========");
  console.error(error);
  console.error("===============================");
  process.exit(1);
}
};

module.exports = connectDB;