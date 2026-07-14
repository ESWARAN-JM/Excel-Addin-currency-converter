/**
 * Calculates the cross-exchange rate between two currencies relative to a shared base.
 * @param rateFrom Rate of fromCurrency relative to base (e.g. USD)
 * @param rateTo Rate of toCurrency relative to base (e.g. USD)
 * @returns Rate representing 1 unit of fromCurrency in terms of toCurrency
 */
export function calculateCrossRate(rateFrom: number, rateTo: number): number {
  if (rateFrom <= 0 || rateTo <= 0) {
    return 0;
  }
  return rateTo / rateFrom;
}

/**
 * Calculates a map of target rates relative to a new base currency.
 * @param baseRate USD rate of the new base currency
 * @param targetRates Map of USD rates for target currencies
 * @returns Map of target rates relative to the new base currency
 */
export function calculateRelativeRates(
  baseRate: number,
  targetRates: Record<string, number>
): Record<string, number> {
  const relative: Record<string, number> = {};
  if (baseRate <= 0) {
    return relative;
  }

  Object.keys(targetRates).forEach((target) => {
    const rateTarget = targetRates[target];
    if (rateTarget >= 0) {
      relative[target] = rateTarget / baseRate;
    }
  });

  return relative;
}
