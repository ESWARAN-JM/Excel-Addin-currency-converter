import { Router, Request, Response } from "express";

const router = Router();
const API_URL = "https://open.er-api.com/v6/latest/USD";

interface RatesCache {
  data: any;
  timestamp: number;
}

let cache: RatesCache | null = null;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Helper to fetch rates (either from cache or API)
async function getRates(): Promise<any> {
  const now = Date.now();

  if (cache && now - cache.timestamp < CACHE_TTL) {
    console.log("Serving currency rates from cache");
    return cache.data;
  }

  try {
    console.log("Fetching currency rates from external API...");
    const res = await fetch(API_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch rates: ${res.statusText}`);
    }
    const data = (await res.json()) as any;
    if (data.result === "success") {
      cache = {
        data,
        timestamp: now,
      };
      return data;
    }
    throw new Error("Invalid API response format");
  } catch (error) {
    console.error("Rates fetch error:", error);
    // If API is down, fallback to stale cache if available
    if (cache) {
      console.warn("API error. Serving stale rates cache.");
      return cache.data;
    }
    throw error;
  }
}

// GET /api/rates/latest
router.get("/latest", async (req: Request, res: Response): Promise<void> => {
  try {
    const ratesData = await getRates();
    res.json(ratesData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch exchange rates." });
  }
});

export default router;
