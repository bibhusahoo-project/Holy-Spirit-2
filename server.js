require("dotenv").config();

const http = require("http");
const app = require("./app");
const env = require("./config/env");
const { connectDB, disconnectDB } = require("./config/db");
const { startExpiryCleanupJob } = require("./utils/cleanupExpiredAccess");
const { startDashboardStatsJob } = require("./services/dashboardStats.job");

let server;
let dbConnection;
let isShuttingDown = false;

const shutdown = async (signal, error) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  if (error) {
    console.error(`[${signal}]`, error);
  }

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (dbConnection) {
      await disconnectDB();
    }
  } finally {
    process.exit(error ? 1 : 0);
  }
};

process.on("unhandledRejection", (reason, promise) => {
  // Log but do NOT shut down — background async tasks (e.g. video processing)
  // may fail without implying the whole server should die. Only synchronous
  // uncaughtException and OS signals trigger graceful shutdown.
  console.error("[UnhandledRejection] Non-fatal async error caught:", {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise?.toString()
  });
});

process.on("uncaughtException", (error) => {
  console.error("[UncaughtException] Fatal error:", {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  shutdown("uncaughtException", error);
});

// Handle uncaught exceptions from async operations
process.on("uncaughtExceptionMonitor", (error) => {
  console.error("[UncaughtExceptionMonitor] Uncaught exception detected:", {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

const startServer = async () => {
  try {
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = env.nodeEnv || "production";
    }
    const nodeEnv = process.env.NODE_ENV;

    dbConnection = await connectDB();
    console.log(`[MongoDB] connected to database: ${dbConnection.connection.name}`);
    console.log(`[Server] Environment: ${nodeEnv}`);
    console.log(`[Server] Demo login enabled: ${env.enableDemoLogin}`);

    server = http.createServer(app);
    server.keepAliveTimeout = env.keepAliveTimeoutMs;
    server.headersTimeout = env.headersTimeoutMs;
    server.timeout = env.requestTimeoutMs;

    server.listen(env.port, () => {
      console.log(`[Server] Running on http://localhost:${env.port}`);
      console.log(`[Server] uptime: ${process.uptime().toFixed(2)}s`);
    });

    server.on("error", (error) => {
      console.error("[Server] unexpected error", error);
      shutdown("serverError", error);
    });

    startExpiryCleanupJob();
    startDashboardStatsJob();

    // PM2 and process manager friendly signal handling for zero-downtime reloads
    process.once("SIGUSR2", () => shutdown("SIGUSR2"));
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
};

startServer();
