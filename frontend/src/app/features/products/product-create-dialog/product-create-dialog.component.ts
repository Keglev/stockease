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

  // No quantity control: creation is master-data only and books no stock (ADR 018). The SKU is
  // operator-assigned - it is the article number the business already uses, not ours to invent.
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    sku: ['', [Validators.required, Validators.maxLength(64)]],
    purchasePrice: [0, [Validators.required, positivePrice]]
  });

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.errorMessage.set(null);

    const { name, sku, purchasePrice } = this.form.getRawValue();
    this.products.create(name, sku, Number(purchasePrice)).subscribe({
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
