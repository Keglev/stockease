package com.stocks.stockease.controller;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/**
 * Integration tests for various ProductController endpoints.
 * 
 * System Under Test (SUT): ProductController miscellaneous endpoints
 * - getLowStockProducts() → Find products with quantity < 5
 * - Potential additional business logic endpoints
 * 
 * Test framework: Spring Boot WebMvcTest (loads SecurityConfig, MockMvc)
 * Authorization: SecurityMockMvcRequestPostProcessors.user() with roles
 * Mock framework: Mockito (@MockitoBean ProductRepository, JwtUtil)
 * 
 * Test coverage:
 * 1. Low-stock query: Find products with quantity < 5 (parameterized by role)
 * 2. Empty result: No products with low stock
 * 
 * Execution flow (Given-When-Then):
 * - @BeforeEach: Reset mocks, setup JWT validation
 * - @ParameterizedTest: Test with ADMIN and USER roles
 * - Business logic: productRepository.findByQuantityLessThan(5)
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see ProductController
 * @see ProductRepository.findByQuantityLessThan()
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
public class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductRepository productRepository;

    @MockitoBean
    private JwtUtil jwtUtil;

    /**
     * Lifecycle hook: Reset all mocks and setup JWT validation before each test.
     * 
     * Mock reset:
     * - ProductRepository: Clears all stubs from previous tests
     * - JwtUtil: Clears all stubs from previous tests
     * 
     * Mock configuration:
     * - JwtUtil.validateToken(): Always returns true
     * - JwtUtil.extractUsername(): Returns "testUser"
     * 
     * Execution: @BeforeEach runs BEFORE each @ParameterizedTest method
     */
    @SuppressWarnings("unused") // Called by JUnit 5 @BeforeEach lifecycle
    @BeforeEach
    void resetMocks() {
        Mockito.reset(productRepository, jwtUtil);
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
    }

    /**
     * Given: Authenticated user (ADMIN or USER)
     * When: GET /api/products/low-stock
     * Then: ResponseEntity(200 OK) with list of products where quantity < 5
     * 
     * Test scenario (parameterized):
     * - Mock ProductRepository.findByQuantityLessThan(5) returns 2 low-stock products
     * - Product 1: qty=3, Product 2: qty=2 (both < 5 threshold)
     * - Verify response contains names of both low-stock products
     * - Confirms business logic for inventory alerts
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testLowStockProductsWithRoles(String username, String role) throws Exception {
        Product product1 = new Product("Low Stock Product 1", 3, 50.0);
        product1.setId(1L);

        Product product2 = new Product("Low Stock Product 2", 2, 30.0);
        product2.setId(2L);

        when(productRepository.findByQuantityLessThan(5)).thenReturn(Arrays.asList(product1, product2));

        mockMvc.perform(get("/api/products/low-stock")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Low Stock Product 1"))
                .andExpect(jsonPath("$[1].name").value("Low Stock Product 2"));
    }

    /**
     * Given: Authenticated user with no low-stock products in repository
     * When: GET /api/products/low-stock
     * Then: ResponseEntity(200 OK) with message "All products are sufficiently stocked"
     * 
     * Test scenario (parameterized):
     * - Mock ProductRepository.findByQuantityLessThan(5) returns empty list
     * - Verify response status 200 (no error) with custom message
     * - Confirms graceful handling of empty result set
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testLowStockProductsEmptyWithRoles(String username, String role) throws Exception {
        when(productRepository.findByQuantityLessThan(5)).thenReturn(List.of());

        mockMvc.perform(get("/api/products/low-stock")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("All products are sufficiently stocked."));
    }

    /**
     * Given: Authenticated user searching for products by name substring
     * When: GET /api/products/search?name=searchable
     * Then: ResponseEntity(200 OK) with matching product "Searchable Product"
     * 
     * Test scenario (parameterized):
     * - Mock ProductRepository.findByNameContainingIgnoreCase("searchable")
     * - Case-insensitive search returns product regardless of case
     * - Verify response contains matching product name
     * - Confirms substring matching for product discovery
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testSearchProductsWithRoles(String username, String role) throws Exception {
        Product product = new Product("Searchable Product", 10, 100.0);
        product.setId(1L);

        when(productRepository.findByNameContainingIgnoreCase("searchable"))
            .thenReturn(List.of(product));

        mockMvc.perform(get("/api/products/search")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("name", "searchable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Searchable Product"));
    }

    /**
     * Given: Authenticated user searching for non-existent product name
     * When: GET /api/products/search?name=nonexistent
     * Then: ResponseEntity(204 No Content) with message about no matches
     * 
     * Test scenario (parameterized):
     * - Mock ProductRepository.findByNameContainingIgnoreCase("nonexistent") returns empty
     * - Status 204 (No Content) indicates "search executed, no results"
     * - Verify response message indicates no products found
     * - Confirms graceful handling of empty search results
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testSearchProductsEmptyWithRoles(String username, String role) throws Exception {
        when(productRepository.findByNameContainingIgnoreCase("nonexistent"))
            .thenReturn(List.of());

        mockMvc.perform(get("/api/products/search")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("name", "nonexistent"))
                .andExpect(status().isNoContent())
                .andExpect(jsonPath("$.message").value("No products found matching the name: nonexistent"));
    }

    /**
     * Tests the "total stock value" endpoint with products present.
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testTotalStockValueWithProducts(String username, String role) throws Exception {
        when(productRepository.calculateTotalStockValue()).thenReturn(500.0);

        mockMvc.perform(get("/api/products/total-stock-value")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(500.0))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Total stock value fetched successfully"));
    }

    /**
     * Tests the "total stock value" endpoint with no products.
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testTotalStockValueWithNoProducts(String username, String role) throws Exception {
        when(productRepository.calculateTotalStockValue()).thenReturn(0.0);

        mockMvc.perform(get("/api/products/total-stock-value")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(0.0))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Total stock value fetched successfully"));
    }
}
