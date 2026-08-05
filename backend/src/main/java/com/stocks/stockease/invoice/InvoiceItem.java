package com.stocks.stockease.invoice;

import java.math.BigDecimal;

import com.stocks.stockease.product.Product;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/** Domain entity representing a single line on a {@link Invoice}, persisted to the {@code invoice_item} table. */
@Data
@Entity
@Table(name = "invoice_item")
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceItem {

    /** Unique invoice item identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Invoice this line belongs to. */
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    /** Product purchased on this line. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /**
     * The product's name as it stood when the invoice was issued. Written once, never updated.
     *
     * <p>Mandatory, unlike the counterparty snapshots: every line has a product. It is also the more
     * urgent of the two - this association is {@code nullable = false}, so a soft-deleted product
     * makes Hibernate raise {@code FetchNotFoundException} on the fetch join rather than resolving to
     * null, which used to turn the whole invoice detail into a 500 (ADR 033).
     */
    @Column(name = "product_name", nullable = false)
    private String productName;

    /**
     * The product foreign key as a plain scalar, readable when the joined row is restriction-hidden.
     * Read-only: the association above is the single writer for this column.
     */
    @Column(name = "product_id", insertable = false, updatable = false)
    private Long productId;

    /** Quantity ordered. */
    @Column(nullable = false)
    private Integer quantity;

    /** Unit price snapshot at invoice time; deliberately independent of {@code product.purchasePrice}. */
    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    /** Quantity returned to the supplier so far. */
    @Column(name = "returned_qty", nullable = false)
    private Integer returnedQty = 0;
}
