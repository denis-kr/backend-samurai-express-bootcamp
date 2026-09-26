import mongoose from "mongoose";

export const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";

// The URI carries no database path, so the name is pinned here instead.
const dbName = "samurai";

export async function runDb() {
  try {
    await mongoose.connect(mongoUri, {
      dbName,
      serverApi: {
        version: mongoose.mongo.ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    console.log("Connected successfully to server");
  } catch (e) {
    console.log("Error connecting to server: ", e);
    await mongoose.disconnect();
  }
}

export async function stopDb() {
  await mongoose.disconnect();
}
