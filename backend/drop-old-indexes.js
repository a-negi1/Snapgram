
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to:", mongoose.connection.db.databaseName);

  const db = mongoose.connection.db;
  const collection = db.collection("users");

  

  const indexes = await collection.indexes();
  console.log("Current indexes:", indexes.map(i => i.name));

  

  const validIndexes = new Set(["_id_", "uid_1", "username_1"]);
  for (const idx of indexes) {
    if (!validIndexes.has(idx.name)) {
      console.log(`⚠️  Dropping stale index: ${idx.name}`);
      await collection.dropIndex(idx.name);
      console.log(`✅ Dropped: ${idx.name}`);
    }
  }

  console.log("Done.");
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
