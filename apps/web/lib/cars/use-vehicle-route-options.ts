'use client';

import { useEffect, useMemo, useState } from 'react';
import type { VehicleRouteOption } from '@africatourismgate/types';
import { listVehicleRouteOptions } from '../api/public';

function normalizeCity(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function useVehicleRouteOptions() {
  const [pairs, setPairs] = useState<VehicleRouteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void listVehicleRouteOptions()
      .then((rows) => {
        if (!cancelled) {
          setPairs(rows);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPairs([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const departureCities = useMemo(() => {
    const names = new Set(pairs.map((pair) => pair.departureCity));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [pairs]);

  const allArrivalCities = useMemo(() => {
    const names = new Set(pairs.map((pair) => pair.arrivalCity));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [pairs]);

  const arrivalsByDeparture = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pair of pairs) {
      const key = normalizeCity(pair.departureCity);
      const list = map.get(key) ?? [];
      if (!list.some((city) => normalizeCity(city) === normalizeCity(pair.arrivalCity))) {
        list.push(pair.arrivalCity);
        map.set(key, list);
      }
    }
    Array.from(map.entries()).forEach(([key, list]) => {
      map.set(
        key,
        list.slice().sort((a, b) => a.localeCompare(b)),
      );
    });
    return map;
  }, [pairs]);

  function resolveDepartureCity(input: string): string | null {
    const needle = normalizeCity(input);
    if (!needle) return null;
    const exact = departureCities.find((city) => normalizeCity(city) === needle);
    if (exact) return exact;
    const partial = departureCities.find((city) =>
      normalizeCity(city).includes(needle),
    );
    return partial ?? null;
  }

  function arrivalsForDeparture(departureInput: string): string[] {
    const resolved = resolveDepartureCity(departureInput);
    if (resolved) {
      return arrivalsByDeparture.get(normalizeCity(resolved)) ?? [];
    }
    return allArrivalCities;
  }

  function hasRoute(departureCity: string, arrivalCity: string): boolean {
    const dep = normalizeCity(departureCity);
    const arr = normalizeCity(arrivalCity);
    if (!dep || !arr) return false;
    return pairs.some(
      (pair) =>
        normalizeCity(pair.departureCity) === dep &&
        normalizeCity(pair.arrivalCity) === arr,
    );
  }

  /** Resolve free-text inputs to a known active OD pair when possible. */
  function resolveRoute(
    departureInput: string,
    arrivalInput: string,
  ): { departureCity: string; arrivalCity: string } | null {
    const depNeedle = normalizeCity(departureInput);
    const arrNeedle = normalizeCity(arrivalInput);
    if (!depNeedle || !arrNeedle) return null;

    const exact = pairs.find(
      (pair) =>
        normalizeCity(pair.departureCity) === depNeedle &&
        normalizeCity(pair.arrivalCity) === arrNeedle,
    );
    if (exact) {
      return {
        departureCity: exact.departureCity,
        arrivalCity: exact.arrivalCity,
      };
    }

    const fuzzy = pairs.find(
      (pair) =>
        normalizeCity(pair.departureCity).includes(depNeedle) &&
        normalizeCity(pair.arrivalCity).includes(arrNeedle),
    );
    if (fuzzy) {
      return {
        departureCity: fuzzy.departureCity,
        arrivalCity: fuzzy.arrivalCity,
      };
    }

    return null;
  }

  return {
    pairs,
    departureCities,
    allArrivalCities,
    arrivalsForDeparture,
    hasRoute,
    resolveRoute,
    loading,
    error,
  };
}
