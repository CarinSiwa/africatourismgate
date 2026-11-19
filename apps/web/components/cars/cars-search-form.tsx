'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { CarsSearchParams } from '../../lib/cars/listings';
import { useVehicleRouteOptions } from '../../lib/cars/use-vehicle-route-options';
import { todayISODate } from '../../lib/hotels/dates';
import { useTranslations } from 'next-intl';
import { buildSearchRoute } from '../../lib/search/route';
import {
  SearchFormDatalistInput,
  SearchFormInput,
  SearchFormLabel,
  SearchFormPanel,
  SearchFormSubmit,
} from '../shared';

type CarsSearchFormProps = {
  initialValues: CarsSearchParams;
};

export function CarsSearchForm({ initialValues }: CarsSearchFormProps) {
  const router = useRouter();
  const t = useTranslations('search');
  const c = useTranslations('cars');

  const [departureLocation, setDepartureLocation] = useState(
    initialValues.departureLocation ?? '',
  );
  const [arrivalLocation, setArrivalLocation] = useState(
    initialValues.arrivalLocation ?? '',
  );
  const [travelDate, setTravelDate] = useState(initialValues.travelDate ?? '');
  const [error, setError] = useState<string | null>(null);

  const {
    departureCities,
    arrivalsForDeparture,
    resolveRoute,
    hasRoute,
    loading: routesLoading,
    error: routesError,
  } = useVehicleRouteOptions();

  const today = todayISODate();

  const arrivalSuggestions = useMemo(
    () => arrivalsForDeparture(departureLocation),
    [arrivalsForDeparture, departureLocation],
  );

  const canSwap = useMemo(() => {
    const dep = departureLocation.trim();
    const arr = arrivalLocation.trim();
    if (!dep || !arr) return false;
    return hasRoute(arr, dep);
  }, [arrivalLocation, departureLocation, hasRoute]);

  useEffect(() => {
    setDepartureLocation(initialValues.departureLocation ?? '');
    setArrivalLocation(initialValues.arrivalLocation ?? '');
    setTravelDate(initialValues.travelDate ?? '');
    setError(null);
  }, [
    initialValues.departureLocation,
    initialValues.arrivalLocation,
    initialValues.travelDate,
  ]);

  function handleDepartureChange(value: string) {
    setDepartureLocation(value);
    setError(null);

    const nextArrivals = arrivalsForDeparture(value);
    const currentArrival = arrivalLocation.trim();
    if (
      currentArrival &&
      nextArrivals.length > 0 &&
      !nextArrivals.some(
        (city) => city.trim().toLowerCase() === currentArrival.toLowerCase(),
      ) &&
      departureCities.some(
        (city) => city.trim().toLowerCase() === value.trim().toLowerCase(),
      )
    ) {
      setArrivalLocation('');
    }
  }

  function swapEndpoints() {
    if (!canSwap) return;
    setDepartureLocation(arrivalLocation);
    setArrivalLocation(departureLocation);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const departure = departureLocation.trim();
    const arrival = arrivalLocation.trim();

    if (!departure || !arrival || !travelDate) {
      setError(t('carsRequired'));
      return;
    }

    if (departure.toLowerCase() === arrival.toLowerCase()) {
      setError(t('carsSameEndpoints'));
      return;
    }

    const resolved = resolveRoute(departure, arrival);
    if (!routesLoading && !routesError && !resolved) {
      setError(t('carsInvalidRoute'));
      return;
    }

    const params = new URLSearchParams();
    params.set(
      'departureLocation',
      resolved?.departureCity ?? departure,
    );
    params.set('arrivalLocation', resolved?.arrivalCity ?? arrival);
    params.set('travelDate', travelDate);

    router.push(buildSearchRoute('cars', params));
  }

  return (
    <SearchFormPanel id="cars-search" onSubmit={handleSubmit}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-atg-muted">{t('carsDurationHint')}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_1fr_auto] lg:items-end">
        <div>
          <SearchFormLabel>{c('departureLocation')}</SearchFormLabel>
          <SearchFormDatalistInput
            name="departureLocation"
            placeholder={routesLoading ? c('loading') : c('selectDeparture')}
            suggestions={departureCities}
            value={departureLocation}
            disabled={routesLoading}
            onChange={handleDepartureChange}
          />
        </div>

        <div className="flex items-end pb-0.5 lg:justify-center">
          <button
            type="button"
            onClick={swapEndpoints}
            disabled={!canSwap}
            aria-label={t('swapAirports')}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-atg-border text-atg-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:border-atg-border dark:hover:text-white"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        <div>
          <SearchFormLabel>{c('arrivalLocation')}</SearchFormLabel>
          <SearchFormDatalistInput
            name="arrivalLocation"
            placeholder={
              routesLoading
                ? c('loading')
                : departureLocation.trim()
                  ? c('selectArrival')
                  : c('selectDepartureFirst')
            }
            suggestions={arrivalSuggestions}
            value={arrivalLocation}
            disabled={routesLoading}
            onChange={(value) => {
              setArrivalLocation(value);
              setError(null);
            }}
          />
        </div>

        <div>
          <SearchFormLabel>{c('travelDate')}</SearchFormLabel>
          <SearchFormInput
            type="date"
            name="travelDate"
            value={travelDate}
            min={today}
            onChange={(value) => {
              setTravelDate(value);
              setError(null);
            }}
          />
        </div>

        <div className="flex items-end">
          <SearchFormSubmit label={t('search')} />
        </div>
      </div>

      {routesError && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300" role="status">
          {c('loadError')}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </SearchFormPanel>
  );
}
