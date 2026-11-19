import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { validateSettingValue } from './validate-setting-value';

describe('validateSettingValue vehicle_shared_trip', () => {
  it('applies defaults when empty', () => {
    const result = validateSettingValue('vehicle_shared_trip', {});
    assert.deepEqual(result, {
      paymentCloseHoursBeforeDeparture: 3,
      departureTimeEditableUntil: 'until_payment_close',
    });
  });

  it('accepts valid values', () => {
    const result = validateSettingValue('vehicle_shared_trip', {
      paymentCloseHoursBeforeDeparture: 6,
      departureTimeEditableUntil: 'until_first_payment',
    });
    assert.deepEqual(result, {
      paymentCloseHoursBeforeDeparture: 6,
      departureTimeEditableUntil: 'until_first_payment',
    });
  });

  it('rejects invalid hours', () => {
    assert.throws(
      () =>
        validateSettingValue('vehicle_shared_trip', {
          paymentCloseHoursBeforeDeparture: -1,
        }),
      BadRequestException,
    );
    assert.throws(
      () =>
        validateSettingValue('vehicle_shared_trip', {
          paymentCloseHoursBeforeDeparture: 200,
        }),
      BadRequestException,
    );
  });

  it('rejects invalid departure edit rule', () => {
    assert.throws(
      () =>
        validateSettingValue('vehicle_shared_trip', {
          departureTimeEditableUntil: 'always',
        }),
      BadRequestException,
    );
  });
});
