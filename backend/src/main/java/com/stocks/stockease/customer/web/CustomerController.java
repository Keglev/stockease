package com.stocks.stockease.customer.web;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.shared.ApiResponse;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for customer master data.
 *
 * <p>Covers listing, lookup, creation and soft deletion, delegating every operation to
 * {@link CustomerService}. There is deliberately no update endpoint: customer master-data management
 * is out of scope by design. All endpoints require at minimum ROLE_USER; deletion requires ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    /**
     * Returns every live customer.
     *
     * @return list of all customers that have not been soft-deleted
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<CustomerResponse> getAllCustomers() {
        return customerService.findAll().stream().map(CustomerResponse::from).toList();
    }

    /**
     * Returns a single customer by its ID.
     *
     * @param id customer identifier
     * @return HTTP 200 with the customer
     * @throws EntityNotFoundException if no customer exists with the given ID
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<CustomerResponse>> getCustomerById(@PathVariable long id) {
        Customer customer = customerService.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Customer with ID " + id + " not found."));
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Customer fetched successfully", CustomerResponse.from(customer)));
    }

    /**
     * Creates a new customer.
     *
     * @param request customer fields (name, email, phone, address, city)
     * @return HTTP 200 with the persisted customer including its generated ID
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<CustomerResponse> createCustomer(@Valid @RequestBody CreateCustomerRequest request) {
        Customer saved = customerService.create(request.name(), request.email(), request.phone(), request.address(),
                request.city());
        return ResponseEntity.ok(CustomerResponse.from(saved));
    }

    /**
     * Soft-deletes a customer by ID (ADMIN only).
     *
     * @param id customer identifier to delete
     * @return HTTP 200 on success
     * @throws EntityNotFoundException if no customer exists with the given ID
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteCustomer(@PathVariable long id) {
        customerService.deleteById(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Customer with ID " + id + " has been successfully deleted.", null));
    }
}
