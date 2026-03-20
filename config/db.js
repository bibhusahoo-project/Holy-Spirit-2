const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const env = require("./env");

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

let reconnectTimer = null;
let listenersBound = false;
let inMemoryServer = null;

const scheduleReconnectLog = () => {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (mongoose.connection.readyState !== 1) {
      console.error("[MongoDB] connection is not healthy. Waiting for driver auto-reconnect...");
    }
  }, 5000);
};

const bindConnectionEvents = () => {
  if (listenersBound) {
    return;
  }
  listenersBound = true;

  mongoose.connection.on("connected", () => {
    console.log("[MongoDB] connected");
  });

  mongoose.connection.on("disconnected", () => {
    console.error("[MongoDB] disconnected");
    scheduleReconnectLog();
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] reconnected");
  });

  mongoose.connection.on("error", (error) => {
    console.error("[MongoDB] error:", error.message);
  });
};

const startInMemoryMongo = async () => {
  if (inMemoryServer) {
    return inMemoryServer.getUri();
  }

  inMemoryServer = await MongoMemoryServer.create();
  console.log("[MongoDB] started in-memory instance");
  return inMemoryServer.getUri();
};

const stopInMemoryMongo = async () => {
  if (!inMemoryServer) return;

  try {
    await inMemoryServer.stop();
    console.log("[MongoDB] stopped in-memory instance");
  } catch (err) {
    console.warn("[MongoDB] failed to stop in-memory instance", err);
  } finally {
    inMemoryServer = null;
  }
};

const connectDB = async () => {
  bindConnectionEvents();

  let mongoUri = env.mongoUri;
  if (!mongoUri && env.useInMemoryDb) {
    mongoUri = await startInMemoryMongo();
  }

  if (!mongoUri) {
    throw new Error("No MongoDB URI configured. Set MONGO_URI or enable USE_IN_MEMORY_DB=true.");
  }

  const connection = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 60000, // Increased for heavy uploads/processing
    maxPoolSize: 50, // Increased for production
    minPoolSize: 10,
    connectTimeoutMS: 20000,
    retryWrites: true,
    writeConcern: { w: "majority" },
    autoIndex: env.nodeEnv !== "production",
    dbName: "movieappDB",
  });

  return connection;
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const disconnectDB = async () => {
  await mongoose.disconnect();
  await stopInMemoryMongo();
};

module.exports = { connectDB, isDatabaseReady, disconnectDB };

