package com.stocks.stockease.invoice.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.NonNull;
import org.springframework.http.MediaType;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.supplier.Supplier;

/** Shared entity builders and request helpers for the invoice controller slice tests. */
final class InvoiceTestFixtures {

    static final LocalDate DUE_DATE = LocalDate.of(2026, 3, 1);
    static final LocalDateTime CREATED_AT = LocalDateTime.of(2026, 1, 2, 3, 4);

    private InvoiceTestFixtures() {
    }

    /** Builds a purchase invoice carrying one line, with the supplier and product initialized. */
    static Invoice purchaseInvoice(InvoiceStatus status) {
        Invoice invoice = new Invoice();
        invoice.setId(1L);
        invoice.setInvoiceNumber("RE-2026-0117");
        invoice.setType(InvoiceType.PURCHASE);
        invoice.setStatus(status);
        invoice.setDueDate(DUE_DATE);
        invoice.setInterestRate(BigDecimal.ZERO);
        invoice.setFineValue(BigDecimal.ZERO);
        invoice.setCreatedAt(CREATED_AT);
        invoice.setSupplier(new Supplier(7L, "Acme", "1 Main St", CREATED_AT, null));
        invoice.setItems(List.of(item(invoice)));
        return invoice;
    }

    /** Builds a sale invoice with a customer and no lines, for summary-only assertions. */
    static Invoice saleInvoice(InvoiceStatus status) {
        Invoice invoice = new Invoice();
        invoice.setId(2L);
        invoice.setType(InvoiceType.SALE);
        invoice.setStatus(status);
        invoice.setDueDate(DUE_DATE);
        invoice.setCreatedAt(CREATED_AT);
        invoice.setCustomer(new Customer(9L, "Jane Doe", null, null, null, null, CREATED_AT, null));
        return invoice;
    }

    private static InvoiceItem item(Invoice invoice) {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(3L);
        InvoiceItem item = new InvoiceItem();
        item.setId(4L);
        item.setInvoice(invoice);
        item.setProduct(product);
        item.setQuantity(2);
        item.setUnitPrice(new BigDecimal("15.00"));
        item.setReturnedQty(0);
        return item;
    }

    /** A well-formed purchase creation body with a single line. */
    static String validCreateBody() {
        return "{\"type\": \"PURCHASE\", \"invoiceNumber\": \"RE-2026-0117\", \"supplierId\": 7,"
                + " \"dueDate\": \"2026-03-01\","
                + " \"items\": [{\"productId\": 3, \"quantity\": 2, \"unitPrice\": 15.00}]}";
    }

    static @NonNull MediaType applicationJson() {
        return Objects.requireNonNull(MediaType.APPLICATION_JSON);
    }

    static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}
