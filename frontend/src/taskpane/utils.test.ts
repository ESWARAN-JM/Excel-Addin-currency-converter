import { calculateCrossRate, calculateRelativeRates } from "./utils";

describe("Frontend Currency Utils tests", () => {
  describe("calculateCrossRate", () => {
    it("should compute cross exchange rates correctly", () => {
      // 1 EUR = 1.08 USD, 1 GBP = 1.27 USD
      // rate(EUR -> GBP) = rate(USD -> GBP) / rate(USD -> EUR)
      const rateFrom = 1.08; // EUR relative to USD
      const rateTo = 1.27;   // GBP relative to USD
      expect(calculateCrossRate(rateFrom, rateTo)).toBeCloseTo(1.1759, 4);
    });

    it("should handle division by zero or invalid negative numbers by returning 0", () => {
      expect(calculateCrossRate(0, 1.5)).toBe(0);
      expect(calculateCrossRate(1.2, 0)).toBe(0);
      expect(calculateCrossRate(-1.5, 1.2)).toBe(0);
      expect(calculateCrossRate(1.2, -1.5)).toBe(0);
    });
  });

  describe("calculateRelativeRates", () => {
    it("should compute relative rates for a dictionary correctly", () => {
      const baseRate = 1.10; // e.g. EUR rate relative to USD
      const targetRates = {
        USD: 1.0,
        GBP: 1.25,
        JPY: 0.007
      };

      const result = calculateRelativeRates(baseRate, targetRates);
      expect(result["USD"]).toBeCloseTo(1 / 1.10, 4);
      expect(result["GBP"]).toBeCloseTo(1.25 / 1.10, 4);
      expect(result["JPY"]).toBeCloseTo(0.007 / 1.10, 4);
    });

    it("should return empty object if base rate is 0 or negative", () => {
      const targetRates = { USD: 1.0 };
      expect(calculateRelativeRates(0, targetRates)).toEqual({});
      expect(calculateRelativeRates(-1.0, targetRates)).toEqual({});
    });
  });
});
