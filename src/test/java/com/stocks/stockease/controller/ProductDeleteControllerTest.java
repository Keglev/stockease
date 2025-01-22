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
 * Test class for product deletion functionality in {@link ProductController}.
 * This class verifies various scenarios for deleting products, including valid,
 * invalid, and unauthorized requests.
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
     * Sets up mocks before each test.
     */
    @BeforeEach
    void setUpMocks() {
        Mockito.when(productRepository.existsById(1L)).thenReturn(true);
    }

    /**
     * Tests successful deletion of a product by an admin user.
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
     * Tests deletion of a nonexistent product.
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
     * Tests unauthorized product deletion by a regular user.
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
