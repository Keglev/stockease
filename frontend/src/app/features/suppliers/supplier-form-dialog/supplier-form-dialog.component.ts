import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { SupplierResponse } from '../../../core/api/api-models';
import { SupplierPayload, SupplierService } from '../supplier.service';

export interface SupplierFormDialogData {
  supplier?: SupplierResponse;
}

/**
 * Creates a supplier, or edits one. Name and address are required while the contact fields are
 * not, which is the supplier register's own contract rather than a rule shared by every form in
 * the application.
 */
@Component({
  selector: 'app-supplier-form-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslatePipe
  ],
  templateUrl: './supplier-form-dialog.component.html',
  styleUrl: './supplier-form-dialog.component.scss'
})
export class SupplierFormDialogComponent {
  private readonly suppliers = inject(SupplierService);
  private readonly dialogRef =
    inject<MatDialogRef<SupplierFormDialogComponent, SupplierResponse>>(MatDialogRef);

  private readonly data = inject<SupplierFormDialogData>(MAT_DIALOG_DATA, { optional: true });

  protected readonly supplier = this.data?.supplier;
  protected readonly isEdit = this.supplier !== undefined;

  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Edit mode pre-fills from the supplier, including the optional fields; a null one becomes the
  // empty string the control needs, and the service turns it back into an absent key on submit.
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.supplier?.name ?? '', Validators.required],
    email: [this.supplier?.email ?? '', Validators.email],
    phone: [this.supplier?.phone ?? ''],
    address: [this.supplier?.address ?? '', Validators.required],
    city: [this.supplier?.city ?? '']
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
        // The dialog stays open so the user can correct the input.
        this.pending.set(false);
        this.errorMessage.set(err.message);
      }
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  private request(payload: SupplierPayload): Observable<SupplierResponse> {
    return this.supplier
      ? this.suppliers.update(this.supplier.id, payload)
      : this.suppliers.create(payload);
  }
}
