const mongoose = require("mongoose");

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

let listenersBound = false;

const bindConnectionEvents = () => {
  if (listenersBound) return;
  listenersBound = true;

  mongoose.connection.on("connected", () => {
    console.log("✅ [MongoDB] connected");
  });

  mongoose.connection.on("disconnected", () => {
    console.error("❌ [MongoDB] disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("🔄 [MongoDB] reconnected");
  });

  mongoose.connection.on("error", (error) => {
    console.error("❌ [MongoDB] error:", error.message);
  });
};

const connectDB = async () => {
  bindConnectionEvents();

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in environment variables");
  }

  const connection = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 60000,
    maxPoolSize: 50,
    minPoolSize: 10,
    connectTimeoutMS: 20000,
    retryWrites: true,
    writeConcern: { w: "majority" },
    autoIndex: false, // production safe
  });

  return connection;
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const disconnectDB = async () => {
  await mongoose.disconnect();
};

module.exports = { connectDB, isDatabaseReady, disconnectDB };