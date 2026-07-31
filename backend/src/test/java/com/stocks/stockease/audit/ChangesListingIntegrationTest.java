package com.stocks.stockease.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/**
 * Tests the enriched changes listing against real rows written by the audit pipeline.
 *
 * <p>The listing is global, so each test asserts on the rows of the product it created rather than
 * on the whole result, which also carries whatever other tests have committed.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChangesListingIntegrationTest extends AbstractIntegrationTest {

    /** The cap the service documents; restated here so a change to it has to be a deliberate one. */
    private static final int CHANGES_LIMIT = 500;

    @Autowired
    private AuditService auditService;

    @Autowired
    private ProductService productService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("changes-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("changes-tester", "hash", "ROLE_ADMIN")));
    }

    private Product renamedProduct(String name) {
        Product product = productService.create(name, "CHG-" + name.hashCode(), 10.0);
        productService.updateName(product.getId(), name + " Renamed", user);
        return product;
    }

    /**
     * Pushes pending JPA state to the database before the listing reads it.
     *
     * <p>Only a test needs this. The listing is plain JDBC on the same connection, so it sees the
     * database rather than Hibernate's session, and in production each service call has already
     * committed by the time a request reads the log. Inside one rolled-back test transaction the
     * writes would still be sitting in the session.
     */
    private List<ChangeLogEntryResponse> changes(LocalDate from, LocalDate to) {
        entityManager.flush();
        return auditService.findChanges(from, to);
    }

    /** This test's own rows, in the order the listing returned them. */
    private List<ChangeLogEntryResponse> rowsFor(Product product, LocalDate from, LocalDate to) {
        return changes(from, to).stream()
                .filter(row -> row.productId().equals(product.getId()))
                .toList();
    }

    @Test
    void changes_always_returnsEnrichedRowsNewestFirst() {
        Product product = renamedProduct("Changes Enriched");
        productService.updatePrice(product.getId(), new java.math.BigDecimal("12.00"), user);

        List<ChangeLogEntryResponse> rows = rowsFor(product, null, null);

        // the names behind the foreign keys, which is the whole reason this DTO exists
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.username()).isEqualTo("changes-tester");
            assertThat(row.productName()).isEqualTo("Changes Enriched Renamed");
            assertThat(row.sku()).isNotBlank();
        });
        // the price change happened after the rename, so it leads
        assertThat(rows).extracting(ChangeLogEntryResponse::field)
                .containsExactly(ChangedField.PURCHASE_PRICE, ChangedField.NAME);
    }

    @Test
    void changes_fromToWindow_excludesOutsideRange() {
        Product product = renamedProduct("Changes Window");
        LocalDate today = LocalDate.now();

        assertThat(rowsFor(product, today, today)).isNotEmpty();
        assertThat(rowsFor(product, LocalDate.of(2020, 1, 1), LocalDate.of(2020, 12, 31))).isEmpty();
    }

    @Test
    void changes_moreThanCap_truncatesAtCap() {
        Product product = renamedProduct("Changes Cap");
        // One statement rather than a loop: the point is only that more rows than the cap exist.
        jdbcTemplate.update("""
                INSERT INTO product_change_log (product_id, user_id, field, old_value, new_value, created_at)
                SELECT ?, ?, 'NAME', 'a', 'b', now() FROM generate_series(1, ?)
                """, product.getId(), user.getId(), CHANGES_LIMIT + 100);

        assertThat(changes(null, null)).hasSize(CHANGES_LIMIT);
    }

    @Test
    void changes_deletedProduct_staysListedFlagged() {
        Product product = renamedProduct("Changes Deleted");
        productService.deleteById(product.getId(), user);

        List<ChangeLogEntryResponse> rows = rowsFor(product, null, null);

        // @SQLRestriction hides soft-deleted products from every mapped query, which is why this
        // listing is native: the change really happened, and retiring the product does not unmake it
        assertThat(rows).isNotEmpty();
        assertThat(rows).allSatisfy(row -> assertThat(row.productDeleted()).isTrue());
    }
}
