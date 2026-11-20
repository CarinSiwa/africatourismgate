/**
 * Resolve per-person price for N passengers from route tiers.
 * Falls back to legacy route.priceCents when no band matches.
 */
export function resolveVehicleRoutePriceCents(
  passengerCount: number,
  tiers: Array<{ minPassengers: number; maxPassengers: number; priceCents: number }>,
  fallbackPriceCents: number,
): number {
  const n = Math.max(1, Math.floor(passengerCount));
  const match = tiers.find(
    (tier) => n >= tier.minPassengers && n <= tier.maxPassengers,
  );
  if (match) {
    return match.priceCents;
  }
  return fallbackPriceCents;
}
