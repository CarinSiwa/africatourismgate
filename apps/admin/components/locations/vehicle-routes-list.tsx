'use client';

import { useAdminErrorMessages } from '../../lib/i18n/use-admin-error-messages';

import {
  AlertDialog,
  Button,
  Card,
  DataTable,
  DataTableActionButton,
  DataTableActions,
  DataTableBadge,
  DataTablePagination,
  Input,
  Modal,
  Select,
  Switch,
  useToast,
  type ColumnDef,
} from '@africatourismgate/ui';
import type {
  Vehicle,
  VehicleCategory,
  VehicleRoute,
  VehicleRoutePriceTierInput,
} from '@africatourismgate/types';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '../../lib/auth/api';
import { useDataTablePaginationLabels } from '../../lib/i18n/use-pagination-labels';
import { FALLBACK_TREASURY_CURRENCY } from '../../lib/treasury/currency-options';
import { useActiveCurrencies } from '../../lib/treasury/use-active-currencies';
import { useFormatMoney } from '../../lib/use-format-money';
import { ListViewModeToggle } from '../list-view-mode-toggle';
import { VehicleRoutesStatCards } from './vehicle-routes-stat-cards';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

type RoutesViewMode = 'grid' | 'table';

type TierFormRow = {
  key: string;
  minPassengers: string;
  maxPassengers: string;
  priceCents: string;
};

type FormValues = {
  vehicleId: string;
  departureCity: string;
  arrivalCity: string;
  priceCents: string;
  currency: string;
  active: boolean;
  tiers: TierFormRow[];
};

type FormFieldKey = keyof FormValues | 'tiers';

function vehicleDesignation(
  vehicle: Vehicle | undefined,
  categoryById: Map<string, VehicleCategory>,
  fallback: string,
): string {
  if (!vehicle) return fallback;
  const category = categoryById.get(vehicle.categoryId);
  return (
    category?.exampleModel?.trim() ||
    category?.name?.trim() ||
    vehicle.licensePlate?.trim() ||
    fallback
  );
}

function newTierKey(): string {
  return `tier-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultTier(priceCents = ''): TierFormRow {
  return {
    key: newTierKey(),
    minPassengers: '1',
    maxPassengers: '1',
    priceCents,
  };
}

const emptyForm: FormValues = {
  vehicleId: '',
  departureCity: '',
  arrivalCity: '',
  priceCents: '',
  currency: FALLBACK_TREASURY_CURRENCY,
  active: true,
  tiers: [defaultTier()],
};

function isRouteActive(route: VehicleRoute): boolean {
  return route.active !== 0;
}

function parseTiers(
  rows: TierFormRow[],
): { ok: true; tiers: VehicleRoutePriceTierInput[] } | { ok: false; error: string } {
  if (!rows.length) {
    return { ok: false, error: 'tierRequired' };
  }
  const tiers: VehicleRoutePriceTierInput[] = [];
  for (const row of rows) {
    const minPassengers = Number.parseInt(row.minPassengers, 10);
    const maxPassengers = Number.parseInt(row.maxPassengers, 10);
    const priceCents = Number(row.priceCents);
    if (
      !Number.isFinite(minPassengers) ||
      !Number.isFinite(maxPassengers) ||
      !Number.isFinite(priceCents) ||
      minPassengers < 1 ||
      maxPassengers < 1 ||
      minPassengers > maxPassengers ||
      priceCents < 0
    ) {
      return { ok: false, error: 'tierRangeInvalid' };
    }
    tiers.push({ minPassengers, maxPassengers, priceCents });
  }
  const sorted = [...tiers].sort((a, b) => a.minPassengers - b.minPassengers);
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      if (a.minPassengers <= b.maxPassengers && b.minPassengers <= a.maxPassengers) {
        return { ok: false, error: 'tierOverlap' };
      }
    }
  }
  return { ok: true, tiers };
}

export function VehicleRoutesList() {
  const { locations: getLocationsErrorMessage } = useAdminErrorMessages();
  const t = useTranslations('modules.locations.referential.routes');
  const tRoutes = useTranslations('modules.locations.sections.routes');
  const tCommon = useTranslations('modules.common');
  const tPagination = useTranslations('modules.common.pagination');
  const tActions = useTranslations('common.actions');
  const tLoading = useTranslations('common.loading');
  const tSelect = useTranslations('modules.common.select');
  const tToast = useTranslations('modules.common.toast');
  const tDataTable = useTranslations('modules.common.dataTable');
  const { toast } = useToast();
  const paginationLabels = useDataTablePaginationLabels();
  const formatPrice = useFormatMoney();
  const emptyDash = tCommon('empty.dash');
  const chooseDash = tSelect('chooseDash');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<RoutesViewMode>('grid');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [statsKey, setStatsKey] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; routes: VehicleRoute[]; total: number; totalPages: number }
  >({ status: 'loading' });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VehicleRoute | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FormFieldKey, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<VehicleRoute | null>(null);

  const { options: currencyOptions } = useActiveCurrencies({
    extraCodes: [formValues.currency],
  });

  const vehicleById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const viewModeOptions = useMemo(
    () => [
      { value: 'grid' as const, label: t('viewGrid') },
      { value: 'table' as const, label: t('viewTable') },
    ],
    [t],
  );

  const vehicleOptions = useMemo(
    () => [
      { value: '', label: t('allVehicles') },
      ...vehicles.map((v) => ({
        value: v.id,
        label: vehicleDesignation(
          v,
          categoryById,
          t('vehicleFallback', { id: v.id.slice(0, 8) }),
        ),
      })),
    ],
    [vehicles, categoryById, t],
  );

  const formVehicleOptions = useMemo(
    () => [
      { value: '', label: chooseDash },
      ...vehicles.map((v) => {
        const designation = vehicleDesignation(
          v,
          categoryById,
          t('vehicleFallback', { id: v.id.slice(0, 8) }),
        );
        const plate = v.licensePlate?.trim();
        return {
          value: v.id,
          label:
            plate && plate !== designation ? `${designation} · ${plate}` : designation,
        };
      }),
    ],
    [vehicles, categoryById, t, chooseDash],
  );

  useEffect(() => {
    void Promise.all([
      getApiClient().listVehicles({ page: 1, limit: 100 }),
      getApiClient().listVehicleCategories({ page: 1, limit: 100 }),
    ])
      .then(([vehiclesResult, categoriesResult]) => {
        setVehicles(vehiclesResult.data);
        setCategories(categoriesResult.data);
      })
      .catch(() => {
        setVehicles([]);
        setCategories([]);
      });
  }, []);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const result = await getApiClient().listVehicleRoutes({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        vehicleId: vehicleFilter || undefined,
        includePriceTiers: true,
      });
      setState({
        status: 'ready',
        routes: result.data,
        total: result.meta.total,
        totalPages: result.meta.totalPages,
      });
    } catch (error) {
      setState({ status: 'error', message: getLocationsErrorMessage(error) });
    }
  }, [page, search, vehicleFilter, getLocationsErrorMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = searchInput.trim();
    const timer = window.setTimeout(() => {
      setSearch((prev) => {
        if (prev !== q) setPage(1);
        return q;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  function vehicleLabel(vehicleId: string): string {
    return vehicleDesignation(
      vehicleById.get(vehicleId),
      categoryById,
      t('vehicleFallback', { id: vehicleId.slice(0, 8) }),
    );
  }

  function vehiclePlate(vehicleId: string): string | null {
    return vehicleById.get(vehicleId)?.licensePlate?.trim() || null;
  }

  function routeLabel(route: VehicleRoute): string {
    return `${route.departureCity} → ${route.arrivalCity}`;
  }

  function resetForm() {
    setFormValues({
      ...emptyForm,
      tiers: [defaultTier()],
    });
    setEditing(null);
    setShowForm(false);
    setFormError(null);
    setFieldErrors({});
  }

  function openCreate() {
    setEditing(null);
    setFormValues({
      ...emptyForm,
      vehicleId: vehicleFilter,
      currency: FALLBACK_TREASURY_CURRENCY,
      tiers: [defaultTier()],
    });
    setShowForm(true);
    setFormError(null);
    setFieldErrors({});
  }

  function openEdit(route: VehicleRoute) {
    setEditing(route);
    const tiers =
      route.priceTiers && route.priceTiers.length > 0
        ? route.priceTiers.map((tier) => ({
            key: tier.id,
            minPassengers: String(tier.minPassengers),
            maxPassengers: String(tier.maxPassengers),
            priceCents: String(tier.priceCents),
          }))
        : [defaultTier(String(route.priceCents))];
    setFormValues({
      vehicleId: route.vehicleId,
      departureCity: route.departureCity,
      arrivalCity: route.arrivalCity,
      priceCents: String(route.priceCents),
      currency: route.currency,
      active: isRouteActive(route),
      tiers,
    });
    setShowForm(true);
    setFormError(null);
    setFieldErrors({});
  }

  function validate(): boolean {
    const errors: Partial<Record<FormFieldKey, string>> = {};
    if (!editing && !formValues.vehicleId) {
      errors.vehicleId = t('validation.vehicleRequired');
    }
    if (!formValues.departureCity.trim()) {
      errors.departureCity = tRoutes('validation.departureRequired');
    }
    if (!formValues.arrivalCity.trim()) {
      errors.arrivalCity = tRoutes('validation.arrivalRequired');
    }
    if (
      formValues.departureCity.trim() &&
      formValues.arrivalCity.trim() &&
      formValues.departureCity.trim().toLowerCase() ===
        formValues.arrivalCity.trim().toLowerCase()
    ) {
      errors.arrivalCity = tRoutes('validation.sameDestination');
    }
    const cents = Number(formValues.priceCents);
    if (!Number.isFinite(cents) || cents < 0) {
      errors.priceCents = tCommon('validation.invalidPriceCents');
    }
    if (formValues.currency.trim().length !== 3) {
      errors.currency = tCommon('validation.currencyThreeLettersExample');
    }
    const tiersResult = parseTiers(formValues.tiers);
    if (!tiersResult.ok) {
      errors.tiers = tRoutes(`validation.${tiersResult.error}`);
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const tiersResult = parseTiers(formValues.tiers);
    if (!tiersResult.ok) return;

    setSubmitting(true);
    try {
      const client = getApiClient();
      const priceCents = Number(formValues.priceCents);
      const currency = formValues.currency.trim().toUpperCase();
      const departureCity = formValues.departureCity.trim();
      const arrivalCity = formValues.arrivalCity.trim();
      const payload = {
        departureCity,
        arrivalCity,
        priceCents,
        currency,
        active: formValues.active,
        priceTiers: tiersResult.tiers,
      };
      if (editing) {
        await client.updateVehicleRoute(editing.id, payload);
        toast({
          variant: 'success',
          title: tToast('saved'),
          message: `${departureCity} → ${arrivalCity}`,
        });
      } else {
        await client.createVehicleRoute({
          vehicleId: formValues.vehicleId,
          ...payload,
        });
        toast({
          variant: 'success',
          title: tToast('created'),
          message: `${departureCity} → ${arrivalCity}`,
        });
      }
      resetForm();
      setStatsKey((key) => key + 1);
      await load();
    } catch (error) {
      setFormError(getLocationsErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeletingId(confirmTarget.id);
    try {
      await getApiClient().deleteVehicleRoute(confirmTarget.id);
      toast({
        variant: 'success',
        title: tToast('deleted'),
        message: routeLabel(confirmTarget),
      });
      setConfirmTarget(null);
      setStatsKey((key) => key + 1);
      await load();
    } catch (error) {
      toast({
        variant: 'error',
        title: tToast('deleteError'),
        message: getLocationsErrorMessage(error),
      });
      setConfirmTarget(null);
    } finally {
      setDeletingId(null);
    }
  }

  const handleToggleActive = useCallback(
    async (route: VehicleRoute) => {
      const nextActive = !isRouteActive(route);
      setTogglingId(route.id);
      try {
        await getApiClient().updateVehicleRoute(route.id, { active: nextActive });
        toast({
          variant: 'success',
          title: tToast('saved'),
          message: `${route.departureCity} → ${route.arrivalCity} · ${
            nextActive ? tRoutes('statusVisible') : tRoutes('statusHidden')
          }`,
        });
        await load();
      } catch (error) {
        toast({
          variant: 'error',
          title: tToast('saveError'),
          message: getLocationsErrorMessage(error),
        });
      } finally {
        setTogglingId(null);
      }
    },
    [getLocationsErrorMessage, load, tRoutes, tToast, toast],
  );

  const renderVisibility = useCallback(
    (route: VehicleRoute) => {
      const active = isRouteActive(route);
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DataTableBadge variant={active ? 'success' : 'muted'}>
            {active ? tRoutes('statusVisible') : tRoutes('statusHidden')}
          </DataTableBadge>
          <Switch
            checked={active}
            disabled={togglingId === route.id}
            onChange={() => {
              void handleToggleActive(route);
            }}
            aria-label={tRoutes('toggleActiveAria')}
          />
        </div>
      );
    },
    [handleToggleActive, tRoutes, togglingId],
  );

  const renderActions = useCallback(
    (route: VehicleRoute) => (
      <DataTableActions>
        <DataTableActionButton action="edit" onClick={() => openEdit(route)} />
        <DataTableActionButton
          action="delete"
          disabled={deletingId === route.id}
          loading={deletingId === route.id}
          onClick={() => setConfirmTarget(route)}
        />
      </DataTableActions>
    ),
    [deletingId],
  );

  const columns = useMemo<ColumnDef<VehicleRoute>[]>(
    () => [
      {
        id: 'vehicle',
        header: t('columns.vehicle'),
        meta: { cellClassName: 'min-w-0' },
        cell: ({ row }) => {
          const designation = vehicleLabel(row.original.vehicleId);
          const plate = vehiclePlate(row.original.vehicleId);
          return (
            <Link
              href={`/produits/locations/${row.original.vehicleId}?tab=troncons`}
              className="block min-w-0"
            >
              <span className="block truncate text-sm font-medium text-primary hover:underline">
                {designation}
              </span>
              {plate && plate !== designation ? (
                <span className="mt-0.5 block truncate text-xs text-atg-muted">
                  {plate}
                </span>
              ) : null}
            </Link>
          );
        },
      },
      {
        id: 'route',
        header: tRoutes('columns.route'),
        meta: { cellClassName: 'min-w-0' },
        cell: ({ row }) => (
          <span className="block min-w-0 truncate text-sm font-medium text-atg-fg">
            {routeLabel(row.original)}
          </span>
        ),
      },
      {
        id: 'price',
        header: tRoutes('columns.price'),
        meta: { align: 'right', hideOnMobile: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {formatPrice(row.original.priceCents, row.original.currency)}
          </span>
        ),
      },
      {
        id: 'tiers',
        header: tRoutes('columns.tiers'),
        meta: { hideOnMobile: true },
        cell: ({ row }) => (
          <span className="text-sm text-atg-muted">
            {tRoutes('tiersCount', { count: row.original.priceTiers?.length ?? 0 })}
          </span>
        ),
      },
      {
        id: 'visibility',
        header: tRoutes('columns.visibility'),
        meta: { hideOnMobile: true },
        cell: ({ row }) => renderVisibility(row.original),
      },
      {
        id: 'actions',
        header: tCommon('columns.actions'),
        meta: { align: 'right', cellClassName: 'w-[5.5rem] sm:w-auto' },
        cell: ({ row }) => renderActions(row.original),
      },
    ],
    [
      categoryById,
      formatPrice,
      renderActions,
      renderVisibility,
      t,
      tCommon,
      tRoutes,
      vehicleById,
    ],
  );

  const routes = state.status === 'ready' ? state.routes : [];
  const total = state.status === 'ready' ? state.total : 0;
  const totalPages = state.status === 'ready' ? state.totalPages : 1;
  const hasFilters = Boolean(search || vehicleFilter);
  const emptyMessage = hasFilters ? t('emptySearch') : t('emptyDefault');

  const pagination = state.status === 'ready' ? (
    <DataTablePagination
      page={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={PAGE_SIZE}
      itemLabel={tPagination('route')}
      onPageChange={setPage}
      labels={paginationLabels}
    />
  ) : null;

  return (
    <>
      <AlertDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={tRoutes('deleteTitle')}
        description={
          confirmTarget
            ? tRoutes('deleteConfirm', { label: routeLabel(confirmTarget) })
            : emptyDash
        }
        confirmLabel={tActions('delete')}
        cancelLabel={tActions('cancel')}
        variant="danger"
        loading={Boolean(deletingId)}
        onConfirm={() => {
          void handleDelete();
        }}
      />

      <div className="min-w-0 space-y-6 overflow-x-hidden">
        <VehicleRoutesStatCards refreshKey={statsKey} />

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="min-w-0 w-full flex-1 sm:max-w-md">
              <Input
                type="search"
                placeholder={t('searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label={t('searchAria')}
              />
            </div>
            <div className="min-w-[12rem] w-full sm:w-auto sm:max-w-xs">
              <Select
                value={vehicleFilter}
                options={vehicleOptions}
                onChange={(e) => {
                  setVehicleFilter(e.target.value);
                  setPage(1);
                }}
                aria-label={t('columns.vehicle')}
              />
            </div>
            <ListViewModeToggle
              value={viewMode}
              options={viewModeOptions}
              onChange={setViewMode}
              ariaLabel={t('viewModeAria')}
              className="w-full sm:w-auto"
            />
          </div>
          <Button
            type="button"
            onClick={openCreate}
            className="w-full shrink-0 sm:w-auto"
          >
            {tRoutes('addRoute')}
          </Button>
        </div>

        <Modal
          open={showForm}
          onOpenChange={(open) => {
            if (!open && !submitting) resetForm();
          }}
          title={editing ? tRoutes('editRoute') : tRoutes('newRoute')}
          showClose={!submitting}
          closeAriaLabel={tActions('close')}
          className="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-atg-muted">
              {editing ? tRoutes('editFormHint') : t('formHint')}
            </p>
            {formError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </p>
            ) : null}

            {!editing ? (
              <Select
                label={t('columns.vehicle')}
                value={formValues.vehicleId}
                options={formVehicleOptions}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, vehicleId: e.target.value }))
                }
                error={fieldErrors.vehicleId}
                required
              />
            ) : (
              <div className="rounded-xl border border-atg-border bg-atg-surface/50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-atg-muted">
                  {t('columns.vehicle')}
                </p>
                <p className="mt-1 text-sm font-medium text-atg-fg">
                  {vehicleLabel(formValues.vehicleId)}
                </p>
                {vehiclePlate(formValues.vehicleId) ? (
                  <p className="mt-0.5 text-xs text-atg-muted">
                    {vehiclePlate(formValues.vehicleId)}
                  </p>
                ) : null}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={tRoutes('departure')}
                name="departureCity"
                value={formValues.departureCity}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    departureCity: e.target.value,
                  }))
                }
                error={fieldErrors.departureCity}
                required
              />
              <Input
                label={tRoutes('arrival')}
                name="arrivalCity"
                value={formValues.arrivalCity}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    arrivalCity: e.target.value,
                  }))
                }
                error={fieldErrors.arrivalCity}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={tRoutes('priceCents')}
                type="number"
                min={0}
                value={formValues.priceCents}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, priceCents: e.target.value }))
                }
                error={fieldErrors.priceCents}
                hint={tRoutes('priceCentsHint')}
                required
              />
              <Select
                label={tCommon('form.currency')}
                value={formValues.currency}
                options={currencyOptions}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, currency: e.target.value }))
                }
                error={fieldErrors.currency}
              />
            </div>

            <div className="space-y-3 rounded-xl border border-atg-border bg-atg-surface/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-atg-fg">{tRoutes('tiersTitle')}</p>
                  <p className="text-xs text-atg-muted">{tRoutes('tiersIntro')}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setFormValues((prev) => ({
                      ...prev,
                      tiers: [
                        ...prev.tiers,
                        defaultTier(
                          prev.priceCents || prev.tiers.at(-1)?.priceCents || '',
                        ),
                      ],
                    }))
                  }
                >
                  {tRoutes('addTier')}
                </Button>
              </div>
              {fieldErrors.tiers ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.tiers}
                </p>
              ) : null}
              <div className="space-y-3">
                {formValues.tiers.map((tier, index) => (
                  <div
                    key={tier.key}
                    className="grid gap-2 rounded-lg border border-atg-border/70 bg-atg-surface p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
                  >
                    <Input
                      label={tRoutes('tierMin')}
                      type="number"
                      min={1}
                      value={tier.minPassengers}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          tiers: prev.tiers.map((row, i) =>
                            i === index
                              ? { ...row, minPassengers: e.target.value }
                              : row,
                          ),
                        }))
                      }
                      required
                    />
                    <Input
                      label={tRoutes('tierMax')}
                      type="number"
                      min={1}
                      value={tier.maxPassengers}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          tiers: prev.tiers.map((row, i) =>
                            i === index
                              ? { ...row, maxPassengers: e.target.value }
                              : row,
                          ),
                        }))
                      }
                      required
                    />
                    <Input
                      label={tRoutes('tierPrice')}
                      type="number"
                      min={0}
                      value={tier.priceCents}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          tiers: prev.tiers.map((row, i) =>
                            i === index
                              ? { ...row, priceCents: e.target.value }
                              : row,
                          ),
                        }))
                      }
                      required
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={formValues.tiers.length <= 1}
                        onClick={() =>
                          setFormValues((prev) => ({
                            ...prev,
                            tiers: prev.tiers.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        {tRoutes('removeTier')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-atg-border bg-atg-surface/50 px-4 py-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-atg-fg">
                  {tRoutes('activeLabel')}
                </p>
                <p className="text-xs leading-relaxed text-atg-muted">
                  {tRoutes('activeHint')}
                </p>
              </div>
              <Switch
                checked={formValues.active}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, active: e.target.checked }))
                }
                disabled={submitting}
                aria-label={tRoutes('activeLabel')}
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={submitting}
              >
                {tActions('cancel')}
              </Button>
              <Button type="submit" loading={submitting} loadingText={tLoading('submit')}>
                {editing ? tActions('save') : tRoutes('addRoute')}
              </Button>
            </div>
          </form>
        </Modal>

        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        ) : viewMode === 'table' ? (
          <>
            <Card variant="dashboard" padding="none" className="min-w-0 overflow-hidden">
              <DataTable
                columns={columns}
                data={routes}
                isLoading={state.status === 'loading'}
                loadingMessage={tDataTable('loading')}
                emptyMessage={emptyMessage}
                emptyVariant={hasFilters ? 'search' : 'default'}
                expandRowLabel={tDataTable('expandRow')}
                collapseRowLabel={tDataTable('collapseRow')}
                expandRowAriaLabel={tDataTable('expandRowAria')}
                getRowId={(row) => row.id}
                aria-label={t('ariaLabel')}
                className="min-w-0"
              />
            </Card>
            {pagination}
          </>
        ) : state.status === 'loading' ? (
          <p className="text-sm text-atg-muted">{tDataTable('loading')}</p>
        ) : routes.length === 0 ? (
          <p className="text-sm text-atg-muted">{emptyMessage}</p>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {routes.map((route) => {
                const designation = vehicleLabel(route.vehicleId);
                const plate = vehiclePlate(route.vehicleId);
                return (
                  <li key={route.id} className="min-w-0">
                    <Card
                      variant="dashboard"
                      padding="sm"
                      className="flex h-full min-w-0 flex-col gap-3 overflow-hidden"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <Link
                          href={`/produits/locations/${route.vehicleId}?tab=troncons`}
                          className="block min-w-0"
                        >
                          <p className="truncate font-medium text-primary hover:underline">
                            {designation}
                          </p>
                        </Link>
                        {plate && plate !== designation ? (
                          <p className="truncate text-xs text-atg-muted">{plate}</p>
                        ) : null}
                        <p className="truncate text-sm font-semibold text-atg-fg">
                          {routeLabel(route)}
                        </p>
                        <p className="tabular-nums text-sm text-atg-muted">
                          {formatPrice(route.priceCents, route.currency)}
                        </p>
                        <p className="text-xs text-atg-muted">
                          {tRoutes('tiersCount', {
                            count: route.priceTiers?.length ?? 0,
                          })}
                        </p>
                        <div className="pt-1">{renderVisibility(route)}</div>
                      </div>
                      <div className="mt-auto flex min-w-0 justify-end border-t border-atg-border pt-3">
                        {renderActions(route)}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
            {pagination}
          </>
        )}
      </div>
    </>
  );
}
