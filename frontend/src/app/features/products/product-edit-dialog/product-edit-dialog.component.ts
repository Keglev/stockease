import { ErrorMessageService } from '../../../core/i18n/error-message.service';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ProductResponse } from '../../../core/api/api-models';
import { positivePrice } from '../positive-price.validator';
import { ProductService } from '../product.service';
import { createDialogSubmitStore } from '../../../shared/dialog/dialog-submit-store';

export type ProductEditMode = 'name' | 'price';

export interface ProductEditDialogData {
  mode: ProductEditMode;
  product: ProductResponse;
}

/**
 * One dialog for both single-field updates, mirroring the API's separate name and price
 * endpoints. Quantity is intentionally not an option: no endpoint accepts it.
 */
@Component({
  selector: 'app-product-edit-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslatePipe
  ],
  templateUrl: './product-edit-dialog.component.html',
  styleUrl: './product-edit-dialog.component.scss'
})
export class ProductEditDialogComponent {
  private readonly products = inject(ProductService);
  private readonly dialogRef =
    inject<MatDialogRef<ProductEditDialogComponent, ProductResponse>>(MatDialogRef);

  private readonly data = inject<ProductEditDialogData>(MAT_DIALOG_DATA);

  protected readonly mode = this.data.mode;
  protected readonly isPrice = this.mode === 'price';

  protected readonly titleKey = this.isPrice ? 'products.form.priceTitle' : 'products.form.nameTitle';
  protected readonly labelKey = this.isPrice ? 'products.form.purchasePrice' : 'products.form.name';
  protected readonly errorKey = this.isPrice
    ? 'products.form.priceInvalid'
    : 'products.form.nameRequired';

  private readonly errorMessages = inject(ErrorMessageService);

  protected readonly submitState = createDialogSubmitStore<ProductResponse>(
    (saved) => this.dialogRef.close(saved),
    (error) => this.errorMessages.resolve(error)
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    value: [
      this.isPrice ? String(this.data.product.purchasePrice) : this.data.product.name,
      this.isPrice ? [Validators.required, positivePrice] : [Validators.required]
    ]
  });

  protected submit(): void {
    if (this.form.invalid || this.submitState.pending()) {
      return;
    }
    this.submitState.submit(this.request(this.form.getRawValue().value));
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  private request(value: string): Observable<ProductResponse> {
    const id = this.data.product.id;
    return this.isPrice
      ? this.products.changePrice(id, Number(value))
      : this.products.rename(id, value);
  }
}
