package com.stocks.stockease.controller;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/**
 * Integration tests for PUT /api/products/{id}/* endpoints (product updates).
 * 
 * System Under Test (SUT): ProductController.updateQuantity(), updatePrice(), updateName()
 * → ResponseEntity<ApiResponse<Product>> (200 OK) or error response
 * 
 * Test framework: Spring Boot WebMvcTest (loads SecurityConfig, MockMvc)
 * Authorization: SecurityMockMvcRequestPostProcessors.user() with roles
 * Mock framework: Mockito (@MockitoBean ProductRepository)
 * 
 * Test coverage (parameterized):
 * 1. Update quantity: Both ADMIN and USER roles allowed (shared endpoint)
 * 2. Update price: Both ADMIN and USER roles allowed
 * 3. Update name: Both ADMIN and USER roles allowed, including special characters
 * 
 * Execution flow (Given-When-Then):
 * - @BeforeEach: Mock JWT validation, ProductRepository behavior
 * - @ParameterizedTest: Run same test with multiple role combinations
 * - TestConfig: Provides SecurityFilterChain for authorization checks
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see ProductController.updateQuantity()
 * @see ProductController.updatePrice()
 * @see ProductController.updateName()
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class) // Use TestConfig to handle authorization
public class ProductUpdateControllerTest {

    @MockitoBean
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * Lifecycle hook: Setup JWT mocks before each test.
     * 
     * Mock configuration:
     * - JwtUtil.validateToken(): Always returns true
     * - JwtUtil.extractUsername(): Returns "testUser"
     * - ProductRepository: Reset to clear stubs between tests
     * 
     * Execution: @BeforeEach runs BEFORE each @ParameterizedTest
     */
    @SuppressWarnings("unused") // Called by JUnit 5 @BeforeEach lifecycle
    @BeforeEach
    void setUpJwtMock() {
        // Mock JwtUtil behavior for consistent authorization
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        Mockito.reset(productRepository); // Reset repository mock to avoid interference between tests
    }

    /**
     * Given: Authenticated user (ADMIN or USER) with valid product ID
     * When: PUT /api/products/{id}/quantity with new quantity value
     * Then: ResponseEntity(200 OK) with updated quantity in response body
     * 
     * Test scenario (parameterized):
     * - Test both ADMIN and USER roles (both can update quantity)
     * - Mock ProductRepository.findById() to return existing product
     * - Mock ProductRepository.save() to persist update
     * - Verify response contains updated quantity value
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdateQuantityWithRoles(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenReturn(product);

        // Perform the PUT request to update quantity
        mockMvc.perform(put("/api/products/1/quantity")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"quantity\": 50}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Quantity updated successfully"))
            .andExpect(jsonPath("$.data.quantity").value(50));
    }

    /**
     * Given: Authenticated user (ADMIN or USER) with valid product ID
     * When: PUT /api/products/{id}/price with new price value
     * Then: ResponseEntity(200 OK) with "Price updated successfully" message
     * 
     * Test scenario (parameterized):
     * - Test both ADMIN and USER roles (both can update price)
     * - Mock ProductRepository for lookup and persistence
     * - Verify response includes success message
     * - Price update recalculates total_value (qty × price)
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdatePriceWithRoles(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenReturn(product);

        // Perform the PUT request to update price
        mockMvc.perform(put("/api/products/1/price")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"price\": 150.0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Price updated successfully"));
    }

    /**
     * Given: Authenticated user (ADMIN or USER) updating product name with special characters
     * When: PUT /api/products/{id}/name with name containing !@#$%
     * Then: ResponseEntity(200 OK) with updated name echoed in response
     * 
     * Test scenario (parameterized):
     * - Verify special characters (!, @, #, $, %) preserved in name field
     * - Test XSS protection: special chars should NOT be HTML-encoded on save
     * - Mock repository persistence and retrieval
     * - Confirm response mirrors back provided special characters
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdateNameWithSpecialCharacters(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenReturn(product);

        // Perform the PUT request to update name with special characters
        mockMvc.perform(put("/api/products/1/name")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"name\": \"Updated!@#$%\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Name updated successfully"))
            .andExpect(jsonPath("$.data.name").value("Updated!@#$%"));
    }
}
