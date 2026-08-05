import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { CustomerResponse } from '../../../core/api/api-models';
import { CustomerPayload, CustomerService } from '../customer.service';

export interface CustomerFormDialogData {
  customer?: CustomerResponse;
}

/**
 * Creates a customer, or edits one - the supplier form dialog's structure, with the customer's own
 * validation. Name is the only required field here; the supplier's mandatory address is not made
 * mandatory on a customer by the fact that both registers are now editable.
 */
@Component({
  selector: 'app-customer-form-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslatePipe
  ],
  templateUrl: './customer-form-dialog.component.html',
  styleUrl: './customer-form-dialog.component.scss'
})
export class CustomerFormDialogComponent {
  private readonly customers = inject(CustomerService);
  private readonly dialogRef =
    inject<MatDialogRef<CustomerFormDialogComponent, CustomerResponse>>(MatDialogRef);

  private readonly data = inject<CustomerFormDialogData>(MAT_DIALOG_DATA, { optional: true });

  protected readonly customer = this.data?.customer;
  protected readonly isEdit = this.customer !== undefined;

  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Edit mode pre-fills from the customer, including the optional fields; a null one becomes the
  // empty string the control needs, and the service turns it back into an absent key on submit.
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.customer?.name ?? '', Validators.required],
    email: [this.customer?.email ?? '', Validators.email],
    phone: [this.customer?.phone ?? ''],
    address: [this.customer?.address ?? ''],
    city: [this.customer?.city ?? '']
  });

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.errorMessage.set(null);

    this.request(this.form.getRawValue()).subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.dialogRef.close(saved);
      },
      error: (err: Error) => {
        // The dialog stays open so the user can correct the input (e.g. a duplicate email).
        this.pending.set(false);
        this.errorMessage.set(err.message);
      }
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  private request(payload: CustomerPayload): Observable<CustomerResponse> {
    return this.customer
      ? this.customers.update(this.customer.id, payload)
      : this.customers.create(payload);
  }
}
