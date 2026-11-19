'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { CarsSearchParams } from '../../lib/cars/listings';
import { useVehicleRouteOptions } from '../../lib/cars/use-vehicle-route-options';
import { todayISODate } from '../../lib/hotels/dates';
import { useTranslations } from 'next-intl';
import { buildSearchRoute } from '../../lib/search/route';
import {
  SearchFormInput,
  SearchFormLabel,
  SearchFormPanel,
  SearchFormSelect,
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
    arrivalsByDeparture,
    hasRoute,
    loading: routesLoading,
    error: routesError,
  } = useVehicleRouteOptions();

  const today = todayISODate();

  const departureOptions = useMemo(() => {
    const options = [...departureCities];
    const current = departureLocation.trim();
    if (current && !options.includes(current)) options.unshift(current);
    return options;
  }, [departureCities, departureLocation]);

  const arrivalOptions = useMemo(() => {
    const linked = arrivalsByDeparture.get(departureLocation.trim()) ?? [];
    const options = [...linked];
    const current = arrivalLocation.trim();
    if (current && !options.includes(current)) options.unshift(current);
    return options;
  }, [arrivalLocation, arrivalsByDeparture, departureLocation]);

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
    const nextArrivals = arrivalsByDeparture.get(value.trim()) ?? [];
    if (arrivalLocation.trim() && !nextArrivals.includes(arrivalLocation.trim())) {
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

    if (departure === arrival) {
      setError(t('carsSameEndpoints'));
      return;
    }

    if (!routesLoading && !routesError && !hasRoute(departure, arrival)) {
      setError(t('carsInvalidRoute'));
      return;
    }

    const params = new URLSearchParams();
    params.set('departureLocation', departure);
    params.set('arrivalLocation', arrival);
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
          <SearchFormSelect
            name="departureLocation"
            placeholder={routesLoading ? c('loading') : c('selectDeparture')}
            options={departureOptions}
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
          <SearchFormSelect
            name="arrivalLocation"
            placeholder={
              routesLoading
                ? c('loading')
                : departureLocation
                  ? c('selectArrival')
                  : c('selectDepartureFirst')
            }
            options={arrivalOptions}
            value={arrivalLocation}
            disabled={routesLoading || !departureLocation}
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
