package com.stocks.stockease.customer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.support.AbstractIntegrationTest;

import jakarta.persistence.EntityNotFoundException;

/**
 * Exercises the customer update against a real database, mirroring the supplier's own contact-field
 * integration test.
 *
 * <p>It is here for the same reason that one is: the controller slice next door mocks the service,
 * so nothing there writes a column, and a wholesale replace that silently merged - or an update that
 * never reached the database at all - would leave every slice test green. Clearing an optional field
 * is the case that can only be proved by reading the row back.
 *
 * <p>Every method commits into the shared database, so each takes a name of its own.
 */
@SpringBootTest
@ActiveProfiles("test")
class CustomerUpdateIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private CustomerService customerService;

    private static final AtomicInteger RUNS = new AtomicInteger();

    private static String token() {
        return "Zzcustupdate" + RUNS.incrementAndGet();
    }

    @Test
    void update_withNewValues_replacesEveryField() {
        Customer created = customerService.create(token(), "old@example.com", "555-0000", "1 Main St", "Springfield");

        customerService.update(created.getId(), "Renamed " + token(), "new@example.com", "555-1111", "2 Side St",
                "Shelbyville");

        Customer reread = customerService.findById(created.getId()).orElseThrow();
        assertThat(reread.getEmail()).isEqualTo("new@example.com");
        assertThat(reread.getPhone()).isEqualTo("555-1111");
        assertThat(reread.getAddress()).isEqualTo("2 Side St");
        assertThat(reread.getCity()).isEqualTo("Shelbyville");
    }

    @Test
    void update_omittingOptionalValues_clearsThem() {
        String name = token();
        Customer created = customerService.create(name, "old@example.com", "555-0000", "1 Main St", "Springfield");

        // The wholesale-replace semantics the PUT javadoc claims: replacing an optional field with
        // absent removes it. A merge would have left the old email in place.
        customerService.update(created.getId(), name, null, null, null, null);

        Customer reread = customerService.findById(created.getId()).orElseThrow();
        assertThat(reread.getName()).isEqualTo(name);
        assertThat(reread.getEmail()).isNull();
        assertThat(reread.getPhone()).isNull();
        assertThat(reread.getAddress()).isNull();
        assertThat(reread.getCity()).isNull();
    }

    @Test
    void update_clearingAnEmail_freesItForAnotherCustomer() {
        String held = "shared-" + token() + "@example.com";
        Customer first = customerService.create(token(), held, null, null, null);
        Customer second = customerService.create(token(), null, null, null, null);

        // Email uniqueness holds among live rows, so clearing one is what makes the address
        // available - a merge-shaped update would have kept it taken and failed this insert.
        customerService.update(first.getId(), first.getName(), null, null, null, null);
        customerService.update(second.getId(), second.getName(), held, null, null, null);

        assertThat(customerService.findById(second.getId()).orElseThrow().getEmail()).isEqualTo(held);
    }

    @Test
    void update_withUnknownId_throwsRatherThanCreating() {
        assertThatThrownBy(() -> customerService.update(9_999_999L, token(), null, null, null, null))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Customer with ID 9999999 not found.");
    }
}
