import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB, isMockDb } from "./db";
import { seedDefaultAdmin } from "./models/User";
import authRoutes from "./routes/auth";
import ratesRoutes from "./routes/rates";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get(["/", "/api"], (req, res) => {
  res.send("Backend running successfully");
});
app.use("/api/auth", authRoutes);
app.use("/api/rates", ratesRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: isMockDb ? "local-mock" : "mongodb-atlas",
    timestamp: new Date()
  });
});

// Start Server
async function startServer() {
  await connectDB();
  await seedDefaultAdmin();

  // If running under Jest test environment or Vercel serverless, don't start listening
  if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`🚀 Express server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
      if (isMockDb) {
        console.log("ℹ️ Mock DB fallback active. Database state is stored in root 'mock_db.json'.");
      }
    });
  }
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});

export default app;
