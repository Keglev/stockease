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

    /** Supplier this invoice was issued by. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

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
