package com.stocks.stockease.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/**
 * Integration tests for POST /api/products endpoint (product creation).
 * 
 * System Under Test (SUT): ProductController.createProduct(Product) 
 * → ResponseEntity<Product> (201 Created) or error response
 * 
 * Test framework: Spring Boot WebMvcTest (loads SecurityConfig, MockMvc)
 * Mock framework: Mockito (@MockitoBean ProductRepository)
 * Authorization: TestConfig provides JWT token validation mocks
 * 
 * Test coverage:
 * 1. Happy path: Admin user creates product with valid data
 * 2. Authorization failure: USER role denied (403 Forbidden)
 * 3. Validation failures: Missing fields, negative quantity, zero/invalid price
 * 4. Type validation: Invalid JSON data types (string for numeric field)
 * 
 * Execution flow (Given-When-Then):
 * - @BeforeEach: Mock JWT validation, initialize test product
 * - @Test: Setup request → MockMvc.perform() → Assert response status/body
 * - TestConfig: Provides SecurityFilterChain for JWT extraction
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see ProductController.createProduct()
 * @see TestConfig (JWT mock configuration)
 * @see SecurityConfig (JWT filter chain)
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class) // Use TestConfig to handle authorization
public class ProductCreateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProductRepository productRepository;

    private Product product1;

    /**
     * Lifecycle hook: Setup JWT mocks and test data before each test.
     * 
     * Mock configuration:
     * - JwtUtil.validateToken(): Always returns true (simulates valid JWT)
     * - JwtUtil.extractUsername(): Returns "testUser" (authenticated user)
     * - JwtUtil.extractRole(): Returns "ROLE_ADMIN" (role from token)
     * 
     * Test data:
     * - product1: Valid product with name, quantity=10, price=100.0, totalValue=1000.0
     * - ProductRepository: Reset after each mock setup (Mockito.reset())
     * 
     * Execution: @BeforeEach runs BEFORE each @Test/@ParameterizedTest method
     */
    @SuppressWarnings("unused") // Called by JUnit 5 @BeforeEach lifecycle
    @BeforeEach
    void setUpMocks() {
        // Mock JwtUtil behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        Mockito.when(jwtUtil.extractRole(Mockito.anyString())).thenReturn("ROLE_ADMIN");

        // Initialize a valid product
        product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0);

        // Reset repository mock
        Mockito.reset(productRepository);
    }

    /**
     * Given: Admin user authenticated with ROLE_ADMIN
     * When: POST /api/products with valid product JSON
     * Then: ResponseEntity(200 OK) with created product details (name, quantity, price, totalValue)
     * 
     * Test scenario:
     * - Mock ProductRepository.save() to return product1
     * - Include CSRF token (POST requires CSRF protection)
     * - Verify response contains product attributes
     */
    @Test
    void testValidProductCreation() throws Exception {
        when(productRepository.save(any(Product.class))).thenReturn(product1);

        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(csrf())
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Product 1"))
            .andExpect(jsonPath("$.quantity").value(10))
            .andExpect(jsonPath("$.price").value(100.0))
            .andExpect(jsonPath("$.totalValue").value(1000.0));
    }

    /**
     * Given: Regular user authenticated with ROLE_USER (not ROLE_ADMIN)
     * When: POST /api/products with valid product JSON
     * Then: ResponseEntity(403 Forbidden) - @PreAuthorize("hasRole('ADMIN')") denies access
     * 
     * Test scenario:
     * - Use ParameterizedTest with CsvSource for multiple role variations
     * - Verify role-based authorization enforced by SecurityConfig
     * - Confirms only ADMIN users can create products
     */
    @ParameterizedTest
    @CsvSource({
        "regularUser, USER"
    })
    void testProductCreationDeniedForUser(String username, String role) throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Valid Product\", \"quantity\": 10, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
            .andExpect(status().isForbidden());
    }

    /**
     * Given: Admin user with empty/blank product name
     * When: POST /api/products with name="" (empty string)
     * Then: ResponseEntity(400 Bad Request) with error message about required fields
     * 
     * Test scenario:
     * - Product model uses @NotBlank on name field
     * - Spring validation framework rejects before reaching controller logic
     * - Verifies input validation layer works correctly
     */
    @Test
    void testProductCreationWithMissingFields() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"\"}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Incomplete update. Please fill in all required fields."));
    }

    /**
     * Given: Admin user with negative quantity (-5)
     * When: POST /api/products with quantity < 0
     * Then: ResponseEntity(400 Bad Request) with error message "Quantity cannot be negative"
     * 
     * Test scenario:
     * - Product model uses custom validation (@Min or @Positive on quantity)
     * - Controller/service validates business logic constraint
     * - Verifies domain model enforces business rule (quantity ≥ 0)
     */
    @Test
    void testProductCreationWithNegativeQuantity() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": -5, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Quantity cannot be negative."));
    }

    /**
     * Given: Admin user with zero price (0.0)
     * When: POST /api/products with price = 0
     * Then: ResponseEntity(400 Bad Request) with error message "Price must be greater than 0"
     * 
     * Test scenario:
     * - Product model enforces price > 0 (business rule for valid products)
     * - Prevents free products from being created without explicit authorization
     * - Verifies domain validation catches invalid price
     */
    @Test
    void testProductCreationWithZeroPrice() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 0, \"totalValue\": 0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Price must be greater than 0."));
    }

    /**
     * Given: Admin user with string value for price field (e.g., "notANumber")
     * When: POST /api/products with price="notANumber" (type mismatch)
     * Then: ResponseEntity(400 Bad Request) - HttpMessageNotReadableException
     * 
     * Test scenario:
     * - JSON deserializer fails to parse string as Double
     * - GlobalExceptionHandler catches HttpMessageNotReadableException
     * - Verifies type validation at framework level (before reaching controller)
     * - Prevents runtime casting errors via fail-fast validation
     */
    @Test
    void testProductCreationWithInvalidTypeForPrice() throws Exception {
        when(productRepository.save(any(Product.class))).thenReturn(product1);
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": \"notANumber\", \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().isBadRequest());
    }
}

