import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductResponse } from '../../../core/api/api-models';
import { NotificationService } from '../../../core/notifications/notification.service';
// Deliberate cross-feature import, as on the invoice create page: "a price must be greater
// than zero" should have one definition rather than a copy per feature.
import { positivePrice } from '../../products/positive-price.validator';
import { ProductService } from '../../products/product.service';
import {
  MOVEMENT_REMARKS,
  MovementRemarkValue,
  STANDALONE_REASONS,
  StandaloneReason,
  buildRecordMovementRequest,
  requiresRemark
} from '../movement-payload';
import { MovementService } from '../movement.service';

/**
 * Routed form for recording a standalone stock correction. The unit-cost control exists only
 * for new stock, which is the sole reason the API accepts it on.
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

  // Only the three standalone reasons: the backend books PURCHASE and SOLD through invoice
  // closing and the return reasons through the return endpoint, refusing them here with a 400.
  protected readonly reasons = STANDALONE_REASONS;
  protected readonly remarks = MOVEMENT_REMARKS;

  protected readonly productOptions = signal<ProductResponse[]>([]);
  protected readonly pending = signal(false);

  // unitCost is optional in the group's type so it can be added and removed with the reason.
  protected readonly form = new FormGroup<MovementForm>({
    productId: new FormControl<number | null>(null, Validators.required),
    reason: new FormControl<StandaloneReason>('NEW_PRODUCT', {
      nonNullable: true,
      validators: Validators.required
    }),
    quantity: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), integerOnly]
    }),
    unitCost: unitCostControl()
  });

  private readonly reasonValue = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: this.form.controls.reason.value
  });

  protected readonly isNewProduct = computed(() => this.reasonValue() === 'NEW_PRODUCT');

  protected readonly isLoss = computed(() => requiresRemark(this.reasonValue()));

  ngOnInit(): void {
    this.products.getAll().subscribe((products) => this.productOptions.set(products));

    this.form.controls.reason.valueChanges.subscribe((reason) => this.onReasonChange(reason));
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
      unitCost: this.form.contains('unitCost') ? Number(raw.unitCost) : null,
      remark: this.form.contains('remark') ? (raw.remark ?? null) : null
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

  /**
   * Adds or removes the reason-specific controls. They are removed rather than hidden or disabled,
   * because a lingering control could leak a stale value into the payload.
   */
  private onReasonChange(reason: StandaloneReason): void {
    if (reason === 'NEW_PRODUCT') {
      if (!this.form.contains('unitCost')) {
        this.form.addControl('unitCost', unitCostControl());
      }
    } else {
      this.form.removeControl('unitCost');
    }

    if (requiresRemark(reason)) {
      if (!this.form.contains('remark')) {
        this.form.addControl('remark', remarkControl());
      }
      return;
    }
    this.form.removeControl('remark');
  }

  private resetForm(): void {
    this.form.reset({ productId: null, reason: 'NEW_PRODUCT', quantity: 1, unitCost: 0 });
    this.onReasonChange('NEW_PRODUCT');
  }
}

interface MovementForm {
  productId: FormControl<number | null>;
  reason: FormControl<StandaloneReason>;
  quantity: FormControl<number>;
  unitCost?: FormControl<number>;
  remark?: FormControl<MovementRemarkValue | null>;
}

function unitCostControl(): FormControl<number> {
  return new FormControl(0, {
    nonNullable: true,
    validators: [Validators.required, positivePrice]
  });
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
