import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Rejects fractional amounts: stock and invoice lines move in whole units, and `Validators.min(1)`
 * happily accepts 1.5. Blank values are left to `Validators.required`.
 */
export function integerOnly(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number.isInteger(Number(value)) ? null : { integerOnly: true };
}
