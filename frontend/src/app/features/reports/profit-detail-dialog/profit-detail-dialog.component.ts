import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductProfitReport } from '../../../core/api/api-models';

/**
 * Read-only drill-down on one product's profit row, opened from the profit table. It is a pure
 * presenter: the page fetches the detail before opening it, so the dialog performs no request.
 */
@Component({
  selector: 'app-profit-detail-dialog',
  imports: [CurrencyPipe, MatButtonModule, MatDialogModule, TranslatePipe],
  templateUrl: './profit-detail-dialog.component.html',
  styleUrl: './profit-detail-dialog.component.scss'
})
export class ProfitDetailDialogComponent {
  protected readonly detail = inject<ProductProfitReport>(MAT_DIALOG_DATA);
}
