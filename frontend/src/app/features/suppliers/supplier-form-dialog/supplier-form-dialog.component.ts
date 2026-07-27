import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { SupplierResponse } from '../../../core/api/api-models';
import { SupplierService } from '../supplier.service';

export interface SupplierFormDialogData {
  supplier?: SupplierResponse;
}

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

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.supplier?.name ?? '', Validators.required],
    address: [this.supplier?.address ?? '', Validators.required]
  });

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.errorMessage.set(null);

    const { name, address } = this.form.getRawValue();
    this.request(name, address).subscribe({
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

  private request(name: string, address: string): Observable<SupplierResponse> {
    return this.supplier
      ? this.suppliers.update(this.supplier.id, name, address)
      : this.suppliers.create(name, address);
  }
}
