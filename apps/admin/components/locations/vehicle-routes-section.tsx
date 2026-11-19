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
  Input,
  Modal,
  Select,
  Switch,
  type ColumnDef,
} from '@africatourismgate/ui';
import type {
  VehicleRoute,
  VehicleRoutePriceTierInput,
} from '@africatourismgate/types';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '../../lib/auth/api';
import { FALLBACK_TREASURY_CURRENCY } from '../../lib/treasury/currency-options';
import { useActiveCurrencies } from '../../lib/treasury/use-active-currencies';
import { useFormatMoney } from '../../lib/use-format-money';

type TierFormRow = {
  key: string;
  minPassengers: string;
  maxPassengers: string;
  priceCents: string;
};

type FormValues = {
  departureCity: string;
  arrivalCity: string;
  priceCents: string;
  currency: string;
  active: boolean;
  tiers: TierFormRow[];
};

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

type VehicleRoutesSectionProps = {
  vehicleId: string;
  defaultCurrency?: string;
  embedded?: boolean;
  onChanged?: () => void;
};

export function VehicleRoutesSection({
  vehicleId,
  defaultCurrency,
  embedded = false,
  onChanged,
}: VehicleRoutesSectionProps) {
  const { locations: getLocationsErrorMessage } = useAdminErrorMessages();
  const t = useTranslations('modules.locations.sections.routes');
  const tCommon = useTranslations('modules.common');
  const tActions = useTranslations('common.actions');
  const tLoading = useTranslations('common.loading');
  const formatPrice = useFormatMoney();
  const emptyDash = tCommon('empty.dash');

  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; routes: VehicleRoute[] }
  >({ status: 'loading' });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VehicleRoute | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'departureCity' | 'arrivalCity' | 'priceCents' | 'currency' | 'tiers', string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<VehicleRoute | null>(null);

  const { options: currencyOptions } = useActiveCurrencies({
    extraCodes: [formValues.currency, defaultCurrency],
  });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const routesResult = await getApiClient().listVehicleRoutes({
        vehicleId,
        page: 1,
        limit: 100,
        includePriceTiers: true,
      });
      setState({ status: 'ready', routes: routesResult.data });
    } catch (error) {
      setState({ status: 'error', message: getLocationsErrorMessage(error) });
    }
  }, [vehicleId, getLocationsErrorMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setFormValues({
      ...emptyForm,
      currency: (defaultCurrency ?? FALLBACK_TREASURY_CURRENCY).toUpperCase(),
      tiers: [defaultTier()],
    });
    setEditing(null);
    setShowForm(false);
    setFormError(null);
    setFieldErrors({});
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
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
    const errors: Partial<
      Record<'departureCity' | 'arrivalCity' | 'priceCents' | 'currency' | 'tiers', string>
    > = {};
    if (!formValues.departureCity.trim()) {
      errors.departureCity = t('validation.departureRequired');
    }
    if (!formValues.arrivalCity.trim()) {
      errors.arrivalCity = t('validation.arrivalRequired');
    }
    if (
      formValues.departureCity.trim() &&
      formValues.arrivalCity.trim() &&
      formValues.departureCity.trim().toLowerCase() ===
        formValues.arrivalCity.trim().toLowerCase()
    ) {
      errors.arrivalCity = t('validation.sameDestination');
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
      errors.tiers = t(`validation.${tiersResult.error}`);
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
      } else {
        await client.createVehicleRoute({
          vehicleId,
          ...payload,
        });
      }
      resetForm();
      await load();
      onChanged?.();
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
      setConfirmTarget(null);
      await load();
      onChanged?.();
    } catch (error) {
      setFormError(getLocationsErrorMessage(error));
      setConfirmTarget(null);
    } finally {
      setDeletingId(null);
    }
  }

  function routeLabel(route: VehicleRoute): string {
    return `${route.departureCity} → ${route.arrivalCity}`;
  }

  const handleToggleActive = useCallback(
    async (route: VehicleRoute) => {
      const nextActive = !isRouteActive(route);
      setTogglingId(route.id);
      setFormError(null);
      try {
        await getApiClient().updateVehicleRoute(route.id, { active: nextActive });
        await load();
        onChanged?.();
      } catch (error) {
        setFormError(getLocationsErrorMessage(error));
      } finally {
        setTogglingId(null);
      }
    },
    [getLocationsErrorMessage, load, onChanged],
  );

  const columns = useMemo<ColumnDef<VehicleRoute>[]>(
    () => [
      {
        id: 'route',
        header: t('columns.route'),
        cell: ({ row }) => (
          <span className="text-sm font-medium text-atg-fg">{routeLabel(row.original)}</span>
        ),
      },
      {
        id: 'price',
        header: t('columns.price'),
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {formatPrice(row.original.priceCents, row.original.currency)}
          </span>
        ),
      },
      {
        id: 'tiers',
        header: t('columns.tiers'),
        cell: ({ row }) => (
          <span className="text-sm text-atg-muted">
            {t('tiersCount', { count: row.original.priceTiers?.length ?? 0 })}
          </span>
        ),
      },
      {
        id: 'visibility',
        header: t('columns.visibility'),
        cell: ({ row }) => {
          const active = isRouteActive(row.original);
          return (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <DataTableBadge variant={active ? 'success' : 'muted'}>
                {active ? t('statusVisible') : t('statusHidden')}
              </DataTableBadge>
              <Switch
                checked={active}
                disabled={togglingId === row.original.id}
                onChange={() => {
                  void handleToggleActive(row.original);
                }}
                aria-label={t('toggleActiveAria')}
              />
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: tCommon('columns.actions'),
        meta: { align: 'right' },
        cell: ({ row }) => (
          <DataTableActions>
            <DataTableActionButton
              action="edit"
              onClick={() => openEdit(row.original)}
            />
            <DataTableActionButton
              action="delete"
              disabled={deletingId === row.original.id}
              loading={deletingId === row.original.id}
              onClick={() => setConfirmTarget(row.original)}
            />
          </DataTableActions>
        ),
      },
    ],
    [deletingId, formatPrice, handleToggleActive, t, tCommon, togglingId],
  );

  const routes = state.status === 'ready' ? state.routes : [];
  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-atg-fg">{t('title')}</h3>
          <p className="mt-0.5 text-xs text-atg-muted">{t('intro')}</p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          {t('addRoute')}
        </Button>
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}

      {formError && !showForm ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {formError}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={routes}
        isLoading={state.status === 'loading'}
        emptyMessage={t('empty')}
        getRowId={(row) => row.id}
      />

      <Modal
        open={showForm}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
        title={editing ? t('editRoute') : t('newRoute')}
        showClose
        closeAriaLabel={tActions('close')}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-atg-muted">
            {editing ? t('editFormHint') : t('formHint')}
          </p>
          {formError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          ) : null}
          <Input
            label={t('departure')}
            name="departureCity"
            value={formValues.departureCity}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, departureCity: e.target.value }))
            }
            error={fieldErrors.departureCity}
            required
          />
          <Input
            label={t('arrival')}
            name="arrivalCity"
            value={formValues.arrivalCity}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, arrivalCity: e.target.value }))
            }
            error={fieldErrors.arrivalCity}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('priceCents')}
              type="number"
              min={0}
              value={formValues.priceCents}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, priceCents: e.target.value }))
              }
              error={fieldErrors.priceCents}
              hint={t('priceCentsHint')}
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
                <p className="text-sm font-medium text-atg-fg">{t('tiersTitle')}</p>
                <p className="text-xs text-atg-muted">{t('tiersIntro')}</p>
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
                      defaultTier(prev.priceCents || prev.tiers.at(-1)?.priceCents || ''),
                    ],
                  }))
                }
              >
                {t('addTier')}
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
                    label={t('tierMin')}
                    type="number"
                    min={1}
                    value={tier.minPassengers}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        tiers: prev.tiers.map((row, i) =>
                          i === index ? { ...row, minPassengers: e.target.value } : row,
                        ),
                      }))
                    }
                    required
                  />
                  <Input
                    label={t('tierMax')}
                    type="number"
                    min={1}
                    value={tier.maxPassengers}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        tiers: prev.tiers.map((row, i) =>
                          i === index ? { ...row, maxPassengers: e.target.value } : row,
                        ),
                      }))
                    }
                    required
                  />
                  <Input
                    label={t('tierPrice')}
                    type="number"
                    min={0}
                    value={tier.priceCents}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        tiers: prev.tiers.map((row, i) =>
                          i === index ? { ...row, priceCents: e.target.value } : row,
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
                      {t('removeTier')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-atg-border bg-atg-surface/50 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-atg-fg">{t('activeLabel')}</p>
              <p className="text-xs leading-relaxed text-atg-muted">{t('activeHint')}</p>
            </div>
            <Switch
              checked={formValues.active}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, active: e.target.checked }))
              }
              disabled={submitting}
              aria-label={t('activeLabel')}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" loading={submitting} loadingText={tLoading('submit')}>
              {editing ? tActions('save') : t('addRoute')}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
              {tActions('cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      <AlertDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={t('deleteTitle')}
        description={
          confirmTarget
            ? t('deleteConfirm', { label: routeLabel(confirmTarget) })
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
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card variant="dashboard" padding="sm">
      {content}
    </Card>
  );
}
