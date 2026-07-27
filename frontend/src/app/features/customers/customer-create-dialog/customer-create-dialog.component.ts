import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

import { CustomerResponse } from '../../../core/api/api-models';
import { CustomerService } from '../customer.service';

/** Creation only: the backend has no customer update endpoint, so there is no edit mode. */
@Component({
  selector: 'app-customer-create-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslatePipe
  ],
  templateUrl: './customer-create-dialog.component.html',
  styleUrl: './customer-create-dialog.component.scss'
})
export class CustomerCreateDialogComponent {
  private readonly customers = inject(CustomerService);
  private readonly dialogRef =
    inject<MatDialogRef<CustomerCreateDialogComponent, CustomerResponse>>(MatDialogRef);

  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    email: ['', Validators.email],
    phone: [''],
    address: [''],
    city: ['']
  });

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.errorMessage.set(null);

    this.customers.create(this.form.getRawValue()).subscribe({
      next: (created) => {
        this.pending.set(false);
        this.dialogRef.close(created);
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
}
