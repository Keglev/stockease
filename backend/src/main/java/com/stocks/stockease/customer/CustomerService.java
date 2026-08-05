package com.stocks.stockease.customer;

import java.util.List;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.customer.internal.CustomerRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Customer module's public API for querying and mutating customers.
 * Other modules depend on this service rather than reaching into the module's repository.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Finds a customer by its ID.
     *
     * @param id customer identifier
     * @return the customer, or empty if none exists with that ID
     */
    public Optional<Customer> findById(long id) {
        return customerRepository.findById(id);
    }

    /**
     * Returns every live customer.
     *
     * @return list of all customers that have not been soft-deleted
     */
    public List<Customer> findAll() {
        return customerRepository.findAll();
    }

    /**
     * Creates and persists a new customer.
     *
     * @param name customer name
     * @param email customer email, may be {@code null}
     * @param phone customer phone number, may be {@code null}
     * @param address customer postal address, may be {@code null}
     * @param city customer city, may be {@code null}
     * @return the persisted customer including its generated ID
     */
    @Transactional
    public Customer create(String name, String email, String phone, String address, String city) {
        Customer customer = new Customer();
        customer.setName(name);
        customer.setEmail(email);
        customer.setPhone(phone);
        customer.setAddress(address);
        customer.setCity(city);
        return customerRepository.save(customer);
    }

    /**
     * Replaces a customer's fields.
     *
     * <p>Every field is replaced, including the optional ones: a {@code null} email clears the
     * stored email rather than leaving it in place. Name is the only mandatory field, as on
     * creation.
     *
     * <p>Unlike {@link com.stocks.stockease.supplier.SupplierService#update}, there is no
     * service-level argument guard. The supplier's exists because two of its fields are mandatory
     * and its create path is reached from more than the controller; a customer's rules are the ones
     * {@link com.stocks.stockease.customer.web.CreateCustomerRequest} already states, and its create
     * method carries no guard either. Adding one only here would make an edit stricter than the
     * creation it edits.
     *
     * @param id customer identifier
     * @param name new display name
     * @param email new email, may be {@code null} to clear it
     * @param phone new phone number, may be {@code null} to clear it
     * @param address new postal address, may be {@code null} to clear it
     * @param city new city, may be {@code null} to clear it
     * @return the updated customer
     * @throws EntityNotFoundException if no customer exists with the given ID
     */
    @Transactional
    public Customer update(long id, String name, String email, String phone, String address, String city) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Customer with ID " + id + " not found."));
        customer.setName(name);
        customer.setEmail(email);
        customer.setPhone(phone);
        customer.setAddress(address);
        customer.setCity(city);
        return customerRepository.save(customer);
    }

    /**
     * Soft-deletes a customer, unless a listener vetoes the deletion.
     *
     * @param id customer identifier
     * @throws EntityNotFoundException if no customer exists with the given ID
     * @throws com.stocks.stockease.shared.EntityInUseException if a listener vetoes the deletion, for
     *         instance because open invoices still reference the customer
     */
    @Transactional
    public void deleteById(long id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Customer with ID " + id + " not found."));
        // the event fires first so open-invoice vetoes abort before any state changes; a veto exception
        // rolls back the transaction
        eventPublisher.publishEvent(new CustomerDeletedEvent(customer.getId(), customer.getName()));
        customerRepository.delete(customer);
    }
}
