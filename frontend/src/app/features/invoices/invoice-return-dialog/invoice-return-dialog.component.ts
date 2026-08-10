import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

import { InvoiceItemResponse } from '../../../core/api/api-models';
import { integerOnly } from '../../../shared/forms/integer-only.validator';

export interface InvoiceReturnDialogData {
  item: InvoiceItemResponse;
  invoiceType: 'PURCHASE' | 'SALE';
}

export interface InvoiceReturnDialogResult {
  quantity: number;
}

/**
 * Collects the quantity for a return against one invoice line. The direction is shown but never
 * chosen, because the invoice type already fixes it.
 */
@Component({
  selector: 'app-invoice-return-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslatePipe
  ],
  templateUrl: './invoice-return-dialog.component.html',
  styleUrl: './invoice-return-dialog.component.scss'
})
export class InvoiceReturnDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<InvoiceReturnDialogComponent, InvoiceReturnDialogResult>>(MatDialogRef);

  protected readonly data = inject<InvoiceReturnDialogData>(MAT_DIALOG_DATA);

  protected readonly remaining = signal(
    (this.data.item.quantity ?? 0) - (this.data.item.returnedQty ?? 0)
  );

  protected readonly isFromCustomer = this.data.invoiceType === 'SALE';

  protected readonly form = inject(FormBuilder).nonNullable.group({
    quantity: [
      1,
      [Validators.required, Validators.min(1), Validators.max(this.remaining()), integerOnly]
    ]
  });

  protected confirm(): void {
    if (this.form.invalid) {
      return;
    }
    this.dialogRef.close({ quantity: Number(this.form.getRawValue().quantity) });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
