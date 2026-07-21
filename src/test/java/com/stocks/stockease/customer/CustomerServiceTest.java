package com.stocks.stockease.customer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.customer.internal.CustomerRepository;

/** Tests for {@link CustomerService} covering each method's happy path. */
@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    private CustomerRepository customerRepository;
    private CustomerService customerService;

    @BeforeEach
    void setUp() {
        customerRepository = mock(CustomerRepository.class);
        customerService = new CustomerService(customerRepository);
    }

    @Test
    void findById_withExistingId_returnsCustomer() {
        Customer customer = new Customer();
        when(customerRepository.findById(1L)).thenReturn(Optional.of(customer));

        assertThat(customerService.findById(1L)).contains(customer);
    }

    @Test
    void findById_withMissingId_returnsEmpty() {
        when(customerRepository.findById(1L)).thenReturn(Optional.empty());

        assertThat(customerService.findById(1L)).isEmpty();
    }

    @Test
    void create_withValidFields_savesAndReturnsCustomer() {
        Customer saved = new Customer();
        when(customerRepository.save(any(Customer.class))).thenReturn(saved);

        Customer result = customerService.create("Jane Doe", "jane@example.com", "555-1234", "1 Main St", "Springfield");

        assertThat(result).isSameAs(saved);
    }
}
