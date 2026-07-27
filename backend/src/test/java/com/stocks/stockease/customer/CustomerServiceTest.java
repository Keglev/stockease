package com.stocks.stockease.customer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.stocks.stockease.customer.internal.CustomerRepository;

import jakarta.persistence.EntityNotFoundException;

/** Tests for {@link CustomerService} covering each method's happy path and the deletion event. */
@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    private CustomerRepository customerRepository;
    private ApplicationEventPublisher eventPublisher;
    private CustomerService customerService;

    @BeforeEach
    void setUp() {
        customerRepository = mock(CustomerRepository.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        customerService = new CustomerService(customerRepository, eventPublisher);
    }

    private static Customer customer(long id, String name) {
        Customer customer = new Customer();
        customer.setId(id);
        customer.setName(name);
        return customer;
    }

    @Test
    void findAll_withCustomers_returnsRepositoryResult() {
        Customer customer = customer(1L, "Jane Doe");
        when(customerRepository.findAll()).thenReturn(List.of(customer));

        assertThat(customerService.findAll()).containsExactly(customer);
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

    @Test
    void deleteById_withExistingId_publishesEventThenDeletes() {
        Customer customer = customer(1L, "Jane Doe");
        when(customerRepository.findById(1L)).thenReturn(Optional.of(customer));

        customerService.deleteById(1L);

        ArgumentCaptor<CustomerDeletedEvent> captor = ArgumentCaptor.forClass(CustomerDeletedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().customerId()).isEqualTo(1L);
        assertThat(captor.getValue().customerName()).isEqualTo("Jane Doe");
        verify(customerRepository).delete(customer);
    }

    @Test
    void deleteById_withMissingId_throwsEntityNotFoundException() {
        when(customerRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> customerService.deleteById(1L))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Customer with ID 1 not found.");
        verify(eventPublisher, never()).publishEvent(any(CustomerDeletedEvent.class));
    }
}
