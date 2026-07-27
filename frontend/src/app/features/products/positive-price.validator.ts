import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Rejects zero and negatives: the backend requires purchasePrice > 0, which `Validators.min(0)`
 * would permit. Blank values are left to `Validators.required`.
 */
export function positivePrice(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number(value) > 0 ? null : { positivePrice: true };
}
