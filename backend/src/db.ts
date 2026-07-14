import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export let isMockDb = false;

export async function connectDB(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    isMockDb = true;
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes("example.mongodb.net") || uri.includes("dummy")) {
    console.warn("⚠️ No valid MongoDB URI found. Falling back to local JSON database.");
    isMockDb = true;
    return;
  }

  try {
    // Set a short connection timeout so it fails quickly if the URI is invalid/unreachable
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log("✅ Connected to MongoDB Atlas.");
    isMockDb = false;
  } catch (error) {
    console.error("❌ MongoDB Atlas connection error:", error);
    console.warn("⚠️ Falling back to local JSON database.");
    isMockDb = true;
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isMockDb) {
    await mongoose.disconnect();
  }
}
