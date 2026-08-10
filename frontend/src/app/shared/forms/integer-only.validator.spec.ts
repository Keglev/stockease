import { AbstractControl } from '@angular/forms';

import { integerOnly } from './integer-only.validator';

/* Wraps a raw value as the only thing the validator reads off a control. */
function control(value: unknown): AbstractControl {
  return { value } as AbstractControl;
}

/*
 * A quantity must be a whole number, and a blank value is not this validator's error to claim - it
 * defers to required rather than reporting twice on the same field.
 * Out of scope: the forms that apply it.
 */
describe('integerOnly', () => {
  it('validate_wholeNumber_returnsNoError', () => {
    expect(integerOnly(control(1))).toBeNull();
    expect(integerOnly(control(0))).toBeNull();
  });

  it('validate_fractionalNumber_reportsIntegerOnlyError', () => {
    // The gap Validators.min(1) leaves open: 1.5 clears the minimum and is still not a unit.
    expect(integerOnly(control(1.5))).toEqual({ integerOnly: true });
  });

  it('validate_blankValue_defersToRequiredRatherThanClaimingTheError', () => {
    // A blank field is a missing field, not a fractional one - reporting it here would put the
    // wrong message under the input, and Number('') is 0, which would otherwise read as valid.
    expect(integerOnly(control(''))).toBeNull();
    expect(integerOnly(control(null))).toBeNull();
    expect(integerOnly(control(undefined))).toBeNull();
  });

  it('validate_numericStringWholeNumber_returnsNoError', () => {
    // What a text input actually hands over: the digits arrive as a string, not a number.
    expect(integerOnly(control('3'))).toBeNull();
  });

  it('validate_nonNumericString_reportsIntegerOnlyError', () => {
    // Number('abc') is NaN, which is not an integer, so the field is reported rather than passed.
    expect(integerOnly(control('abc'))).toEqual({ integerOnly: true });
  });
});
