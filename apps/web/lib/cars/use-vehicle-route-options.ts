'use client';

import { useEffect, useMemo, useState } from 'react';
import type { VehicleRouteOption } from '@africatourismgate/types';
import { listVehicleRouteOptions } from '../api/public';

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
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [pairs]);

  const arrivalsByDeparture = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pair of pairs) {
      const list = map.get(pair.departureCity) ?? [];
      if (!list.includes(pair.arrivalCity)) {
        list.push(pair.arrivalCity);
        map.set(pair.departureCity, list);
      }
    }
    for (const [key, list] of map) {
      map.set(
        key,
        [...list].sort((a, b) => a.localeCompare(b)),
      );
    }
    return map;
  }, [pairs]);

  function hasRoute(departureCity: string, arrivalCity: string): boolean {
    const dep = departureCity.trim().toLowerCase();
    const arr = arrivalCity.trim().toLowerCase();
    return pairs.some(
      (pair) =>
        pair.departureCity.toLowerCase() === dep &&
        pair.arrivalCity.toLowerCase() === arr,
    );
  }

  return {
    pairs,
    departureCities,
    arrivalsByDeparture,
    hasRoute,
    loading,
    error,
  };
}
