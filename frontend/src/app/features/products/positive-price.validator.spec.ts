import { AbstractControl } from '@angular/forms';

import { positivePrice } from './positive-price.validator';

/* Wraps a raw value as the only thing the validator reads off a control. */
function control(value: unknown): AbstractControl {
  return { value } as AbstractControl;
}

describe('positivePrice', () => {
  it('validate_positiveAmount_returnsNoError', () => {
    expect(positivePrice(control(0.01))).toBeNull();
    expect(positivePrice(control('999.99'))).toBeNull();
  });

  it('validate_zeroOrNegative_reportsPositivePriceError', () => {
    // The gap Validators.min(0) leaves open: the backend requires strictly greater than zero.
    expect(positivePrice(control(0))).toEqual({ positivePrice: true });
    expect(positivePrice(control(-1))).toEqual({ positivePrice: true });
  });

  it('validate_blankValue_defersToRequiredRatherThanClaimingTheError', () => {
    // A blank field is a missing field, not a bad price - reporting it here would put the wrong
    // message under the input, and Number('') is 0, which would otherwise read as non-positive.
    expect(positivePrice(control(''))).toBeNull();
    expect(positivePrice(control(null))).toBeNull();
    expect(positivePrice(control(undefined))).toBeNull();
  });
});
