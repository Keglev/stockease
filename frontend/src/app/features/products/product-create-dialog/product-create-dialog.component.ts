import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductResponse } from '../../../core/api/api-models';
import { positivePrice } from '../positive-price.validator';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-product-create-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslatePipe
  ],
  templateUrl: './product-create-dialog.component.html',
  styleUrl: './product-create-dialog.component.scss'
})
export class ProductCreateDialogComponent {
  private readonly products = inject(ProductService);
  private readonly dialogRef =
    inject<MatDialogRef<ProductCreateDialogComponent, ProductResponse>>(MatDialogRef);

  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // No SKU control: the server generates it, so there is nothing for the user to supply.
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    quantity: [0, [Validators.required, Validators.min(0), integerOnly]],
    purchasePrice: [0, [Validators.required, positivePrice]]
  });

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.errorMessage.set(null);

    const { name, quantity, purchasePrice } = this.form.getRawValue();
    this.products.create(name, Number(quantity), Number(purchasePrice)).subscribe({
      next: (created) => {
        this.pending.set(false);
        this.dialogRef.close(created);
      },
      error: (err: Error) => {
        // The dialog stays open so the user can correct the input (e.g. a duplicate name).
        this.pending.set(false);
        this.errorMessage.set(err.message);
      }
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}

function integerOnly(control: { value: unknown }) {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number.isInteger(Number(value)) ? null : { integerOnly: true };
}
