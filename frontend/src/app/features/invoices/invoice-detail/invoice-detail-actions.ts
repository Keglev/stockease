import { Injectable, Signal, WritableSignal, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { InvoiceResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { ErrorMessageService } from '../../../core/i18n/error-message.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/confirm-dialog/confirm-dialog.component';
import { InvoiceService } from '../invoice.service';

/** The page state a lifecycle action needs to read, write and refresh once it has run. */
export interface InvoiceDetailActionsHost {
  readonly invoice: Signal<InvoiceResponse | null>;
  /**
   * Shared with the returns collaborator on purpose, and held by the page rather than by either of
   * them: one in-flight flag disables every action on the page, so a return cannot start while a
   * close is still running, or the other way round.
   */
  readonly working: WritableSignal<boolean>;
  currentId(): number;
  load(id: number): void;
}

/**
 * The admin lifecycle of one invoice: closing it, marking it paid, and deleting it, each behind a
 * confirmation prompt.
 *
 * @remarks
 * Provided by the invoice detail component rather than in root, matching the returns collaborator
 * beside it: these actions only run from an open detail page and the state they read belongs to
 * that page's lifetime.
 *
 * The coupling is one `connect` call. The page keeps the invoice signal, the shared in-flight flag
 * and the route-derived id, because they are the page's; this collaborator owns the five services
 * its own bodies use, including the admin check that only these three guards read.
 */
@Injectable()
export class InvoiceDetailActions {
  private readonly invoices = inject(InvoiceService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly errorMessages = inject(ErrorMessageService);

  private host!: InvoiceDetailActionsHost;

  // Same admin detection the products feature uses; UI convenience only, the server enforces 403.
  private readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');

  // Mirrors the backend guard: only an OPEN invoice can be closed.
  readonly canClose = computed(
    () => this.isAdmin() && this.host.invoice()?.status === 'OPEN'
  );

  // Mirrors the backend guard: payment needs only an unpaid invoice, whatever its status.
  readonly canMarkPaid = computed(
    () => this.isAdmin() && this.host.invoice() !== null && this.host.invoice()?.paidAt == null
  );

  // Mirrors the backend guard: only an OPEN invoice can be deleted.
  readonly canDelete = computed(
    () => this.isAdmin() && this.host.invoice()?.status === 'OPEN'
  );

  /** Wires the collaborator to its page. Called once, before any of the members below run. */
  connect(host: InvoiceDetailActionsHost): void {
    this.host = host;
  }

  confirmClose(): void {
    this.confirm(
      {
        titleKey: 'invoices.actions.closeConfirmTitle',
        messageKey: 'invoices.actions.closeConfirmMessage',
        messageParams: this.numberParam(),
        detailKey: 'invoices.actions.closeConfirmDetail'
      },
      () => this.runClose()
    );
  }

  confirmMarkPaid(): void {
    this.confirm(
      {
        titleKey: 'invoices.actions.paidConfirmTitle',
        messageKey: 'invoices.actions.paidConfirmMessage',
        messageParams: this.numberParam()
      },
      () => this.runMarkPaid()
    );
  }

  confirmDelete(): void {
    this.confirm(
      {
        titleKey: 'invoices.actions.deleteConfirmTitle',
        messageKey: 'invoices.actions.deleteConfirmMessage',
        messageParams: this.numberParam()
      },
      () => this.runDelete()
    );
  }

  /** Names the invoice in the prompt, so a destructive confirmation states what it acts on. */
  private numberParam(): Record<string, unknown> {
    return { number: this.host.invoice()?.invoiceNumber };
  }

  private confirm(data: ConfirmDialogData, action: () => void): void {
    this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) {
          action();
        }
      });
  }

  private runClose(): void {
    const id = this.host.currentId();
    this.dispatch(this.invoices.close(id), 'invoices.actions.closed', id, true);
  }

  private runMarkPaid(): void {
    const id = this.host.currentId();
    this.dispatch(this.invoices.markPaid(id), 'invoices.actions.markedPaid', id, false);
  }

  private runDelete(): void {
    this.host.working.set(true);

    this.invoices.remove(this.host.currentId()).subscribe({
      next: (message) => {
        this.host.working.set(false);
        this.notifications.success(message);
        void this.router.navigate(['/app/invoices']);
      },
      error: (err: Error) => {
        this.host.working.set(false);
        this.notifications.error(this.errorMessages.resolve(err));
      }
    });
  }

  /**
   * Runs one lifecycle call and refreshes the page from the detail endpoint afterwards.
   *
   * @param refetchOnError re-read even when the call failed
   */
  private dispatch(
    call: Observable<unknown>,
    successKey: string,
    id: number,
    refetchOnError: boolean
  ): void {
    this.host.working.set(true);

    call.subscribe({
      next: () => {
        this.host.working.set(false);
        this.notifications.success(successKey);
        // The lifecycle endpoints answer with a summary, which carries neither items nor
        // counterparty names; re-reading the detail keeps the rendered page consistent.
        this.host.load(id);
      },
      error: (err: Error) => {
        this.host.working.set(false);
        this.notifications.error(this.errorMessages.resolve(err));
        if (refetchOnError) {
          // A failed close rolled back entirely, so nothing changed server-side; re-reading
          // proves that to the user instead of leaving a half-trusted page on screen.
          this.host.load(id);
        }
      }
    });
  }
}
