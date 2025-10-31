package com.stocks.stockease.controller;

import java.util.Arrays;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/**
 * Integration tests for GET /api/products/* endpoints (product fetching/querying).
 * 
 * System Under Test (SUT): ProductController.getAllProducts(), getProductById(Long id)
 * → ResponseEntity<List<Product>> or ResponseEntity<ApiResponse<Product>>
 * 
 * Test framework: Spring Boot WebMvcTest (loads SecurityConfig, MockMvc)
 * Authorization: SecurityMockMvcRequestPostProcessors.user() with roles
 * Mock framework: Mockito (@MockitoBean ProductRepository)
 * Context: @DirtiesContext clears Spring context between tests (isolation)
 * 
 * Test coverage (parameterized):
 * 1. Fetch all products: Both ADMIN and USER roles allowed
 * 2. Fetch product by ID: Both ADMIN and USER roles allowed
 * 3. Not found: Fetch non-existent ID (404 Not Found)
 * 
 * Execution flow (Given-When-Then):
 * - @BeforeEach: Setup mock products with ID, quantity, price, totalValue
 * - @ParameterizedTest: Test with multiple role combinations
 * - TestConfig: Provides SecurityFilterChain for authorization checks
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see ProductController.getAllProducts()
 * @see ProductController.getProductById()
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class) // Import the reusable TestConfig
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
public class ProductFetchControllerTest {

    @MockitoBean // Mock the repository
    private ProductRepository productRepository;

    @Autowired // Inject MockMvc for request simulation
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * Lifecycle hook: Setup mock product data before each test.
     * 
     * Mock data:
     * - Product 1: ID=1, name="Product 1", quantity=10, price=100.0, totalValue=1000.0
     * - Product 2: ID=2, name="Product 2", quantity=5, price=50.0, totalValue=250.0
     * - ProductRepository.findAllOrderById(): Returns list of both products
     * 
     * Execution: @BeforeEach runs BEFORE each @Test/@ParameterizedTest method
     */
    @SuppressWarnings("unused") // Called by JUnit 5 @BeforeEach lifecycle
    @BeforeEach
    void setUp() {
        // Mock products
        Product product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0); // Mock total value

        Product product2 = new Product("Product 2", 5, 50.0);
        product2.setId(2L);
        product2.setTotalValue(250.0); // Mock total value

        when(productRepository.findAllOrderById()).thenReturn(Arrays.asList(product1, product2));
    }

    /**
     * Application context sanity check.
     * 
     * Given: Spring Boot WebMvcTest loads application context
     * When: Test runs
     * Then: ProductRepository and MockMvc beans are NOT null
     * 
     * Verifies: Configuration and auto-wiring successful
     */
    @Test
    void contextLoads() {
        assertNotNull(productRepository);
        assertNotNull(mockMvc);
    }

    /**
     * Given: Authenticated user (ADMIN or USER)
     * When: GET /api/products (fetch all)
     * Then: ResponseEntity(200 OK) with list of all products [Product 1, Product 2]
     * 
     * Test scenario (parameterized):
     * - Test both ADMIN and USER roles (both can read products)
     * - Mock JwtUtil.validateToken() returns true
     * - Verify response contains product names and totalValues
     * - Confirms read-access is unrestricted by role
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetAllProductsWithRoles(String username, String role) throws Exception {
        // Mock JwtUtil behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

        // Perform GET request and validate response
        ResultActions result = mockMvc.perform(get("/api/products")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)));

        // Validate JSON response
        result.andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Product 1"))
            .andExpect(jsonPath("$[0].totalValue").value(1000.0))
            .andExpect(jsonPath("$[1].name").value("Product 2"))
            .andExpect(jsonPath("$[1].totalValue").value(250.0));
    }

    /**
     * Given: Authenticated user (ADMIN or USER) with valid product ID
     * When: GET /api/products/{id}
     * Then: ResponseEntity(200 OK) with product details (name, totalValue, etc.)
     * 
     * Test scenario (parameterized):
     * - Test both ADMIN and USER roles (both can read specific product)
     * - Mock ProductRepository.findById(1L) returns Product 1
     * - Verify response contains product attributes in data wrapper
     * - Confirms product lookup by ID works for all roles
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetProductByIdWithRoles(String username, String role) throws Exception {
        // Mock JwtUtil behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

        // Prepare mock data
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);
        product.setTotalValue(10 * 100.0);

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        // Perform GET request and validate response
        mockMvc.perform(get("/api/products/1")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Product 1"))
            .andExpect(jsonPath("$.data.totalValue").value(1000.0));
    }

    /**
     * Given: Authenticated user (ADMIN or USER) requesting non-existent product ID
     * When: GET /api/products/{id} where id=999 (doesn't exist)
     * Then: ResponseEntity(404 Not Found) with success=false, message about missing product
     * 
     * Test scenario (parameterized):
     * - Mock ProductRepository.findById(999L) returns Optional.empty()
     * - Verify response status 404 and appropriate error message
     * - Confirm data field is empty/null
     * - Validates 404 handling for both ADMIN and USER roles
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetProductByIdNotFoundWithRoles(String username, String role) throws Exception {
        // Mock JwtUtil behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

        // Mock repository behavior: return empty for the given ID
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        // Perform GET request for a non-existing product and validate response
        mockMvc.perform(get("/api/products/999")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("The product with ID 999 does not exist."))
            .andExpect(jsonPath("$.data").isEmpty());
    }
}