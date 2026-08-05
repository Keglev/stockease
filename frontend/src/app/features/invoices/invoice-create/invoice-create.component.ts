import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import { CustomerResponse, ProductResponse, SupplierResponse } from '../../../core/api/api-models';
import { NotificationService } from '../../../core/notifications/notification.service';
import { TypeaheadComponent } from '../../../shared/typeahead/typeahead.component';
import { CustomerService } from '../../customers/customer.service';
// Deliberate cross-feature import: the price rule is identical here, so it is reused rather
// than copied, keeping one definition of "a price must be greater than zero".
import { positivePrice } from '../../products/positive-price.validator';
import { productLabel } from '../../products/product-label';
import { ProductService } from '../../products/product.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { InvoiceType, buildCreateInvoiceRequest } from '../invoice-payload';
import { InvoiceService } from '../invoice.service';

/**
 * Routed page for recording a new invoice. The counterparty control changes source and
 * obligation with the selected type.
 */
@Component({
  selector: 'app-invoice-create',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslatePipe,
    TypeaheadComponent
  ],
  templateUrl: './invoice-create.component.html',
  styleUrl: './invoice-create.component.scss'
})
export class InvoiceCreateComponent implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly suppliers = inject(SupplierService);
  private readonly customers = inject(CustomerService);
  private readonly products = inject(ProductService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  // The counterparty select still reads a whole register: both are small, and picking one is the
  // first thing this page asks for. Only the product picker changes here.
  protected readonly supplierOptions = signal<SupplierResponse[]>([]);
  protected readonly customerOptions = signal<CustomerResponse[]>([]);
  protected readonly pending = signal(false);

  /** Bound into every line's typeahead; arrow properties so `this` survives the input binding. */
  protected readonly searchProducts = (term: string): Observable<ProductResponse[]> =>
    this.products.search(term);

  protected readonly productLabel = productLabel;

  protected readonly form = this.formBuilder.nonNullable.group({
    type: this.formBuilder.nonNullable.control<InvoiceType>('PURCHASE', Validators.required),
    invoiceNumber: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(64)
    ]),
    counterpartyId: this.formBuilder.control<number | null>(null, Validators.required),
    dueDate: this.formBuilder.control<Date | null>(null, Validators.required),
    items: this.formBuilder.array([this.itemGroup()])
  });

  private readonly typeValue = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value
  });

  private readonly itemsValue = toSignal(this.form.controls.items.valueChanges, {
    initialValue: this.form.controls.items.value
  });

  protected readonly isPurchase = computed(() => this.typeValue() === 'PURCHASE');

  protected readonly counterpartyOptions = computed(() =>
    this.isPurchase() ? this.supplierOptions() : this.customerOptions()
  );

  // Presentation-side arithmetic: the API exposes no invoice total field by design.
  protected readonly runningTotal = computed(() =>
    this.itemsValue().reduce(
      (sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0),
      0
    )
  );

  ngOnInit(): void {
    this.suppliers.getAll().subscribe((suppliers) => this.supplierOptions.set(suppliers));
    this.customers.getAll().subscribe((customers) => this.customerOptions.set(customers));

    this.form.controls.type.valueChanges.subscribe((type) => this.onTypeChange(type));
  }

  /**
   * Writes one line's chosen product into that line's control.
   *
   * <p>Indexed rather than bound, because the typeahead reports a row and the payload wants an id.
   * Each line has its own component instance, so a choice made in one never reaches another.
   */
  protected onProductSelected(index: number, product: ProductResponse | null): void {
    const control = this.items.at(index).get('productId');
    control?.setValue(product?.id ?? null);
    control?.markAsTouched();
  }

  protected get items(): FormArray {
    return this.form.controls.items;
  }

  protected addItem(): void {
    this.items.push(this.itemGroup());
  }

  /** Removes one line; the last remaining line is kept because an invoice needs at least one. */
  protected removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);

    const raw = this.form.getRawValue();
    const counterpartyId = raw.counterpartyId;
    const request = buildCreateInvoiceRequest({
      type: raw.type,
      invoiceNumber: raw.invoiceNumber,
      supplierId: raw.type === 'PURCHASE' ? counterpartyId : null,
      customerId: raw.type === 'SALE' ? counterpartyId : null,
      dueDate: toIsoDate(raw.dueDate),
      items: this.items.getRawValue().map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice)
      }))
    });

    this.invoices.create(request).subscribe({
      next: (created) => {
        this.pending.set(false);
        this.notifications.success('invoices.created');
        void this.router.navigate(['/app/invoices', created.id]);
      },
      error: (err: Error) => {
        // Stay on the page so the entered lines survive a rejected submission.
        this.pending.set(false);
        this.notifications.error(err.message);
      }
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/app/invoices']);
  }

  /**
   * Clears the counterparty whenever the type changes, because a supplier id must never leak
   * into a sale payload nor a customer id into a purchase payload.
   */
  private onTypeChange(type: InvoiceType): void {
    const control = this.form.controls.counterpartyId;
    control.reset(null);

    // A sale may name no customer at all: that is a walk-in sale, not a missing field.
    if (type === 'SALE') {
      control.removeValidators(Validators.required);
    } else {
      control.addValidators(Validators.required);
    }
    control.updateValueAndValidity();
  }

  private itemGroup() {
    return this.formBuilder.nonNullable.group({
      productId: this.formBuilder.control<number | null>(null, Validators.required),
      quantity: [1, [Validators.required, Validators.min(1), integerOnly]],
      unitPrice: [0, [Validators.required, positivePrice]]
    });
  }
}

/** Serializes to the date-only form the backend field expects. */
function toIsoDate(value: Date | null): string {
  if (!value) {
    return '';
  }
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function integerOnly(control: { value: unknown }) {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number.isInteger(Number(value)) ? null : { integerOnly: true };
}
