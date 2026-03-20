require("dotenv").config();

const { connectDB } = require("../config/db");

const CANDIDATE_COLLECTIONS = [
  "fs.files",
  "fs.chunks",
  "uploads.files",
  "uploads.chunks",
  "movie_media.files",
  "movie_media.chunks",
  "media.files",
  "media.chunks",
];

const run = async () => {
  const execute = process.argv.includes("--execute");
  const force = process.argv.includes("--force");
  const connection = await connectDB();

  try {
    const existingCollections = await connection.connection.db.listCollections({}, { nameOnly: true }).toArray();
    const existingNames = new Set(existingCollections.map((item) => item.name));
    const presentCandidates = CANDIDATE_COLLECTIONS.filter((name) => existingNames.has(name));

    if (!presentCandidates.length) {
      console.log("No candidate media collections found.");
      return;
    }

    for (const collectionName of presentCandidates) {
      const count = await connection.connection.db.collection(collectionName).estimatedDocumentCount();
      console.log(`${collectionName}: ${count} documents`);

      if (!execute) {
        continue;
      }

      if (!force && count > 0) {
        console.log(`Skipped ${collectionName} (non-empty). Use --force to drop.`);
        continue;
      }

      await connection.connection.db.collection(collectionName).drop();
      console.log(`Dropped ${collectionName}`);
    }

    if (!execute) {
      console.log("Dry run complete. Re-run with --execute to drop safe empty collections.");
    }
  } finally {
    await connection.disconnect();
  }
};

run().catch((error) => {
  console.error("Collection cleanup failed:", error.message);
  process.exit(1);
});
