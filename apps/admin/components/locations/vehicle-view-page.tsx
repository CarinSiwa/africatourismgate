'use client';

import { useAdminErrorMessages } from '../../lib/i18n/use-admin-error-messages';
import { useFormatDateTime } from '../../lib/i18n/use-module-labels';

import {
  Button,
  Card,
  DataTable,
  DataTableActionButton,
  DataTableActions,
  DataTableBadge,
  Input,
  Skeleton,
  type ColumnDef,
} from '@africatourismgate/ui';
import type {
  RentalAgency,
  Vehicle,
  VehicleAvailability,
  VehicleCategory,
  VehicleImage,
  VehicleRoute,
} from '@africatourismgate/types';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageBackLink } from '../admin-page-back-link';
import { useAdminEditPageMeta } from '../use-admin-edit-page-meta';
import { getApiClient } from '../../lib/auth/api';
import { useFormatMoney } from '../../lib/use-format-money';
import { getVehicleStatusLabel } from '../../lib/vehicle-status-labels';
import { useVehicleAvailabilityStatusLabels } from '../../lib/i18n/use-module-labels';
import { VehiclePhotosCarousel } from './vehicle-photos-carousel';
import { VehicleSpecsGrid } from './vehicle-specs-grid';
import { VehicleThumbnail } from './vehicle-thumbnail';

type VehicleViewPageProps = {
  vehicleId: string;
};

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-atg-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-atg-fg">{value}</dd>
    </div>
  );
}

function isRouteActive(route: VehicleRoute): boolean {
  return route.active !== 0;
}

export function VehicleViewPage({ vehicleId }: VehicleViewPageProps) {
  const { locations: getLocationsErrorMessage } = useAdminErrorMessages();
  const tDetail = useTranslations('modules.locations.detail');
  const tView = useTranslations('modules.locations.view');
  const tForm = useTranslations('modules.locations.form');
  const tColumns = useTranslations('modules.locations.columns');
  const tAvailability = useTranslations('modules.locations.sections.availability');
  const tRoutes = useTranslations('modules.locations.sections.routes');
  const tCommon = useTranslations('modules.common');
  const tCommonColumns = useTranslations('modules.common.columns');
  const tDates = useTranslations('modules.common.dates');
  const tActions = useTranslations('common.actions');
  const formatPrice = useFormatMoney();
  const statusLabels = useVehicleAvailabilityStatusLabels();
  const formatDateTime = useFormatDateTime('short');
  const locale = useLocale();
  const emptyDash = tCommon('empty.dash');

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [agency, setAgency] = useState<RentalAgency | null>(null);
  const [category, setCategory] = useState<VehicleCategory | null>(null);
  const [images, setImages] = useState<VehicleImage[]>([]);
  const [routes, setRoutes] = useState<VehicleRoute[]>([]);
  const [slots, setSlots] = useState<VehicleAvailability[]>([]);
  const [slotSearch, setSlotSearch] = useState('');
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready' }
  >({ status: 'loading' });

  const entityLabel = vehicle?.licensePlate ?? category?.name ?? undefined;

  useAdminEditPageMeta({
    ready: state.status === 'ready' && vehicle != null,
    title: tView('title'),
    entityLabel,
  });

  const formatRange = useCallback(
    (start: string, end: string): string => {
      const opts: Intl.DateTimeFormatOptions = {
        dateStyle: 'short',
        timeStyle: 'short',
      };
      try {
        return `${new Date(start).toLocaleString(locale, opts)} → ${new Date(end).toLocaleString(locale, opts)}`;
      } catch {
        return `${start} → ${end}`;
      }
    },
    [locale],
  );

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const client = getApiClient();
      const vehicleData = await client.getVehicle(vehicleId);
      const [agencyData, categoryData, imagesResult, routesResult, slotsResult] =
        await Promise.all([
          client.getRentalAgency(vehicleData.agencyId).catch(() => null),
          client.getVehicleCategory(vehicleData.categoryId).catch(() => null),
          client.listVehicleImages({ vehicleId, page: 1, limit: 100 }),
          client.listVehicleRoutes({ vehicleId, page: 1, limit: 100 }),
          client.listVehicleAvailability({ vehicleId, page: 1, limit: 100 }),
        ]);

      setVehicle(vehicleData);
      setAgency(agencyData);
      setCategory(categoryData);
      setImages([...imagesResult.data].sort((a, b) => a.sortOrder - b.sortOrder));
      setRoutes(routesResult.data);
      setSlots(slotsResult.data);
      setState({ status: 'ready' });
    } catch (error) {
      setState({ status: 'error', message: getLocationsErrorMessage(error) });
    }
  }, [vehicleId, getLocationsErrorMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const editHref = `/produits/locations/${vehicleId}`;
  const editRoutesHref = `${editHref}?tab=troncons`;
  const availabilityHref = `/produits/locations/${vehicleId}/disponibilites`;

  const routeColumns = useMemo<ColumnDef<VehicleRoute, unknown>[]>(
    () => [
      {
        id: 'route',
        header: tRoutes('columns.route'),
        meta: { cellClassName: 'min-w-0' },
        cell: ({ row }) => (
          <span className="block min-w-0 truncate text-sm font-medium text-atg-fg">
            {row.original.departureCity} → {row.original.arrivalCity}
          </span>
        ),
      },
      {
        id: 'price',
        header: tRoutes('columns.price'),
        meta: { hideOnMobile: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-atg-fg">
            {formatPrice(row.original.priceCents, row.original.currency)}
          </span>
        ),
      },
      {
        id: 'visibility',
        header: tRoutes('columns.visibility'),
        meta: { hideOnMobile: true },
        cell: ({ row }) => (
          <DataTableBadge variant={isRouteActive(row.original) ? 'default' : 'muted'}>
            {isRouteActive(row.original)
              ? tRoutes('statusVisible')
              : tRoutes('statusHidden')}
          </DataTableBadge>
        ),
      },
      {
        id: 'actions',
        header: tCommonColumns('actions'),
        meta: { align: 'right', cellClassName: 'w-[4.5rem] sm:w-auto' },
        cell: () => (
          <DataTableActions className="opacity-90 transition-opacity group-hover:opacity-100">
            <DataTableActionButton
              action="edit"
              href={editRoutesHref}
              label={tActions('edit')}
            />
          </DataTableActions>
        ),
      },
    ],
    [editRoutesHref, formatPrice, tActions, tCommonColumns, tRoutes],
  );

  const availabilityColumns = useMemo<ColumnDef<VehicleAvailability, unknown>[]>(
    () => [
      {
        id: 'range',
        header: tCommonColumns('period'),
        meta: { cellClassName: 'min-w-0' },
        cell: ({ row }) => (
          <span className="block min-w-0 truncate text-sm tabular-nums text-atg-fg">
            {formatRange(row.original.startDatetime, row.original.endDatetime)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: tAvailability('status'),
        meta: { hideOnMobile: true },
        cell: ({ row }) => (
          <DataTableBadge variant="muted">
            {getVehicleStatusLabel(row.original.status, statusLabels)}
          </DataTableBadge>
        ),
      },
      {
        id: 'actions',
        header: tCommonColumns('actions'),
        meta: { align: 'right', cellClassName: 'w-[5.5rem] sm:w-auto' },
        cell: () => (
          <DataTableActions className="opacity-90 transition-opacity group-hover:opacity-100">
            <DataTableActionButton action="calendar" href={availabilityHref} />
            <DataTableActionButton
              action="edit"
              href={editHref}
              label={tActions('edit')}
            />
          </DataTableActions>
        ),
      },
    ],
    [
      availabilityHref,
      editHref,
      formatRange,
      statusLabels,
      tActions,
      tAvailability,
      tCommonColumns,
    ],
  );

  const filteredSlots = useMemo(() => {
    const query = slotSearch.trim().toLowerCase();
    const sorted = [...slots].sort(
      (a, b) =>
        new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime(),
    );
    if (!query) return sorted;

    return sorted.filter((slot) => {
      const statusLabel = getVehicleStatusLabel(slot.status, statusLabels);
      const haystack = [
        statusLabel,
        slot.status,
        formatRange(slot.startDatetime, slot.endDatetime),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [formatRange, slotSearch, slots, statusLabels]);

  const hasSlotSearch = slotSearch.trim().length > 0;
  const thumbnailLabel =
    vehicle?.licensePlate ?? category?.name ?? vehicle?.id.slice(0, 8) ?? '';

  const minRoutePrice = useMemo(() => {
    if (!routes.length) return null;
    const min = Math.min(...routes.map((r) => r.priceCents));
    const currency =
      routes.find((r) => r.priceCents === min)?.currency ?? vehicle?.currency ?? 'USD';
    return { cents: min, currency };
  }, [routes, vehicle?.currency]);

  if (state.status === 'loading') {
    return (
      <div className="min-w-0 space-y-6">
        <Skeleton className="h-5 w-40" />
        <div className="flex flex-col gap-4 rounded-xl border border-atg-border bg-atg-elevated p-4 sm:flex-row sm:items-center">
          <Skeleton className="h-12 w-16 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === 'error' || !vehicle) {
    return (
      <div className="min-w-0 space-y-4">
        <AdminPageBackLink href="/produits/locations" label={tDetail('backLink')} />
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.status === 'error' ? state.message : tView('notFound')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminPageBackLink href="/produits/locations" label={tDetail('backLink')} />
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            href={availabilityHref}
            variant="outline"
            className="w-full shrink-0 sm:w-auto"
          >
            {tAvailability('title')}
          </Button>
          <Button href={editHref} className="w-full shrink-0 sm:w-auto">
            {tView('editButton')}
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-atg-border bg-atg-elevated p-4 sm:flex-row sm:items-start">
        <VehicleThumbnail
          vehicleId={vehicleId}
          label={thumbnailLabel}
          categoryName={category?.name}
          size="md"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {vehicle.licensePlate ? (
              <h2 className="min-w-0 break-all font-mono text-xl font-semibold text-atg-fg">
                {vehicle.licensePlate}
              </h2>
            ) : (
              <h2 className="text-xl font-semibold text-atg-fg">
                {tDetail('noLicensePlate')}
              </h2>
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {agency ? <DataTableBadge variant="muted">{agency.name}</DataTableBadge> : null}
              {category ? (
                <DataTableBadge variant="default">{category.name}</DataTableBadge>
              ) : null}
            </div>
          </div>
          <p className="tabular-nums text-sm font-semibold text-atg-fg">
            {minRoutePrice ? (
              <>
                {formatPrice(minRoutePrice.cents, minRoutePrice.currency)}{' '}
                <span className="text-xs font-normal text-atg-muted">
                  {tRoutes('minPriceHint')}
                </span>
              </>
            ) : (
              <>
                {emptyDash}{' '}
                <span className="text-xs font-normal text-atg-muted">
                  {tRoutes('unpriced')}
                </span>
              </>
            )}
          </p>
          {category ? (
            <VehicleSpecsGrid categoryName={category.name} compact />
          ) : null}
        </div>
      </div>

      <Card variant="dashboard" padding="sm" className="min-w-0 overflow-hidden">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-atg-fg">{tView('infoTitle')}</h3>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              <ProfileField
                label={tForm('rentalAgency')}
                value={
                  <span>
                    {agency?.name ?? emptyDash}
                    {agency?.address ? (
                      <span className="mt-0.5 block text-xs font-normal text-atg-muted">
                        {agency.address}
                      </span>
                    ) : null}
                  </span>
                }
              />
              <ProfileField
                label={tForm('category')}
                value={
                  <span>
                    {category?.name ?? emptyDash}
                    {category?.exampleModel ? (
                      <span className="mt-0.5 block text-xs font-normal text-atg-muted">
                        {category.exampleModel}
                      </span>
                    ) : null}
                  </span>
                }
              />
              <ProfileField
                label={tForm('licensePlate')}
                value={vehicle.licensePlate ?? tDetail('noLicensePlate')}
              />
              <ProfileField
                label={tForm('maxPassengers')}
                value={
                  vehicle.maxPassengers != null
                    ? String(vehicle.maxPassengers)
                    : emptyDash
                }
              />
              <ProfileField
                label={tColumns('minRoutePrice')}
                value={
                  minRoutePrice
                    ? formatPrice(minRoutePrice.cents, minRoutePrice.currency)
                    : tRoutes('unpriced')
                }
              />
              <ProfileField
                label={tRoutes('title')}
                value={tRoutes('count', { count: routes.length })}
              />
              <ProfileField
                label={tDates('createdAt')}
                value={formatDateTime(vehicle.createdAt)}
              />
              <ProfileField
                label={tDates('updatedAt')}
                value={
                  vehicle.updatedAt ? formatDateTime(vehicle.updatedAt) : emptyDash
                }
              />
            </dl>
          </div>

          <div className="min-w-0 border-t border-atg-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h3 className="text-sm font-semibold text-atg-fg">{tView('imagesTitle')}</h3>
            <p className="mt-0.5 text-xs text-atg-muted">
              {tView('imagesIntro', { count: images.length })}
            </p>
            <div className="mt-2 w-full max-w-md lg:max-w-none">
              <VehiclePhotosCarousel images={images} altFallback={thumbnailLabel} />
            </div>
          </div>
        </div>
      </Card>

      <section className="min-w-0 space-y-4 overflow-x-hidden">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-atg-fg">{tRoutes('title')}</h3>
              <DataTableBadge variant="muted">{routes.length}</DataTableBadge>
            </div>
            <p className="mt-1 text-sm text-atg-muted">{tRoutes('intro')}</p>
          </div>
          <Button
            href={editRoutesHref}
            variant="outline"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
          >
            {tRoutes('addRoute')}
          </Button>
        </div>

        <Card variant="dashboard" padding="none" className="min-w-0 overflow-hidden">
          <DataTable
            columns={routeColumns}
            data={routes}
            emptyMessage={tRoutes('empty')}
            getRowId={(row) => row.id}
            aria-label={tRoutes('title')}
            loadingMessage={tCommon('dataTable.loading')}
            expandRowLabel={tCommon('dataTable.expandRow')}
            collapseRowLabel={tCommon('dataTable.collapseRow')}
            expandRowAriaLabel={tCommon('dataTable.expandRowAria')}
            className="min-w-0"
          />
        </Card>
      </section>

      <section className="min-w-0 space-y-4 overflow-x-hidden">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-atg-fg">
                {tAvailability('title')}
              </h3>
              <DataTableBadge variant="muted">
                {hasSlotSearch
                  ? `${filteredSlots.length}/${slots.length}`
                  : slots.length}
              </DataTableBadge>
            </div>
            <p className="mt-1 text-sm text-atg-muted">
              {tView('availabilityIntro', { count: slots.length })}
            </p>
          </div>
          <Button
            href={`${availabilityHref}?add=1`}
            variant="outline"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
          >
            {tAvailability('addSlot')}
          </Button>
        </div>

        {slots.length > 0 ? (
          <div className="min-w-0 w-full max-w-md">
            <Input
              type="search"
              placeholder={tView('availabilitySearchPlaceholder')}
              value={slotSearch}
              onChange={(e) => setSlotSearch(e.target.value)}
              aria-label={tView('availabilitySearchPlaceholder')}
            />
          </div>
        ) : null}

        <Card variant="dashboard" padding="none" className="min-w-0 overflow-hidden">
          <DataTable
            columns={availabilityColumns}
            data={filteredSlots}
            emptyMessage={
              hasSlotSearch
                ? tView('availabilitySearchEmpty')
                : tAvailability('empty')
            }
            emptyVariant={hasSlotSearch ? 'search' : 'default'}
            getRowId={(row) => row.id}
            aria-label={tAvailability('title')}
            loadingMessage={tCommon('dataTable.loading')}
            expandRowLabel={tCommon('dataTable.expandRow')}
            collapseRowLabel={tCommon('dataTable.collapseRow')}
            expandRowAriaLabel={tCommon('dataTable.expandRowAria')}
            className="min-w-0"
          />
        </Card>
      </section>

      <div className="flex justify-stretch sm:justify-end">
        <Button href={editHref} variant="outline" className="w-full sm:w-auto">
          {tActions('edit')}
        </Button>
      </div>
    </div>
  );
}
