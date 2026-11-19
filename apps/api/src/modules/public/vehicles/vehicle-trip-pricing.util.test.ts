import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveVehicleRoutePriceCents } from './vehicle-trip-pricing.util';

describe('resolveVehicleRoutePriceCents', () => {
  const tiers = [
    { minPassengers: 1, maxPassengers: 1, priceCents: 10000 },
    { minPassengers: 2, maxPassengers: 4, priceCents: 7000 },
  ];

  it('uses matching band', () => {
    assert.equal(resolveVehicleRoutePriceCents(1, tiers, 999), 10000);
    assert.equal(resolveVehicleRoutePriceCents(3, tiers, 999), 7000);
  });

  it('falls back when no band matches', () => {
    assert.equal(resolveVehicleRoutePriceCents(5, tiers, 5500), 5500);
  });

  it('treats zero/negative as 1 passenger', () => {
    assert.equal(resolveVehicleRoutePriceCents(0, tiers, 999), 10000);
  });
});
