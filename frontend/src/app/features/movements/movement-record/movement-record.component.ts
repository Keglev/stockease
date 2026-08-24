import { Component, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ProductResponse } from '../../../core/api/api-models';
import { ErrorMessageService } from '../../../core/i18n/error-message.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { productLabel } from '../../../shared/typeahead/product-label';
import { ProductService } from '../../products/product.service';
import { integerOnly } from '../../../shared/forms/integer-only.validator';
import { TypeaheadComponent } from '../../../shared/typeahead/typeahead.component';
import {
  MOVEMENT_REMARKS,
  MovementRemarkValue,
  STANDALONE_REASONS,
  StandaloneReason,
  buildRecordMovementRequest
} from '../movement-payload';
import { MovementService } from '../movement.service';

/**
 * Routed form for recording a loss. It offers only LOST and DESTROYED, each of which needs a remark
 * and none of which carries a price; stock is added by closing a purchase invoice, not here.
 */
@Component({
  selector: 'app-movement-record',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslatePipe,
    TypeaheadComponent
  ],
  templateUrl: './movement-record.component.html',
  styleUrl: './movement-record.component.scss'
})
export class MovementRecordComponent {
  private readonly movements = inject(MovementService);
  private readonly products = inject(ProductService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMessages = inject(ErrorMessageService);

  /** Cleared alongside the form after a successful record, so the field stops naming a done job. */
  private readonly productField = viewChild(TypeaheadComponent);

  // Only the two loss reasons: the backend books PURCHASE and SOLD through invoice closing and the
  // return reasons through the return endpoint, refusing them here with a 400. Stock never enters
  // through this form at all - a new product is stocked by closing a purchase invoice (ADR 021).
  protected readonly reasons = STANDALONE_REASONS;
  protected readonly remarks = MOVEMENT_REMARKS;

  protected readonly pending = signal(false);

  /** Bound into the typeahead; arrow properties so `this` survives the input binding. */
  protected readonly searchProducts = (term: string): Observable<ProductResponse[]> =>
    this.products.search(term);

  protected readonly productLabel = productLabel;

  // Every control is unconditional now: both reasons this form offers are losses, so both take a
  // remark and neither takes a price. Nothing is added or removed as the reason changes.
  protected readonly form = new FormGroup<MovementForm>({
    productId: new FormControl<number | null>(null, Validators.required),
    reason: new FormControl<StandaloneReason>('LOST', {
      nonNullable: true,
      validators: Validators.required
    }),
    quantity: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), integerOnly]
    }),
    remark: remarkControl()
  });

  /** The typeahead owns the search; the form control only ever holds the chosen id. */
  protected onProductSelected(product: ProductResponse | null): void {
    this.form.controls.productId.setValue(product?.id ?? null);
    this.form.controls.productId.markAsTouched();
  }

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);

    const raw = this.form.getRawValue();
    const request = buildRecordMovementRequest({
      productId: Number(raw.productId),
      reason: raw.reason,
      quantity: Number(raw.quantity),
      // non-null by the time submit runs: the control is required and the form is valid
      remark: raw.remark as MovementRemarkValue
    });

    this.movements.record(request).subscribe({
      next: () => {
        this.pending.set(false);
        this.notifications.success('movements.recorded');
        // There is no movement list endpoint to navigate to, so the form resets for the next
        // correction instead.
        this.resetForm();
      },
      error: (err: Error) => {
        // Values are preserved so a rejected correction can be adjusted and retried.
        this.pending.set(false);
        // Through the resolver rather than showing err.message: the movement matrix names its
        // refusals with codes, and this form can provoke the missing-remark one (ADR 041).
        this.notifications.error(this.errorMessages.resolve(err));
      }
    });
  }

  private resetForm(): void {
    this.form.reset({ productId: null, reason: 'LOST', quantity: 1, remark: null });
    // The typeahead holds its own text, so resetting the control alone would leave the last
    // product's name in a field that no longer selects it.
    this.productField()?.reset();
  }
}

interface MovementForm {
  productId: FormControl<number | null>;
  reason: FormControl<StandaloneReason>;
  quantity: FormControl<number>;
  remark: FormControl<MovementRemarkValue | null>;
}

/** Starts empty and required, so a loss cannot be submitted until its cause is chosen. */
function remarkControl(): FormControl<MovementRemarkValue | null> {
  return new FormControl<MovementRemarkValue | null>(null, Validators.required);
}
