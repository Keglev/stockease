package com.stocks.stockease.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.repository.ProductRepository;

/**
 * Integration tests for DELETE /api/products/{id} endpoint (product deletion).
 * 
 * System Under Test (SUT): ProductController.deleteProduct(Long id) 
 * → ResponseEntity<ApiResponse<Void>> (200 OK) or error response
 * 
 * Test framework: Spring Boot WebMvcTest (loads SecurityConfig, MockMvc)
 * Authorization: @WithMockUser (JUnit 5 Spring Security test support)
 * Mock framework: Mockito (@MockitoBean ProductRepository)
 * 
 * Test coverage:
 * 1. Happy path: Admin user deletes existing product (200 OK)
 * 2. Not Found: Admin attempts to delete non-existent product (404 Not Found)
 * 3. Authorization failure: USER role denied deletion (403 Forbidden)
 * 
 * Execution flow (Given-When-Then):
 * - @BeforeEach: Setup mock ProductRepository.existsById()
 * - @Test: Setup authorization → MockMvc.perform(DELETE) → Assert response
 * - TestConfig: Provides SecurityFilterChain for authorization checks
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see ProductController.deleteProduct()
 * @see TestConfig (security configuration)
 * @see SecurityConfig (@PreAuthorize enforcement)
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class) // Ensure security beans are imported
public class ProductDeleteControllerTest {

    @MockitoBean
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    /**
     * Lifecycle hook: Setup mock ProductRepository behavior before each test.
     * 
     * Mock configuration:
     * - ProductRepository.existsById(1L): Returns true (product exists by default)
     * - Tests override this if checking non-existent product scenario
     * 
     * Execution: @BeforeEach runs BEFORE each @Test method
     */
    @SuppressWarnings("unused") // Called by JUnit 5 @BeforeEach lifecycle
    @BeforeEach
    void setUpMocks() {
        Mockito.when(productRepository.existsById(1L)).thenReturn(true);
    }

    /**
     * Given: Admin user authenticated with ROLE_ADMIN
     * When: DELETE /api/products/1 for existing product
     * Then: ResponseEntity(200 OK) with success=true, ProductRepository.deleteById() called once
     * 
     * Test scenario:
     * - @WithMockUser sets up authenticated security context
     * - ProductRepository.existsById(1L) returns true (mocked in @BeforeEach)
     * - Verifies controller calls repository deleteById() method exactly once
     * - Confirms successful deletion response message
     */
    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDeleteProductAsAdmin() throws Exception {
        mockMvc.perform(delete("/api/products/1")
                .with(csrf())) // Add CSRF token
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Product with ID 1 has been successfully deleted."));

        Mockito.verify(productRepository, Mockito.times(1)).deleteById(1L);
    }

    /**
     * Given: Admin user authenticated, product with ID 1 does NOT exist
     * When: DELETE /api/products/1
     * Then: ResponseEntity(404 Not Found) with success=false, deleteById() NEVER called
     * 
     * Test scenario:
     * - Override mock: ProductRepository.existsById(1L) returns false
     * - Controller checks existence before deletion (prevents orphaned operations)
     * - Verify deleteById() NOT invoked (via Mockito.never())
     * - Confirms idempotency: deleting non-existent product is safe
     */
    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testDeleteNonexistentProduct() throws Exception {
        Mockito.when(productRepository.existsById(1L)).thenReturn(false);

        mockMvc.perform(delete("/api/products/1")
                .with(csrf()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Cannot delete. Product with ID 1 does not exist."));

        Mockito.verify(productRepository, Mockito.never()).deleteById(Mockito.anyLong());
    }

    /**
     * Given: Regular user authenticated with ROLE_USER (not ROLE_ADMIN)
     * When: DELETE /api/products/1
     * Then: ResponseEntity(403 Forbidden) - @PreAuthorize("hasRole('ADMIN')") denies access
     * 
     * Test scenario:
     * - Manually setup SecurityContext with ROLE_USER (using UsernamePasswordAuthenticationToken)
     * - Verify role-based authorization enforced by SecurityConfig
     * - Confirms only ADMIN users can delete products
     * - No error message exposed (security best practice)
     */
    @Test
    void testDeleteProductAsRegularUser() throws Exception {
        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "regularUser",
                "password",
                AuthorityUtils.createAuthorityList("ROLE_USER")
            )
        );
        SecurityContextHolder.setContext(securityContext);

        mockMvc.perform(delete("/api/products/1"))
            .andExpect(status().isForbidden()) // 403 Forbidden expected
            .andExpect(jsonPath("$.error").doesNotExist()); // No specific error message in response
    }
}
