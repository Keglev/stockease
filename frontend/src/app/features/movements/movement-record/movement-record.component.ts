import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductResponse } from '../../../core/api/api-models';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProductService } from '../../products/product.service';
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
    TranslatePipe
  ],
  templateUrl: './movement-record.component.html',
  styleUrl: './movement-record.component.scss'
})
export class MovementRecordComponent implements OnInit {
  private readonly movements = inject(MovementService);
  private readonly products = inject(ProductService);
  private readonly notifications = inject(NotificationService);

  // Only the two loss reasons: the backend books PURCHASE and SOLD through invoice closing and the
  // return reasons through the return endpoint, refusing them here with a 400. Stock never enters
  // through this form at all - a new product is stocked by closing a purchase invoice (ADR 021).
  protected readonly reasons = STANDALONE_REASONS;
  protected readonly remarks = MOVEMENT_REMARKS;

  protected readonly productOptions = signal<ProductResponse[]>([]);
  protected readonly pending = signal(false);

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

  ngOnInit(): void {
    this.products.getAll().subscribe((products) => this.productOptions.set(products));
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
        this.notifications.error(err.message);
      }
    });
  }

  private resetForm(): void {
    this.form.reset({ productId: null, reason: 'LOST', quantity: 1, remark: null });
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

function integerOnly(control: { value: unknown }) {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number.isInteger(Number(value)) ? null : { integerOnly: true };
}
