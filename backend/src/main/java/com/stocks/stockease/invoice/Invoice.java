package com.stocks.stockease.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.security.User;
import com.stocks.stockease.supplier.Supplier;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Domain entity representing a supplier invoice, persisted to the {@code invoice} table.
 * Immutable after creation: only lifecycle fields ({@code status}, {@code closedBy}, {@code closedAt}) ever change.
 */
@Data
@Entity
@Table(name = "invoice")
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE invoice SET deleted_at = now() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Invoice {

    /** Unique invoice identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Whether this invoice records a purchase from a supplier or a sale to a customer. */
    @Enumerated(EnumType.STRING)
    @Column(name = "invoice_type", nullable = false, length = 16)
    private InvoiceType type;

    /**
     * Operator-assigned business identifier: the supplier's document number on a purchase, the
     * operator's own number on a sale. Unique among live invoices, enforced by a partial index.
     */
    @Column(name = "invoice_number", nullable = false, length = 64)
    private String invoiceNumber;

    /** Supplier this invoice was issued by; {@code null} for sale invoices. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    /** Customer this invoice was issued to; {@code null} for purchase invoices and anonymous cash sales. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    /**
     * The supplier's name as it stood when this invoice was issued; {@code null} on sale invoices.
     *
     * <p>Written once at creation and never again: a document states the party it was issued by, and
     * renaming a supplier afterwards must not rewrite invoices already sent. This is also what keeps
     * the counterparty readable after the supplier is soft-deleted, which the association cannot do -
     * {@code @SQLRestriction} hides the row and the association resolves to null (ADR 033).
     */
    @Column(name = "supplier_name")
    private String supplierName;

    /** The customer's name as it stood at issuance; {@code null} on purchases and on walk-in sales. */
    @Column(name = "customer_name")
    private String customerName;

    /**
     * The counterparty foreign keys as plain scalars, readable even when the joined row is hidden.
     *
     * <p>Read-only mappings of the same columns the associations own, which is what
     * {@code insertable=false, updatable=false} declares: the association remains the single writer.
     * They exist because a restriction-hidden association yields {@code null} for the whole
     * reference, identifier included, so the document would lose the id as well as the name.
     */
    @Column(name = "supplier_id", insertable = false, updatable = false)
    private Long supplierId;

    /** The customer foreign key as a plain scalar; see {@link #supplierId}. */
    @Column(name = "customer_id", insertable = false, updatable = false)
    private Long customerId;

    /** Current lifecycle state. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private InvoiceStatus status;

    /** Date payment is due. */
    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    /** Late-payment interest rate applied after {@code dueDate}. */
    @Column(name = "interest_rate", nullable = false)
    private BigDecimal interestRate;

    /** Accrued late-payment fine value. */
    @Column(name = "fine_value", nullable = false)
    private BigDecimal fineValue;

    /** Admin user who closed the invoice; {@code null} while still open. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by")
    private User closedBy;

    /** Timestamp the invoice was closed; {@code null} while still open. */
    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    /** Timestamp the invoice was paid; {@code null} while unpaid. Independent of {@code status}. */
    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    /** Timestamp the row was first persisted, populated by JPA auditing. */
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Timestamp the row was soft-deleted; {@code null} while still live. */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /** Line items purchased on this invoice. */
    // excluded from equals/toString: bidirectional link would recurse
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "invoice", cascade = CascadeType.PERSIST, orphanRemoval = false)
    private List<InvoiceItem> items = new ArrayList<>();
}
