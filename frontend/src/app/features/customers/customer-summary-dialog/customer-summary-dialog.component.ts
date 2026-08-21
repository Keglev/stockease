import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { CustomerSummary } from '../../../core/api/api-models';
import { ErrorMessageService } from '../../../core/i18n/error-message.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ReportService } from '../../reports/report.service';
import { AppCurrencyPipe } from '../../../shared/format/app-currency.pipe';

export interface CustomerSummaryDialogData {
  customerId: number;
}

/**
 * Read-only view of what one customer has bought and returned, loaded when the dialog opens.
 * It takes only the customer id: the figures are the reporting module's to answer, so nothing
 * the customer list already holds is passed in and possibly shown stale.
 */
@Component({
  selector: 'app-customer-summary-dialog',
  imports: [AppCurrencyPipe, MatButtonModule, MatDialogModule, TranslatePipe],
  templateUrl: './customer-summary-dialog.component.html',
  styleUrl: './customer-summary-dialog.component.scss'
})
export class CustomerSummaryDialogComponent implements OnInit {
  // Deliberate cross-feature import: the reporting endpoints have one client, and the customer
  // summary is a report that happens to describe a customer. The backend draws the same line,
  // serving it from the reports controller rather than the customer API.
  private readonly reports = inject(ReportService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMessages = inject(ErrorMessageService);
  private readonly dialogRef = inject<MatDialogRef<CustomerSummaryDialogComponent>>(MatDialogRef);

  private readonly data = inject<CustomerSummaryDialogData>(MAT_DIALOG_DATA);

  protected readonly summary = signal<CustomerSummary | null>(null);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  /** Fetches the summary and closes on failure, since a dialog with nothing to show is noise. */
  private load(): void {
    this.loading.set(true);

    this.reports.customerSummary(this.data.customerId).subscribe({
      next: (summary) => {
        this.loading.set(false);
        this.summary.set(summary);
      },
      error: (err: Error) => {
        // Through the resolver rather than showing err.message: this dialog reads
        // GET /api/reports/customers/{id}/summary, which names a customer that is gone as
        // CUSTOMER_NOT_FOUND, so a row deleted while the list was open reads German (#301).
        this.loading.set(false);
        this.notifications.error(this.errorMessages.resolve(err));
        this.dialogRef.close();
      }
    });
  }
}
