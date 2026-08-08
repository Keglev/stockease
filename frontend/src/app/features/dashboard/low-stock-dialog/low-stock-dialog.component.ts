import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductResponse } from '../../../core/api/api-models';

export interface LowStockDialogData {
  products: ProductResponse[];
}

/**
 * The products currently below the reorder threshold, listed in a scrollable body.
 *
 * @remarks
 * A pure presenter, unlike its customer-summary sibling: the rows are handed in rather than
 * fetched, because the dashboard already loaded them to show the count on the card that opens this.
 * Asking the endpoint a second time would risk the dialog and the KPI behind it disagreeing.
 */
@Component({
  selector: 'app-low-stock-dialog',
  imports: [MatButtonModule, MatDialogModule, RouterLink, TranslatePipe],
  templateUrl: './low-stock-dialog.component.html',
  styleUrl: './low-stock-dialog.component.scss'
})
export class LowStockDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<LowStockDialogComponent>>(MatDialogRef);

  protected readonly products = inject<LowStockDialogData>(MAT_DIALOG_DATA).products;

  /** Navigating away from the dashboard leaves nothing here worth keeping open behind the route. */
  protected close(): void {
    this.dialogRef.close();
  }
}
