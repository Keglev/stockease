import { ErrorMessageService } from '../../../core/i18n/error-message.service';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductResponse } from '../../../core/api/api-models';
import { positivePrice } from '../positive-price.validator';
import { ProductService } from '../product.service';
import { createDialogSubmitStore } from '../../../shared/dialog/dialog-submit-store';

/**
 * Creates a product from its name, SKU and purchase price. There is no quantity control, because
 * creation is master-data maintenance and books no stock (ADR 018): a new product starts at zero
 * and moves only through recorded stock events.
 */
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

  private readonly errorMessages = inject(ErrorMessageService);

  protected readonly submitState = createDialogSubmitStore<ProductResponse>(
    (saved) => this.dialogRef.close(saved),
    (error) => this.errorMessages.resolve(error)
  );

  // No quantity control: creation is master-data only and books no stock (ADR 018). The SKU is
  // operator-assigned - it is the article number the business already uses, not ours to invent.
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    sku: ['', [Validators.required, Validators.maxLength(64)]],
    purchasePrice: [0, [Validators.required, positivePrice]]
  });

  protected submit(): void {
    if (this.form.invalid || this.submitState.pending()) {
      return;
    }
    const { name, sku, purchasePrice } = this.form.getRawValue();
    this.submitState.submit(this.products.create(name, sku, Number(purchasePrice)));
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
