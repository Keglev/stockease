package com.stocks.stockease.customer;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.customer.internal.CustomerRepository;

import lombok.RequiredArgsConstructor;

/**
 * Customer module's public API for looking up and registering customers.
 * Other modules depend on this service rather than reaching into the module's repository.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customerRepository;

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
}
