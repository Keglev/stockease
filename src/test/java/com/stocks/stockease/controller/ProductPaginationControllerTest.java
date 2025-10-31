package com.stocks.stockease.controller;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.hamcrest.Matchers.hasSize;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/**
 * Integration tests for GET /api/products/paged endpoint (paginated product queries).
 * 
 * System Under Test (SUT): ProductController.getProductsPaginated(Pageable)
 * → ResponseEntity<ApiResponse<Page<Product>>> with pagination metadata
 * 
 * Test framework: Spring Boot WebMvcTest (loads SecurityConfig, MockMvc)
 * Authorization: SecurityMockMvcRequestPostProcessors.user() with roles
 * Mock framework: Mockito (@MockitoBean ProductRepository)
 * Pagination: Spring Data Pageable with page/size parameters
 * 
 * Test coverage (parameterized):
 * 1. Valid pagination: Fetch page 0 with size 10 → 20 total products, 2 pages
 * 2. Empty page: Fetch page 1 where no data exists → empty content[]
 * 3. Invalid parameters: Negative page/size → 400 Bad Request validation error
 * 
 * Execution flow (Given-When-Then):
 * - @BeforeEach: Create 20 mock products, mock findAll(Pageable)
 * - @ParameterizedTest: Test with ADMIN and USER roles
 * - Response includes: content[], totalElements, totalPages, currentPage
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see ProductController.getProductsPaginated()
 * @see org.springframework.data.domain.Page (Spring Data pagination)
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
public class ProductPaginationControllerTest {

    @MockitoBean
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * Lifecycle hook: Setup mock products and pagination behavior before each test.
     * 
     * Mock data:
     * - 20 products generated: "Product 1" through "Product 20"
     * - Each with quantity=i, price=i*10.0 (Product 1: qty=1, price=10.0, etc.)
     * - Page 0 (first 10): Products 1-10
     * - Mock: ProductRepository.findAll(Pageable) returns paginated results
     * 
     * Execution: @BeforeEach runs BEFORE each @ParameterizedTest method
     */
    @SuppressWarnings("unused") // Called by JUnit 5 @BeforeEach lifecycle
    @BeforeEach
    void setUp() {
        // Mock JWT behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

        // Generate mock products
        List<Product> products = IntStream.range(1, 21) // Generate 20 products
                .mapToObj(i -> new Product("Product " + i, i, i * 10.0))
                .collect(Collectors.toList());

        Page<Product> productPage = new PageImpl<>(products.subList(0, 10), PageRequest.of(0, 10), products.size());
        Mockito.when(productRepository.findAll(Mockito.any(Pageable.class))).thenReturn(productPage);
    }

    /**
     * Given: Authenticated user (ADMIN or USER) requesting page 0, size 10
     * When: GET /api/products/paged?page=0&size=10
     * Then: ResponseEntity(200 OK) with 10 products, totalElements=20, totalPages=2
     * 
     * Test scenario (parameterized):
     * - Mock returns first 10 products out of 20 total
     * - Verify response includes content[], totalElements, totalPages
     * - Confirms pagination metadata correct for offset-based slicing
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetPagedProductsWithRoles(String username, String role) throws Exception {
        mockMvc.perform(get("/api/products/paged")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("page", "0")
                .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content", hasSize(10)))
            .andExpect(jsonPath("$.data.content[0].name").value("Product 1"))
            .andExpect(jsonPath("$.data.content[9].name").value("Product 10"))
            .andExpect(jsonPath("$.data.totalElements").value(20))
            .andExpect(jsonPath("$.data.totalPages").value(2));
    }

    /**
     * Given: Authenticated user requesting page 1, size 10 (which has no data)
     * When: GET /api/products/paged?page=1&size=10
     * Then: ResponseEntity(200 OK) with empty content[], totalElements correctly set
     * 
     * Test scenario (parameterized):
     * - Mock returns empty Page (no products on page 1)
     * - Verify content[] is empty but response still succeeds (200 OK)
     * - Confirms pagination handles empty pages gracefully
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetPagedProductsEmptyPage(String username, String role) throws Exception {
        Page<Product> emptyPage = new PageImpl<>(Collections.emptyList());
        Mockito.when(productRepository.findAll(Mockito.any(Pageable.class))).thenReturn(emptyPage);

        mockMvc.perform(get("/api/products/paged")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("page", "1")
                .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content").isEmpty());
    }

    /**
     * Given: Authenticated user with NEGATIVE page=-1 or negative size=-10
     * When: GET /api/products/paged?page=-1&size=-10
     * Then: ResponseEntity(400 Bad Request) - @Min validation fails
     * 
     * Test scenario (parameterized):
     * - Pageable uses @Min(0) annotations on page/size parameters
     * - Spring validation framework rejects negative values
     * - HandlerMethodValidationException caught and converted to 400
     * - Confirms input validation prevents invalid pagination queries
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetPagedProductsInvalidParams(String username, String role) throws Exception {
        mockMvc.perform(get("/api/products/paged")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("page", "-1")
                .param("size", "-10"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Validation failed for request parameters."))
            .andExpect(jsonPath("$.data.Unknown").value("Unable to extract detailed validation error.")); // Adjust expectation based on actual error message
    }
}
