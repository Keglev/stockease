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

import com.stocks.stockease.shared.MissingEntityException;
import com.stocks.stockease.shared.ApiErrorCodes;
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
    void update_withExistingId_replacesEveryFieldAndSaves() {
        Customer stored = customer(1L, "Jane Doe");
        stored.setEmail("old@example.com");
        stored.setPhone("555-0000");
        stored.setCity("Springfield");
        when(customerRepository.findById(1L)).thenReturn(Optional.of(stored));
        when(customerRepository.save(any(Customer.class))).thenAnswer(call -> call.getArgument(0));

        Customer result = customerService.update(1L, "Jane Roe", "roe@example.com", "555-9999", "2 Side St",
                "Shelbyville");

        assertThat(result.getName()).isEqualTo("Jane Roe");
        assertThat(result.getEmail()).isEqualTo("roe@example.com");
        assertThat(result.getPhone()).isEqualTo("555-9999");
        assertThat(result.getAddress()).isEqualTo("2 Side St");
        assertThat(result.getCity()).isEqualTo("Shelbyville");
    }

    @Test
    void update_withNullOptionalFields_clearsThemRatherThanKeepingThem() {
        Customer stored = customer(1L, "Jane Doe");
        stored.setEmail("old@example.com");
        stored.setPhone("555-0000");
        stored.setAddress("1 Main St");
        stored.setCity("Springfield");
        when(customerRepository.findById(1L)).thenReturn(Optional.of(stored));
        when(customerRepository.save(any(Customer.class))).thenAnswer(call -> call.getArgument(0));

        // Wholesale replace, not merge: absent means remove. A merge would leave the old email in
        // place, which is the failure this asserts against.
        Customer result = customerService.update(1L, "Jane Doe", null, null, null, null);

        assertThat(result.getEmail()).isNull();
        assertThat(result.getPhone()).isNull();
        assertThat(result.getAddress()).isNull();
        assertThat(result.getCity()).isNull();
    }

    @Test
    void update_withMissingId_throwsEntityNotFoundException() {
        when(customerRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> customerService.update(1L, "Jane Roe", null, null, null, null))
                // The subtype, not the parent: the parent still answers uncoded for a not-found JPA
                // raises, and asserting it here would pass whether or not this site was migrated.
                .isInstanceOf(MissingEntityException.class)
                .hasMessage("Customer with ID 1 not found.")
                .extracting(thrown -> ((MissingEntityException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.CUSTOMER_NOT_FOUND);
        verify(customerRepository, never()).save(any(Customer.class));
    }

    @Test
    void update_withExistingId_publishesNoEvent() {
        // Deliberate, and the supplier's update does the same: an edit is not an audited event in
        // either register. Only deletion publishes, because only deletion can be vetoed.
        when(customerRepository.findById(1L)).thenReturn(Optional.of(customer(1L, "Jane Doe")));
        when(customerRepository.save(any(Customer.class))).thenAnswer(call -> call.getArgument(0));

        customerService.update(1L, "Jane Roe", null, null, null, null);

        verify(eventPublisher, never()).publishEvent(any());
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
