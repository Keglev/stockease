package com.stocks.stockease.customer.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.customer.Customer;

/** Spring Data JPA repository for {@link Customer} entities. */
public interface CustomerRepository extends JpaRepository<Customer, Long> {
}
