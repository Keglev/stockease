package com.stocks.stockease.customer.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.support.AbstractIntegrationTest;

/** Integration tests for {@link Customer} JPA mapping, soft delete, and the partial unique email index. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CustomerMappingTest extends AbstractIntegrationTest {

    @Autowired
    private CustomerRepository customerRepository;

    private static Customer newCustomer(String name, String email) {
        Customer customer = new Customer();
        customer.setName(name);
        customer.setEmail(email);
        customer.setPhone("555-1234");
        customer.setAddress("1 Main St");
        customer.setCity("Springfield");
        return customer;
    }

    @Test
    void persistCustomer_withAllFields_roundTripsAndStampsCreatedAt() {
        Customer saved = customerRepository.saveAndFlush(newCustomer("Jane Doe", "jane@example.com"));

        Customer found = customerRepository.findById(saved.getId()).orElseThrow();
        assertThat(found.getName()).isEqualTo("Jane Doe");
        assertThat(found.getCity()).isEqualTo("Springfield");
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    void deleteCustomer_viaRepository_disappearsFromQueries() {
        Customer saved = customerRepository.saveAndFlush(newCustomer("John Doe", "john@example.com"));
        Long id = saved.getId();

        customerRepository.delete(saved);
        customerRepository.flush();

        assertThat(customerRepository.findById(id)).isEmpty();
        assertThat(customerRepository.findAll()).noneMatch(c -> c.getId().equals(id));
    }

    @Test
    void persistCustomer_duplicateActiveEmail_rejected() {
        customerRepository.saveAndFlush(newCustomer("First", "dup@example.com"));
        Customer second = newCustomer("Second", "dup@example.com");

        assertThatThrownBy(() -> customerRepository.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void softDeleteCustomer_thenRecreateSameEmail_succeeds() {
        Customer first = customerRepository.saveAndFlush(newCustomer("First", "reuse@example.com"));
        customerRepository.delete(first);
        customerRepository.flush();

        Customer second = customerRepository.saveAndFlush(newCustomer("Second", "reuse@example.com"));

        assertThat(second.getId()).isNotNull();
    }

    @Test
    void persistCustomers_bothWithNullEmail_coexist() {
        customerRepository.saveAndFlush(newCustomer("No Email 1", null));
        Customer second = customerRepository.saveAndFlush(newCustomer("No Email 2", null));

        assertThat(second.getId()).isNotNull();
    }
}
